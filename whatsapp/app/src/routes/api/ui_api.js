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

    // Build name lookup map from contactCache and pushNames in stored messages
    const contactNames = new Map();
    if (session.contactCache) {
      for (const [cId, contact] of session.contactCache.entries()) {
        const cName = contact.name || contact.notify || contact.verifiedName;
        if (cName) contactNames.set(cId, cName);
      }
    }

    messages.forEach((msg) => {
      if (!msg.key || !msg.key.remoteJid) return;
      const jid = msg.key.remoteJid;
      if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@g.us')) return;

      const msgTime = (msg.messageTimestamp?.low || msg.messageTimestamp || 0) * 1000;
      const previewText = getMessageText(msg);

      // Collect pushName for contact if present
      if (!jid.endsWith('@g.us') && msg.pushName && !contactNames.has(jid)) {
        contactNames.set(jid, msg.pushName);
      }

      if (!JidMap[jid] || msgTime > JidMap[jid].timestamp) {
        JidMap[jid] = {
          jid,
          name: jid.split('@')[0],
          preview: previewText,
          timestamp: msgTime,
          fromMe: msg.key.fromMe || false,
        };
      }
    });

    // Resolve final display names (async for missing group names)
    const chats = Object.values(JidMap)
      .filter((c) => c.preview && c.preview.trim().length > 0)
      .sort((a, b) => b.timestamp - a.timestamp);

    // Resolve group names and contact names
    const resolveNamesPromises = chats.map(async (c) => {
      if (c.jid.endsWith('@g.us')) {
        if (session.groupCache && session.groupCache.has(c.jid)) {
          c.name = session.groupCache.get(c.jid);
        } else if (session.sock) {
          try {
            const meta = await session.sock.groupMetadata(c.jid);
            if (meta && meta.subject) {
              c.name = meta.subject;
              session.groupCache?.set(c.jid, meta.subject);
            }
          } catch (e) {
            c.name = `Group (${c.jid.split('@')[0].split('-')[0]})`;
          }
        } else {
          c.name = `Group (${c.jid.split('@')[0].split('-')[0]})`;
        }
      } else if (contactNames.has(c.jid)) {
        c.name = contactNames.get(c.jid);
      }
      return c;
    });

    Promise.all(resolveNamesPromises)
      .then((resolvedChats) => {
        res.json(resolvedChats);
      })
      .catch(() => {
        res.json(chats);
      });
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

  app.get('/api/avatar', uiAuthMiddleware, async (req, res) => {
    const sessionId = sanitizeSessionId(req.query.session_id || 'default');
    const session = getSession(sessionId);
    const jid = req.query.jid;
    if (!jid || !session.sock) return res.status(404).json({ error: 'No session or JID' });

    try {
      let url = null;
      try {
        url = await session.sock.profilePictureUrl(jid, 'preview');
      } catch (e) {
        url = await session.sock.profilePictureUrl(jid, 'image');
      }
      if (url) {
        return res.json({ url });
      }
      res.status(404).json({ error: 'No picture' });
    } catch (err) {
      res.status(404).json({ error: 'Not found' });
    }
  });

  app.get('/api/chat_info', uiAuthMiddleware, async (req, res) => {
    const sessionId = sanitizeSessionId(req.query.session_id || 'default');
    const session = getSession(sessionId);
    const jid = req.query.jid;
    if (!jid) return res.status(400).json({ error: 'JID required' });

    const isGroup = jid.endsWith('@g.us');
    const info = { jid, isGroup };

    if (isGroup && session.sock) {
      try {
        const metadata = await session.sock.groupMetadata(jid);
        info.name = metadata.subject;
        info.description = metadata.desc ? metadata.desc.toString() : '';
        info.owner = metadata.owner;
        info.creation = metadata.creation;
        info.participantsCount = metadata.participants ? metadata.participants.length : 0;
        info.participants = (metadata.participants || []).map((p) => {
          let pName = p.id.split('@')[0];
          if (session.contactCache && session.contactCache.has(p.id)) {
            const c = session.contactCache.get(p.id);
            pName = c.name || c.notify || pName;
          }
          return { id: p.id, name: pName, admin: p.admin };
        });
      } catch (err) {
        if (session.groupCache && session.groupCache.has(jid)) {
          info.name = session.groupCache.get(jid);
        }
      }
    } else {
      if (session.contactCache && session.contactCache.has(jid)) {
        const c = session.contactCache.get(jid);
        info.name = c.name || c.notify || jid.split('@')[0];
        info.status = c.status || '';
      } else {
        info.name = jid.split('@')[0];
      }
    }

    try {
      info.avatarUrl = await session.sock?.profilePictureUrl(jid, 'preview');
    } catch {}

    res.json(info);
  });
}
