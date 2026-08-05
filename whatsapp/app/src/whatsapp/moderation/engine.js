import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from './store.js';
import { processAiModeration } from './ai.js';
import { reply } from '../actions.js';
import { logger } from '../../logger.js';

// In-memory sliding window trackers
const userFloodMap = new Map(); // key: groupId:userId -> array of timestamps
const groupJoinMap = new Map(); // key: groupId -> array of timestamps
const pendingCaptchas = new Map(); // key: groupId:userId -> { answer, mode, timeoutHandle, timestamp }

function getWindowKey(groupId, userId) {
  return `${groupId}:${userId}`;
}

export async function executePenalty(session, groupId, userId, action, reason = '') {
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
        reason || 'Violation of group moderation rules'
      );
    } else if (action === 'mute') {
      // Mute user or restrict group send permissions via Baileys if supported
      await reply(session, groupId, {
        text: `⚠️ @${userId} has been muted. Reason: ${reason || 'Moderation penalty'}`,
        mentions: [`${userId}@s.whatsapp.net`],
      });
    } else if (action === 'kick' || action === 'ban') {
      const userJid = userId.includes('@') ? userId : `${userId}@s.whatsapp.net`;
      try {
        await session.sock.groupParticipantsUpdate(groupId, [userJid], 'remove');
        await reply(session, groupId, {
          text: `🚫 User @${userId} was ${action === 'ban' ? 'banned' : 'kicked'} from group.`,
          mentions: [userJid],
        });
      } catch (e) {
        logger.warn({ error: e.message }, `Failed to ${action} user ${userId}`);
      }
    }
  } catch (err) {
    logger.error({ error: err.message }, `Error executing penalty ${action}`);
  }
}

export async function issueUserWarning(session, groupId, userId, reason) {
  const store = loadModerationStore();
  const config = getGroupModerationConfig(groupId);
  const warnConfig = config.warnings || { max_warnings: 3, action: 'mute' };

  if (!config.warnings.user_warns) {
    config.warnings.user_warns = {};
  }
  if (!config.warnings.user_warns[userId]) {
    config.warnings.user_warns[userId] = [];
  }

  const now = Date.now();

  // Warning decay: prune warnings older than decay_hours
  const decayHours = warnConfig.decay_hours || 0;
  if (decayHours > 0) {
    const decayMs = decayHours * 3600 * 1000;
    config.warnings.user_warns[userId] = config.warnings.user_warns[userId].filter(
      (w) => now - w.timestamp < decayMs
    );
  }

  config.warnings.user_warns[userId].push({ reason, timestamp: now });
  store.groups[groupId] = config;
  saveModerationStore(store);

  const warnCount = config.warnings.user_warns[userId].length;
  const maxWarns = warnConfig.max_warnings || 3;

  await reply(session, groupId, {
    text: `⚠️ *Warning Issued to @${userId}* (${warnCount}/${maxWarns})\nReason: ${reason}`,
    mentions: [`${userId}@s.whatsapp.net`],
  });

  if (warnCount >= maxWarns) {
    await reply(session, groupId, {
      text: `🚨 @${userId} reached maximum warnings (${maxWarns})! Executing penalty: *${warnConfig.action}*`,
      mentions: [`${userId}@s.whatsapp.net`],
    });
    await executePenalty(
      session,
      groupId,
      userId,
      warnConfig.action,
      `Exceeded max warnings (${maxWarns})`
    );
    // Reset warnings after penalty
    config.warnings.user_warns[userId] = [];
    store.groups[groupId] = config;
    saveModerationStore(store);
  }
}

export function clearUserWarnings(groupId, userId) {
  const store = loadModerationStore();
  const config = getGroupModerationConfig(groupId);
  if (config.warnings?.user_warns?.[userId]) {
    config.warnings.user_warns[userId] = [];
    store.groups[groupId] = config;
    saveModerationStore(store);
    return true;
  }
  return false;
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
          'Banned in Global Security Federation'
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
              `Prohibited link/pattern from Global Federation (${pat})`
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
      await reply(session, groupId, {
        text: `✅ Captcha verified! Welcome @${userId}.`,
        mentions: [`${userId}@s.whatsapp.net`],
      });
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
      await reply(session, groupId, {
        text: `🔒 Message deleted: ${lockTitle} are locked in this group.`,
      });
      if (lock.action && lock.action !== 'delete') {
        await executePenalty(session, groupId, userId, lock.action, `${lockTitle} locked`);
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
    (text.includes('http://') || text.includes('https://') || text.includes('www.'))
  ) {
    if (await triggerLock('url', 'Links / URLs')) return true;
  }
  if (locks.invite?.enabled && text.includes('chat.whatsapp.com/')) {
    if (await triggerLock('invite', 'Group Invite Links')) return true;
  }
  if (locks.poll?.enabled && (event.type === 'poll_update' || event.type === 'poll' || event.media_type === 'poll')) {
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
    rawMsg?.message?.extendedTextMessage?.contextInfo?.isForwarded ||
    rawMsg?.message?.imageMessage?.contextInfo?.isForwarded ||
    rawMsg?.message?.videoMessage?.contextInfo?.isForwarded ||
    rawMsg?.message?.documentMessage?.contextInfo?.isForwarded
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
        await reply(session, groupId, {
          text: `🚫 Message deleted: Blacklisted word detected.`,
        });
        if (blAction !== 'delete') {
          await executePenalty(session, groupId, userId, blAction, `Blacklist match: "${word}"`);
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
        'Message flood rate exceeded'
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
          await reply(session, groupId, { text: filter.response });
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
                `Filter match: "${filter.trigger}"`
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
        await reply(session, groupId, { text: config.notes[cleanText] });
        return true;
      }
    }

    // Check Rules trigger
    if (text.toLowerCase() === '!rules' || text.toLowerCase() === '#rules') {
      const rulesText = config.rules?.text || 'No rules configured for this group.';
      await reply(session, groupId, { text: `📜 *Group Rules:*\n\n${rulesText}` });
      return true;
    }
  }

  // 7. Gemini AI Context & FAQ Engine
  if (config.ai?.enabled && config.ai?.faq_auto_reply && text) {
    const aiReply = await processAiModeration(text, config.ai, store.gemini_api_key);
    if (aiReply) {
      await reply(session, groupId, { text: `🤖 *AI Assistant:*\n${aiReply}` });
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
        await reply(session, groupId, {
          text: `🛡️ Message removed: Detected as potentially harmful content.`,
        });
        await issueUserWarning(session, groupId, userId, 'AI detected toxic content');
        return true;
      }
    }
  }

  return false;
}

export async function handleModerationParticipantUpdate(session, update) {
  const store = loadModerationStore();
  if (!store.global_enabled) return;

  const groupId = update.id;
  if (!groupId || !groupId.endsWith('@g.us')) return;

  const config = getGroupModerationConfig(groupId);
  if (!config.enabled) return;

  const action = update.action;
  const participants = update.participants || [];

  if (action === 'add') {
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
        await reply(session, groupId, {
          text: `🚨 *ANTI-RAID SHIELD ACTIVATED!* High-velocity join detection triggered.`,
        });
        // Lockdown group send permissions via Baileys if possible
        try {
          await session.sock.groupSettingUpdate(groupId, 'announcement');
        } catch (e) {
          logger.warn({ error: e.message }, 'Failed to set group announcement mode on anti-raid');
        }
      }
    }

    // 2. Check participants against Global Ban Federation & Greetings
    for (const participantJid of participants) {
      const userId = participantJid.split('@')[0];

      // Global Ban Federation check
      if (config.federation_id) {
        const fed = store.federations.find((f) => f.id === config.federation_id);
        if (fed && fed.banned_users.includes(userId)) {
          await executePenalty(session, groupId, userId, 'ban', 'Banned in Global Ban Federation');
          continue;
        }
      }

      // Greetings & Welcome message
      if (config.greetings?.welcome_enabled) {
        let welcomeMsg =
          config.greetings.welcome_text ||
          config.greetings.welcome_message ||
          'Welcome {mention} to {group}!';
        welcomeMsg = welcomeMsg
          .replace(/{mention}/g, `@${userId}`)
          .replace(/{name}/g, userId)
          .replace(/{user}/g, `@${userId}`)
          .replace(/{group}/g, groupId.split('@')[0])
          .replace(/{rules}/g, config.rules?.text || 'Be respectful');

        await reply(session, groupId, {
          text: welcomeMsg,
          mentions: [participantJid],
        });
      }

      // Show rules on join if enabled
      if (config.rules?.show_on_join && config.rules?.text) {
        await reply(session, groupId, {
          text: `📜 *Group Rules:*\n${config.rules.text}`,
        });
      }

      // Captcha Challenge
      if (config.greetings?.captcha_enabled) {
        const mode = config.greetings.captcha_mode || 'button';
        let answer = 'pass';
        let challengeText = `🤖 *Captcha Verification for @${userId}*\nType *pass* to verify.`;

        if (mode === 'math') {
          const num1 = Math.floor(Math.random() * 9) + 1;
          const num2 = Math.floor(Math.random() * 9) + 1;
          answer = String(num1 + num2);
          challengeText = `🤖 *Captcha Verification for @${userId}*\nSolve math problem: ${num1} + ${num2} = ?`;
        }

        const captchaKey = getWindowKey(groupId, userId);
        const timeoutSec = config.greetings.captcha_timeout_seconds || 120;

        const timeoutHandle = setTimeout(async () => {
          if (pendingCaptchas.has(captchaKey)) {
            pendingCaptchas.delete(captchaKey);
            await reply(session, groupId, {
              text: `❌ Captcha timeout for @${userId}. Executing kick.`,
              mentions: [participantJid],
            });
            await executePenalty(session, groupId, userId, 'kick', 'Captcha verification timeout');
          }
        }, timeoutSec * 1000);

        pendingCaptchas.set(captchaKey, { answer, mode, timeoutHandle, timestamp: Date.now() });

        await reply(session, groupId, {
          text: challengeText,
          mentions: [participantJid],
        });
      }
    }
  } else if (action === 'remove') {
    // Goodbye message
    if (config.greetings?.goodbye_enabled) {
      for (const participantJid of participants) {
        const userId = participantJid.split('@')[0];
        let goodbyeMsg =
          config.greetings.goodbye_text || config.greetings.goodbye_message || 'Goodbye {name}!';
        goodbyeMsg = goodbyeMsg
          .replace(/{mention}/g, `@${userId}`)
          .replace(/{name}/g, userId)
          .replace(/{user}/g, `@${userId}`)
          .replace(/{group}/g, groupId.split('@')[0]);

        await reply(session, groupId, { text: goodbyeMsg });
      }
    }
  }
}
