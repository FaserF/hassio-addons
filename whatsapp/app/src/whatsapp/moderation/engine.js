import {
  loadModerationStore,
  getGroupModerationConfig,
  saveModerationStore,
  clearModerationStoreCache,
} from './store.js';
import { processAiModeration } from './ai.js';
import { translateTextFreeWithReason } from '../../utils/freeTranslator.js';
import { reply } from '../actions.js';
import { logger } from '../../logger.js';
import { t } from '../../locales/loader.js';
import {
  resolveCanonicalUserKey,
  resolveUserDisplayName,
  normalizeJid,
  isSameUser,
} from '../../utils/security.js';
import { checkSuspiciousName } from './securityScanner.js';

// In-memory sliding window trackers

/** Translate a bot-reply key using the group's configured language (fallback: 'en') */
export function gt(config, key, params = {}) {
  const lang = config?.language || 'en';
  return t(lang, key, params);
}

const userFloodMap = new Map(); // key: groupId:userId -> array of timestamps
const groupJoinMap = new Map(); // key: groupId -> array of timestamps
const pendingCaptchas = new Map(); // key: groupId:userId -> { answer, mode, timeoutHandle, timestamp }
const recentKickReasons = new Map(); // key: groupId:userId -> { reason, expires }
const _TRANSLATION_MAP = new Map(); // key: groupId:sourceWaId -> { botWaId, botKey }

export function recordTranslationMap(groupId, sourceWaId, botWaId, botKey) {
  if (!groupId || !sourceWaId || !botWaId) return;
  const key = `${groupId}:${sourceWaId}`;
  _TRANSLATION_MAP.set(key, { botWaId, botKey });
  if (_TRANSLATION_MAP.size > 5000) {
    const firstKey = _TRANSLATION_MAP.keys().next().value;
    _TRANSLATION_MAP.delete(firstKey);
  }
}

export async function deleteTranslationIfExists(session, groupId, sourceWaId) {
  if (!groupId || !sourceWaId) return;
  const key = `${groupId}:${sourceWaId}`;
  const record = _TRANSLATION_MAP.get(key);
  if (record) {
    _TRANSLATION_MAP.delete(key);
    try {
      if (session?.sock?.sendMessage && record.botKey) {
        await session.sock.sendMessage(groupId, { delete: record.botKey });
        logger.info({ groupId, sourceWaId, botWaId: record.botWaId }, '🗑️ Deleted translated WhatsApp bot message for revoked source message');
      }
    } catch (e) {
      logger.debug({ error: e.message }, 'Failed to delete translated WhatsApp bot message');
    }
  }
}

const PLATFORM_DOMAINS = {
  whatsapp: ['chat\\.whatsapp\\.com', 'wa\\.me', 'wa\\.link', 'whatsapp\\.com\\/channel'],
  telegram: ['t\\.me', 'telegram\\.me', 'telegram\\.dog'],
  signal: ['signal\\.group', 'signal\\.me'],
  instagram: ['instagram\\.com\\/j', 'ig\\.me\\/j'],
  discord: ['discord\\.(gg|com\\/invite)'],
  other: [
    'line\\.me\\/ti\\/g',
    'viber\\.com\\/g',
    'snapchat\\.com\\/add',
    'matrix\\.to\\/#',
    'element\\.io',
  ],
};

// Centralized Regex definitions per Messenger platform for Invite Link Detection
export const SPAM_INVITE_LINK_PATTERNS = {
  whatsapp: new RegExp(
    `(https?:\\/\\/)?(${PLATFORM_DOMAINS.whatsapp.join('|')})\\/[a-zA-Z0-9_\\-+#/=+]+`,
    'i'
  ),
  telegram: new RegExp(
    `(https?:\\/\\/)?(${PLATFORM_DOMAINS.telegram.join('|')})\\/[a-zA-Z0-9_\\-+#/=+]+`,
    'i'
  ),
  signal: new RegExp(
    `(https?:\\/\\/)?(${PLATFORM_DOMAINS.signal.join('|')})\\/[a-zA-Z0-9_\\-+#/=+]+`,
    'i'
  ),
  instagram: new RegExp(
    `(https?:\\/\\/)?(${PLATFORM_DOMAINS.instagram.join('|')})\\/[a-zA-Z0-9_\\-+#/=+]+`,
    'i'
  ),
  discord: new RegExp(
    `(https?:\\/\\/)?(${PLATFORM_DOMAINS.discord.join('|')})\\/[a-zA-Z0-9_\\-+#/=+]+`,
    'i'
  ),
  other: new RegExp(
    `(https?:\\/\\/)?(${PLATFORM_DOMAINS.other.join('|')})\\/[a-zA-Z0-9_\\-+#/=+]+`,
    'i'
  ),
  all: new RegExp(
    `(https?:\\/\\/)?(${Object.values(PLATFORM_DOMAINS).flat().join('|')})\\/[a-zA-Z0-9_\\-+#/=+]+`,
    'i'
  ),
};

function getWindowKey(groupId, userId) {
  return `${groupId}:${userId}`;
}

/**
 * Normalizes input string for Captcha comparisons by removing surrounding WhatsApp formatting
 * (*, _, ~, `, ', ", whitespace, emojis/symbols like 👉, etc.) and trailing punctuation.
 */
export function cleanCaptchaInput(text) {
  if (!text) return '';
  let str = String(text).trim();
  str = str.replace(/^[*_~`'"\s:👉]+|[*_~`'"\s:!.]+$|/gu, '');
  const alphanumericOnly = str.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
  if (alphanumericOnly) {
    return alphanumericOnly.toLowerCase();
  }
  return str.toLowerCase();
}

/**
 * Finds a pending captcha entry matching the given groupId and user identifiers (PN, LID, canonical key, alt JIDs).
 */
export function findPendingCaptcha(groupId, userId, session = null, rawMsg = null) {
  if (!groupId || !userId) return null;

  // 1. Direct lookup
  const key1 = getWindowKey(groupId, userId);
  if (pendingCaptchas.has(key1)) {
    return { key: key1, captchaObj: pendingCaptchas.get(key1) };
  }

  // 2. Lookup by clean digits
  const cleanDigits = userId.replace(/\D/g, '');
  if (cleanDigits && cleanDigits !== userId) {
    const key2 = getWindowKey(groupId, cleanDigits);
    if (pendingCaptchas.has(key2)) {
      return { key: key2, captchaObj: pendingCaptchas.get(key2) };
    }
  }

  // 3. Lookup by canonical user key (LID <-> PN mapping)
  const canonicalKey = resolveCanonicalUserKey(userId, session);
  if (canonicalKey && canonicalKey !== userId && canonicalKey !== cleanDigits) {
    const key3 = getWindowKey(groupId, canonicalKey);
    if (pendingCaptchas.has(key3)) {
      return { key: key3, captchaObj: pendingCaptchas.get(key3) };
    }
  }

  // 4. Lookup using participant / participantAlt from raw message
  const rawParticipant = rawMsg?.key?.participant || rawMsg?.participant;
  if (rawParticipant) {
    const pUser = rawParticipant.split('@')[0];
    const pKey = getWindowKey(groupId, pUser);
    if (pendingCaptchas.has(pKey)) {
      return { key: pKey, captchaObj: pendingCaptchas.get(pKey) };
    }
  }
  const participantAlt = rawMsg?.key?.participantAlt;
  if (participantAlt) {
    const altUser = participantAlt.split('@')[0];
    const altKey = getWindowKey(groupId, altUser);
    if (pendingCaptchas.has(altKey)) {
      return { key: altKey, captchaObj: pendingCaptchas.get(altKey) };
    }
  }

  // 5. Fallback scan entries for this groupId
  const prefix = `${groupId}:`;
  for (const [key, captchaObj] of pendingCaptchas.entries()) {
    if (key.startsWith(prefix)) {
      const storedUserId = key.slice(prefix.length);
      const storedClean = storedUserId.replace(/\D/g, '');
      if (
        storedUserId === userId ||
        (cleanDigits && storedClean === cleanDigits) ||
        (canonicalKey && resolveCanonicalUserKey(storedUserId, session) === canonicalKey)
      ) {
        return { key, captchaObj };
      }
    }
  }

  return null;
}

/**
 * Clears and removes a pending captcha and its timeout timer for a given user in a group.
 */
export function clearPendingCaptcha(groupId, userId, session = null) {
  if (!groupId || !userId) return;
  const entry = findPendingCaptcha(groupId, userId, session);
  if (!entry || !entry.captchaObj) return;

  if (entry.captchaObj.timeoutHandle) {
    clearTimeout(entry.captchaObj.timeoutHandle);
  }

  for (const [k, obj] of pendingCaptchas.entries()) {
    if (obj === entry.captchaObj) {
      pendingCaptchas.delete(k);
    }
  }
}

export function isUserVerified(groupId, userId, session = null, _rawMsg = null) {
  if (!groupId || !userId) return false;
  const config = getGroupModerationConfig(groupId);
  const verifiedUsers = config.verified_users || {};

  // 1. Direct key/ID or digits lookup
  const checkId = (id) => {
    if (!id) return false;
    if (verifiedUsers[id]?.verified === true) return true;
    const digits = String(id).replace(/\D/g, '');
    if (digits && verifiedUsers[digits]?.verified === true) return true;
    return false;
  };

  if (checkId(userId)) return true;

  // 2. Canonical user key lookup (LID <-> PN mapping)
  const canonicalKey = resolveCanonicalUserKey(userId, session);
  if (canonicalKey && checkId(canonicalKey)) return true;

  // 3. Universal user matching using isSameUser against every verified record
  for (const [vKey, vVal] of Object.entries(verifiedUsers)) {
    if (vVal?.verified === true) {
      if (isSameUser(vKey, userId, session)) return true;
    }
  }

  return false;
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

export function generateBotWelcomeMessage(isBotAdmin = false) {
  let adminNotice = '';
  if (!isBotAdmin) {
    adminNotice = `⚠️ *Notice:* The bot currently *does not have Admin permissions* in this group.\nWithout Admin rights, the following features *will not* be available:\n• Captcha Verification (Automatic kick on failure/timeout)\n• Moderation Penalties (Kick, Ban, Mute, Temp-Ban)\n• Anti-Raid / Group Lockdown\n• Automatic message deletion on rule violations\n\n👉 *Please grant Admin permissions to the bot to enable full protection!*\n\n`;
  }

  return `🤖 *Hello! I am your Moderation & Assistant Bot.*

${adminNotice}⚡ *What I can do:*
• *Welcome & Captcha:* Greet new members, display group rules & intercept spam bots via Captcha
• *Auto-Responder & FAQ:* Automatic responses to predefined keywords or help hints from FAQ
• *Content Protection & Moderation:* Word filters, link locks, flood protection, mute & warnings (!warn, !mute, !kick, !ban)
• *Notes & Commands:* Group rules (!rules), notes (!note / #note) & user reports (!report)
• *Home Assistant Integration:* Control messages & notifications directly via Home Assistant

⚙️ *Useful Commands:*
• Type \`!help\` to see available group commands
• Type \`!rules\` to view group rules
• Type \`!admins\` to see group administrators
• Type \`!report <reason>\` to report bad behavior to group admins

📚 *Documentation & Guide:*
https://faserf.github.io/ha-whatsapp/`;
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
    // Always attempt to delete the triggering message for moderation enforcement
    if (rawMsg?.key?.id && session?.sock) {
      try {
        await session.sock.sendMessage(groupId, { delete: rawMsg.key });
      } catch (e) {
        logger.warn(
          { groupId, userId, err: e?.message },
          'executePenalty: message delete failed (bot may not be group admin)'
        );
      }
    }

    if (action === 'delete') {
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
          text: gt(config, 'bot_replies.muted', {
            user: userId,
            reason: reason || 'Moderation penalty',
          }),
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

      // Load config once at kick/ban level — used by both inner persistence blocks and gt() reply calls below
      const config = getGroupModerationConfig(groupId);

      if (action === 'ban') {
        const store = loadModerationStore();
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
            text: gt(config, 'bot_replies.banned_dm', {
              group: groupId.split('@')[0],
              reason: reason || 'Violation of group rules',
            }),
          });
        } catch (dmErr) {
          logger.warn({ error: dmErr.message }, `Failed to send DM ban notification to ${userJid}`);
        }
      } else if (action === 'kick') {
        // Persist kick to kick_log for UI history
        const store = loadModerationStore();
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

      // Perform pre-checks on group metadata before attempting kick/ban
      let isBotAdmin = false;
      let isTargetAdmin = false;

      if (session?.sock?.groupMetadata) {
        try {
          const meta = await session.sock.groupMetadata(groupId);
          for (const p of meta?.participants || []) {
            const isAdminRole = p.admin === 'admin' || p.admin === 'superadmin';

            // Check bot status using isSelfParticipant (handles LID, PN, stats.my_number)
            if (isSelfParticipant(p.id, session)) {
              if (isAdminRole) isBotAdmin = true;
            }
            // Check target user status
            if (isSameUser(p.id, userId, session)) {
              if (isAdminRole) isTargetAdmin = true;
            }
          }
        } catch (metaErr) {
          logger.debug(
            { error: metaErr.message, groupId },
            'Failed to fetch metadata in executePenalty'
          );
        }
      }

      if (!isBotAdmin && session?.sock?.groupMetadata) {
        await sendMissingAdminWarning(session, groupId, `Execute action: ${action}`, rawMsg);
        return false;
      }

      if (isTargetAdmin) {
        const displayName = resolveUserDisplayName(userId, session);
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.cannot_action_admin', { action, name: displayName }),
            mentions: [userJid],
          },
          rawMsg
        );
        return false;
      }

      try {
        const displayName = resolveUserDisplayName(userId, session);

        // Build array of candidate JIDs (phone JID and LID JID) to ensure WhatsApp multi-device accepts removal
        const candidateJids = [];
        if (session?.sock?.groupMetadata) {
          try {
            const meta = await session.sock.groupMetadata(groupId);
            const targetDigits = userId.replace(/\D/g, '');
            const foundPart = meta?.participants?.find((p) => {
              const pId = p.id ? normalizeJid(p.id) : '';
              const pDigits = pId.split('@')[0].replace(/\D/g, '');
              return (
                (targetDigits && pDigits && pDigits === targetDigits) ||
                (userJid && pId === userJid) ||
                pId.split('@')[0] === userId
              );
            });
            if (foundPart?.id) {
              candidateJids.push(foundPart.id);
            }
          } catch (_err) {}
        }
        if (cleanDigits && !candidateJids.includes(`${cleanDigits}@s.whatsapp.net`)) {
          candidateJids.push(`${cleanDigits}@s.whatsapp.net`);
        }
        if (userJid && !candidateJids.includes(userJid)) {
          candidateJids.push(userJid);
        }
        if (userId && !candidateJids.includes(userId)) {
          const formatted = userId.includes('@') ? userId : `${userId}@s.whatsapp.net`;
          if (!candidateJids.includes(formatted)) candidateJids.push(formatted);
        }

        let lastErr = null;
        let success = false;
        for (const targetJid of candidateJids) {
          try {
            const res = await session.sock.groupParticipantsUpdate(groupId, [targetJid], 'remove');
            // Baileys returns array like [{ jid, status: "200" | "403" | "404" | "408" | "500" }]
            if (Array.isArray(res) && res.length > 0) {
              const resStatus = String(res[0]?.status || '');
              if (resStatus === '200' || resStatus === '201') {
                success = true;
                break;
              } else {
                lastErr = new Error(`WhatsApp server returned status code ${resStatus}`);
              }
            } else {
              success = true;
              break;
            }
          } catch (kickAttemptErr) {
            lastErr = kickAttemptErr;
          }
        }
        if (!success && lastErr) throw lastErr;
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.kick_ban_done', {
              name: displayName,
              action: action === 'ban' ? 'banned' : 'kicked',
            }),
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
          errMsg.includes('permission') ||
          errMsg.includes('403') ||
          errMsg.includes('500') ||
          errMsg.includes('internal-server-error')
        ) {
          // Bot is not an admin in this group or WhatsApp protocol rejected action due to insufficient bot rights
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
              text: gt(config, 'bot_replies.user_not_member', { name: displayName }),
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
              text: gt(config, 'bot_replies.action_rate_limited', { action, name: displayName }),
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
              text: gt(config, 'bot_replies.action_failed', {
                action,
                name: displayName,
                reason: e.message || 'Unknown WhatsApp protocol error',
              }),
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
        text: gt(config, 'bot_replies.warning_max_reached', {
          user: userDisplay,
          count: warnCount,
          max: maxWarns,
          reason,
          action: penaltyAction.toUpperCase(),
        }),
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
        text: gt(config, 'bot_replies.warning_issued', {
          user: userDisplay,
          count: warnCount,
          max: maxWarns,
          reason,
        }),
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
  const isGroup = event.is_group ?? event.sender?.endsWith('@g.us');
  const groupId = isGroup ? event.from || event.sender : event.sender;
  const config = getGroupModerationConfig(groupId);

  const isGroupConfigured =
    config.enabled || config.translation?.mode === 'auto' || Boolean(config.stt_enabled);
  if (!store.global_enabled || !isGroupConfigured) {
    logger.debug('Skipping moderation: global_enabled is false or group features not configured');
    return false;
  }

  // Never moderate or auto-respond to outgoing bot messages (prevents self-loop)
  if (event.raw?.key?.fromMe) return false;

  // Handle Private Chat (DM) messages for pending Captchas
  if (!isGroup) {
    return await handlePrivateCaptchaMessage(session, event);
  }

  // For group messages, event.sender is the participant JID (@s.whatsapp.net),
  // while event.from is the group JID (@g.us). Use the group JID as groupId.
  if (!groupId || !groupId.endsWith('@g.us')) return false;

  const rawMsg = event.raw;
  let userId = event.sender_number;
  if (!userId || userId === groupId.split('@')[0]) {
    const rawParticipant =
      rawMsg?.key?.participant || rawMsg?.participant || rawMsg?.key?.participantAlt;
    if (typeof rawParticipant === 'string') {
      userId = rawParticipant.split('@')[0].replace(/\D/g, '');
    }
  }
  const text = (event.content || '').trim();

  // Guard: userId must be a valid sender number, not empty or the group JID digits
  if (!userId || userId.includes('@')) return false;
  const groupDigits = groupId.split('@')[0];
  if (userId === groupDigits) {
    logger.debug(
      { groupId, userId },
      'Skipping moderation: sender_number matches group JID (no participant JID resolved)'
    );
    return false;
  }

  if (config.approved && config.approved.includes(userId)) {
    if (config.antispam?.notify_bypassed_actions && text && !rawMsg?.key?.fromMe) {
      let bypassedReason = null;
      if (config.anti_spam_links_enabled) {
        const blockedPlatforms = config.antispam?.blocked_invite_platforms || {};
        for (const [platKey, pattern] of Object.entries(SPAM_INVITE_LINK_PATTERNS)) {
          if (platKey === 'all') continue;
          if (blockedPlatforms[platKey] !== false && pattern.test(text)) {
            bypassedReason = `Anti-Spam Invite Link (${platKey})`;
            break;
          }
        }
      }
      if (!bypassedReason && config.locks) {
        const locks = config.locks;
        if (
          locks.url?.enabled &&
          /(https?:\/\/|www\.|[a-zA-Z0-9-]+\.(com|de|net|org|io|me|co|app|xyz))/i.test(text)
        ) {
          bypassedReason = 'URL Link Lock';
        } else if (locks.rtl?.enabled && /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text)) {
          bypassedReason = 'Right-To-Left (RTL) Lock';
        } else if (locks.contact?.enabled && event.media_type === 'contact') {
          bypassedReason = 'Contact Card Lock';
        } else if (locks.location?.enabled && event.media_type === 'location') {
          bypassedReason = 'Location Lock';
        }
      }
      if (!bypassedReason && config.blacklist?.words && Array.isArray(config.blacklist.words)) {
        for (const word of config.blacklist.words) {
          if (!word) continue;
          const isMatch =
            config.blacklist.mode === 'wildcard'
              ? text.toLowerCase().includes(word.toLowerCase())
              : new RegExp(`\\b${word}\\b`, 'i').test(text);
          if (isMatch) {
            bypassedReason = `Blacklisted Word ("${word}")`;
            break;
          }
        }
      }
      if (bypassedReason) {
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.moderation_bypassed_whitelist', {
              reason: bypassedReason,
            }),
          },
          rawMsg,
          { skipSpamGuard: true }
        );
      }
    }
    return false; // User is whitelisted, skip moderation
  }

  // In group chats, ONLY actual WhatsApp Group Admins or the bot itself bypass destructive moderation rules (blacklist, locks, anti-spam).
  const isGroupAdminUser = Boolean(
    (event.is_group ? event.is_group_admin : event.is_admin) || rawMsg?.key?.fromMe
  );

  // Check suspicious spam/drugs/nsfw name pattern
  if (config.name_ban_enabled !== false && !isGroupAdminUser) {
    const senderName = event.sender_name || rawMsg?.pushName || '';
    const nameViolation = checkSuspiciousName(senderName);
    if (nameViolation) {
      logger.warn({ senderName, userId, nameViolation }, '🚫 Flagged suspicious user profile name');
      if (rawMsg?.key?.id) {
        try {
          await session.sock.sendMessage(groupId, { delete: rawMsg.key });
        } catch (_e) {}
      }
      const action = config.name_ban_action || 'ban';
      await executePenalty(
        session,
        groupId,
        userId,
        action,
        `Prohibited Name Pattern: ${nameViolation}`,
        rawMsg
      );
      return true;
    }
  }

  // 0. Auto-Responder / Custom Filters & FAQ triggers check (runs for everyone including admins)
  const allFilters = [
    ...(Array.isArray(config.filters) ? config.filters : []),
    ...(Array.isArray(config.autoresponder?.rules) ? config.autoresponder.rules : []),
    ...(Array.isArray(config.faq?.rules) ? config.faq.rules : []),
  ];

  if (text && allFilters.length > 0) {
    for (const filter of allFilters) {
      if (!filter.trigger) continue;
      let isMatch = false;
      if (filter.is_regex) {
        try {
          isMatch = new RegExp(filter.trigger, 'i').test(text);
        } catch (e) {}
      } else {
        const cleanTrigger = filter.trigger.toLowerCase().trim();
        const lowerText = text.toLowerCase().trim();
        if (lowerText === cleanTrigger || lowerText.includes(cleanTrigger)) {
          isMatch = true;
        }
      }

      if (isMatch) {
        const isFaq = filter.type === 'faq';
        const replyText = isFaq
          ? gt(config, 'bot_replies.faq_hint', { response: filter.response })
          : filter.response;

        await reply(session, groupId, { text: replyText }, rawMsg);
        // Execute filter action if defined & user is not admin
        if (filter.action && filter.action !== 'reply' && !isGroupAdminUser) {
          if (rawMsg?.key?.id) {
            try {
              await session.sock.sendMessage(groupId, { delete: rawMsg.key });
            } catch (e) {}
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

  if (isGroupAdminUser) {
    logger.debug({ groupId, userId }, 'Skipping destructive content moderation for admin/bot user');
    if (config.antispam?.notify_bypassed_actions && text && !rawMsg?.key?.fromMe) {
      let bypassedReason = null;

      // 1. Anti-spam invite links check
      if (config.anti_spam_links_enabled) {
        const blockedPlatforms = config.antispam?.blocked_invite_platforms || {};
        for (const [platKey, pattern] of Object.entries(SPAM_INVITE_LINK_PATTERNS)) {
          if (platKey === 'all') continue;
          if (blockedPlatforms[platKey] !== false && pattern.test(text)) {
            bypassedReason = `Anti-Spam Invite Link (${platKey})`;
            break;
          }
        }
      }

      // 2. Content locks check if not matched
      if (!bypassedReason && config.locks) {
        const locks = config.locks;
        if (
          locks.url?.enabled &&
          /(https?:\/\/|www\.|[a-zA-Z0-9-]+\.(com|de|net|org|io|me|co|app|xyz))/i.test(text)
        ) {
          bypassedReason = 'URL Link Lock';
        } else if (locks.rtl?.enabled && /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text)) {
          bypassedReason = 'Right-To-Left (RTL) Lock';
        } else if (locks.contact?.enabled && event.media_type === 'contact') {
          bypassedReason = 'Contact Card Lock';
        } else if (locks.location?.enabled && event.media_type === 'location') {
          bypassedReason = 'Location Lock';
        }
      }

      // 3. Blacklist check if not matched
      if (!bypassedReason && config.blacklist?.words && Array.isArray(config.blacklist.words)) {
        for (const word of config.blacklist.words) {
          if (!word) continue;
          const isMatch =
            config.blacklist.mode === 'wildcard'
              ? text.toLowerCase().includes(word.toLowerCase())
              : new RegExp(`\\b${word}\\b`, 'i').test(text);
          if (isMatch) {
            bypassedReason = `Blacklisted Word ("${word}")`;
            break;
          }
        }
      }

      if (bypassedReason) {
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.moderation_bypassed_admin', { reason: bypassedReason }),
          },
          rawMsg,
          { skipSpamGuard: true }
        );
      }
    }
    return false;
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
            if (rawMsg?.key?.id) {
              try {
                await session.sock.sendMessage(groupId, { delete: rawMsg.key });
              } catch (e) {
                logger.warn(
                  { groupId, userId, err: e?.message },
                  'Federation blacklist: message delete failed'
                );
              }
            }
            await executePenalty(
              session,
              groupId,
              userId,
              'delete',
              `Prohibited link/pattern from Global Federation (${pat})`,
              rawMsg
            );
            if (config.antispam?.notify_deleted_action !== false) {
              await reply(
                session,
                groupId,
                {
                  text: gt(config, 'bot_replies.federation_deleted', {
                    user: userId,
                    pattern: pat,
                  }),
                  mentions: [`${userId}@s.whatsapp.net`],
                },
                rawMsg
              );
            }
            return true;
          }
        }
      }
    }
  }

  // 2. Pending Captcha & Verification check
  const isCaptchaEnabled = Boolean(config.greetings?.captcha_enabled);
  if (isCaptchaEnabled) {
    const verified = isUserVerified(groupId, userId, session, rawMsg);
    if (!verified) {
      const captchaEntry = findPendingCaptcha(groupId, userId, session, rawMsg);
      let expectedUpper = '';

      if (captchaEntry) {
        const { key: captchaKey, captchaObj } = captchaEntry;
        const cleanAnswer = String(captchaObj.answer || '')
          .trim()
          .toLowerCase();
        expectedUpper = String(captchaObj.answer || '').toUpperCase();

        const rawInput = text.trim().toLowerCase();
        const cleanInput = cleanCaptchaInput(text);
        const words = text.split(/\s+/).map((w) => cleanCaptchaInput(w));
        const noFormatText = text.toLowerCase().replace(/[*_~`'"\s]/g, '');

        const isMatch =
          rawInput === cleanAnswer ||
          cleanInput === cleanAnswer ||
          words.includes(cleanAnswer) ||
          noFormatText === cleanAnswer;

        if (isMatch) {
          clearTimeout(captchaObj.timeoutHandle);
          pendingCaptchas.delete(captchaKey);

          try {
            const verRecord = { verified: true, timestamp: Date.now(), mode: 'auto' };
            config.verified_users = config.verified_users || {};
            config.verified_users[userId] = verRecord;
            const cleanId = userId.replace(/\D/g, '');
            if (cleanId) config.verified_users[cleanId] = verRecord;
            // Also store canonical key if resolved
            const canonical = resolveCanonicalUserKey(userId, session);
            if (canonical) config.verified_users[canonical] = verRecord;
            store.groups[groupId] = config;
            saveModerationStore(store);
          } catch (storeErr) {
            logger.warn({ error: storeErr.message }, 'Failed to record captcha verification');
          }

          // Fetch group title for human readable group name
          let groupName = groupId.split('@')[0];
          if (session?.sock?.groupMetadata) {
            try {
              const meta = await session.sock.groupMetadata(groupId);
              if (meta?.subject) groupName = meta.subject;
            } catch (_e) {}
          }

          // Send confirmation — DM if captcha was sent via DM, otherwise group
          const captchaTargetMode = config.greetings?.captcha_target || 'private';
          const userPhoneJid = `${userId.replace(/\D/g, '')}@s.whatsapp.net`;
          const confirmText = `✅ *Captcha Verified!*\n\nYou have been successfully verified in *${groupName}*. You can now participate in the group.`;

          if (captchaTargetMode === 'private') {
            // Try DM first
            let dmSent = false;
            try {
              await session.sock.sendMessage(userPhoneJid, { text: confirmText });
              dmSent = true;
            } catch (_err) {
              /* fall through to group */
            }

            // Also post a brief notice in the group so members see the verification
            await reply(
              session,
              groupId,
              {
                text: gt(config, 'bot_replies.captcha_verified_dm', { user: userId }),
                mentions: [`${userId}@s.whatsapp.net`],
              },
              rawMsg
            );

            if (!dmSent) {
              // DM failed — send full confirmation in group as fallback
              await reply(
                session,
                groupId,
                { text: `@${userId} ${confirmText}`, mentions: [`${userId}@s.whatsapp.net`] },
                rawMsg
              );
            }
          } else {
            await reply(
              session,
              groupId,
              {
                text: gt(config, 'bot_replies.captcha_verified_group', { user: userId }),
                mentions: [`${userId}@s.whatsapp.net`],
              },
              rawMsg
            );
          }
          return true;
        }
      }

      // Delete message from unverified user
      if (rawMsg?.key?.id) {
        try {
          await session.sock.sendMessage(groupId, { delete: rawMsg.key });
        } catch (e) {
          /* ignore delete failure */
        }
      }

      logger.info({ groupId, userId, text }, 'Blocked message from unverified user');
      const reminderText = expectedUpper
        ? `🔒 *Message Deleted: Captcha Verification Pending*\n\n@${userId}, your message was deleted because you have not completed captcha verification yet.\n👉 Please reply with the exact security code: *${expectedUpper}*`
        : `🔒 *Message Deleted: Captcha Verification Required*\n\n@${userId}, your message was deleted because you must complete captcha verification before posting.`;

      await reply(
        session,
        groupId,
        {
          text: reminderText,
          mentions: [`${userId}@s.whatsapp.net`],
        },
        rawMsg
      );

      return true; // Consume message completely so no command or auto-responder executes
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
      if (config.antispam?.notify_deleted_action !== false) {
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.content_lock_deleted', { user: userId, type: lockTitle }),
            mentions: [`${userId}@s.whatsapp.net`],
          },
          rawMsg
        );
      }
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
  if (locks.invite?.enabled && SPAM_INVITE_LINK_PATTERNS.all.test(text)) {
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

  // 3.5 Anti-Spam Invite Links Check (Standalone Anti-Spam Feature)
  if (config.anti_spam_links_enabled && text) {
    const blockedPlatforms = config.antispam?.blocked_invite_platforms || {};
    let inviteMatch = false;
    for (const [platKey, pattern] of Object.entries(SPAM_INVITE_LINK_PATTERNS)) {
      if (platKey === 'all') continue;
      if (blockedPlatforms[platKey] !== false && pattern.test(text)) {
        inviteMatch = true;
        break;
      }
    }
    logger.debug(
      {
        groupId,
        userId,
        anti_spam_links_enabled: true,
        textSnippet: text.slice(0, 80),
        inviteMatch,
      },
      '🔗 Anti-spam link check'
    );
    if (inviteMatch) {
      if (rawMsg?.key?.id) {
        try {
          await session.sock.sendMessage(groupId, { delete: rawMsg.key });
        } catch (e) {
          logger.warn(
            { groupId, userId, err: e?.message },
            'Anti-spam: message delete failed (bot may not be admin)'
          );
        }
      }

      const isNotifyEnabled = config.antispam?.notify_deleted_action !== false;
      if (isNotifyEnabled) {
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.antispam_link_deleted', { user: userId }),
            mentions: [`${userId}@s.whatsapp.net`],
          },
          rawMsg
        );
      }
      return true;
    }
  }

  // 4. Blacklist / Prohibited Words check
  const blacklistWords = [
    ...(Array.isArray(config.blacklist?.words) ? config.blacklist.words : []),
    ...(Array.isArray(config.blacklisted_words) ? config.blacklisted_words : []),
  ];
  const isBlacklistEnabled = config.blacklist?.enabled !== false && blacklistWords.length > 0;

  if (isBlacklistEnabled) {
    const lowerText = text.toLowerCase();
    const matchingMode = config.blacklist?.matching_mode || 'exact'; // default 'exact'

    for (const word of blacklistWords) {
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
      } else if (matchingMode === 'contains') {
        matched = lowerText.includes(lowerWord);
      } else {
        // Exact word match (matches standalone word with word boundaries or punctuation)
        const escapedWord = lowerWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordBoundaryRegex = new RegExp(
          `(?:^|[^\\p{L}\\p{N}_])${escapedWord}(?:$|[^\\p{L}\\p{N}_])`,
          'ui'
        );
        matched = wordBoundaryRegex.test(lowerText);
      }

      if (matched) {
        if (rawMsg?.key?.id) {
          try {
            await session.sock.sendMessage(groupId, { delete: rawMsg.key });
          } catch (e) {}
        }
        const blAction = config.blacklist.action || 'delete';
        if (config.antispam?.notify_deleted_action !== false) {
          await reply(
            session,
            groupId,
            {
              text: gt(config, 'bot_replies.blacklist_deleted', { user: userId }),
              mentions: [`${userId}@s.whatsapp.net`],
            },
            rawMsg
          );
        }
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

  // 4b. AI Intent & Scam Detection (for long or suspicious messages)
  if (config.ai?.enabled && text.length > 30) {
    const storeGeminiKey = store.gemini_api_key;
    const intentResult = await processAiModeration(text, config.ai, storeGeminiKey, 'intent_scan');
    if (intentResult === 'SPAM') {
      if (rawMsg?.key?.id) {
        try {
          await session.sock.sendMessage(groupId, { delete: rawMsg.key });
        } catch (e) {}
      }
      await reply(session, groupId, { text: gt(config, 'bot_replies.ai_guard_deleted') }, rawMsg);
      await executePenalty(
        session,
        groupId,
        userId,
        'warn',
        'AI detected fraudulent/scam intent in message',
        rawMsg
      );
      return true;
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

    if (timestamps.length >= (floodConfig.max_messages || 5)) {
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

  // 6. Notes & Rules trigger matching
  if (text) {
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
      await reply(
        session,
        groupId,
        { text: gt(config, 'bot_replies.group_rules', { rules: rulesText }) },
        rawMsg
      );
      return true;
    }
  }

  // 7. Gemini AI Context & FAQ Engine
  if (config.ai?.enabled && config.ai?.faq_auto_reply && text) {
    const aiReply = await processAiModeration(text, config.ai, store.gemini_api_key);
    if (aiReply) {
      await reply(
        session,
        groupId,
        { text: gt(config, 'bot_replies.ai_assistant', { reply: aiReply }) },
        rawMsg
      );
      return true;
    }
  }

  // 8. Auto Translation Engine (Translates messages if enabled and not already target language)
  if (config.translation?.mode === 'auto' && text && text.trim().length > 2) {
    const targetLang = config.translation?.target_lang || 'en';
    const provider = config.translation?.provider || 'auto';

    const transResult =
      provider === 'ai'
        ? await (async () => {
            const { processAiModeration } = await import('./ai.js');
            return processAiModeration(text, config.ai || {}, store.gemini_api_key, 'translate', {
              targetLang,
            });
          })()
        : await translateTextFreeWithReason(text, targetLang, provider);

    if (
      transResult?.translation &&
      transResult.translation.trim().toLowerCase() !== text.trim().toLowerCase()
    ) {
      const srcCode = (transResult.sourceLang || '?').toLowerCase();
      const dstCode = targetLang.toLowerCase();

      // Skip translation if detected source language is already the target language
      if (srcCode !== '?' && srcCode === dstCode) {
        logger.debug(
          { srcCode, dstCode },
          'Skipping auto-translation: source language matches target language'
        );
      } else {
        const header =
          targetLang === 'de'
            ? `🌐 *Automatische Übersetzung (${srcCode.toUpperCase()} → ${dstCode.toUpperCase()}):*`
            : `🌐 *Auto Translation (${srcCode.toUpperCase()} → ${dstCode.toUpperCase()}):*`;
        const sentTransMsg = await reply(
          session,
          groupId,
          { text: `${header}\n\n"${transResult.translation}"` },
          rawMsg
        );
        if (sentTransMsg?.key?.id && rawMsg?.key?.id) {
          recordTranslationMap(groupId, rawMsg.key.id, sentTransMsg.key.id, sentTransMsg.key);
        }
      }
    }
  }

  // 9. Sentiment Moderation via AI
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
            text: gt(config, 'bot_replies.ai_harmful_deleted'),
          },
          rawMsg
        );
        await issueUserWarning(session, groupId, userId, 'AI detected toxic content', rawMsg);
        return true;
      }
    }
  }

  // 10. Security Scanner (Local Heuristics + Signatures + VirusTotal Cloud)
  const secScan = config.security_scan || { enabled: true, engine: 'local', trigger: 'auto' };
  if (secScan.enabled !== false && secScan.trigger !== 'command') {
    const { performSecurityScan } = await import('./securityScanner.js');
    const scanResult = await performSecurityScan(rawMsg, secScan, store.gemini_api_key);
    if (scanResult?.is_malicious) {
      const threatType = scanResult.threats?.[0]?.type?.toUpperCase() || 'MALWARE / PHISHING LINK';
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
          text: `🛡️ *Security Shield Alert*\n\n⚠️ Malicious ${threatType} detected and neutralized.`,
        },
        rawMsg
      );
      await issueUserWarning(
        session,
        groupId,
        userId,
        `Security Threat Detected (${threatType})`,
        rawMsg
      );
      return true;
    }
  }

  return false;
}

/**
 * Handles incoming private (DM) messages to check if the sender is trying to resolve a pending Captcha
 * for any group where private captcha verification is enabled.
 */
export async function handlePrivateCaptchaMessage(session, event) {
  const userId = event.sender_number;
  const text = (event.content || '').trim();
  if (!userId || !text) return false;

  // Scan all pending captchas for an entry matching this user (by PN, LID, canonical key)
  let foundMatch = null;
  let targetGroupId = null;
  let targetKey = null;

  for (const [key, captchaObj] of pendingCaptchas.entries()) {
    const colonIdx = key.indexOf(':');
    if (colonIdx === -1) continue;
    const gId = key.slice(0, colonIdx);
    const storedUserId = key.slice(colonIdx + 1);

    const matchUser =
      storedUserId === userId ||
      storedUserId.replace(/\D/g, '') === userId.replace(/\D/g, '') ||
      resolveCanonicalUserKey(storedUserId, session) === resolveCanonicalUserKey(userId, session);

    if (matchUser) {
      foundMatch = captchaObj;
      targetGroupId = gId;
      targetKey = key;
      break;
    }
  }

  if (!foundMatch || !targetGroupId) return false;

  const cleanAnswer = String(foundMatch.answer || '')
    .trim()
    .toLowerCase();
  const rawInput = text.trim().toLowerCase();
  const cleanInput = cleanCaptchaInput(text);
  const words = text.split(/\s+/).map((w) => cleanCaptchaInput(w));
  const noFormatText = text.toLowerCase().replace(/[*_~`'"\s]/g, '');

  const isMatch =
    rawInput === cleanAnswer ||
    cleanInput === cleanAnswer ||
    words.includes(cleanAnswer) ||
    noFormatText === cleanAnswer;

  if (isMatch) {
    clearTimeout(foundMatch.timeoutHandle);
    pendingCaptchas.delete(targetKey);
    const cleanUserDigits = userId.replace(/\D/g, '');
    if (cleanUserDigits) pendingCaptchas.delete(`${targetGroupId}:${cleanUserDigits}`);
    const userCanonical = resolveCanonicalUserKey(userId, session);
    if (userCanonical) pendingCaptchas.delete(`${targetGroupId}:${userCanonical}`);
    const participantUser = userId.split('@')[0];
    if (participantUser) pendingCaptchas.delete(`${targetGroupId}:${participantUser}`);
    if (foundMatch.captchaObj?.participantJid) {
      pendingCaptchas.delete(`${targetGroupId}:${foundMatch.captchaObj.participantJid}`);
      const partUser = foundMatch.captchaObj.participantJid.split('@')[0];
      if (partUser) pendingCaptchas.delete(`${targetGroupId}:${partUser}`);
    }

    const store = loadModerationStore();
    const config = getGroupModerationConfig(targetGroupId);
    const verRecord = { verified: true, timestamp: Date.now(), mode: 'auto' };

    config.verified_users = config.verified_users || {};
    config.verified_users[userId] = verRecord;
    const storedUserVal = targetKey.slice(targetKey.indexOf(':') + 1);
    if (storedUserVal) config.verified_users[storedUserVal] = verRecord;
    const cleanId = userId.replace(/\D/g, '');
    if (cleanId) config.verified_users[cleanId] = verRecord;
    const canonical = resolveCanonicalUserKey(userId, session);
    if (canonical) config.verified_users[canonical] = verRecord;
    if (foundMatch.participantJid) {
      const pUser = foundMatch.participantJid.split('@')[0];
      if (pUser) config.verified_users[pUser] = verRecord;
    }

    store.groups[targetGroupId] = config;
    saveModerationStore(store);

    let groupSubject = targetGroupId.split('@')[0];
    if (session?.sock?.groupMetadata) {
      try {
        const meta = await session.sock.groupMetadata(targetGroupId);
        if (meta?.subject) groupSubject = meta.subject;
      } catch (_e) {
        /* ignore */
      }
    }

    const confirmText = `✅ *Captcha Verified!*\n\nYou have been successfully verified for *${groupSubject}*. You can now post messages in the group.`;
    const dmJid = `${userId.replace(/\D/g, '')}@s.whatsapp.net`;
    try {
      await session.sock.sendMessage(dmJid, { text: confirmText });
    } catch (_e) {
      /* ignore */
    }

    // Also send brief notification into group
    try {
      const userLabel = resolveUserDisplayName(userId, session, config.greetings);
      await reply(session, targetGroupId, {
        text: gt(config, 'bot_replies.captcha_verified_via_dm', { user: userLabel }),
        mentions: [`${userId.replace(/\D/g, '')}@s.whatsapp.net`],
      });
    } catch (_e) {
      /* ignore */
    }

    return true;
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

  const userLabel = resolveUserDisplayName(userId || participantJid, session, config?.greetings);
  const canonicalKey = resolveCanonicalUserKey(userId || participantJid, session);
  const mentionText =
    canonicalKey && !canonicalKey.startsWith('1576') ? `@${canonicalKey}` : userLabel;

  const pushname =
    (participantJid && session?.sock?.contacts?.[participantJid]?.notify) ||
    (participantJid && session?.sock?.contacts?.[participantJid]?.name) ||
    userLabel ||
    '';

  return template
    .replace(/{mention}/g, mentionText)
    .replace(/{user}/g, mentionText)
    .replace(/{name}/g, userLabel)
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

export const participantEventDeduper = new Map(); // key -> timestamp

export function clearParticipantEventDeduper() {
  participantEventDeduper.clear();
}

export async function handleModerationParticipantUpdate(session, update) {
  const groupId = update.id;
  if (!groupId || !groupId.endsWith('@g.us')) return;

  const action = update.action || 'add';
  const participants = update.participants || [];
  const now = Date.now();

  // Deduplicate identical participant events firing within 10 seconds
  // (Baileys fires both group-participants.update AND messageStubType for the exact same event)
  const filteredParticipants = participants.filter((p) => {
    const pStr = typeof p === 'string' ? p : p?.id || p?.jid || '';
    const cleanUser = pStr.split('@')[0].split(':')[0].replace(/\D/g, '') || pStr;
    const key = `${groupId}:${action}:${cleanUser}`;
    const lastTime = participantEventDeduper.get(key) || 0;
    if (now - lastTime < 10000) {
      return false; // Skip duplicate event
    }
    participantEventDeduper.set(key, now);
    return true;
  });

  if (filteredParticipants.length === 0) {
    logger.debug(
      { groupId, action },
      '👥 Skipping duplicate participant update event within window'
    );
    return;
  }

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
            text: gt(config, 'bot_replies.anti_raid_activated'),
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
    for (const participantJid of filteredParticipants) {
      // If the bot itself joined the group, post the Bot Welcome & Capability message
      if (isSelfParticipant(participantJid, session)) {
        let isBotAdmin = false;
        if (session?.sock?.groupMetadata) {
          try {
            const meta = await session.sock.groupMetadata(groupId);
            const myUser = session.sock.user;
            const myId = myUser?.id ? normalizeJid(myUser.id) : '';
            const myLid = myUser?.lid ? normalizeJid(myUser.lid) : '';
            const myUserDigits = myId.split('@')[0].replace(/\D/g, '');

            const p = meta?.participants?.find((part) => {
              const pid = part.id ? part.id.split('@')[0].replace(/\D/g, '') : '';
              return pid === myUserDigits || part.id === myId || (myLid && part.id === myLid);
            });
            if (p && (p.admin === 'admin' || p.admin === 'superadmin')) {
              isBotAdmin = true;
            }
          } catch (e) {
            logger.debug({ error: e.message, groupId }, 'Failed to check bot admin status on join');
          }
        }

        const botWelcomeText = generateBotWelcomeMessage(isBotAdmin);
        await reply(session, groupId, { text: botWelcomeText }, rawMsg, { skipSpamGuard: true });
        continue;
      }

      const userId = participantJid.split('@')[0];
      const cleanDigits = userId.replace(/\D/g, '');

      // Local Group Ban Check
      const bannedUsersMap = config.banned_users || {};
      const banInfo = bannedUsersMap[userId] || (cleanDigits ? bannedUsersMap[cleanDigits] : null);

      if (banInfo) {
        // User was banned from this group -> notify via private DM and auto-kick
        // Fetch group title for human readable group name
        let groupTitle = groupId.split('@')[0];
        if (session?.sock?.groupMetadata) {
          try {
            const meta = await session.sock.groupMetadata(groupId);
            if (meta?.subject) groupTitle = meta.subject;
          } catch (_e) {}
        }
        try {
          await session.sock.sendMessage(participantJid, {
            text: gt(config, 'bot_replies.join_ban_enforced_dm', {
              group: groupTitle,
              reason: banInfo.reason || 'Banned by group moderation',
            }),
          });
        } catch (dmErr) {
          logger.warn({ error: dmErr.message }, `Failed to send join ban DM to ${participantJid}`);
        }

        try {
          const kickRes = await session.sock.groupParticipantsUpdate(
            groupId,
            [participantJid],
            'remove'
          );
          // Evaluate Baileys status response
          const kickStatus =
            Array.isArray(kickRes) && kickRes.length > 0 ? String(kickRes[0]?.status || '') : '200';
          if (kickStatus === '403' || kickStatus === '500') {
            await sendMissingAdminWarning(
              session,
              groupId,
              'Auto-remove banned user on rejoin',
              rawMsg
            );
          } else {
            await reply(
              session,
              groupId,
              {
                text: gt(config, 'bot_replies.join_ban_enforced_group', {
                  user: cleanDigits || userId,
                }),
                mentions: [participantJid],
              },
              rawMsg,
              { skipSpamGuard: true }
            );
          }
        } catch (kickErr) {
          const kickErrMsg = (kickErr.message || '').toLowerCase();
          logger.warn(
            { error: kickErr.message },
            `Failed to auto-remove banned user ${participantJid}`
          );
          if (
            kickErrMsg.includes('not-authorized') ||
            kickErrMsg.includes('forbidden') ||
            kickErrMsg.includes('403') ||
            kickErrMsg.includes('500') ||
            kickErrMsg.includes('internal-server-error')
          ) {
            await sendMissingAdminWarning(
              session,
              groupId,
              'Auto-remove banned user on rejoin',
              rawMsg
            );
          }
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

      // Check suspicious spam/drugs/nsfw name pattern on participant join
      if (config.name_ban_enabled !== false) {
        const contact = session.contactCache?.get(participantJid);
        const contactName = contact?.name || contact?.notify || '';
        const nameViolation = checkSuspiciousName(contactName);
        if (nameViolation) {
          logger.warn(
            { participantJid, contactName, nameViolation },
            '🚫 Prohibited Name Pattern detected on joining WhatsApp participant'
          );
          const action = config.name_ban_action || 'ban';
          if (action === 'ban') {
            config.banned_users = config.banned_users || {};
            config.banned_users[cleanDigits || userId] = {
              timestamp: Date.now(),
              reason: `Prohibited name pattern (${nameViolation})`,
            };
            store.groups[groupId] = config;
            saveModerationStore(store);
          }
          try {
            await session.sock.groupParticipantsUpdate(groupId, [participantJid], 'remove');
            await reply(
              session,
              groupId,
              {
                text: `🚫 *Automated Moderation Notice*\n\nUser @${cleanDigits || userId} was removed.\n*Reason:* ${nameViolation}`,
                mentions: [participantJid],
              },
              rawMsg,
              { skipSpamGuard: true }
            );
          } catch (_err) {}
          continue;
        }
      }

      // Build consolidated Welcome + Rules + Captcha message (Single message to reduce spam)
      const isWelcomeEnabled = Boolean(config.greetings?.welcome_enabled);
      const isRulesOnJoin = Boolean(config.rules?.show_on_join && config.rules?.text);
      const isCaptchaEnabled = Boolean(config.greetings?.captcha_enabled);

      if (isWelcomeEnabled || isRulesOnJoin || isCaptchaEnabled) {
        // Reset old Captcha verification status on rejoin if Captcha is enabled so user must verify again
        if (isCaptchaEnabled && config.verified_users) {
          delete config.verified_users[userId];
          if (cleanDigits) delete config.verified_users[cleanDigits];
          const canonicalRejoin = resolveCanonicalUserKey(participantJid, session);
          if (canonicalRejoin) delete config.verified_users[canonicalRejoin];
          store.groups[groupId] = config;
          saveModerationStore(store);
        }
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
          const mode = config.greetings.captcha_mode || 'math';
          let answer;
          let captchaSection;

          if (mode === 'math') {
            const n1 = Math.floor(Math.random() * 12) + 1;
            const n2 = Math.floor(Math.random() * 12) + 1;
            const op = Math.random() > 0.5 ? '+' : '*';
            answer = op === '+' ? String(n1 + n2) : String(n1 * n2);
            captchaSection = `🤖 *Captcha Verification*\nSolve the security challenge to verify:\n👉 *${n1} ${op} ${n2} = ?*\n\nReply with the correct number to gain access.`;
          } else if (mode === 'text' || mode === 'code') {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = '';
            for (let i = 0; i < 5; i++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            answer = code.toLowerCase();
            captchaSection = `🤖 *Captcha Verification*\nType the following security code to verify:\n👉 *${code}*`;
          } else {
            // Default / Button fallback
            const n1 = Math.floor(Math.random() * 9) + 1;
            const n2 = Math.floor(Math.random() * 9) + 1;
            answer = String(n1 + n2);
            captchaSection = `🤖 *Captcha Verification*\nSolve math problem to verify:\n👉 *${n1} + ${n2} = ?*`;
          }

          messageParts.push(captchaSection);

          // Clear any pre-existing pending Captcha and its timeout handle for this user
          clearPendingCaptcha(groupId, userId, session);
          clearPendingCaptcha(groupId, participantJid, session);

          const captchaKey = getWindowKey(groupId, userId);
          const timeoutSec = config.greetings.captcha_timeout_seconds || 120;
          const mentionJid = normalizeJid(participantJid).replace(/@lid$/, '@s.whatsapp.net');

          const timeoutHandle = setTimeout(async () => {
            // Check if user is verified before executing removal
            const pendingCheck =
              findPendingCaptcha(groupId, userId, session) ||
              findPendingCaptcha(groupId, participantJid, session);
            if (
              !pendingCheck ||
              isUserVerified(groupId, userId, session) ||
              isUserVerified(groupId, participantJid, session)
            ) {
              clearPendingCaptcha(groupId, userId, session);
              return;
            }

            // Check if user is a WhatsApp Group Admin — Group Admins are exempt from Captcha kick timeout!
            let userIsAdmin = false;

            // Live check against Baileys group metadata if available
            if (!userIsAdmin && session?.sock?.groupMetadata) {
              try {
                const meta = await session.sock.groupMetadata(groupId);
                const tid = participantJid.split('@')[0].replace(/\D/g, '');
                let resolvedTid = tid;
                if (participantJid.endsWith('@lid') && session.contactCache) {
                  for (const c of session.contactCache.values()) {
                    const cLid = c.lid ? normalizeJid(c.lid) : '';
                    const cId = c.id ? normalizeJid(c.id) : '';
                    if (
                      cLid === normalizeJid(participantJid) ||
                      cId === normalizeJid(participantJid)
                    ) {
                      const pnDigits = (cId || cLid).split('@')[0].replace(/\D/g, '');
                      if (pnDigits) {
                        resolvedTid = pnDigits;
                        break;
                      }
                    }
                  }
                }

                const p = meta?.participants?.find((part) => {
                  const pid = part.id ? part.id.split('@')[0].replace(/\D/g, '') : '';
                  return pid === tid || pid === resolvedTid || part.id === participantJid;
                });
                if (p && (p.admin === 'admin' || p.admin === 'superadmin')) {
                  userIsAdmin = true;
                }
              } catch (metaErr) {
                logger.debug(
                  { error: metaErr.message },
                  'Failed to fetch live group metadata for captcha admin check'
                );
              }
            }

            if (userIsAdmin) {
              clearPendingCaptcha(groupId, userId, session);
              logger.info(
                { groupId, userId },
                '🛡️ User is an admin, skipping Captcha timeout kick'
              );
              return;
            }

            // Retrieve pending challenge info to verify if challenge was delivered
            const pendingEntry =
              findPendingCaptcha(groupId, userId, session) ||
              findPendingCaptcha(groupId, participantJid, session);
            if (!pendingEntry?.captchaObj?.delivered) {
              clearPendingCaptcha(groupId, userId, session);
              logger.warn(
                { groupId, userId },
                '⚠️ Skipping Captcha timeout kick because challenge message delivery was not confirmed.'
              );
              return;
            }

            clearPendingCaptcha(groupId, userId, session);
            const userLabel = resolveUserDisplayName(userId, session);

            // Record kick reason so goodbye message can display it
            const recObj = {
              reason: '⏱️ Removed — Captcha verification timed out',
              expires: Date.now() + 120000,
            };
            recentKickReasons.set(getWindowKey(groupId, userId), recObj);
            if (cleanDigits) recentKickReasons.set(getWindowKey(groupId, cleanDigits), recObj);
            const recCanonical = resolveCanonicalUserKey(userId, session);
            if (recCanonical) recentKickReasons.set(getWindowKey(groupId, recCanonical), recObj);

            await reply(
              session,
              groupId,
              {
                text: gt(config, 'bot_replies.captcha_timeout', { user: userLabel }),
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
          }, timeoutSec * 1000);
          if (timeoutHandle.unref) timeoutHandle.unref();

          const captchaObj = {
            answer,
            mode,
            timeoutHandle,
            timestamp: Date.now(),
            delivered: false,
            participantJid,
          };
          pendingCaptchas.set(captchaKey, captchaObj);
          if (cleanDigits) pendingCaptchas.set(getWindowKey(groupId, cleanDigits), captchaObj);
          const participantUser = participantJid.split('@')[0];
          if (participantUser)
            pendingCaptchas.set(getWindowKey(groupId, participantUser), captchaObj);
          const canonicalPhoneKeyVal = resolveCanonicalUserKey(participantJid, session);
          if (canonicalPhoneKeyVal)
            pendingCaptchas.set(getWindowKey(groupId, canonicalPhoneKeyVal), captchaObj);
        }

        const fullText = messageParts.join('\n\n');
        const canonicalPhoneKey = resolveCanonicalUserKey(participantJid, session);
        const isLidDigits = (canonicalPhoneKey || '').startsWith('1576');
        const phoneJid =
          !isLidDigits && canonicalPhoneKey
            ? `${canonicalPhoneKey}@s.whatsapp.net`
            : normalizeJid(participantJid).replace(/@lid$/, '@s.whatsapp.net');
        const targetPrivateJid =
          phoneJid.includes('1576') && !phoneJid.includes('@s.whatsapp.net')
            ? null
            : phoneJid.replace(/@lid$/, '@s.whatsapp.net');
        const mentionJid = targetPrivateJid || normalizeJid(participantJid);

        const welcomeTargetMode =
          config.greetings?.welcome_target || config.greetings?.captcha_target || 'private';
        const targetMode = isCaptchaEnabled
          ? config.greetings?.captcha_target || 'private'
          : welcomeTargetMode;
        let sentViaDM = false;

        // Attempt sending Welcome & Captcha via Private DM if configured as 'private'
        if (targetMode === 'private' && targetPrivateJid) {
          try {
            await reply(session, targetPrivateJid, {
              text: gt(config, 'bot_replies.welcome_group_info', {
                group: groupMeta?.subject || 'Group',
                text: fullText,
              }),
            });
            sentViaDM = true; // Only mark as sent if the DM actually succeeded
          } catch (dmErr) {
            logger.info(
              { error: dmErr.message, targetPrivateJid },
              'Private DM delivery failed, falling back to group'
            );
          }
        }

        // Send into Group if targetMode is 'group' OR if Private DM delivery failed (fallback)
        if (!sentViaDM) {
          const groupNotice =
            targetMode === 'private' && isCaptchaEnabled
              ? `⚠️ _Direct message to ${resolveUserDisplayName(userId, session)} could not be delivered. Please verify here in the group:_\n\n${fullText}`
              : fullText;

          await reply(
            session,
            groupId,
            {
              text: groupNotice,
              mentions: [mentionJid],
            },
            rawMsg
          );
        }

        // Update pending captcha delivered state for all variant keys
        if (isCaptchaEnabled) {
          const entry = findPendingCaptcha(groupId, userId, session);
          if (entry?.captchaObj) entry.captchaObj.delivered = true;
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

      for (const participantJid of filteredParticipants) {
        const userId = participantJid.split('@')[0];
        const cleanDigits = userId.replace(/\D/g, '');

        // --- Determine departure reason ---
        let departureReason = '';
        if (action === 'leave') {
          departureReason = '🚶 Left voluntarily';
        } else if (action === 'remove') {
          // Check recent kick reason registry (e.g. captcha timeout)
          const canonicalUser = resolveCanonicalUserKey(userId, session);
          const kickKeys = [
            getWindowKey(groupId, userId),
            cleanDigits ? getWindowKey(groupId, cleanDigits) : null,
            canonicalUser ? getWindowKey(groupId, canonicalUser) : null,
          ].filter(Boolean);

          for (const kKey of kickKeys) {
            const recentKick = recentKickReasons.get(kKey);
            if (recentKick && recentKick.expires > Date.now()) {
              departureReason = recentKick.reason;
              recentKickReasons.delete(kKey);
              break;
            }
          }

          if (!departureReason) {
            // Check group ban
            const bannedMap = config.banned_users || {};
            const banInfo = bannedMap[userId] || (cleanDigits ? bannedMap[cleanDigits] : null);
            if (banInfo) {
              departureReason = `🚫 Banned${banInfo.reason ? ` — _${banInfo.reason}_` : ''}`;
            }
          }

          if (!departureReason) {
            // Check federation ban
            const fedId = config.federation_id;
            if (fedId) {
              const fed = store.federations?.find((f) => f.id === fedId);
              if (
                fed &&
                (fed.banned_users?.includes(userId) ||
                  (cleanDigits && fed.banned_users?.includes(cleanDigits)))
              ) {
                departureReason = '🌐 Banned via Global Security Federation';
              }
            }
          }

          if (!departureReason) {
            const warningsMap = config.warnings?.user_warns || {};
            const warnings = warningsMap[userId] || (cleanDigits ? warningsMap[cleanDigits] : null);
            const warnCount = Array.isArray(warnings) ? warnings.length : warnings ? 1 : 0;
            if (warnCount > 0) {
              departureReason = `⚠️ Removed after ${warnCount} warning${warnCount !== 1 ? 's' : ''}`;
            }
          }

          if (!departureReason) {
            departureReason = '🔇 Removed by an admin';
          }
        }

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

        if (departureReason) {
          goodbyeMsg += `\n\n📋 *Reason:* ${departureReason}`;
        }

        const goodbyeTarget = config.greetings.goodbye_target || 'private';
        if (goodbyeTarget === 'private') {
          // Attempt Private DM delivery to leaving user first
          const sentDM = await reply(session, participantJid, { text: goodbyeMsg });
          if (!sentDM) {
            // Fallback to group if DM fails
            await reply(session, groupId, { text: goodbyeMsg }, rawMsg);
          }
        } else {
          // Send Goodbye message directly to Group
          await reply(session, groupId, { text: goodbyeMsg }, rawMsg);
        }
      }
    }
  }
}

export function setUserCaptchaVerification(groupId, userId, verified, session = null) {
  const store = loadModerationStore();
  const config = getGroupModerationConfig(groupId);
  config.verified_users = config.verified_users || {};

  const cleanId = (userId || '').replace(/\D/g, '');
  const canonicalKey = resolveCanonicalUserKey(userId, session);

  const record = {
    verified: Boolean(verified),
    timestamp: Date.now(),
    mode: 'manual',
  };

  config.verified_users[userId] = record;
  if (cleanId) config.verified_users[cleanId] = record;
  if (canonicalKey) config.verified_users[canonicalKey] = record;

  if (verified) {
    const entry = findPendingCaptcha(groupId, userId, session);
    if (entry) {
      clearTimeout(entry.captchaObj.timeoutHandle);
      pendingCaptchas.delete(entry.key);
    }
  }

  store.groups[groupId] = config;
  saveModerationStore(store);
  return record;
}

export async function getGroupCaptchaUsers(groupId, session = null) {
  const config = getGroupModerationConfig(groupId);
  const verifiedMap = config.verified_users || {};

  let participants = [];
  if (session?.sock?.groupMetadata) {
    try {
      const meta = await session.sock.groupMetadata(groupId);
      participants = meta?.participants || [];
    } catch (e) {
      logger.debug(
        { error: e.message, groupId },
        'Failed to fetch group metadata for captcha users'
      );
    }
  }

  const result = [];
  const processedUserIds = new Set();

  for (const p of participants) {
    const pJid = p.id ? normalizeJid(p.id) : '';
    const pUser = pJid.split('@')[0];
    const cleanDigits = pUser.replace(/\D/g, '');
    const canonicalKey = resolveCanonicalUserKey(pJid, session);

    processedUserIds.add(pUser);
    if (cleanDigits) processedUserIds.add(cleanDigits);
    if (canonicalKey) processedUserIds.add(canonicalKey);

    const pending = findPendingCaptcha(groupId, pUser, session);
    const verRecord =
      verifiedMap[pUser] ||
      (cleanDigits ? verifiedMap[cleanDigits] : null) ||
      (canonicalKey ? verifiedMap[canonicalKey] : null);

    const isVerified = verRecord ? Boolean(verRecord.verified) : !pending;

    result.push({
      userId: pUser,
      jid: pJid,
      name: resolveUserDisplayName(pUser, session) || pUser,
      verified: isVerified,
      pending: Boolean(pending),
      timestamp: verRecord?.timestamp || pending?.captchaObj?.timestamp || null,
      mode: verRecord?.mode || (pending ? 'pending' : 'auto'),
      isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
    });
  }

  for (const [uId, verRecord] of Object.entries(verifiedMap)) {
    if (!processedUserIds.has(uId)) {
      processedUserIds.add(uId);
      result.push({
        userId: uId,
        jid: uId.includes('@') ? uId : `${uId}@s.whatsapp.net`,
        name: resolveUserDisplayName(uId, session) || uId,
        verified: Boolean(verRecord?.verified),
        pending: false,
        timestamp: verRecord?.timestamp || null,
        mode: verRecord?.mode || 'manual',
        isAdmin: false,
      });
    }
  }

  return result;
}
