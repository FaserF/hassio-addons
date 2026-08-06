import {
  loadModerationStore,
  getGroupModerationConfig,
  saveModerationStore,
  clearModerationStoreCache,
} from './store.js';
import { processAiModeration } from './ai.js';
import { reply } from '../actions.js';
import { logger } from '../../logger.js';
import {
  resolveCanonicalUserKey,
  resolveUserDisplayName,
  normalizeJid,
  isAdmin,
} from '../../utils/security.js';

// In-memory sliding window trackers
const userFloodMap = new Map(); // key: groupId:userId -> array of timestamps
const groupJoinMap = new Map(); // key: groupId -> array of timestamps
const pendingCaptchas = new Map(); // key: groupId:userId -> { answer, mode, timeoutHandle, timestamp }

function getWindowKey(groupId, userId) {
  return `${groupId}:${userId}`;
}

export function isSelfParticipant(participantJid, session) {
  if (!participantJid || !session?.sock?.user) return false;
  const targetNorm = normalizeJid(participantJid);
  const targetUser = targetNorm.split('@')[0];
  const targetDigits = targetUser.replace(/\D/g, '');

  const myUser = session.sock.user;
  const myId = myUser.id ? normalizeJid(myUser.id) : '';
  const myLid = myUser.lid ? normalizeJid(myUser.lid) : '';

  if (targetNorm === myId || (myLid && targetNorm === myLid)) return true;
  if (myId && targetUser === myId.split('@')[0]) return true;
  if (myLid && targetUser === myLid.split('@')[0]) return true;

  if (session.stats?.my_number) {
    const myNumDigits = session.stats.my_number.replace(/\D/g, '');
    if (
      myNumDigits &&
      targetDigits &&
      (myNumDigits.endsWith(targetDigits) || targetDigits.endsWith(myNumDigits))
    ) {
      return true;
    }
  }
  return false;
}

export function generateBotWelcomeMessage(config, _store) {
  const isModEnabled = Boolean(config.enabled);
  const prefix = config.commands?.prefix || '!';

  return (
    `🤖 *Home Assistant WhatsApp Bot Connected!*\n\n` +
    `Hello everyone! 👋 I am the WhatsApp Gateway & Group Moderation Bot for Home Assistant.\n\n` +
    `ℹ️ *About Me:*\n` +
    `I connect your WhatsApp group to Home Assistant automations, while protecting this group with automated security & moderation tools.\n\n` +
    `🛡️ *Group Moderation Status:*\n` +
    `Moderation for this group is: *${isModEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}*\n\n` +
    `${
      isModEnabled
        ? `✅ *Active features in this group:*\n` +
          `• 📜 Rules enforcement & Auto-welcome\n` +
          `• 🛡️ Anti-Raid & Flood protection against spam bots\n` +
          `• 🔒 Content locks (Media, Links, Invites, RTL text)\n` +
          `• ⚠️ Warning system (\`${prefix}warn\`, \`${prefix}unwarn\`, \`${prefix}warns\`) & Penalties (Mute/Kick/Ban)\n` +
          `• 🚫 Local & Cross-Group Ban Federation (\`${prefix}ban\`, \`${prefix}unban\`)\n` +
          `• 🤖 Auto-responder filters & Custom commands (e.g. \`${prefix}wifi\`)\n` +
          `• 🧠 Gemini AI Assistant & Auto-Translation`
        : `💡 *Moderation is currently disabled for this group.*\n` +
          `Administrators can enable and configure moderation features anytime via the Web Dashboard or by turning on group moderation.`
    }\n\n` +
    `⚙️ *Useful Commands:*\n` +
    `• Type \`${prefix}help\` to see available group commands\n` +
    `• Type \`${prefix}rules\` to view group rules\n` +
    `• Type \`${prefix}admins\` to see group administrators\n` +
    `• Type \`${prefix}report <reason>\` to report bad behavior to group admins\n\n` +
    `📖 *Documentation & Setup:*\n` +
    `https://github.com/FaserF/ha-whatsapp`
  );
}

export async function sendMissingAdminWarning(
  session,
  groupId,
  attemptedAction = '',
  rawMsg = null
) {
  const text =
    `⚠️ *Bot Missing Admin Permissions!*\n\n` +
    `I attempted to execute an action requiring Admin rights (${attemptedAction || 'Moderation/Admin command'}), but I am currently NOT a group administrator.\n\n` +
    `👉 *How to Fix:*\n` +
    `1. Open the WhatsApp Group settings.\n` +
    `2. Go to *Group Info* -> *Group Members*.\n` +
    `3. Select the Bot account and tap *Make Group Admin* (Promote).\n\n` +
    `⛔ *Limitations without Admin Rights:*\n` +
    `• Cannot delete rule-violating or muted messages (` +
    '`!del` / `!mute` / content locks' +
    `)\n` +
    `• Cannot kick or ban members (` +
    '`!kick` / `!ban` / anti-raid / flood penalty' +
    `)\n` +
    `• Cannot promote or demote other users (` +
    '`!promote` / `!demote` / `!approve` / `!unapprove`' +
    `)\n` +
    `• Cannot change group settings or enforce lock restrictions`;

  try {
    await reply(session, groupId, { text }, rawMsg);
  } catch (err) {
    logger.error({ error: err.message }, 'Failed to send missing admin warning');
  }
}

export async function executePenalty(session, groupId, userId, action, reason = '', rawMsg = null) {
  logger.info(
    `🛡️ Executing moderation penalty [${action}] on ${userId} in ${groupId}. Reason: ${reason}`
  );

  try {
    if (action === 'delete') {
      // Deletion is handled per message key in message handler
      return;
    } else if (action === 'warn') {
      await issueUserWarning(
        session,
        groupId,
        userId,
        reason || 'Violation of group moderation rules',
        rawMsg
      );
    } else if (action === 'mute') {
      const store = loadModerationStore();
      const config = getGroupModerationConfig(groupId);
      config.muted_users = config.muted_users || {};
      config.muted_users[userId] = {
        until: null,
        reason: reason || 'Moderation penalty',
        created: Date.now(),
      };
      store.groups[groupId] = config;
      saveModerationStore(store);

      await reply(
        session,
        groupId,
        {
          text: `⚠️ @${userId} has been muted. Reason: ${reason || 'Moderation penalty'}`,
          mentions: [`${userId}@s.whatsapp.net`],
        },
        rawMsg
      );
    } else if (action === 'kick' || action === 'ban') {
      const canonicalKey = resolveCanonicalUserKey(userId, session);
      const cleanDigits = (canonicalKey || userId).replace(/\D/g, '');
      const userJid = cleanDigits
        ? `${cleanDigits}@s.whatsapp.net`
        : userId.includes('@')
          ? userId
          : `${userId}@s.whatsapp.net`;
      const targetDisplayId = cleanDigits || userId.split('@')[0];

      if (action === 'ban') {
        const store = loadModerationStore();
        const config = getGroupModerationConfig(groupId);
        config.banned_users = config.banned_users || {};
        config.banned_users[targetDisplayId] = {
          timestamp: Date.now(),
          reason: reason || 'Banned by group moderation',
        };
        store.groups[groupId] = config;
        saveModerationStore(store);

        // Send private chat notification with explanation before kicking
        try {
          await session.sock.sendMessage(userJid, {
            text: `🚫 *Banned from Group*\n\nYou have been permanently banned from the group \`${groupId.split('@')[0]}\`.\n\n*Reason:* ${reason || 'Violation of group rules'}\n\nIf you attempt to rejoin, you will be automatically removed.`,
          });
        } catch (dmErr) {
          logger.warn({ error: dmErr.message }, `Failed to send DM ban notification to ${userJid}`);
        }
      } else if (action === 'kick') {
        // Persist kick to kick_log for UI history
        const store = loadModerationStore();
        const config = getGroupModerationConfig(groupId);
        config.kick_log = Array.isArray(config.kick_log) ? config.kick_log : [];
        config.kick_log.unshift({
          userId: targetDisplayId,
          reason: reason || 'Admin kick',
          timestamp: Date.now(),
        });
        // Keep log to last 200 entries to avoid unbounded growth
        if (config.kick_log.length > 200) config.kick_log = config.kick_log.slice(0, 200);
        store.groups[groupId] = config;
        saveModerationStore(store);
      }

      try {
        const displayName = resolveUserDisplayName(userId, session);

        // Build array of candidate JIDs (phone JID and LID JID) to ensure WhatsApp multi-device accepts removal
        const candidateJids = [userJid];
        if (userId.includes('@lid') && !candidateJids.includes(userId)) {
          candidateJids.push(userId);
        } else if (userId.includes('@s.whatsapp.net') && !candidateJids.includes(userId)) {
          candidateJids.push(userId);
        }

        let lastErr = null;
        let success = false;
        for (const targetJid of candidateJids) {
          try {
            await session.sock.groupParticipantsUpdate(groupId, [targetJid], 'remove');
            success = true;
            break;
          } catch (kickAttemptErr) {
            lastErr = kickAttemptErr;
          }
        }
        if (!success && lastErr) throw lastErr;
        await reply(
          session,
          groupId,
          {
            text: `🚫 ${displayName} was ${action === 'ban' ? 'banned' : 'kicked'} from the group.`,
            mentions: [userJid],
          },
          rawMsg
        );
      } catch (e) {
        const errMsg = (e.message || '').toLowerCase();
        const displayName = resolveUserDisplayName(userId, session);
        logger.warn({ error: e.message, action, userJid, groupId }, `Failed to ${action} user`);

        if (
          errMsg.includes('not-authorized') ||
          errMsg.includes('forbidden') ||
          errMsg.includes('not authorized') ||
          errMsg.includes('403') ||
          errMsg.includes('permission')
        ) {
          // Bot is not an admin in this group
          await sendMissingAdminWarning(session, groupId, `Execute action: ${action}`, rawMsg);
        } else if (
          errMsg.includes('not-participant') ||
          errMsg.includes('not in group') ||
          errMsg.includes('participant') ||
          errMsg.includes('404')
        ) {
          // Target user is no longer in the group
          await reply(
            session,
            groupId,
            {
              text: `ℹ️ ${displayName} is no longer a member of this group.`,
              mentions: [userJid],
            },
            rawMsg
          );
        } else if (
          errMsg.includes('internal-server-error') ||
          errMsg.includes('500') ||
          errMsg.includes('admin') ||
          errMsg.includes('owner')
        ) {
          // Internal Server Error usually means WhatsApp rejected removing an admin/owner or LID format mismatch
          await reply(
            session,
            groupId,
            {
              text: `⚠️ Cannot ${action} ${displayName}.\n\n*Reason:* WhatsApp server rejected the request. This occurs if the target user is a Group Admin/Owner or if the user account is protected by WhatsApp privacy rules.`,
              mentions: [userJid],
            },
            rawMsg
          );
        } else if (
          errMsg.includes('rate-limit') ||
          errMsg.includes('429') ||
          errMsg.includes('too many')
        ) {
          await reply(
            session,
            groupId,
            {
              text: `⏳ Action ${action} for ${displayName} failed due to WhatsApp rate limiting. Please try again in a few moments.`,
              mentions: [userJid],
            },
            rawMsg
          );
        } else {
          // General clean error notice
          await reply(
            session,
            groupId,
            {
              text: `❌ Could not ${action} ${displayName}.\n\n*Reason:* ${e.message || 'Unknown WhatsApp protocol error'}`,
              mentions: [userJid],
            },
            rawMsg
          );
        }
      }
    }
  } catch (err) {
    logger.error({ error: err.message }, `Error executing penalty ${action}`);
  }
}

export async function issueUserWarning(session, groupId, rawUserId, reason, rawMsg = null) {
  const store = loadModerationStore();
  const config = getGroupModerationConfig(groupId);
  const warnConfig = config.warnings || { max_warnings: 3, action: 'mute' };

  // Resolve canonical PN key to unify LIDs and phone numbers into a single record
  const canonicalKey = resolveCanonicalUserKey(rawUserId, session);
  const userKey = canonicalKey || (rawUserId || '').replace(/\D/g, '') || rawUserId;
  const userDisplay = resolveUserDisplayName(userKey, session);

  if (!config.warnings.user_warns) {
    config.warnings.user_warns = {};
  }

  // Merge any existing warning entries under LID or legacy format keys into canonical userKey
  for (const existingKey of Object.keys(config.warnings.user_warns)) {
    const existingCanonical = resolveCanonicalUserKey(existingKey, session);
    if (
      existingKey !== userKey &&
      (existingCanonical === userKey || existingKey.replace(/\D/g, '') === userKey)
    ) {
      const legacyWarns = config.warnings.user_warns[existingKey] || [];
      delete config.warnings.user_warns[existingKey];
      if (!config.warnings.user_warns[userKey]) config.warnings.user_warns[userKey] = [];
      config.warnings.user_warns[userKey].push(...legacyWarns);
    }
  }

  if (!config.warnings.user_warns[userKey]) {
    config.warnings.user_warns[userKey] = [];
  }

  const now = Date.now();

  // Warning decay: prune warnings older than decay_hours
  const decayHours = warnConfig.decay_hours || 0;
  if (decayHours > 0) {
    const decayMs = decayHours * 3600 * 1000;
    config.warnings.user_warns[userKey] = config.warnings.user_warns[userKey].filter(
      (w) => now - w.timestamp < decayMs
    );
  }

  config.warnings.user_warns[userKey].push({ reason, timestamp: now });
  store.groups[groupId] = config;
  saveModerationStore(store);

  const warnCount = config.warnings.user_warns[userKey].length;
  const maxWarns = warnConfig.max_warnings || 3;

  if (warnCount >= maxWarns) {
    const penaltyAction = warnConfig.action || 'mute';
    await reply(
      session,
      groupId,
      {
        text:
          `⚠️ *Warning Issued to ${userDisplay}* (${warnCount}/${maxWarns})\n` +
          `Reason: ${reason}\n\n` +
          `🚨 *Maximum warnings (${maxWarns}) reached! Executing penalty: ${penaltyAction.toUpperCase()}*`,
        mentions: [`${userKey}@s.whatsapp.net`],
      },
      rawMsg
    );

    await executePenalty(
      session,
      groupId,
      userKey,
      penaltyAction,
      `Exceeded max warnings (${maxWarns})`,
      rawMsg
    );
  } else {
    await reply(
      session,
      groupId,
      {
        text: `⚠️ *Warning Issued to ${userDisplay}* (${warnCount}/${maxWarns})\nReason: ${reason}`,
        mentions: [`${userKey}@s.whatsapp.net`],
      },
      rawMsg
    );
  }
}

export function clearUserWarnings(groupId, rawUserId, session = null) {
  const store = loadModerationStore();
  const config = getGroupModerationConfig(groupId);
  const canonicalKey = resolveCanonicalUserKey(rawUserId, session);
  const cleanId = canonicalKey || (rawUserId || '').replace(/\D/g, '');
  let cleared = false;

  if (config.warnings?.user_warns) {
    for (const key of Object.keys(config.warnings.user_warns)) {
      const keyCanonical = resolveCanonicalUserKey(key, session);
      if (
        key === rawUserId ||
        key === cleanId ||
        keyCanonical === cleanId ||
        key.replace(/\D/g, '') === cleanId
      ) {
        delete config.warnings.user_warns[key];
        cleared = true;
      }
    }
    if (cleared) {
      store.groups[groupId] = config;
      saveModerationStore(store);
    }
  }
  return cleared;
}

export async function handleModerationMessage(session, event) {
  const store = loadModerationStore();
  if (!store.global_enabled) return false;

  // Never moderate or auto-respond to outgoing bot messages (prevents self-loop)
  if (event.raw?.key?.fromMe) return false;

  const groupId = event.sender;
  if (!groupId || !groupId.endsWith('@g.us')) return false;

  const config = getGroupModerationConfig(groupId);
  if (!config.enabled) return false;

  const userId = event.sender_number;
  const text = (event.content || '').trim();
  const rawMsg = event.raw;

  if (config.approved && config.approved.includes(userId)) {
    return false; // User is whitelisted, skip moderation
  }

  // 0. Muted Users check — delete messages from muted users
  if (config.muted_users && config.muted_users[userId]) {
    const muteEntry = config.muted_users[userId];
    if (!muteEntry.until || muteEntry.until > Date.now()) {
      // User is muted, delete their message
      if (rawMsg?.key?.id) {
        try {
          await session.sock.sendMessage(groupId, { delete: rawMsg.key });
        } catch (e) {
          /* ignore delete failure */
        }
      }
      return true; // silently consumed
    } else {
      // Mute has expired, clean up
      delete config.muted_users[userId];
      store.groups[groupId] = config;
      saveModerationStore(store);
    }
  }

  // 1. Global Ban Federation check & Shared Blacklist
  if (config.federation_id) {
    const fed = store.federations.find((f) => f.id === config.federation_id);
    if (fed) {
      if (Array.isArray(fed.banned_users) && fed.banned_users.includes(userId)) {
        await executePenalty(
          session,
          groupId,
          userId,
          'ban',
          'Banned in Global Security Federation',
          rawMsg
        );
        return true;
      }
      if (fed.shared_blacklist_enabled !== false && Array.isArray(fed.shared_blacklist)) {
        const lowerText = text.toLowerCase();
        for (const pat of fed.shared_blacklist) {
          if (pat && lowerText.includes(pat.toLowerCase())) {
            await executePenalty(
              session,
              groupId,
              userId,
              'delete',
              `Prohibited link/pattern from Global Federation (${pat})`,
              rawMsg
            );
            return true;
          }
        }
      }
    }
  }

  // 2. Pending Captcha verification check
  const captchaKey = getWindowKey(groupId, userId);
  if (pendingCaptchas.has(captchaKey)) {
    const captchaObj = pendingCaptchas.get(captchaKey);
    if (text === captchaObj.answer) {
      clearTimeout(captchaObj.timeoutHandle);
      pendingCaptchas.delete(captchaKey);
      await reply(
        session,
        groupId,
        {
          text: `✅ Captcha verified! Welcome @${userId}.`,
          mentions: [`${userId}@s.whatsapp.net`],
        },
        rawMsg
      );
      return true;
    }
  }

  // 3. Content Locks check
  const locks = config.locks || {};

  // Helper for lock penalty
  const triggerLock = async (lockKey, lockTitle) => {
    const lock = locks[lockKey];
    if (lock && lock.enabled) {
      if (rawMsg?.key?.id) {
        try {
          await session.sock.sendMessage(groupId, { delete: rawMsg.key });
        } catch (e) {
          /* ignore delete failure */
        }
      }
      await reply(
        session,
        groupId,
        {
          text: `🔒 Message deleted: ${lockTitle} are locked in this group.`,
        },
        rawMsg
      );
      if (lock.action && lock.action !== 'delete') {
        await executePenalty(session, groupId, userId, lock.action, `${lockTitle} locked`, rawMsg);
      }
      return true;
    }
    return false;
  };

  if (event.media_type === 'image' && (await triggerLock('image', 'Images'))) return true;
  if (event.media_type === 'video' && (await triggerLock('video', 'Videos'))) return true;
  if (event.media_type === 'audio' && (await triggerLock('audio', 'Voice/Audio'))) return true;
  if (event.media_type === 'document' && (await triggerLock('document', 'Documents'))) return true;
  if (event.media_type === 'sticker' && (await triggerLock('sticker', 'Stickers'))) return true;

  if (
    locks.url?.enabled &&
    /(https?:\/\/|www\.|[a-zA-Z0-9-]+\.(com|de|net|org|io|me|co|app|xyz))/i.test(text)
  ) {
    if (await triggerLock('url', 'Links / URLs')) return true;
  }
  if (locks.invite?.enabled && /(https?:\/\/)?(chat\.whatsapp\.com\/|wa\.me\/)/i.test(text)) {
    if (await triggerLock('invite', 'Group Invite Links')) return true;
  }
  if (
    locks.poll?.enabled &&
    (event.type === 'poll_update' || event.type === 'poll' || event.media_type === 'poll')
  ) {
    if (await triggerLock('poll', 'Polls')) return true;
  }

  // Right-to-Left text check (RTL lock)
  if (locks.rtl?.enabled && /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text)) {
    if (await triggerLock('rtl', 'RTL text')) return true;
  }

  // Contact lock check
  if (event.media_type === 'contact' && (await triggerLock('contact', 'Contacts'))) return true;

  // Location lock check
  if (event.media_type === 'location' && (await triggerLock('location', 'Locations'))) return true;

  // Forwarded message lock check
  if (
    event.is_forwarded ||
    Boolean(rawMsg?.message?.[Object.keys(rawMsg?.message || {})[0]]?.contextInfo?.isForwarded)
  ) {
    if (await triggerLock('forwarded', 'Forwarded messages')) return true;
  }

  // 4. Blacklist / Prohibited Words check
  if (config.blacklist?.enabled && Array.isArray(config.blacklist.words)) {
    const lowerText = text.toLowerCase();
    for (const word of config.blacklist.words) {
      if (!word) continue;
      const lowerWord = word.toLowerCase();
      let matched = false;
      if (lowerWord.startsWith('/') && lowerWord.endsWith('/')) {
        try {
          const regex = new RegExp(lowerWord.slice(1, -1), 'i');
          matched = regex.test(text);
        } catch (e) {
          /* invalid regex */
        }
      } else if (lowerWord.includes('*')) {
        const pattern = lowerWord.replace(/\*/g, '.*');
        matched = new RegExp(`^${pattern}$`, 'i').test(lowerText);
      } else {
        matched = lowerText.includes(lowerWord);
      }

      if (matched) {
        if (rawMsg?.key?.id) {
          try {
            await session.sock.sendMessage(groupId, { delete: rawMsg.key });
          } catch (e) {}
        }
        const blAction = config.blacklist.action || 'delete';
        await reply(
          session,
          groupId,
          {
            text: `🚫 Message deleted: Blacklisted word detected.`,
          },
          rawMsg
        );
        if (blAction !== 'delete') {
          await executePenalty(
            session,
            groupId,
            userId,
            blAction,
            `Blacklist match: "${word}"`,
            rawMsg
          );
        }
        return true;
      }
    }
  }

  // 5. Flood Protection check
  const floodConfig = config.antispam?.flood_protection;
  if (floodConfig?.enabled) {
    const key = getWindowKey(groupId, userId);
    const now = Date.now();
    const windowMs = (floodConfig.window_seconds || 5) * 1000;
    const timestamps = (userFloodMap.get(key) || []).filter((t) => now - t < windowMs);
    timestamps.push(now);
    userFloodMap.set(key, timestamps);

    if (timestamps.length > (floodConfig.max_messages || 5)) {
      await executePenalty(
        session,
        groupId,
        userId,
        floodConfig.action || 'mute',
        'Message flood rate exceeded',
        rawMsg
      );
      userFloodMap.set(key, []);
      return true;
    }
  }

  // 6. Custom Filters & Notes matching
  if (text) {
    // Check Filters
    if (Array.isArray(config.filters)) {
      for (const filter of config.filters) {
        if (!filter.trigger) continue;
        let isMatch = false;
        if (filter.is_regex) {
          try {
            isMatch = new RegExp(filter.trigger, 'i').test(text);
          } catch (e) {}
        } else {
          isMatch =
            text.toLowerCase() === filter.trigger.toLowerCase() ||
            text.toLowerCase().includes(filter.trigger.toLowerCase());
        }

        if (isMatch) {
          await reply(session, groupId, { text: filter.response }, rawMsg);
          // Execute filter action if defined (warn, kick, ban, mute)
          if (filter.action && filter.action !== 'reply') {
            if (rawMsg?.key?.id) {
              try {
                await session.sock.sendMessage(groupId, { delete: rawMsg.key });
              } catch (e) {
                /* ignore */
              }
            }
            if (filter.action !== 'delete') {
              await executePenalty(
                session,
                groupId,
                userId,
                filter.action,
                `Filter match: "${filter.trigger}"`,
                rawMsg
              );
            }
          }
          return true;
        }
      }
    }

    // Check Notes (trigger via #notename or !notename or exact name)
    if (config.notes && typeof config.notes === 'object') {
      const cleanText = text.replace(/^[#!]/, '').trim().toLowerCase();
      if (config.notes[cleanText]) {
        await reply(session, groupId, { text: config.notes[cleanText] }, rawMsg);
        return true;
      }
    }

    // Check Rules trigger
    if (text.toLowerCase() === '!rules' || text.toLowerCase() === '#rules') {
      const rulesText = config.rules?.text || 'No rules configured for this group.';
      await reply(session, groupId, { text: `📜 *Group Rules:*\n\n${rulesText}` }, rawMsg);
      return true;
    }
  }

  // 7. Gemini AI Context & FAQ Engine
  if (config.ai?.enabled && config.ai?.faq_auto_reply && text) {
    const aiReply = await processAiModeration(text, config.ai, store.gemini_api_key);
    if (aiReply) {
      await reply(session, groupId, { text: `🤖 *AI Assistant:*\n${aiReply}` }, rawMsg);
      return true;
    }
  }

  // 8. Sentiment Moderation via AI
  if (config.ai?.enabled && config.ai?.sentiment_moderation && text && text.length > 10) {
    const apiKey = store.gemini_api_key || process.env.GEMINI_API_KEY;
    if (apiKey) {
      const sentimentConfig = {
        system_prompt:
          'You are a toxicity detector. Analyze the message and reply ONLY with "TOXIC" if it is hateful, threatening, harassing, or extremely offensive. Reply "SAFE" otherwise. No other text.',
        faq_auto_reply: true,
      };
      const result = await processAiModeration(text, sentimentConfig, apiKey);
      if (result && result.trim().toUpperCase().includes('TOXIC')) {
        if (rawMsg?.key?.id) {
          try {
            await session.sock.sendMessage(groupId, { delete: rawMsg.key });
          } catch (e) {
            /* ignore */
          }
        }
        await reply(
          session,
          groupId,
          {
            text: `🛡️ Message removed: Detected as potentially harmful content.`,
          },
          rawMsg
        );
        await issueUserWarning(session, groupId, userId, 'AI detected toxic content', rawMsg);
        return true;
      }
    }
  }

  return false;
}

export function formatMessageTemplate(
  template,
  { userId, participantJid, groupId, groupMeta, config, session } = {}
) {
  if (!template) return '';
  const now = new Date();
  const dateStr = now.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const groupTitle = groupMeta?.subject || (groupId ? groupId.split('@')[0] : '');
  const memberCount = groupMeta?.participants?.length
    ? String(groupMeta.participants.length)
    : 'N/A';
  const pushname =
    (participantJid && session?.sock?.contacts?.[participantJid]?.notify) ||
    (participantJid && session?.sock?.contacts?.[participantJid]?.name) ||
    userId ||
    '';

  return template
    .replace(/{mention}/g, userId ? `@${userId}` : '')
    .replace(/{user}/g, userId ? `@${userId}` : '')
    .replace(/{name}/g, userId || '')
    .replace(/{pushname}/g, pushname)
    .replace(/{group}/g, groupTitle)
    .replace(/{subject}/g, groupTitle)
    .replace(/{title}/g, groupTitle)
    .replace(/{count}/g, memberCount)
    .replace(/{members}/g, memberCount)
    .replace(/{rules}/g, config?.rules?.text || 'Be respectful')
    .replace(/{date}/g, dateStr)
    .replace(/{time}/g, timeStr);
}

export async function handleModerationParticipantUpdate(session, update) {
  const groupId = update.id;
  if (!groupId || !groupId.endsWith('@g.us')) return;

  // Force a fresh disk-read for every join/leave event so stale in-memory
  // cache can never suppress greeting/captcha messages.
  clearModerationStoreCache();
  const store = loadModerationStore();
  if (!store.global_enabled) {
    logger.debug({ groupId }, '🔇 Participant update: global moderation disabled, skipping');
    return;
  }

  // No triggering message for join/leave events — quoting disabled for these
  const rawMsg = null;
  const action = update.action;
  const participants = update.participants || [];

  const config = getGroupModerationConfig(groupId);
  // Note: We intentionally do NOT gate on config.enabled here.
  // Greetings, captcha, and ban enforcement are per-feature flags
  // and should work regardless of whether the full moderation engine is enabled.
  logger.info(
    {
      groupId,
      action,
      participantsCount: participants.length,
      greetings: config.greetings,
      rulesShowOnJoin: config.rules?.show_on_join,
    },
    '👥 Participant update — loaded config'
  );

  if (action === 'add' || action === 'invite' || action === 'join') {
    // 1. Anti-Raid velocity check
    const antiRaid = config.antispam?.anti_raid;
    if (antiRaid?.enabled) {
      const now = Date.now();
      const windowMs = (antiRaid.window_seconds || 10) * 1000;
      const joins = (groupJoinMap.get(groupId) || []).filter((t) => now - t < windowMs);

      for (let i = 0; i < participants.length; i++) joins.push(now);
      groupJoinMap.set(groupId, joins);

      if (joins.length >= (antiRaid.max_joins || 5)) {
        logger.warn(`🛡️ Anti-Raid triggered for group ${groupId}! ${joins.length} joins detected.`);
        await reply(
          session,
          groupId,
          {
            text: `🚨 *ANTI-RAID SHIELD ACTIVATED!* High-velocity join detection triggered.`,
          },
          rawMsg
        );
        // Lockdown group send permissions via Baileys if possible
        try {
          await session.sock.groupSettingUpdate(groupId, 'announcement');
        } catch (e) {
          logger.warn({ error: e.message }, 'Failed to set group announcement mode on anti-raid');
        }
      }
    }

    // 2. Check participants against Group Ban & Global Ban Federation & Greetings
    for (const participantJid of participants) {
      // If the bot itself joined the group, post the Bot Welcome & Capability message
      if (isSelfParticipant(participantJid, session)) {
        const botWelcomeText = generateBotWelcomeMessage(config, store);
        await reply(session, groupId, { text: botWelcomeText }, rawMsg);
        continue;
      }

      const userId = participantJid.split('@')[0];
      const cleanDigits = userId.replace(/\D/g, '');

      // Local Group Ban Check
      const bannedUsersMap = config.banned_users || {};
      const banInfo = bannedUsersMap[userId] || (cleanDigits ? bannedUsersMap[cleanDigits] : null);

      if (banInfo) {
        // User was banned from this group -> notify via private DM and auto-kick
        try {
          await session.sock.sendMessage(participantJid, {
            text: `🚫 *Group Ban Enforced*\n\nYou attempted to join \`${groupId.split('@')[0]}\`, but you are banned from this group.\n\n*Reason:* ${banInfo.reason || 'Banned by group moderation'}\n\nYou have been automatically removed.`,
          });
        } catch (dmErr) {
          logger.warn({ error: dmErr.message }, `Failed to send join ban DM to ${participantJid}`);
        }

        try {
          await session.sock.groupParticipantsUpdate(groupId, [participantJid], 'remove');
          await reply(
            session,
            groupId,
            {
              text: `🚫 Banned user @${cleanDigits || userId} attempted to join and was automatically removed.`,
              mentions: [participantJid],
            },
            rawMsg
          );
        } catch (kickErr) {
          logger.warn(
            { error: kickErr.message },
            `Failed to auto-remove banned user ${participantJid}`
          );
        }
        continue;
      }

      // Global Ban Federation check
      if (config.federation_id) {
        const fed = store.federations.find((f) => f.id === config.federation_id);
        if (
          fed &&
          (fed.banned_users.includes(userId) ||
            (cleanDigits && fed.banned_users.includes(cleanDigits)))
        ) {
          await executePenalty(
            session,
            groupId,
            userId,
            'ban',
            'Banned in Global Ban Federation',
            rawMsg
          );
          continue;
        }
      }

      // Build consolidated Welcome + Rules + Captcha message (Single message to reduce spam)
      const isWelcomeEnabled = Boolean(config.greetings?.welcome_enabled);
      const isRulesOnJoin = Boolean(config.rules?.show_on_join && config.rules?.text);
      const isCaptchaEnabled = Boolean(config.greetings?.captcha_enabled);

      if (isWelcomeEnabled || isRulesOnJoin || isCaptchaEnabled) {
        let groupMeta = null;
        if (session?.sock?.groupMetadata) {
          try {
            groupMeta = await session.sock.groupMetadata(groupId);
          } catch (e) {
            logger.debug({ error: e.message, groupId }, 'Failed to fetch group metadata');
          }
        }

        const messageParts = [];

        // 1. Welcome Message Header
        if (isWelcomeEnabled) {
          let welcomeMsg =
            config.greetings.welcome_text ||
            config.greetings.welcome_message ||
            'Welcome {mention} to {group}!';
          welcomeMsg = formatMessageTemplate(welcomeMsg, {
            userId,
            participantJid,
            groupId,
            groupMeta,
            config,
            session,
          });
          messageParts.push(welcomeMsg);
        } else if (isRulesOnJoin || isCaptchaEnabled) {
          messageParts.push(`👋 Welcome @${userId}!`);
        }

        // 2. Inline Group Rules (Appended if show_on_join is active)
        if (isRulesOnJoin) {
          messageParts.push(`📜 *Group Rules:*\n${config.rules.text}`);
        }

        // 3. Inline Captcha Challenge
        if (isCaptchaEnabled) {
          const mode = config.greetings.captcha_mode || 'button';
          let answer = 'pass';
          let captchaSection = `🤖 *Captcha Verification*\nType *pass* to verify.`;

          if (mode === 'math') {
            const num1 = Math.floor(Math.random() * 9) + 1;
            const num2 = Math.floor(Math.random() * 9) + 1;
            answer = String(num1 + num2);
            captchaSection = `🤖 *Captcha Verification*\nSolve math problem: ${num1} + ${num2} = ?`;
          }

          messageParts.push(captchaSection);

          const captchaKey = getWindowKey(groupId, userId);
          const timeoutSec = config.greetings.captcha_timeout_seconds || 120;
          const mentionJid = normalizeJid(participantJid).replace(/@lid$/, '@s.whatsapp.net');

          const timeoutHandle = setTimeout(async () => {
            if (pendingCaptchas.has(captchaKey)) {
              pendingCaptchas.delete(captchaKey);

              // Check if user is an Admin — Admins are exempt from Captcha kick timeout!
              let userIsAdmin = isAdmin(participantJid, session);

              // Live check against Baileys group metadata if available
              if (!userIsAdmin && session?.sock?.groupMetadata) {
                try {
                  const meta = await session.sock.groupMetadata(groupId);
                  const p = meta?.participants?.find((part) => {
                    const pid = part.id ? part.id.split('@')[0].replace(/\D/g, '') : '';
                    const tid = participantJid.split('@')[0].replace(/\D/g, '');
                    return pid === tid || part.id === participantJid;
                  });
                  if (p && (p.admin === 'admin' || p.admin === 'superadmin')) {
                    userIsAdmin = true;
                  }
                } catch (metaErr) {
                  logger.debug({ error: metaErr.message }, 'Failed to fetch live group metadata for captcha admin check');
                }
              }

              if (userIsAdmin) {
                logger.info(
                  { groupId, userId },
                  '🛡️ User is an admin, skipping Captcha timeout kick'
                );
                return;
              }

              const userLabel = resolveUserDisplayName(userId, session);
              await reply(
                session,
                groupId,
                {
                  text: `⏳ Captcha verification timed out for ${userLabel}. Executing removal.`,
                  mentions: [mentionJid],
                },
                rawMsg
              );
              await executePenalty(
                session,
                groupId,
                userId,
                'kick',
                'Captcha verification timeout',
                rawMsg
              );
            }
          }, timeoutSec * 1000);

          pendingCaptchas.set(captchaKey, { answer, mode, timeoutHandle, timestamp: Date.now() });
        }

        const fullText = messageParts.join('\n\n');
        const mentionJid = normalizeJid(participantJid).replace(/@lid$/, '@s.whatsapp.net');

        const sendResult = await reply(
          session,
          groupId,
          {
            text: fullText,
            mentions: [mentionJid],
          },
          rawMsg
        );

        // If sending the welcome/captcha message failed, cancel the captcha timeout
        // so no timeout kick is executed for a challenge the user never saw!
        if (!sendResult && isCaptchaEnabled) {
          const captchaKey = getWindowKey(groupId, userId);
          const pending = pendingCaptchas.get(captchaKey);
          if (pending?.timeoutHandle) {
            clearTimeout(pending.timeoutHandle);
          }
          pendingCaptchas.delete(captchaKey);
          logger.warn(
            { groupId, userId },
            '⚠️ Cancelled captcha timeout kick because welcome/captcha message failed to send.'
          );
        }
      }
    }
  } else if (action === 'remove' || action === 'leave') {
    // Goodbye message
    if (config.greetings?.goodbye_enabled) {
      logger.info({ groupId, action }, '👋 Sending goodbye message');
      let groupMeta = null;
      if (session?.sock?.groupMetadata) {
        try {
          groupMeta = await session.sock.groupMetadata(groupId);
        } catch (e) {
          logger.debug(
            { error: e.message, groupId },
            'Failed to fetch group metadata for goodbye greeting'
          );
        }
      }

      for (const participantJid of participants) {
        const userId = participantJid.split('@')[0];
        let goodbyeMsg =
          config.greetings.goodbye_text || config.greetings.goodbye_message || 'Goodbye {name}!';
        goodbyeMsg = formatMessageTemplate(goodbyeMsg, {
          userId,
          participantJid,
          groupId,
          groupMeta,
          config,
          session,
        });

        await reply(session, groupId, { text: goodbyeMsg }, rawMsg);
      }
    }
  }
}
