import { delay } from '@whiskeysockets/baileys';

export async function ensureConnected(session, maxWaitMs = 3000) {
  if (!session) return false;
  if (session.isConnected) return true;
  if (session.sock && !session.sock.ws?.isClosed) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      await delay(250);
      if (session.isConnected) return true;
    }
  }
  return session.isConnected;
}

/**
 * Validates session and active connection, sending HTTP 503 error response if not connected.
 * Returns session if connected, or null if response was handled.
 */
export async function requireConnectedSession(req, res, maxWaitMs = 3000) {
  const { getReqSession } = await import('../../session.js');
  const session = getReqSession(req);
  const connected = await ensureConnected(session, maxWaitMs);
  if (!connected) {
    res.status(503).json({ detail: 'Not connected to WhatsApp' });
    return null;
  }
  return session;
}

export function getMessageText(msg) {
  if (!msg) return '';
  if (typeof msg === 'string') return msg;
  if (msg._text) return msg._text;
  if (msg.text && typeof msg.text === 'string') return msg.text;
  if (!msg.message) return '';

  let m = msg.message;
  if (m.ephemeralMessage) m = m.ephemeralMessage.message;
  if (m.viewOnceMessage) m = m.viewOnceMessage.message;
  if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
  if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message;
  if (!m) return '';

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsMessage?.contentText ||
    m.buttonsMessage?.text ||
    m.buttonsMessage?.headerType ||
    m.templateMessage?.hydratedTemplate?.hydratedContentText ||
    m.interactiveMessage?.body?.text ||
    m.interactiveMessage?.header?.title ||
    m.listMessage?.description ||
    m.listMessage?.title ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.templateButtonReplyMessage?.selectedId ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    m.interactiveResponseMessage?.body?.text ||
    m.groupInviteMessage?.caption ||
    m.locationMessage?.name ||
    m.locationMessage?.address ||
    (m.contactMessage ? `👤 Contact: ${m.contactMessage.displayName || 'Card'}` : '') ||
    (m.locationMessage ? '📍 Location' : '') ||
    (m.liveLocationMessage ? '📍 Live Location' : '') ||
    (m.eventMessage ? `📅 Event: ${m.eventMessage.name || 'Event'}` : '') ||
    (m.imageMessage ? '🖼️ Image' : '') ||
    (m.videoMessage ? '📹 Video' : '') ||
    (m.audioMessage ? '🎵 Audio' : '') ||
    (m.stickerMessage ? '🎨 Sticker' : '') ||
    (m.documentMessage ? '📄 Document' : '') ||
    (m.pollCreationMessage || m.pollCreationMessageV2 || m.pollCreationMessageV3
      ? `📊 Poll: ${(m.pollCreationMessage || m.pollCreationMessageV2 || m.pollCreationMessageV3).name || 'Poll'}`
      : '') ||
    ''
  );
}

export function getLastMessagesForChat(session, jid) {
  if (!session?.messageStore || !jid) return [];
  const normalizedJid = String(jid).toLowerCase();
  let latest = null;

  for (const msg of session.messageStore.values()) {
    const remoteJid = msg.key?.remoteJid;
    if (
      remoteJid &&
      (remoteJid.toLowerCase() === normalizedJid ||
        remoteJid.split('@')[0] === normalizedJid.split('@')[0])
    ) {
      if (!latest || Number(msg.messageTimestamp || 0) > Number(latest.messageTimestamp || 0)) {
        latest = msg;
      }
    }
  }

  if (latest && latest.key?.id && latest.key?.remoteJid) {
    const rawTs = Number(latest.messageTimestamp?.low || latest.messageTimestamp || 0);
    const validTs = !isNaN(rawTs) && rawTs > 0 ? rawTs : Math.floor(Date.now() / 1000);
    return [
      {
        key: latest.key,
        messageTimestamp: validTs,
      },
    ];
  }

  return [];
}

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    const errMsg = String(err?.message || err || 'Unknown error');
    console.error('❌ Unhandled route error [%s %s]: %s', req.method, req.path, errMsg);
    if (!res.headersSent) {
      res.status(500).json({ detail: errMsg });
    }
  });
};
