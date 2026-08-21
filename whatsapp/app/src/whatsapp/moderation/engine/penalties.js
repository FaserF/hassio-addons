import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../store.js';
import { reply } from '../../actions.js';
import { logger } from '../../../logger.js';
import {
  resolveCanonicalUserKey,
  resolveUserDisplayName,
  normalizeJid,
  isSameUser,
} from '../../../utils/security.js';
import { gt } from './translations.js';

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

export function generateBotWelcomeMessage(isBotAdmin = false, config = null) {
  let adminNotice = '';
  if (!isBotAdmin) {
    adminNotice = `${gt(config, 'bot_replies.bot_welcome_missing_admin_notice')}\n\n`;
  }

  return `🤖 *${gt(config, 'bot_replies.bot_welcome_title')}*

${adminNotice}⚡ *${gt(config, 'bot_replies.bot_welcome_capabilities_header')}:*
• *${gt(config, 'bot_replies.bot_welcome_cap_welcome')}:* ${gt(config, 'bot_replies.bot_welcome_cap_welcome_desc')}
• *${gt(config, 'bot_replies.bot_welcome_cap_autoresponder')}:* ${gt(config, 'bot_replies.bot_welcome_cap_autoresponder_desc')}
• *${gt(config, 'bot_replies.bot_welcome_cap_moderation')}:* ${gt(config, 'bot_replies.bot_welcome_cap_moderation_desc')}
• *${gt(config, 'bot_replies.bot_welcome_cap_notes')}:* ${gt(config, 'bot_replies.bot_welcome_cap_notes_desc')}
• *${gt(config, 'bot_replies.bot_welcome_cap_ha')}:* ${gt(config, 'bot_replies.bot_welcome_cap_ha_desc')}

⚙️ *${gt(config, 'bot_replies.bot_welcome_commands_header')}:*
• ${gt(config, 'bot_replies.bot_welcome_cmd_help')}
• ${gt(config, 'bot_replies.bot_welcome_cmd_rules')}
• ${gt(config, 'bot_replies.bot_welcome_cmd_admins')}
• ${gt(config, 'bot_replies.bot_welcome_cmd_report')}

📚 *${gt(config, 'bot_replies.bot_welcome_docs_header')}:*
https://faserf.github.io/ha-whatsapp/`;
}

export async function sendMissingAdminWarning(
  session,
  groupId,
  attemptedAction = '',
  rawMsg = null
) {
  const config = getGroupModerationConfig(groupId);
  const text = gt(config, 'bot_replies.bot_missing_admin_warning_full', {
    action: attemptedAction || gt(config, 'bot_replies.admin_action_generic'),
  });

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
