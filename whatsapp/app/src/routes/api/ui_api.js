import { uiAuthMiddleware, anyAuthMiddleware, apiLimiter } from '../../middleware.js';
import { getSession, sanitizeSessionId, sessions } from '../../session.js';
import { getMessageText, asyncHandler } from './helpers.js';
import { getJid } from '../../utils/jid.js';
import {
  resolveCanonicalUserKey,
  isSameUser,
  isMessageForJid,
  normalizeJid,
} from '../../utils/security.js';

export function registerUiApiRoutes(app) {
  app.get(
    '/api/chats',
    uiAuthMiddleware,
    asyncHandler(async (req, res) => {
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

        // Ensure groupCache has participating group subjects
        if (
          session.sock &&
          session.sock.groupFetchAllParticipating &&
          (!session.groupCache || session.groupCache.size === 0)
        ) {
          try {
            const groups = await session.sock.groupFetchAllParticipating();
            for (const [gId, g] of Object.entries(groups)) {
              if (g && g.subject) {
                session.groupCache?.set(gId, g.subject);
              }
            }
          } catch (e) {
            /* ignore fetch error */
          }
        }

        const messages = Array.from(session.messageStore.values());
        const JidMap = {};

        // Build name lookup map from contactCache and pushNames in stored messages
        const contactNames = new Map();
        if (session.contactCache) {
          for (const [cId, contact] of session.contactCache.entries()) {
            const cName = contact.name || contact.notify || contact.verifiedName;
            if (cName) {
              contactNames.set(cId, cName);
              if (contact.lid) {
                contactNames.set(contact.lid, cName);
                const lidNorm = normalizeJid(contact.lid);
                if (lidNorm) contactNames.set(lidNorm, cName);
              }
              const digits = (contact.id || cId || '').split('@')[0].replace(/\D/g, '');
              if (digits && !digits.startsWith('1576')) {
                contactNames.set(`${digits}@s.whatsapp.net`, cName);
              }
              const phoneDigits = (contact.phoneNumber || '').replace(/\D/g, '');
              if (phoneDigits) {
                contactNames.set(`${phoneDigits}@s.whatsapp.net`, cName);
              }
            }
          }
        }

        messages.forEach((msg) => {
          if (!msg.key || !msg.key.remoteJid) return;
          let jid = msg.key.remoteJid;
          if (jid.endsWith('@lid') && msg.key.remoteJidAlt?.endsWith('@s.whatsapp.net')) {
            jid = msg.key.remoteJidAlt;
          }
          if (jid.endsWith('@lid')) {
            const resolvedPn = resolveCanonicalUserKey(jid, session);
            if (resolvedPn && !resolvedPn.startsWith('1576')) {
              jid = `${resolvedPn}@s.whatsapp.net`;
            }
          }
          if (
            !jid ||
            (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@g.us') && !jid.endsWith('@lid'))
          )
            return;

          // Check if JID is an internal bot LID (starts with 1576... or length >= 14)
          const rawUser = jid.split('@')[0];
          const digits = rawUser.replace(/\D/g, '');
          if (!jid.endsWith('@g.us') && digits.length >= 14 && digits.startsWith('1576')) {
            const resolvedPn = resolveCanonicalUserKey(jid, session);
            if (resolvedPn && resolvedPn !== digits) {
              jid = `${resolvedPn}@s.whatsapp.net`;
            } else {
              // Internal bot LID or test runner mock JID -> skip ghost chat
              return;
            }
          }

          const msgTime = (msg.messageTimestamp?.low || msg.messageTimestamp || 0) * 1000;
          const previewText = getMessageText(msg);

          // Collect pushName for contact if present (only for incoming messages to prevent owner's pushName overwriting contact)
          if (!jid.endsWith('@g.us') && !msg.key.fromMe && msg.pushName) {
            if (!contactNames.has(jid)) {
              contactNames.set(jid, msg.pushName);
            }
          } else if (
            jid.endsWith('@g.us') &&
            msg.key.participant &&
            !msg.key.fromMe &&
            msg.pushName
          ) {
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

        // Also incorporate chats from session.chatCache that might not have stored messages yet
        if (session.chatCache) {
          for (let jid of session.chatCache.keys()) {
            if (!jid) continue;
            if (jid.endsWith('@lid')) {
              const resolvedPn = resolveCanonicalUserKey(jid, session);
              if (resolvedPn && !resolvedPn.startsWith('1576')) {
                jid = `${resolvedPn}@s.whatsapp.net`;
              }
            }
            if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@g.us') && !jid.endsWith('@lid'))
              continue;
            const rawUser = jid.split('@')[0];
            const digits = rawUser.replace(/\D/g, '');
            if (!jid.endsWith('@g.us') && digits.length >= 14 && digits.startsWith('1576')) {
              const resolvedPn = resolveCanonicalUserKey(jid, session);
              if (resolvedPn && resolvedPn !== digits) {
                jid = `${resolvedPn}@s.whatsapp.net`;
              } else {
                continue;
              }
            }
            if (!JidMap[jid]) {
              JidMap[jid] = {
                jid,
                name: jid.split('@')[0],
                preview: '[No messages cached]',
                timestamp: 0,
                fromMe: false,
              };
            }
          }
        }

        // Identify self WhatsApp user JID
        const myJidRaw = session.sock?.user?.id || session.sock?.user?.jid;
        const myJidClean = myJidRaw
          ? `${myJidRaw.split('@')[0].split(':')[0]}@s.whatsapp.net`
          : null;

        // Resolve final display names synchronously (with async background cache enrichment)
        const chats = Object.values(JidMap)
          .map((c) => {
            if (!c.preview || !c.preview.trim()) {
              c.preview = '[Message]';
            }
            if (myJidClean && c.jid === myJidClean) {
              c.name = '__ME_SELF_BOT__';
            } else if (c.jid.endsWith('@g.us')) {
              if (session.groupCache && session.groupCache.has(c.jid)) {
                c.name = session.groupCache.get(c.jid);
              } else {
                c.name = `__GROUP_FALLBACK__:${c.jid.split('@')[0].split('-')[0]}`;
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
            } else {
              const norm = normalizeJid(c.jid);
              if (contactNames.has(norm)) {
                c.name = contactNames.get(norm);
              } else {
                const canonicalPn = resolveCanonicalUserKey(c.jid, session);
                if (canonicalPn && contactNames.has(`${canonicalPn}@s.whatsapp.net`)) {
                  c.name = contactNames.get(`${canonicalPn}@s.whatsapp.net`);
                } else if (canonicalPn && canonicalPn !== c.jid.split('@')[0]) {
                  c.name = canonicalPn;
                }
              }
            }
            return c;
          })
          .sort((a, b) => b.timestamp - a.timestamp);

        res.json(chats);
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

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
        .filter((msg) => isMessageForJid(msg, targetJid, session))
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
            : msg.pushName
              ? msg.pushName
              : resolveCanonicalUserKey(participant || targetJid, session) ||
                (participant || targetJid ? (participant || targetJid).split('@')[0] : 'Unknown');

          let buttons = [];
          let rawMsg = msg.message;
          if (rawMsg?.ephemeralMessage) rawMsg = rawMsg.ephemeralMessage.message;
          if (rawMsg?.viewOnceMessage) rawMsg = rawMsg.viewOnceMessage.message;
          if (rawMsg?.viewOnceMessageV2) rawMsg = rawMsg.viewOnceMessageV2.message;

          // Poll extraction
          const pollCreation =
            rawMsg?.pollCreationMessage ||
            rawMsg?.pollCreationMessageV2 ||
            rawMsg?.pollCreationMessageV3;
          let pollData = null;
          if (pollCreation) {
            pollData = {
              name: pollCreation.name || 'Poll',
              options: (pollCreation.options || []).map((o) =>
                typeof o === 'string' ? o : o.optionName || 'Option'
              ),
              selectableCount: pollCreation.selectableCount || 1,
            };
          }

          // Location extraction
          const locMsg = rawMsg?.locationMessage || rawMsg?.liveLocationMessage;
          let locationData = null;
          if (locMsg) {
            locationData = {
              degreesLatitude: locMsg.degreesLatitude,
              degreesLongitude: locMsg.degreesLongitude,
              name: locMsg.name || locMsg.address || null,
              address: locMsg.address || null,
              isLive: Boolean(rawMsg?.liveLocationMessage),
            };
          }

          // Contact extraction
          const contactMsg = rawMsg?.contactMessage || rawMsg?.contactsArrayMessage?.contacts?.[0];
          let contactData = null;
          if (contactMsg) {
            const displayName =
              contactMsg.displayName ||
              (contactMsg.vcard ? contactMsg.vcard.match(/FN:(.*)/)?.[1]?.trim() : null) ||
              'Contact';
            const phone = contactMsg.vcard
              ? contactMsg.vcard.match(/TEL.*:(.*)/)?.[1]?.trim()
              : null;
            contactData = {
              displayName,
              phone,
              vcard: contactMsg.vcard || null,
            };
          }

          // Event extraction
          const evMsg = rawMsg?.eventMessage;
          let eventData = null;
          if (evMsg) {
            eventData = {
              name: evMsg.name || 'Event',
              description: evMsg.description || '',
              startTime: evMsg.startTime ? Number(evMsg.startTime) : null,
              location: evMsg.location?.name || null,
              joinLink: evMsg.joinLink || null,
              isCanceled: Boolean(evMsg.isCanceled),
            };
          }

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
              text: b.buttonParamsJson
                ? (() => {
                    try {
                      return JSON.parse(b.buttonParamsJson)?.display_text || b.name;
                    } catch (e) {
                      return b.name;
                    }
                  })()
                : b.name,
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

          const effectiveMediaType =
            mediaType ||
            (rawMsg?.stickerMessage
              ? 'sticker'
              : rawMsg?.imageMessage
                ? 'image'
                : rawMsg?.videoMessage
                  ? 'video'
                  : rawMsg?.audioMessage
                    ? 'audio'
                    : rawMsg?.documentMessage
                      ? 'document'
                      : null);

          return {
            id: msg.key.id,
            fromMe: msg.key.fromMe || false,
            senderName,
            senderJid: participant || (msg.key.fromMe ? null : targetJid),
            text: text || caption || null,
            caption,
            timestamp,
            mediaUrl,
            mediaType: effectiveMediaType,
            mediaMime,
            poll: pollData,
            location: locationData,
            contact: contactData,
            eventData,
            quotedId,
            quotedText,
            quotedSender,
            buttons,
            ack: msg._ack != null ? msg._ack : msg.status != null ? msg.status : null,
            reactions: msg._reactions || [],
            starred: msg.starred || false,
          };
        })
        .filter(
          (m) =>
            m.text ||
            m.mediaUrl ||
            (m.buttons && m.buttons.length > 0) ||
            m.poll ||
            m.location ||
            m.contact ||
            m.eventData ||
            m.mediaType ||
            m.id
        )
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

  app.post('/api/groups/create', uiAuthMiddleware, async (req, res) => {
    try {
      const sessionId = sanitizeSessionId(req.body.session_id || 'default');
      const session = getSession(sessionId);
      if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ detail: 'WhatsApp session not connected' });
      }
      const { subject, participants } = req.body;
      if (!subject || !participants || !Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({ detail: 'Missing subject or participants list' });
      }
      const formattedParticipants = participants.map((p) => getJid(p));
      const group = await session.sock.groupCreate(subject, formattedParticipants);
      res.json({ success: true, status: 'created', group });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.post('/api/group/participants/add', uiAuthMiddleware, async (req, res) => {
    try {
      const sessionId = sanitizeSessionId(req.body.session_id || 'default');
      const session = getSession(sessionId);
      if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ detail: 'WhatsApp session not connected' });
      }
      const { groupJid, participantJid } = req.body;
      if (!groupJid || !participantJid) {
        return res.status(400).json({ detail: 'Missing groupJid or participantJid' });
      }
      const cleanParticipant = participantJid.includes('@')
        ? participantJid
        : participantJid + '@s.whatsapp.net';
      const result = await session.sock.groupParticipantsUpdate(
        groupJid,
        [cleanParticipant],
        'add'
      );
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.post('/api/group/participants/remove', uiAuthMiddleware, async (req, res) => {
    try {
      const sessionId = sanitizeSessionId(req.body.session_id || 'default');
      const session = getSession(sessionId);
      if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ detail: 'WhatsApp session not connected' });
      }
      const { groupJid, participantJid } = req.body;
      if (!groupJid || !participantJid) {
        return res.status(400).json({ detail: 'Missing groupJid or participantJid' });
      }
      const cleanParticipant = participantJid.includes('@')
        ? participantJid
        : participantJid + '@s.whatsapp.net';
      const result = await session.sock.groupParticipantsUpdate(
        groupJid,
        [cleanParticipant],
        'remove'
      );
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.post('/api/poll/vote', uiAuthMiddleware, async (req, res) => {
    try {
      const sessionId = sanitizeSessionId(req.body.session_id || 'default');
      const session = getSession(sessionId);
      if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ detail: 'WhatsApp session not connected' });
      }
      const { jid, option } = req.body;
      if (!jid || !option) {
        return res.status(400).json({ detail: 'Missing jid or option' });
      }

      await session.sock.sendMessage(jid, {
        text: `🗳️ Vote: ${option}`,
      });
      res.json({ success: true, option });
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
      if (!session || !session.messageStore) return res.json([]);
      const results = Array.from(session.messageStore.values())
        .filter((msg) => isMessageForJid(msg, jid, session))
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

  app.get(
    '/api/avatar',
    apiLimiter,
    anyAuthMiddleware,
    asyncHandler(async (req, res) => {
      const sessionId = sanitizeSessionId(req.query.session_id || 'default');
      const session = getSession(sessionId);
      const jid = req.query.jid;
      if (!jid || !session.sock) return res.json({ success: false, url: null });

      try {
        let url = null;
        try {
          url = await session.sock.profilePictureUrl(jid, 'preview');
        } catch (e) {
          url = await session.sock.profilePictureUrl(jid, 'image');
        }
        if (url) {
          return res.json({ success: true, url });
        }
        res.json({ success: false, url: null });
      } catch (err) {
        res.json({ success: false, url: null });
      }
    })
  );

  app.get(
    '/api/chat_info',
    uiAuthMiddleware,
    asyncHandler(async (req, res) => {
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
            info.restrict = !!metadata.restrict;
            info.announce = !!metadata.announce;
            const botJidRaw = session.sock?.user?.id || '';
            const cleanBotId = botJidRaw ? botJidRaw.split('@')[0].split(':')[0] : '';
            let isBotAdmin = false;
            if (botJidRaw && metadata.participants) {
              const botPart = metadata.participants.find((p) => {
                const cleanPId = p.id.split('@')[0].split(':')[0];
                return cleanPId === cleanBotId;
              });
              if (botPart && (botPart.admin === 'admin' || botPart.admin === 'superadmin')) {
                isBotAdmin = true;
              }
            }
            info.botJidRaw = botJidRaw;
            info.botUserNum = cleanBotId;
            info.isBotAdmin = isBotAdmin;
            info.canEditGroupInfo = !metadata.restrict || isBotAdmin;
            info.participantsCount = metadata.participants ? metadata.participants.length : 0;
            info.participants = (metadata.participants || []).map((p) => {
              let pName = p.id.split('@')[0];
              if (session.contactCache && session.contactCache.has(p.id)) {
                const c = session.contactCache.get(p.id);
                pName = c.name || c.notify || pName;
              }
              const cleanPId = p.id.split('@')[0].split(':')[0];
              const isBot = Boolean(cleanBotId && cleanPId === cleanBotId);
              return { id: p.id, name: pName, admin: p.admin, isBot };
            });
          } catch (err) {
            if (session.groupCache && session.groupCache.has(jid)) {
              info.name = session.groupCache.get(jid);
            }
          }
        } else {
          let displayName = jid.split('@')[0];
          let username = null;
          let matchedContact = null;
          if (session.contactCache) {
            matchedContact = session.contactCache.get(jid);
            if (!matchedContact) {
              for (const c of session.contactCache.values()) {
                if (c.id && isSameUser(c.id, jid, session)) {
                  matchedContact = c;
                  break;
                }
              }
            }
          }
          if (matchedContact) {
            displayName = matchedContact.name || matchedContact.notify || displayName;
            username = matchedContact.notify || matchedContact.verifiedName || null;
            info.status = matchedContact.status || '';
          }
          if (session.messageStore) {
            const lastWithPushName = Array.from(session.messageStore.values()).find(
              (m) => isMessageForJid(m, jid, session) && !m.key?.fromMe && m.pushName
            );
            if (lastWithPushName) {
              username = username || lastWithPushName.pushName;
              if (displayName === jid.split('@')[0]) displayName = lastWithPushName.pushName;
            }
          }
          const canonical = resolveCanonicalUserKey(jid, session);
          if (displayName === jid.split('@')[0] && canonical && canonical !== jid.split('@')[0]) {
            displayName = canonical;
          }
          info.name = displayName;
          info.username = username;
          const phoneDigits = (canonical || jid.split('@')[0]).replace(/\D/g, '');
          info.phone = phoneDigits && !phoneDigits.startsWith('1576') ? `+${phoneDigits}` : null;
          if (session.sock) {
            try {
              const st = await session.sock.fetchStatus(jid);
              // Baileys fetchStatus returns an array of [{ jid, status: { status, setAt } }] or simple object/string
              const entry = Array.isArray(st) ? st[0] : st;
              const statusVal =
                entry?.status?.status ??
                entry?.status ??
                (typeof entry === 'string' ? entry : null);
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
    })
  );
}
