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

export function getMessageText(msg) {
  if (!msg || !msg.message) return '';
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
    (m.imageMessage ? '🖼️ Image' : '') ||
    (m.videoMessage ? '📹 Video' : '') ||
    (m.audioMessage ? '🎵 Audio' : '') ||
    (m.documentMessage ? '📄 Document' : '') ||
    (m.pollCreationMessage ? `📊 Poll: ${m.pollCreationMessage.name}` : '') ||
    ''
  );
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
