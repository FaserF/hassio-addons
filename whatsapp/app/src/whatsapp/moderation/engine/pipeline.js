import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../store.js';
import { processAiModeration } from '../ai.js';
import { translateTextGatewayWithReason } from '../../../utils/gatewayTranslator.js';
import { reply } from '../../actions.js';
import { logger } from '../../../logger.js';
import { checkSuspiciousName } from '../securityScanner.js';
import { gt, recordTranslationMap, shouldSkipDuplicateTranslation } from './translations.js';
import { executePenalty, issueUserWarning } from './penalties.js';
import {
  findPendingCaptcha,
  isUserVerified,
  cleanCaptchaInput,
  pendingCaptchas,
  getWindowKey,
  handlePrivateCaptchaMessage,
} from './captcha.js';
import { SPAM_INVITE_LINK_PATTERNS, userFloodMap } from './filters.js';
import { resolveCanonicalUserKey } from '../../../utils/security.js';

// Per-trigger cooldown: prevents the same trigger from firing more than once per group
// within TRIGGER_COOLDOWN_MS milliseconds. Key: `${groupId}:${trigger}`.
// This is defense-in-depth against loops where a bot response contains a trigger substring.
const TRIGGER_COOLDOWN_MS = 30_000;
const _triggerCooldowns = new Map();

export async function handleModerationMessage(session, event) {
  const store = loadModerationStore();
  const isGroup = event.is_group ?? event.sender?.endsWith('@g.us');
  const groupId = isGroup ? event.from || event.sender : event.sender;
  const config = getGroupModerationConfig(groupId);

  const isTranslationActive = Boolean(config.translation?.enabled);
  const isGroupConfigured = config.enabled || isTranslationActive || Boolean(config.stt_enabled);
  if (!store.global_enabled || !isGroupConfigured) {
    logger.debug('Skipping moderation: global_enabled is false or group features not configured');
    return false;
  }

  // Bot's own outgoing messages must NEVER be processed by the moderation pipeline,
  // auto-responders, translation engine, or blacklist under any circumstance.
  // This completely eliminates any feedback loops where bot responses trigger further reactions.
  if (event.raw?.key?.fromMe || event.from_me) return false;

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
        // Cooldown guard: if this exact trigger already fired in this group within
        // TRIGGER_COOLDOWN_MS, skip it. Prevents any loop where a bot response
        // contains the trigger substring and somehow bypasses the fromMe guard.
        const cooldownKey = `${groupId}:${filter.trigger}`;
        const lastFired = _triggerCooldowns.get(cooldownKey) ?? 0;
        if (Date.now() - lastFired < TRIGGER_COOLDOWN_MS) {
          logger.debug(
            { groupId, trigger: filter.trigger },
            'Trigger cooldown active — skipping to prevent loop'
          );
          continue;
        }
        _triggerCooldowns.set(cooldownKey, Date.now());

        // 1. Dispatch Emoji Reaction directly to the triggering message
        if (filter.reaction_emoji && rawMsg?.key?.id) {
          try {
            await session.sock.sendMessage(groupId, {
              react: { text: filter.reaction_emoji, key: rawMsg.key },
            });
          } catch (e) {
            logger.debug({ error: e.message }, 'Failed to send filter emoji reaction');
          }
        }

        // 2. Dispatch Media Response (Sticker / GIF)
        if (filter.media_type === 'sticker' && filter.media_url) {
          try {
            await session.sock.sendMessage(groupId, {
              sticker: { url: filter.media_url },
            });
          } catch (e) {
            logger.warn({ error: e.message }, 'Failed to send filter sticker');
          }
        } else if (filter.media_type === 'gif' && filter.media_url) {
          try {
            await session.sock.sendMessage(groupId, {
              video: { url: filter.media_url },
              caption: filter.response || '',
              gifPlayback: true,
            });
          } catch (e) {
            logger.warn({ error: e.message }, 'Failed to send filter GIF');
          }
        } else if (filter.response) {
          // 3. Dispatch Text Reply / FAQ Hint
          const isFaq = filter.type === 'faq';
          const replyText = isFaq
            ? gt(config, 'bot_replies.faq_hint', { response: filter.response })
            : filter.response;

          await reply(session, groupId, { text: replyText }, rawMsg);
        }

        // 4. Dispatch Document / File Attachment
        if (filter.file_url && filter.media_type !== 'sticker' && filter.media_type !== 'gif') {
          try {
            await session.sock.sendMessage(groupId, {
              document: { url: filter.file_url },
              fileName: filter.file_name || 'Document.pdf',
              mimetype: 'application/octet-stream',
            });
          } catch (e) {
            logger.warn({ error: e.message }, 'Failed to send filter document attachment');
          }
        }

        // 5. Dispatch Interactive Poll
        if (
          filter.poll_options &&
          Array.isArray(filter.poll_options) &&
          filter.poll_options.length >= 2
        ) {
          try {
            await session.sock.sendMessage(groupId, {
              poll: {
                name: filter.poll_question || 'FAQ Poll',
                values: filter.poll_options,
                selectableCount: 1,
              },
            });
          } catch (e) {
            logger.warn({ error: e.message }, 'Failed to send filter poll');
          }
        }

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
  }

  // 0. Non-destructive Auto-Translation Engine (never translate bot's own messages or existing translations)
  const isTranslationHeader =
    text &&
    (/🌐\s*\*.*[→\->].*\*\s*:?/i.test(text) ||
      /_\s*🌐\s*\[.*\]\s*_/i.test(text) ||
      text.includes('🌐 ['));

  const isSyntheticMessage =
    rawMsg?.key?.fromMe ||
    event.from_me ||
    isTranslationHeader ||
    event.media_type === 'location' ||
    event.media_type === 'contact' ||
    event.media_type === 'poll' ||
    event.media_type === 'sticker' ||
    event.media_type === 'buttons' ||
    event.media_type === 'list' ||
    event.media_type === 'interactive' ||
    event.media_type === 'protocol' ||
    event.type === 'poll' ||
    event.type === 'location' ||
    event.type === 'contact' ||
    event.type === 'reaction' ||
    /^(📍\s*\[(Location|Live Location) Share|👤\s*\[Contact:|📊\s*\[Poll|🔘\s*\[|📋\s*\[List:|🗳️\s*Vote:|📅\s*\*?\[Event)/i.test(
      text
    ) ||
    /^[!/#.?]\w+/i.test(text);

  if (isTranslationActive && !isSyntheticMessage && text && text.trim().length > 2) {
    const targetLang = config.translation?.target_lang || 'en';
    const provider = config.translation?.provider || 'auto';

    if (shouldSkipDuplicateTranslation(groupId, text, targetLang, 120000)) {
      logger.info(
        { groupId, textSnippet: text.slice(0, 40) },
        'ℹ️ Skipping auto-translation: identical message was already translated recently'
      );
    } else {
      logger.info(
        { groupId, textSnippet: text.slice(0, 40), targetLang, provider },
        '🌐 Processing auto-translation for group message'
      );

      const transResult =
        provider === 'ai'
          ? await (async () => {
              const { processAiModeration } = await import('../ai.js');
              return processAiModeration(text, config.ai || {}, store.gemini_api_key, 'translate', {
                targetLang,
              });
            })()
          : await translateTextGatewayWithReason(text, targetLang, provider);

      if (
        transResult?.translation &&
        transResult.translation.trim().toLowerCase() !== text.trim().toLowerCase()
      ) {
        const srcCode = (transResult.sourceLang || transResult.detectedSource || '?').toLowerCase();
        const dstCode = targetLang.toLowerCase();

        // Skip translation if detected source language is already the target language
        if (srcCode !== '?' && srcCode === dstCode) {
          logger.info(
            { srcCode, dstCode },
            'Skipping auto-translation: source language matches target language'
          );
        } else {
          const header = gt(config, 'bot_replies.auto_translation_header', {
            src: srcCode.toUpperCase(),
            dst: dstCode.toUpperCase(),
          });
          const provBadge = transResult.providerName
            ? `\n\n_🌐 [${transResult.providerName}]_`
            : transResult.provider
              ? `\n\n_🌐 [${transResult.provider}]_`
              : '';
          const sentTransMsg = await reply(
            session,
            groupId,
            { text: `${header}\n\n"${transResult.translation}"${provBadge}` },
            rawMsg
          );
          if (sentTransMsg?.key?.id && rawMsg?.key?.id) {
            recordTranslationMap(groupId, rawMsg.key.id, sentTransMsg.key.id, sentTransMsg.key);
          }
          logger.info(
            { groupId, src: srcCode, dst: dstCode },
            '✅ Auto-translation successfully sent to group'
          );
        }
      } else {
        logger.info(
          {
            textSnippet: text.slice(0, 40),
            reason: transResult?.reason || 'Translation matched original text or returned empty',
          },
          'ℹ️ Auto-translation skipped: no distinct translation produced'
        );
      }
    }
  }

  if (isGroupAdminUser || (config.approved && config.approved.includes(userId))) {
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
    const { performSecurityScan } = await import('../securityScanner.js');
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
