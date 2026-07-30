import { uiAuthMiddleware } from '../../middleware.js';
import { getSession, sanitizeSessionId, sessions } from '../../session.js';
import { getMessageText, asyncHandler } from './helpers.js';

export function registerUiApiRoutes(app) {
  app.get('/api/chats', uiAuthMiddleware, (req, res) => {
    try {
    const sessionId = sanitizeSessionId(req.query.session_id || 'default');
    let session = getSession(sessionId);
    if (!session || !session.messageStore || session.messageStore.size === 0) {
      const activeWithMessages = Array.from(sessions.values()).find(
        (s) => s.messageStore && s.messageStore.size > 0
      );
      if (activeWithMessages) {
        session = activeWithMessages;
      }
    }
    if (!session || !session.messageStore) return res.json([]);

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
      if (!jid.endsWith('@g.us') && msg.pushName) {
        contactNames.set(jid, msg.pushName);
      } else if (jid.endsWith('@g.us') && msg.key.participant && msg.pushName) {
        if (!contactNames.has(msg.key.participant)) {
          contactNames.set(msg.key.participant, msg.pushName);
        }
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

    // Resolve final display names synchronously (with async background cache enrichment)
    const chats = Object.values(JidMap)
      .map((c) => {
        if (!c.preview || !c.preview.trim()) {
          c.preview = '[Message]';
        }
        if (c.jid.endsWith('@g.us')) {
          if (session.groupCache && session.groupCache.has(c.jid)) {
            c.name = session.groupCache.get(c.jid);
          } else {
            c.name = `Group (${c.jid.split('@')[0].split('-')[0]})`;
            // Background fetch metadata without blocking response
            if (session.sock) {
              session.sock
                .groupMetadata(c.jid)
                .then((meta) => {
                  if (meta && meta.subject) {
                    session.groupCache?.set(c.jid, meta.subject);
                  }
                })
                .catch(() => {});
            }
          }
        } else if (contactNames.has(c.jid)) {
          c.name = contactNames.get(c.jid);
        }
        return c;
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    res.json(chats);
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.get('/api/messages', uiAuthMiddleware, (req, res) => {
    try {
    const sessionId = sanitizeSessionId(req.query.session_id || 'default');
    let session = getSession(sessionId);
    if (!session || !session.messageStore || session.messageStore.size === 0) {
      const activeWithMessages = Array.from(sessions.values()).find(
        (s) => s.messageStore && s.messageStore.size > 0
      );
      if (activeWithMessages) {
        session = activeWithMessages;
      }
    }
    const targetJid = req.query.jid;

    if (!targetJid) return res.status(400).json({ detail: 'Missing jid parameter' });
    if (!session || !session.messageStore) return res.json([]);

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

        let buttons = [];
        let rawMsg = msg.message;
        if (rawMsg?.ephemeralMessage) rawMsg = rawMsg.ephemeralMessage.message;
        if (rawMsg?.viewOnceMessage) rawMsg = rawMsg.viewOnceMessage.message;
        if (rawMsg?.viewOnceMessageV2) rawMsg = rawMsg.viewOnceMessageV2.message;

        if (rawMsg?.buttonsMessage?.buttons) {
          buttons = rawMsg.buttonsMessage.buttons.map((b) => ({
            id: b.buttonId || b.nativeFlowInfo?.name || '',
            text: b.buttonText?.displayText || b.nativeFlowInfo?.name || 'Button',
          }));
        } else if (rawMsg?.templateMessage?.hydratedTemplate?.hydratedButtons) {
          buttons = rawMsg.templateMessage.hydratedTemplate.hydratedButtons.map((b) => {
            if (b.quickReplyButton) {
              return { id: b.quickReplyButton.id, text: b.quickReplyButton.displayText };
            }
            if (b.urlButton) {
              return {
                id: b.urlButton.url,
                text: `🔗 ${b.urlButton.displayText}`,
                url: b.urlButton.url,
              };
            }
            if (b.callButton) {
              return { id: b.callButton.phoneNumber, text: `📞 ${b.callButton.displayText}` };
            }
            return { id: '', text: 'Button' };
          });
        } else if (rawMsg?.interactiveMessage?.nativeFlowMessage?.buttons) {
          buttons = rawMsg.interactiveMessage.nativeFlowMessage.buttons.map((b) => ({
            id: b.name || '',
            text: b.buttonParamsJson ? (() => { try { return JSON.parse(b.buttonParamsJson)?.display_text || b.name; } catch (e) { return b.name; } })() : b.name,
          }));
        } else if (rawMsg?.listMessage?.sections) {
          rawMsg.listMessage.sections.forEach((sec) => {
            if (sec.rows) {
              sec.rows.forEach((r) => {
                buttons.push({ id: r.rowId, text: r.title, description: r.description });
              });
            }
          });
        }

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
          buttons,
          ack: msg._ack != null ? msg._ack : msg.status != null ? msg.status : null,
          reactions: msg._reactions || [],
          starred: msg.starred || false,
        };
      })
      .filter((m) => m.text || m.mediaUrl || (m.buttons && m.buttons.length > 0))
      .sort((a, b) => a.timestamp - b.timestamp);

    res.json(messages);
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.get('/api/presence', uiAuthMiddleware, (req, res) => {
    try {
    const sessionId = sanitizeSessionId(req.query.session_id || 'default');
    const session = getSession(sessionId);
    const jid = req.query.jid;
    if (!jid) return res.json({ typing: false });
    const p = session._presenceStore?.get(jid);
    if (!p || Date.now() - p.lastSeen > 10000) return res.json({ typing: false });
    res.json({ typing: p.status === 'composing', status: p.status });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.get('/api/messages/search', uiAuthMiddleware, (req, res) => {
    try {
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
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.get('/api/avatar', uiAuthMiddleware, asyncHandler(async (req, res) => {
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
  }));

  app.get('/api/chat_info', uiAuthMiddleware, asyncHandler(async (req, res) => {
    try {
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
      let displayName = jid.split('@')[0];
      if (session.contactCache && session.contactCache.has(jid)) {
        const c = session.contactCache.get(jid);
        displayName = c.name || c.notify || displayName;
        info.status = c.status || '';
      }
      if (displayName === jid.split('@')[0] && session.messageStore) {
        const lastWithPushName = Array.from(session.messageStore.values()).find(
          (m) => m.key?.remoteJid === jid && m.pushName
        );
        if (lastWithPushName) displayName = lastWithPushName.pushName;
      }
      info.name = displayName;
      if (session.sock) {
        try {
          const st = await session.sock.fetchStatus(jid);
          // Baileys fetchStatus returns an array of [{ jid, status: { status, setAt } }] or simple object/string
          const entry = Array.isArray(st) ? st[0] : st;
          const statusVal =
            entry?.status?.status ?? entry?.status ?? (typeof entry === 'string' ? entry : null);
          if (statusVal && typeof statusVal === 'string') {
            info.status = statusVal;
          }
        } catch (e) {}
      }
    }

    try {
      info.avatarUrl = await session.sock?.profilePictureUrl(jid, 'preview');
    } catch {}

    res.json(info);
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  }));
}
