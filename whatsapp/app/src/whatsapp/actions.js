import { delay } from '@whiskeysockets/baileys';
import { logger } from '../logger.js';
import { ADMIN_NUMBERS, ADMIN_NOTIFICATIONS_ENABLED, WELCOME_MESSAGE_ENABLED } from '../config.js';
import { getJid } from '../utils/jid.js';
import { maskData, isAdmin } from '../utils/security.js';
import { formatHATime } from '../utils/format.js';
import { markUserAsSeen } from '../state.js';

/**
 * Sends a relative-path reply and tracks it in stats.
 */
export async function reply(session, jid, content) {
  try {
    const result = await session.sock.sendMessage(jid, content);
    const text = typeof content === 'string' ? content : content.text || '[Mixed Content]';
    const target = jid.includes('@g.us') ? jid : jid.split('@')[0].split(':')[0];

    session.stats.sent += 1;
    session.stats.last_sent_message = maskData(text);
    session.stats.last_sent_target = maskData(target);
    session.stats.last_sent_time = Date.now();
    trackSent(session, target, text);
    return result;
  } catch (err) {
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
 */
export async function notifyAdmins(session, text) {
  if (!ADMIN_NOTIFICATIONS_ENABLED) return;

  const targets = [...ADMIN_NUMBERS];
  if (targets.length === 0 && session.sock?.user?.id) {
    targets.push(session.sock.user.id.split(':')[0]);
  }

  if (targets.length === 0) return;

  for (const admin of targets) {
    const jid = getJid(admin);
    await reply(session, jid, { text }).catch((e) =>
      logger.error({ error: e.message, admin: maskData(jid) }, 'Failed to notify admin')
    );
  }
}

/**
 * Runs a set of diagnostic WhatsApp features.
 */
export async function runDiagnostic(session, senderJid, addLogFn) {
  try {
    addLogFn(session, `Starting diagnostic test for ${maskData(senderJid)}`, 'info');

    // 1. Text Message
    const textMsg = await reply(session, senderJid, {
      text: '🧪 *Diagnostic Test [1/6]*: Text message works!',
    });
    await delay(1000);

    // 2. Reaction
    if (textMsg) {
      await reply(session, senderJid, {
        react: { text: '✅', key: textMsg.key },
      });
      await delay(1000);
    }

    // 3. Buttons
    await reply(session, senderJid, {
      text: '🧪 *Diagnostic Test [2/6]*: Checking Buttons...',
      footer: 'HA App Test',
      buttons: [
        { buttonId: 'diag_1', displayText: 'Button 1' },
        { buttonId: 'diag_2', displayText: 'Button 2' },
      ],
    });
    await delay(1000);

    // 4. List
    await reply(session, senderJid, {
      title: '🧪 Diagnostic Test [3/6]',
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

    // 5. Location
    await reply(session, senderJid, {
      location: { degreesLatitude: 52.52, degreesLongitude: 13.405 },
      title: '🧪 Diagnostic Test [4/6]',
      address: 'Berlin, Germany',
    });
    await delay(1000);

    // 6. Final Text & Help Tip
    await reply(session, senderJid, {
      text: '🧪 *Diagnostic Test [5/6]*: Overall bridge check complete.',
    });
    await delay(1000);

    // 7. Cleanup (Delete first message)
    if (textMsg) {
      await reply(session, senderJid, { delete: textMsg.key });
      await reply(session, senderJid, {
        text: '🧪 *Diagnostic Test [6/6]*: Cleanup (Delete) verified. All tests finished!',
      });
    }

    addLogFn(session, `Diagnostic test for ${maskData(senderJid)} finished`, 'success');
  } catch (err) {
    logger.error({ error: err.message }, 'Diagnostic test failed');
    await reply(session, senderJid, { text: `❌ *Diagnostic Failed:* ${err.message}` });
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
