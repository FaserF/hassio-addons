import {
  loadModerationStore,
  getGroupModerationConfig,
  saveModerationStore,
  clearModerationStoreCache,
} from '../store.js';
import { reply } from '../../actions.js';
import { logger } from '../../../logger.js';
import {
  resolveCanonicalUserKey,
  resolveUserDisplayName,
  normalizeJid,
  isSameUser,
} from '../../../utils/security.js';
import { checkSuspiciousName } from '../securityScanner.js';
import { gt } from './translations.js';
import { formatDuration } from '../../../utils/format.js';
import {
  isSelfParticipant,
  generateBotWelcomeMessage,
  sendMissingAdminWarning,
  executePenalty,
} from './penalties.js';
import {
  findPendingCaptcha,
  clearPendingCaptcha,
  savePendingCaptcha,
  isUserVerified,
  recentKickReasons,
  getWindowKey,
  pendingCaptchas,
} from './captcha.js';
import { groupJoinMap } from './filters.js';

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

        const botWelcomeText = generateBotWelcomeMessage(isBotAdmin, config);
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
                text: gt(config, 'bot_replies.auto_moderation_name_notice', {
                  user: cleanDigits || userId,
                  reason: nameViolation,
                }),
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
            gt(config, 'bot_replies.welcome_template_default');
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
          messageParts.push(gt(config, 'bot_replies.welcome_short_greeting', { user: userId }));
        }

        // 2. Inline Group Rules (Appended if show_on_join is active)
        if (isRulesOnJoin) {
          messageParts.push(`📜 *${gt(config, 'bot_replies.rules_title')}:*\n${config.rules.text}`);
        }

        // 3. Inline Captcha Challenge
        if (isCaptchaEnabled) {
          const mode = config.greetings.captcha_mode || 'math';
          const author = update.author || update.actor || null;
          const isSelfJoin =
            !author ||
            action === 'invite' ||
            action === 'join' ||
            isSameUser(author, participantJid, session) ||
            isSameUser(author, userId, session);
          const timeoutSec = isSelfJoin
            ? config.greetings?.captcha_timeout_join_seconds ||
              config.greetings?.captcha_timeout_seconds ||
              120
            : config.greetings?.captcha_timeout_added_seconds || 600;
          const timeoutFormatted = formatDuration(timeoutSec * 1000);

          let answer;
          let captchaSection;

          if (mode === 'math') {
            const n1 = Math.floor(Math.random() * 12) + 1;
            const n2 = Math.floor(Math.random() * 12) + 1;
            const op = Math.random() > 0.5 ? '+' : '*';
            answer = op === '+' ? String(n1 + n2) : String(n1 * n2);
            captchaSection = gt(config, 'bot_replies.captcha_challenge_math', {
              n1,
              op,
              n2,
              timeout: timeoutFormatted,
            });
          } else if (mode === 'text' || mode === 'code') {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = '';
            for (let i = 0; i < 5; i++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            answer = code.toLowerCase();
            captchaSection = gt(config, 'bot_replies.captcha_challenge_code', {
              code,
              timeout: timeoutFormatted,
            });
          } else {
            // Default / Button fallback
            const n1 = Math.floor(Math.random() * 9) + 1;
            const n2 = Math.floor(Math.random() * 9) + 1;
            answer = String(n1 + n2);
            captchaSection = gt(config, 'bot_replies.captcha_challenge_math_simple', {
              n1,
              n2,
              timeout: timeoutFormatted,
            });
          }

          messageParts.push(captchaSection);

          // Clear any pre-existing pending Captcha and its timeout handle for this user
          clearPendingCaptcha(groupId, userId, session);
          clearPendingCaptcha(groupId, participantJid, session);

          const captchaKey = getWindowKey(groupId, userId);
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
            expiresAt: Date.now() + timeoutSec * 1000,
          };
          pendingCaptchas.set(captchaKey, captchaObj);
          if (cleanDigits) pendingCaptchas.set(getWindowKey(groupId, cleanDigits), captchaObj);
          const participantUser = participantJid.split('@')[0];
          if (participantUser)
            pendingCaptchas.set(getWindowKey(groupId, participantUser), captchaObj);
          const canonicalPhoneKeyVal = resolveCanonicalUserKey(participantJid, session);
          if (canonicalPhoneKeyVal)
            pendingCaptchas.set(getWindowKey(groupId, canonicalPhoneKeyVal), captchaObj);

          savePendingCaptcha(groupId, userId, {
            participantJid,
            answer,
            mode,
            timestamp: Date.now(),
            timeoutSec,
            expiresAt: Date.now() + timeoutSec * 1000,
          });
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
          departureReason = gt(config, 'bot_replies.departure_voluntary');
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
              departureReason = `🚫 ${gt(config, 'bot_replies.departure_banned')}${banInfo.reason ? ` — _${banInfo.reason}_` : ''}`;
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
                departureReason = `🌐 ${gt(config, 'bot_replies.departure_fed_banned')}`;
              }
            }
          }

          if (!departureReason) {
            const warningsMap = config.warnings?.user_warns || {};
            const warnings = warningsMap[userId] || (cleanDigits ? warningsMap[cleanDigits] : null);
            const warnCount = Array.isArray(warnings) ? warnings.length : warnings ? 1 : 0;
            if (warnCount > 0) {
              departureReason = `⚠️ ${gt(config, 'bot_replies.departure_warn_limit', { count: warnCount })}`;
            }
          }

          if (!departureReason) {
            departureReason = `🔇 ${gt(config, 'bot_replies.departure_admin_remove')}`;
          }
        }

        let goodbyeMsg =
          config.greetings.goodbye_text ||
          config.greetings.goodbye_message ||
          gt(config, 'bot_replies.goodbye_template_default');
        goodbyeMsg = formatMessageTemplate(goodbyeMsg, {
          userId,
          participantJid,
          groupId,
          groupMeta,
          config,
          session,
        });

        if (departureReason) {
          goodbyeMsg += `\n\n📋 *${gt(config, 'bot_replies.reason_label')}:* ${departureReason}`;
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
