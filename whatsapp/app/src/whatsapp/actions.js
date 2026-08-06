import { delay } from '@whiskeysockets/baileys';
import { logger } from '../logger.js';
import { ADMIN_NUMBERS, ADMIN_NOTIFICATIONS_ENABLED, WELCOME_MESSAGE_ENABLED } from '../config.js';
import { getJid } from '../utils/jid.js';
import { maskData, isAdmin } from '../utils/security.js';
import { formatHATime } from '../utils/format.js';
import { markUserAsSeen } from '../state.js';
import { sessions, enqueue } from '../session.js';
import { sendHANotification } from '../ha.js';

/**
 * Sends a relative-path reply and tracks it in stats.
 */
export async function reply(session, jid, content, quotedMsg = null) {
  if (!session.sock) {
    logger.warn(
      { sessionId: session.id, jid: maskData(jid) },
      'Cannot send reply: Socket not initialized'
    );
    return null;
  }
  try {
    // Build sendMessage options — attach quoted for context in busy groups
    const sendOptions = quotedMsg ? { quoted: quotedMsg } : {};
    const contentObj = typeof content === 'string' ? { text: content } : content;
    const result = await enqueue(session, () =>
      session.sock.sendMessage(jid, contentObj, sendOptions)
    );
    const text = contentObj.text || '[Mixed Content]';
    const target = jid.includes('@g.us') ? jid : jid.split('@')[0].split(':')[0];

    session.stats.sent += 1;
    session.stats.last_sent_message = maskData(text);
    session.stats.last_sent_target = maskData(target);
    session.stats.last_sent_time = Date.now();
    trackSent(session, target, text);
    return result;
  } catch (err) {
    const text = typeof content === 'string' ? content : content.text || '[Mixed Content]';
    trackFailure(session, jid, text, err.message);
    logger.error({ error: err.message, jid }, 'Failed to send reply');
    session.stats.failed += 1;
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
}

export function trackFailure(session, target, message, reason) {
  const timestamp = formatHATime(new Date());
  const displayTarget = target.includes('@g.us') ? target : target.split('@')[0];
  session.recentFailures.unshift({
    timestamp,
    target: maskData(displayTarget),
    message: maskData(message),
    reason: reason,
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
  // Send diagnostic messages to admin number if configured, otherwise to own number
  const targetJid = ADMIN_NUMBERS.length > 0 ? getJid(ADMIN_NUMBERS[0]) : senderJid;

  try {
    addLogFn(session, `Starting diagnostic test for ${maskData(senderJid)}`, 'info');
    addLogFn(
      session,
      `Diagnostic target: ${ADMIN_NUMBERS.length > 0 ? 'admin number' : 'own number'} (${maskData(targetJid)})`,
      'info'
    );

    // 1. Presence Update (Typing...)
    if (session.sock && typeof session.sock.sendPresenceUpdate === 'function') {
      await session.sock.sendPresenceUpdate('composing', targetJid);
      await delay(500);
      await session.sock.sendPresenceUpdate('paused', targetJid);
    }

    // 1. Text Message
    const textMsg = await reply(session, targetJid, {
      text: '🧪 *Diagnostic Test [1/7]*: Text message works!',
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
      text: 'This text will be edited',
    });
    await delay(1000);
    if (editMsg) {
      await reply(session, targetJid, {
        text: '🧪 *Diagnostic Test [2/7]*: Edit message works! ✅',
        edit: editMsg.key,
      });
      await delay(1000);
    }

    // 4. Buttons
    await reply(session, targetJid, {
      text: '🧪 *Diagnostic Test [3/7]*: Checking Buttons...',
      footer: 'HA App Test',
      buttons: [
        { buttonId: 'diag_1', displayText: 'Button 1' },
        { buttonId: 'diag_2', displayText: 'Button 2' },
      ],
    });
    await delay(1000);

    // 5. List
    await reply(session, targetJid, {
      title: '🧪 Diagnostic Test [4/7]',
      text: 'Checking List Message...',
      buttonText: 'View Options',
      sections: [
        {
          title: 'Test Section',
          rows: [
            { title: 'Option 1', id: 'opt_1' },
            { title: 'Option 2', id: 'opt_2' },
          ],
        },
      ],
    });
    await delay(1000);

    // 6. Location (München)
    await reply(session, targetJid, {
      location: { degreesLatitude: 48.1351, degreesLongitude: 11.582 },
      title: '🧪 Diagnostic Test [5/7]',
      address: 'Munich, Germany',
    });
    await delay(1000);

    // 7. Contact (VCard)
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

    // 8. Send "Message to be deleted" and delete it
    const toDeleteMsg = await reply(session, targetJid, {
      text: 'Message to be deleted',
    });
    await delay(1000);
    if (toDeleteMsg) {
      await reply(session, targetJid, { delete: toDeleteMsg.key });
      await delay(1000);
      await reply(session, targetJid, {
        text: '🧪 *Diagnostic Test [7/7]*: Cleanup (Delete) verified. All basic tests finished!',
      });
    }

    // 9. Moderation Feature Diagnostic Summary for all Groups with Moderation Enabled
    try {
      const { loadModerationStore } = await import('./moderation/store.js');
      const store = loadModerationStore();

      if (store && store.global_enabled && store.groups) {
        const modGroupEntries = Object.entries(store.groups).filter(
          ([_, cfg]) => cfg && cfg.enabled
        );

        if (modGroupEntries.length === 0) {
          await reply(session, targetJid, {
            text: '🛡️ *Moderation Diagnostic:* Global Moderation Engine is Active, but no specific group has moderation enabled.',
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
              text: `🛡️ *WhatsApp Moderation Tests for Group: "${groupName}"*\n📌 *Group ID:* \`${groupId}\`\n⚙️ *Prefix:* \`${prefix}\`\n\n_Below are separate copy & paste ready test messages for each category. You can copy an entire block or single lines to test in "${groupName}":_`,
            });

            // Built-in commands list
            const allBuiltins = [
              'ping', 'help', 'id', 'rules', 'warn', 'warns', 'unwarn', 'kick', 'ban',
              'mute', 'unmute', 'lock', 'unlock', 'locks', 'setrules', 'promote', 'demote',
              'approve', 'unapprove', 'report', 'setwelcome', 'welcome', 'setgoodbye', 'goodbye',
              'save', 'get', 'notes', 'filter', 'stop', 'filters', 'info', 'adminlist', 'locktypes',
              'del', 'tban', 'tmute', 'setlang', 'translate',
            ];

            const activeBuiltins = allBuiltins.filter((c) => !disabledCmds.has(c));

            // Send separate copyable messages per item
            // 1. Individual Allowed Commands
            if (activeBuiltins.length > 0) {
              await delay(500);
              await reply(session, targetJid, { text: `🟢 *[TEST PACK 1/6] Allowed Commands for "${groupName}":*` });
              for (const cmd of activeBuiltins.slice(0, 15)) {
                await delay(300);
                await reply(session, targetJid, { text: `${prefix}${cmd}` });
              }
            }

            // 2. Individual Disabled Commands
            if (disabledCmds.size > 0) {
              await delay(500);
              await reply(session, targetJid, { text: `🔴 *[TEST PACK 2/6] Disabled Commands for "${groupName}":*` });
              for (const cmd of Array.from(disabledCmds)) {
                await delay(300);
                await reply(session, targetJid, { text: `${prefix}${cmd}` });
              }
            }

            // 3. Individual Custom Commands
            if (customCmds.length > 0) {
              await delay(500);
              await reply(session, targetJid, { text: `⚡ *[TEST PACK 3/6] Custom Commands for "${groupName}":*` });
              for (const c of customCmds) {
                await delay(300);
                const formattedCmd = c.command.replace(/^[!/#]+/, '');
                await reply(session, targetJid, { text: `${prefix}${formattedCmd}` });
              }
            }

            // 4. Individual Auto-Responder Filters
            if (cfg.filters && cfg.filters.length > 0) {
              await delay(500);
              await reply(session, targetJid, { text: `💬 *[TEST PACK 4/6] Auto-Responder Filters for "${groupName}":*` });
              for (const f of cfg.filters) {
                await delay(300);
                await reply(session, targetJid, { text: `${f.trigger}` });
              }
            }

            // 5. Individual Saved Notes
            if (cfg.notes && Object.keys(cfg.notes).length > 0) {
              await delay(500);
              await reply(session, targetJid, { text: `📌 *[TEST PACK 5/6] Saved Notes for "${groupName}":*` });
              for (const n of Object.keys(cfg.notes)) {
                await delay(300);
                await reply(session, targetJid, { text: `${prefix}get #${n}` });
              }
            }

            // 6. Individual Blacklist Words
            if (cfg.blacklist && cfg.blacklist.enabled && cfg.blacklist.words?.length > 0) {
              await delay(500);
              await reply(session, targetJid, { text: `⚠️ *[TEST PACK 6/6] Blacklist Words (Action: ${cfg.blacklist.action}) for "${groupName}":*` });
              for (const w of cfg.blacklist.words) {
                await delay(300);
                await reply(session, targetJid, { text: `${w}` });
              }
            }

            // 7. Active Content Locks Instructions
            if (cfg.locks) {
              const activeLocks = Object.entries(cfg.locks).filter(([_, lock]) => lock && lock.enabled);
              if (activeLocks.length > 0) {
                await delay(500);
                await reply(session, targetJid, { text: `🔒 *Active Content Locks for "${groupName}":*\n` + activeLocks.map(([type, lock]) => `• Send a ${type} -> Action: ${lock.action}`).join('\n') });
              }
            }
          }
        }
      }
    } catch (modErr) {
      logger.warn({ error: modErr.message }, 'Failed to append moderation diagnostic report');
    }

    addLogFn(
      session,
      `Diagnostic test for ${maskData(senderJid)} finished (sent to ${maskData(targetJid)})`,
      'success'
    );
  } catch (err) {
    logger.error({ error: err.message }, 'Diagnostic test failed');
    await reply(session, targetJid, { text: `❌ *Diagnostic Failed:* ${err.message}` });
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
  if (WELCOME_MESSAGE_ENABLED && !event.is_group && event.content) {
    const personJid = event.raw.key.participant || event.sender;
    if (markUserAsSeen(personJid)) {
      logger.info({ jid: maskData(personJid) }, '👋 Sending first-contact welcome message');
      sendWelcomeMessage(session, event.sender).catch((e) =>
        logger.error({ error: e.message }, 'Failed to send welcome message')
      );
    }
  }
}
