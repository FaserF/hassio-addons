import { delay } from '@whiskeysockets/baileys';
import { logger } from '../logger.js';
import { ADMIN_NUMBERS, ADMIN_NOTIFICATIONS_ENABLED, WELCOME_MESSAGE_ENABLED } from '../config.js';
import { getJid } from '../utils/jid.js';
import { maskData, isAdmin } from '../utils/security.js';
import { formatHATime } from '../utils/format.js';
import { markUserAsSeen } from '../state.js';
import { sessions, enqueue } from '../session.js';
import { sendHANotification } from '../ha.js';
import { getGroupModerationConfig, loadModerationStore } from './moderation/store.js';
import { gt } from './moderation/engine.js';

// Sliding window store for bot outbound message rate limiting
// Map<jid, Array<timestamp>>
const botOutboundWindows = new Map();
// Map<jid, number> (timestamp until muted)
const botMutedUntilMap = new Map();
// Set of active diagnostic target JIDs (exempt from self-message filtering and outbound anti-spam mute)
export const activeDiagnosticChats = new Set();

/**
 * Resets the bot outbound rate limit window and mute state.
 * If jid is null, resets for all chats.
 */
export function resetBotOutboundSpamGuard(jid = null) {
  if (jid) {
    botOutboundWindows.delete(jid);
    botMutedUntilMap.delete(jid);
  } else {
    botOutboundWindows.clear();
    botMutedUntilMap.clear();
  }
}

/**
 * Checks and updates the bot outbound anti-spam rate limiter for a specific chat/group JID.
 * EXEMPT: Telegram Relay messages (options.isTelegramRelay) or options.skipSpamGuard.
 */
export async function checkBotOutboundSpamGuard(session, jid, options = {}) {
  const targetJid = String(jid || '').trim();
  if (options?.isTelegramRelay || options?.skipSpamGuard || activeDiagnosticChats.has(targetJid)) {
    return { allowed: true };
  }

  const now = Date.now();
  if (!targetJid) return { allowed: true };

  // 1. Check if chat is currently stummschaltet (muted)
  const mutedUntil = botMutedUntilMap.get(targetJid) || 0;
  if (now < mutedUntil) {
    const remainingSec = Math.ceil((mutedUntil - now) / 1000);
    logger.warn(
      { jid: maskData(targetJid), remainingSec },
      '🚫 Bot reply blocked by Outbound Anti-Spam Mute'
    );
    return { allowed: false, remainingSec };
  }

  // 2. Check moderation config for this group / chat
  let enabled = true;
  let maxMessagesIn5s = 5;
  try {
    const modStore = loadModerationStore();
    if (modStore && modStore.global_enabled === false) {
      enabled = false;
    } else {
      const groupCfg = getGroupModerationConfig(targetJid);
      if (groupCfg && groupCfg.antispam && groupCfg.antispam.bot_anti_spam) {
        enabled = groupCfg.antispam.bot_anti_spam.enabled !== false;
        maxMessagesIn5s = groupCfg.antispam.bot_anti_spam.max_messages_5s || 5;
      }
    }
  } catch (_e) {
    // Default to enabled
  }

  if (!enabled) {
    return { allowed: true };
  }

  // 3. Update 5s sliding window
  const windowMs = 5000;
  let timestamps = botOutboundWindows.get(targetJid) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);
  timestamps.push(now);
  botOutboundWindows.set(targetJid, timestamps);

  // 4. Check if limit is exceeded
  if (timestamps.length >= maxMessagesIn5s) {
    let memberCount = 2; // Default for 1:1 chats
    if (targetJid.includes('@g.us')) {
      memberCount = 10; // Default estimate for groups
      try {
        if (session?.sock?.groupMetadata) {
          const meta = await session.sock.groupMetadata(targetJid).catch(() => null);
          if (meta && Array.isArray(meta.participants) && meta.participants.length > 0) {
            memberCount = meta.participants.length;
          }
        }
      } catch (_e) {}
    }

    const msgCount = timestamps.length;
    // Formula: X = Nachrichten_in_5s * Mitgliederauszahl_Gruppe
    const muteSeconds = Math.max(10, msgCount * memberCount);
    const muteDurationMs = muteSeconds * 1000;

    botMutedUntilMap.set(targetJid, now + muteDurationMs);
    botOutboundWindows.set(targetJid, []);

    logger.warn(
      { jid: maskData(targetJid), msgCount, memberCount, muteSeconds },
      '⚠️ Bot Outbound Anti-Spam limit reached! Muting bot responses in chat.'
    );

    return {
      allowed: true,
      triggerWarning: true,
      muteSeconds,
      msgCount,
      memberCount,
    };
  }

  return { allowed: true };
}

/**
 * Sends a relative-path reply and tracks it in stats.
 */
export async function reply(session, jid, content, quotedMsg = null, options = {}) {
  if (!session.sock) {
    logger.warn(
      { sessionId: session.id, jid: maskData(jid) },
      'Cannot send reply: Socket not initialized'
    );
    return null;
  }

  // Check Outbound Anti-Spam Guard (Exempt: Telegram Relay / skipSpamGuard)
  if (!options?.skipSpamGuard && !options?.isTelegramRelay) {
    const spamCheck = await checkBotOutboundSpamGuard(session, jid, options);
    if (!spamCheck.allowed) {
      return null;
    }
    if (spamCheck.triggerWarning) {
      const warningText = `⚠️ *Bot Anti-Spam Schutz*: Outbound-Limit (${spamCheck.msgCount} Nachrichten in 5s) in diesem Chat überschritten.\n\nDer Bot pausiert automatische Antworten in dieser Gruppe/Chat für *${spamCheck.muteSeconds} Sekunden* (${spamCheck.msgCount} Msg × ${spamCheck.memberCount} Mitglieder), um Spam-Loops und Fehler zu vermeiden.`;
      try {
        await enqueue(session, () =>
          session.sock.sendMessage(
            jid,
            { text: warningText },
            quotedMsg ? { quoted: quotedMsg } : {}
          )
        );
      } catch (_e) {}
    }
  }

  try {
    // Build sendMessage options — attach quoted for context in busy groups
    const sendOptions = quotedMsg ? { quoted: quotedMsg } : {};
    const contentObj = typeof content === 'string' ? { text: content } : content;
    const result = await enqueue(session, () =>
      session.sock.sendMessage(jid, contentObj, sendOptions)
    );
    if (result && result.key && result.key.id && session.messageStore) {
      session.messageStore.set(result.key.id, result);
    }
    const text = contentObj.text || '[Mixed Content]';
    const target = jid.includes('@g.us') ? jid : jid.split('@')[0].split(':')[0];

    trackSent(session, target, text);
    return result;
  } catch (err) {
    const text = typeof content === 'string' ? content : content?.text || '[Mixed Content]';
    const reasonText = err?.message || String(err || 'Unknown sending error');
    trackFailure(session, jid, text, reasonText);
    logger.error({ error: reasonText, jid }, 'Failed to send reply');
    session.stats.failed = (session.stats.failed || 0) + 1;
    session.stats.lifetime_failed = (session.stats.lifetime_failed || 0) + 1;
    logger.debug({ sessionId: session.id, jid: maskData(jid) }, '📉 Stat: Failed incremented');
    return null;
  }
}

export function trackSent(session, target, message) {
  const timestamp = formatHATime(new Date());
  const displayTarget = target.includes('@g.us') ? target : target.split('@')[0];
  session.recentSent.unshift({
    timestamp,
    target: maskData(displayTarget),
    message: maskData(message),
  });
  if (session.recentSent.length > 5) session.recentSent.pop();

  // Update session stats for sent counter and attributes
  if (session.stats) {
    session.stats.sent = (session.stats.sent || 0) + 1;
    session.stats.lifetime_sent = (session.stats.lifetime_sent || 0) + 1;
    session.stats.last_sent_message = maskData(message);
    session.stats.last_sent_target = maskData(displayTarget);
    session.stats.last_sent_time = Date.now();
  }
}

export function trackReceived(session, sender, message) {
  const timestamp = formatHATime(new Date());
  const displaySender = sender.includes('@g.us') ? sender : sender.split('@')[0];
  session.recentReceived.unshift({
    timestamp,
    sender: maskData(displaySender),
    message: maskData(message),
  });
  if (session.recentReceived.length > 5) session.recentReceived.pop();

  // Update session stats for received counter and attributes
  if (session.stats) {
    session.stats.received = (session.stats.received || 0) + 1;
    session.stats.last_received_message = maskData(message);
    session.stats.last_received_sender = maskData(displaySender);
    session.stats.last_received_time = Date.now();
  }
}

export function trackFailure(session, target, message, reason) {
  const timestamp = formatHATime(new Date());
  const displayTarget = target
    ? target.includes('@g.us')
      ? target
      : target.split('@')[0]
    : 'unknown';
  const cleanReason =
    typeof reason === 'string' ? reason : reason?.message || String(reason || 'Unknown error');
  session.recentFailures.unshift({
    timestamp,
    target: maskData(displayTarget),
    message: maskData(message || ''),
    reason: cleanReason,
  });
  if (session.recentFailures.length > 5) session.recentFailures.pop();
}

/**
 * Notifies administrators with a text message.
 * Will attempt to find ANY connected session if the provided one is down.
 * Falls back to Home Assistant persistent notifications if no WhatsApp session is active.
 */
export async function notifyAdmins(session, text) {
  if (!ADMIN_NOTIFICATIONS_ENABLED) return;

  const targets = [...ADMIN_NUMBERS];
  if (targets.length === 0 && session.sock?.user?.id) {
    targets.push(session.sock.user.id.split(':')[0]);
  }

  if (targets.length === 0) return;

  // Find a sender session (prefer the current one if it's connected)
  let senderSession = session;
  if (!senderSession.isConnected || !senderSession.sock) {
    senderSession = Array.from(sessions.values()).find((s) => s.isConnected && s.sock) || null;
  }

  if (senderSession) {
    for (const admin of targets) {
      const jid = getJid(admin);
      await reply(senderSession, jid, { text }).catch((e) =>
        logger.error(
          { error: e.message, admin: maskData(jid) },
          'Failed to notify admin via WhatsApp'
        )
      );
    }
  } else {
    // Fallback: Home Assistant Persistent Notification
    logger.info('No active WhatsApp sessions found for admin notification. Falling back to HA.');
    await sendHANotification('WhatsApp Addon Alert', text, `whatsapp_alert_${Date.now()}`);
  }
}

/**
 * Runs a set of diagnostic WhatsApp features.
 */
export async function runDiagnostic(session, senderJid, addLogFn) {
  // Always reply in the chat where the diagnostic was invoked (senderJid), fallback to admin number/own number if not provided
  let targetJid = senderJid;
  if (!targetJid || targetJid === 'me') {
    targetJid =
      ADMIN_NUMBERS.length > 0
        ? getJid(ADMIN_NUMBERS[0])
        : session.stats?.my_number
          ? getJid(session.stats.my_number)
          : null;
  }
  if (!targetJid) {
    targetJid = senderJid;
  }

  try {
    activeDiagnosticChats.add(targetJid);
    addLogFn(session, `Starting diagnostic test for ${maskData(targetJid)}`, 'info');
    addLogFn(session, `Diagnostic target: ${maskData(targetJid)}`, 'info');

    // 1. Presence Update (Typing...)
    if (session.sock && typeof session.sock.sendPresenceUpdate === 'function') {
      await session.sock.sendPresenceUpdate('composing', targetJid);
      await delay(500);
      await session.sock.sendPresenceUpdate('paused', targetJid);
    }

    // 0. Intro Message
    await reply(session, targetJid, {
      text:
        '🤖 *WhatsApp Integration: Diagnostic Test Started*\n\n' +
        'This test was triggered to verify all communication and message features.\n\n' +
        '*Upcoming Tests:*\n' +
        '• 📝 Text Message\n' +
        '• ✅ Reaction\n' +
        '• ✏️ Message Edit\n' +
        '• 🔘 Interactive Buttons & Poll Fallback\n' +
        '• 📍 Location Sharing\n' +
        '• 👤 Contact Card\n' +
        '• 🗑️ Auto-Deletion\n',
    });
    await delay(1000);

    // 1. Text Message
    const textMsg = await reply(session, targetJid, {
      text: '🧪 *Diagnostic Test [1/7]*: Text message works! ✅',
    });
    await delay(1000);

    // 2. Reaction
    if (textMsg) {
      await reply(session, targetJid, {
        react: { text: '✅', key: textMsg.key },
      });
      await delay(1000);
    }

    // 3. Edit Message
    const editMsg = await reply(session, targetJid, {
      text: 'This text will be edited...',
    });
    await delay(1000);
    if (editMsg) {
      await reply(session, targetJid, {
        text: '🧪 *Diagnostic Test [3/7]*: Message successfully edited! ✏️✅',
        edit: editMsg.key,
      });
      await delay(1000);
    }

    // 4. Interactive Poll Test (WhatsApp MD native replacement for deprecated buttons)
    await reply(session, targetJid, {
      poll: {
        name: '🧪 *Diagnostic Test [4/7]*: Interactive Poll Choice',
        values: ['Option 1 (Pass)', 'Option 2 (Pass)'],
        selectableCount: 1,
      },
    });
    await delay(1000);

    // 5. Location (München)
    await reply(session, targetJid, {
      location: { degreesLatitude: 48.1351, degreesLongitude: 11.582 },
      title: '🧪 Diagnostic Test [5/7]',
      address: 'Munich, Germany',
    });
    await delay(1000);

    // 6. Contact (VCard)
    const vcard =
      'BEGIN:VCARD\n' +
      'VERSION:3.0\n' +
      'FN:Home Assistant Bot\n' +
      'ORG:Home Assistant;\n' +
      'TEL;type=CELL;type=VOICE;waid=123456789:+123456789\n' +
      'END:VCARD';
    await reply(session, targetJid, {
      contacts: {
        displayName: 'Home Assistant Bot',
        contacts: [{ vcard }],
      },
    });
    await delay(1000);

    // 7. Send "Message to be deleted" and delete it
    const toDeleteMsg = await reply(session, targetJid, {
      text: '🗑️ *Diagnostic Test [7/7]*: This message will be deleted automatically in 2 seconds.',
    });
    await delay(2000);
    if (toDeleteMsg) {
      await reply(session, targetJid, { delete: toDeleteMsg.key });
      await delay(1000);
    }

    // 9. Moderation Feature Diagnostic Summary (Only run inside group chats)
    const isGroupChat = targetJid.endsWith('@g.us');
    if (isGroupChat) {
      try {
        const { loadModerationStore } = await import('./moderation/store.js');
        const store = loadModerationStore();

        if (store && store.global_enabled && store.groups) {
          const modGroupEntries = Object.entries(store.groups).filter(
            ([gId, cfg]) => cfg && cfg.enabled && gId === targetJid
          );

          if (modGroupEntries.length === 0) {
            await reply(session, targetJid, {
              text: '🛡️ *Moderation Diagnostic:* Global Moderation is active, but not enabled for this group.',
            });
          } else {
            for (const [groupId, cfg] of modGroupEntries) {
              const prefix = cfg.commands?.prefix || '!';
              const disabledCmds = new Set(cfg.commands?.disabled_commands || []);
              const customCmds = cfg.commands?.custom_commands || [];

              // Fetch real group metadata / subject if available
              let groupName = groupId.split('@')[0];
              if (session?.sock?.groupMetadata) {
                try {
                  const gMeta = await session.sock.groupMetadata(groupId);
                  if (gMeta?.subject) groupName = gMeta.subject;
                } catch (e) {}
              }

              // Intro Header Message for this Group
              await delay(1000);
              await reply(session, targetJid, {
                text: gt(cfg, 'bot_replies.mod_test_header', {
                  groupName,
                  groupId,
                  prefix,
                }),
              });

              // Built-in commands list
              const allBuiltins = [
                'ping',
                'help',
                'id',
                'rules',
                'warn',
                'warns',
                'unwarn',
                'kick',
                'ban',
                'mute',
                'unmute',
                'lock',
                'unlock',
                'locks',
                'setrules',
                'promote',
                'demote',
                'approve',
                'unapprove',
                'report',
                'setwelcome',
                'welcome',
                'setgoodbye',
                'goodbye',
                'save',
                'get',
                'notes',
                'filter',
                'stop',
                'filters',
                'info',
                'adminlist',
                'locktypes',
                'del',
                'tban',
                'tmute',
                'setlang',
                'translate',
              ];

              const activeBuiltins = allBuiltins.filter((c) => !disabledCmds.has(c));

              // Send separate copyable messages per item
              // 1. Individual Allowed Commands
              if (activeBuiltins.length > 0) {
                await delay(500);
                const cmdLines = activeBuiltins
                  .slice(0, 15)
                  .map((cmd) => `• \`${prefix}${cmd}\``)
                  .join('\n');
                await reply(session, targetJid, {
                  text: `🟢 *[TEST PACK 1/6] Allowed Commands for "${groupName}":*\n\n${cmdLines}`,
                });
              }

              // 2. Individual Disabled Commands
              if (disabledCmds.size > 0) {
                await delay(500);
                const disabledLines = Array.from(disabledCmds)
                  .map((cmd) => `• \`${prefix}${cmd}\``)
                  .join('\n');
                await reply(session, targetJid, {
                  text: `🔴 *[TEST PACK 2/6] Disabled Commands for "${groupName}":*\n\n${disabledLines}`,
                });
              }

              // 3. Individual Custom Commands
              if (customCmds.length > 0) {
                await delay(500);
                const customLines = customCmds
                  .map((c) => `• \`${prefix}${c.command.replace(/^[!/#]+/, '')}\``)
                  .join('\n');
                await reply(session, targetJid, {
                  text: `⚡ *[TEST PACK 3/6] Custom Commands for "${groupName}":*\n\n${customLines}`,
                });
              }

              // 4. Individual Auto-Responder Filters
              if (cfg.filters && cfg.filters.length > 0) {
                await delay(500);
                const filterLines = cfg.filters
                  .map((f) => `• \`${f.trigger}\` ➔ ${f.response || f.reaction_emoji || 'Action'}`)
                  .join('\n');
                await reply(session, targetJid, {
                  text: `💬 *[TEST PACK 4/6] Auto-Responder Filters for "${groupName}":*\n\n${filterLines}`,
                });
              }

              // 5. Individual Saved Notes
              if (cfg.notes && Object.keys(cfg.notes).length > 0) {
                await delay(500);
                const noteLines = Object.keys(cfg.notes)
                  .map((n) => `• \`${prefix}get #${n}\``)
                  .join('\n');
                await reply(session, targetJid, {
                  text: `📌 *[TEST PACK 5/6] Saved Notes for "${groupName}":*\n\n${noteLines}`,
                });
              }

              // 6. Individual Blacklist Words
              if (cfg.blacklist && cfg.blacklist.enabled && cfg.blacklist.words?.length > 0) {
                await delay(500);
                const blacklistLines = cfg.blacklist.words.map((w) => `• \`${w}\``).join('\n');
                await reply(session, targetJid, {
                  text: `⚠️ *[TEST PACK 6/7] Blacklist Words (Action: ${cfg.blacklist.action}) for "${groupName}":*\n\n${blacklistLines}`,
                });
              }

              // 7. Anti-Spam Link Triggers (t.me, wa.me, etc.)
              if (cfg.anti_spam_links_enabled) {
                await delay(500);
                await reply(session, targetJid, {
                  text: `🔗 *[TEST PACK 7/7] Anti-Spam Link Triggers for "${groupName}":*\n• \`https://t.me/joinchat/SPAMMER123\`\n• \`https://wa.me/491761234567\`\n• \`https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv\``,
                });
              }

              // 8. Active Content Locks Instructions
              if (cfg.locks) {
                const activeLocks = Object.entries(cfg.locks).filter(
                  ([_, lock]) => lock && lock.enabled
                );
                if (activeLocks.length > 0) {
                  await delay(500);
                  await reply(session, targetJid, {
                    text:
                      `🔒 *Active Content Locks for "${groupName}":*\n` +
                      activeLocks
                        .map(([type, lock]) => `• Send a ${type} -> Action: ${lock.action}`)
                        .join('\n'),
                  });
                }
              }
            }
          }
        }
      } catch (modErr) {
        logger.warn({ error: modErr.message }, 'Failed to append moderation diagnostic report');
      }

      // 10. Telegram Bridge Diagnostic for Groups with active mappings
      try {
        const { loadTelegramStore } = await import('./telegram/store.js');
        const tgStore = loadTelegramStore();
        if (tgStore && tgStore.enabled && Array.isArray(tgStore.mappings)) {
          const groupMappings = tgStore.mappings.filter(
            (m) => m.enabled && m.wa_jid && m.wa_jid.toLowerCase() === targetJid.toLowerCase()
          );

          if (groupMappings.length > 0) {
            const groupModCfg = getGroupModerationConfig(targetJid);
            for (const map of groupMappings) {
              await delay(800);
              const bot = tgStore.bots?.find((b) => b.id === map.bot_id);
              const botLabel = bot ? `@${bot.username || bot.name}` : map.bot_id || 'Default';
              const modeLabel = map.sync_mode || 'bidirectional';
              const threadInfo = map.tg_thread_id ? ` (Topic / Thread: ${map.tg_thread_id})` : '';

              const bridgeReport = gt(groupModCfg, 'bot_replies.telegram_bridge_diag', {
                chatId: map.tg_chat_id,
                threadInfo,
                botLabel,
                modeLabel,
                edits: map.sync_edits !== false ? '✅' : '❌',
                deletions: map.sync_deletions !== false ? '✅' : '❌',
                reactions: map.sync_reactions !== false ? '✅' : '❌',
                pins: map.sync_pins !== false ? '✅' : '❌',
                systemEvents: map.sync_system_events !== false ? '✅' : '❌',
                polls: map.poll_sync_mode || 'native_sync',
                translation: map.translate_wa_to_tg
                  ? `✅ (${map.translate_wa_to_tg_lang || 'Auto'})`
                  : '❌',
              });

              await reply(session, targetJid, { text: bridgeReport });
            }
          }
        }
      } catch (tgErr) {
        logger.warn({ error: tgErr.message }, 'Failed to append telegram bridge diagnostic report');
      }
    }

    // 8. Final Completion Message
    const completionText =
      '🏁 *Diagnostic Test Completed*\n\n' +
      'All functional tests have been performed successfully.\n\n' +
      '📖 *Documentation:* https://faserf.github.io/ha-whatsapp/\n' +
      '🐞 *Report Issues:* https://github.com/FaserF/ha-whatsapp/issues';
    await reply(session, targetJid, { text: completionText });

    addLogFn(
      session,
      `Diagnostic test for ${maskData(senderJid)} finished (sent to ${maskData(targetJid)})`,
      'success'
    );
  } catch (err) {
    logger.error({ error: err.message }, 'Diagnostic test failed');
    await reply(session, targetJid, { text: `❌ *Diagnostic Failed:* ${err.message}` });
  } finally {
    activeDiagnosticChats.delete(targetJid);
  }
}

/**
 * Sends a role-aware welcome message.
 */
export async function sendWelcomeMessage(session, jid) {
  const isAdminUser = isAdmin(jid, session);
  const role = isAdminUser ? '*Admin*' : '*Standard User*';

  let welcomeText =
    `👋 *Welcome to the Home Assistant WhatsApp Bridge!*\n\n` + `Your current role: ${role}\n\n`;

  if (isAdminUser) {
    welcomeText += `💡 *Admin Tip:* Use \`ha-app-status\` for health checks or \`ha-app-help\` for all control commands.\n\n`;
  } else {
    welcomeText += `💡 *Tip:* Use \`ha-app-status\` to view the integration status.\n\n`;
  }

  welcomeText +=
    `🔗 *Docs & Support:*\n` +
    `• https://faserf.github.io/ha-whatsapp/\n` +
    `• https://faserf.github.io/ha-whatsapp/support.html`;

  await reply(session, jid, { text: welcomeText });
}

export function handleFirstContact(session, event) {
  if (
    WELCOME_MESSAGE_ENABLED &&
    !event.is_group &&
    !event.raw?.key?.fromMe &&
    !event.from_me &&
    event.content
  ) {
    const personJid = event.raw?.key?.participant || event.sender;
    if (markUserAsSeen(personJid)) {
      logger.info({ jid: maskData(personJid) }, '👋 Sending first-contact welcome message');
      sendWelcomeMessage(session, event.sender).catch((e) =>
        logger.error({ error: e.message }, 'Failed to send welcome message')
      );
    }
  }
}
