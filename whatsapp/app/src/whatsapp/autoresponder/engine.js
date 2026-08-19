import { logger } from '../../logger.js';
import { maskData } from '../../utils/security.js';
import { reply } from '../actions.js';
import { loadAutoResponderStore, isAutoResponderActive, recordRecipientReplied } from './store.js';

/**
 * Formats an ISO datetime string into user-friendly localized text based on locale or language code.
 */
export function formatLocalizedDateTime(isoStr, lang = 'en') {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return String(isoStr);

  try {
    const localeCode = lang === 'de' ? 'de-DE' : 'en-US';
    return date.toLocaleString(localeCode, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch (_e) {
    return date.toLocaleString();
  }
}

/**
 * Formats a message template by substituting dynamic variables with localized datetime support.
 */
export function formatAutoResponderText(template, vars = {}) {
  let text = template || '';

  const senderName = vars.sender_name || 'there';
  const rawStart = vars.start_time || '';
  const rawEnd = vars.end_time || '';
  const lang = vars.lang || (vars.config && vars.config.language) || 'en';

  const startTimeFormatted = rawStart ? formatLocalizedDateTime(rawStart, lang) : '';
  const endTimeFormatted = rawEnd ? formatLocalizedDateTime(rawEnd, lang) : '';

  let endTimeText = '';
  if (endTimeFormatted) {
    endTimeText = lang === 'de' ? ` (bis ${endTimeFormatted})` : ` (until ${endTimeFormatted})`;
  }

  let onceNotice = '';
  if (vars.once_per_contact) {
    onceNotice =
      lang === 'de'
        ? 'ℹ️ *Hinweis:* Du erhältst diese automatische Antwort nur einmalig.'
        : 'ℹ️ *Note:* You will only receive this automated reply once.';
  }

  text = text
    .replace(/\{sender_name\}/g, senderName)
    .replace(/\{start_time\}/g, startTimeFormatted || rawStart)
    .replace(/\{end_time\}/g, endTimeFormatted || rawEnd)
    .replace(/\{end_time_text\}/g, endTimeText)
    .replace(/\{once_notice\}/g, onceNotice);

  return text.trim();
}

/**
 * Processes incoming message for auto-responder logic.
 *
 * @param {object} session - Baileys session object
 * @param {object} event - Parsed message event
 */
export async function handleAutoResponder(session, event) {
  try {
    if (!event || !event.sender || !event.raw) return;

    // 1. Never reply to messages sent by oneself
    const rawKey = event.raw.key || {};
    if (rawKey.fromMe || event.from_me) {
      return;
    }

    // 2. Ignore broadcast / status / newsletter messages
    const sender = String(event.sender || '');
    const remoteJid = String(rawKey.remoteJid || '');
    if (
      sender.includes('status@broadcast') ||
      remoteJid.includes('status@broadcast') ||
      sender.includes('@newsletter') ||
      remoteJid.includes('@newsletter')
    ) {
      return;
    }

    // 3. Check if auto responder is currently active (enabled + within timeframe)
    const now = Date.now();
    if (!isAutoResponderActive(now)) {
      return;
    }

    const store = loadAutoResponderStore();

    // 4. Check scope (direct chats vs groups)
    const isGroup = Boolean(event.is_group || remoteJid.endsWith('@g.us'));
    if (store.direct_only && isGroup) {
      return;
    }

    // 5. Determine target reply JID and canonical user identifier
    const targetChatJid = remoteJid || sender;
    const recipientKey = isGroup
      ? `${targetChatJid}:${rawKey.participant || sender}`
      : targetChatJid;

    // 6. Check frequency (once per contact vs every message)
    if (store.once_per_contact) {
      if (store.seen_recipients && store.seen_recipients[recipientKey]) {
        logger.debug(
          { jid: maskData(recipientKey) },
          '🌴 Auto responder skipped (already replied to contact during this period)'
        );
        return;
      }
    }

    // 7. Resolve sender name
    const senderName =
      event.sender_name ||
      event.push_name ||
      (event.sender_number ? `+${event.sender_number}` : 'there');

    // Format template variables
    const formattedText = formatAutoResponderText(store.message_template, {
      sender_name: senderName,
      start_time: store.start_time || '',
      end_time: store.end_time || '',
      once_per_contact: store.once_per_contact,
    });

    if (!formattedText) {
      return;
    }

    logger.info(
      { jid: maskData(targetChatJid), isGroup },
      '🌴 Sending automated away / vacation reply'
    );

    // Record recipient as replied BEFORE sending to avoid race conditions
    recordRecipientReplied(recipientKey, now);

    // Send reply via standard reply helper with skipSpamGuard
    await reply(session, targetChatJid, { text: formattedText }, null, { skipSpamGuard: true });
  } catch (err) {
    logger.error({ error: err.message }, '❌ Error in handleAutoResponder');
  }
}
