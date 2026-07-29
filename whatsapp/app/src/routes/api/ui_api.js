import { uiAuthMiddleware } from '../../middleware.js';
import { getSession, sanitizeSessionId } from '../../session.js';
import { getMessageText } from './helpers.js';

export function registerUiApiRoutes(app) {
  app.get('/api/chats', uiAuthMiddleware, (req, res) => {
    const sessionId = sanitizeSessionId(req.query.session_id || 'default');
    const session = getSession(sessionId);
    if (!session.messageStore) return res.json([]);

    const messages = Array.from(session.messageStore.values());
    const JidMap = {};

    messages.forEach((msg) => {
      if (!msg.key || !msg.key.remoteJid) return;
      const jid = msg.key.remoteJid;
      if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@g.us')) return;

      const msgTime = (msg.messageTimestamp?.low || msg.messageTimestamp || 0) * 1000;
      const previewText = getMessageText(msg);

      if (!JidMap[jid] || msgTime > JidMap[jid].timestamp) {
        let name = jid.split('@')[0];
        if (jid.endsWith('@g.us')) {
          if (session.groupCache && session.groupCache.has(jid)) {
            name = session.groupCache.get(jid);
          } else {
            name = `Group (${jid.split('@')[0]})`;
          }
        } else if (msg.pushName) {
          name = msg.pushName;
        }

        JidMap[jid] = {
          jid,
          name,
          preview: previewText,
          timestamp: msgTime,
          fromMe: msg.key.fromMe || false,
        };
      } else if (!jid.endsWith('@g.us') && msg.pushName && JidMap[jid] && JidMap[jid].name === jid.split('@')[0]) {
        JidMap[jid].name = msg.pushName;
      }
    });

    const chats = Object.values(JidMap)
      .filter((c) => c.preview && c.preview.trim().length > 0)
      .sort((a, b) => b.timestamp - a.timestamp);
    res.json(chats);
  });

  app.get('/api/messages', uiAuthMiddleware, (req, res) => {
    const sessionId = sanitizeSessionId(req.query.session_id || 'default');
    const session = getSession(sessionId);
    const targetJid = req.query.jid;

    if (!targetJid) return res.status(400).json({ detail: 'Missing jid parameter' });
    if (!session.messageStore) return res.json([]);

    const messages = Array.from(session.messageStore.values())
      .filter((msg) => msg.key && msg.key.remoteJid === targetJid)
      .map((msg) => {
        const timestamp = (msg.messageTimestamp?.low || msg.messageTimestamp || 0) * 1000;
        const text = getMessageText(msg);

        const mediaUrl = msg._mediaUrl || null;
        const mediaType = msg._mediaType || null;
        const mediaMime = msg._mediaMime || null;
        const caption = msg._caption || null;

        let quotedId = null,
          quotedText = null,
          quotedSender = null;
        const ctx =
          msg.message?.extendedTextMessage?.contextInfo ||
          msg.message?.imageMessage?.contextInfo ||
          msg.message?.videoMessage?.contextInfo ||
          msg.message?.audioMessage?.contextInfo ||
          msg.message?.documentMessage?.contextInfo ||
          msg.message?.stickerMessage?.contextInfo;
        if (ctx?.stanzaId) {
          quotedId = ctx.stanzaId;
          quotedSender = ctx.participant || ctx.remoteJid || null;
          const qMsg = session.messageStore.get(ctx.stanzaId);
          quotedText = qMsg
            ? getMessageText(qMsg)
            : ctx.quotedMessage?.conversation ||
              ctx.quotedMessage?.extendedTextMessage?.text ||
              ctx.quotedMessage?.imageMessage?.caption ||
              ctx.quotedMessage?.videoMessage?.caption ||
              '...';
        }

        const participant = msg.key.participant || msg.participant;
        const senderName = msg.key.fromMe
          ? 'You'
          : msg.pushName || (participant ? participant.split('@')[0] : targetJid.split('@')[0]);

        return {
          id: msg.key.id,
          fromMe: msg.key.fromMe || false,
          senderName,
          senderJid: participant || (msg.key.fromMe ? null : targetJid),
          text: text || caption || null,
          caption,
          timestamp,
          mediaUrl,
          mediaType,
          mediaMime,
          quotedId,
          quotedText,
          quotedSender,
          ack: msg._ack != null ? msg._ack : msg.status != null ? msg.status : null,
          reactions: msg._reactions || [],
          starred: msg.starred || false,
        };
      })
      .filter((m) => m.text || m.mediaUrl)
      .sort((a, b) => a.timestamp - b.timestamp);

    res.json(messages);
  });

  app.get('/api/presence', uiAuthMiddleware, (req, res) => {
    const sessionId = sanitizeSessionId(req.query.session_id || 'default');
    const session = getSession(sessionId);
    const jid = req.query.jid;
    if (!jid) return res.json({ typing: false });
    const p = session._presenceStore?.get(jid);
    if (!p || Date.now() - p.lastSeen > 10000) return res.json({ typing: false });
    res.json({ typing: p.status === 'composing', status: p.status });
  });

  app.get('/api/messages/search', uiAuthMiddleware, (req, res) => {
    const sessionId = sanitizeSessionId(req.query.session_id || 'default');
    const session = getSession(sessionId);
    const jid = req.query.jid;
    const q = (req.query.q || '').toLowerCase().trim();
    if (!jid || !q) return res.json([]);
    const results = Array.from(session.messageStore.values())
      .filter((msg) => msg.key?.remoteJid === jid)
      .filter((msg) => {
        const t = getMessageText(msg) || '';
        return t.toLowerCase().includes(q);
      })
      .map((msg) => ({
        id: msg.key.id,
        fromMe: msg.key.fromMe || false,
        text: getMessageText(msg),
        timestamp: (msg.messageTimestamp?.low || msg.messageTimestamp || 0) * 1000,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    res.json(results);
  });
}
