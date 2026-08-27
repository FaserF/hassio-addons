import mime from 'mime-types';
import { logger } from '../../logger.js';
import { authMiddleware } from '../../middleware.js';
import { getReqSession } from '../../session.js';
import { getJid } from '../../utils/jid.js';
import { trackSent } from '../../whatsapp/actions.js';
import { getQuotedMessage } from '../../whatsapp/events/index.js';
import { ensureConnected, asyncHandler, getLastMessagesForChat } from './helpers.js';
import { generateMessageID } from '../../utils/security.js';
import {
  syncWhatsAppDeleteToTelegram,
  syncWhatsAppEditToTelegram,
  syncWhatsAppReactionToTelegram,
} from '../../whatsapp/telegram/listener.js';

export function registerMessagingRoutes(app) {
  app.post(
    '/send_message',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, message, quotedMessageId } = req.body;
        if (!number || !message)
          return res.status(400).json({ detail: 'Missing number or message' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected to WhatsApp' });

        const jid = getJid(number);
        const options = {};
        if (quotedMessageId) {
          const quotedMsg = getQuotedMessage(session, quotedMessageId);
          if (quotedMsg) options.quoted = quotedMsg;
        }
        const sentMsg = await session.sock.sendMessage(jid, { text: message }, options);
        if (sentMsg && sentMsg.key?.id) {
          session.messageStore?.set(sentMsg.key.id, sentMsg);
        }
        trackSent(session, number, message);
        res.json({ status: 'sent', id: sentMsg?.key?.id || generateMessageID() });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/send_image',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, url, caption } = req.body;
        if (!number || !url) return res.status(400).json({ detail: 'Missing number or url' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const sentMsg = await session.sock.sendMessage(jid, {
          image: { url },
          caption: caption || '',
        });
        trackSent(session, number, `[Image] ${caption || ''}`);
        res.json({ status: 'sent', id: sentMsg?.key?.id });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/send_poll',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, name, question, options, selectableCount } = req.body;
        const pollTitle = name || question;
        if (!number || !pollTitle || !options || !Array.isArray(options)) {
          return res.status(400).json({ detail: 'Missing number, name, or options array' });
        }

        const cleanedOptions = options.map((opt) => String(opt).trim()).filter(Boolean);
        if (cleanedOptions.length < 2) {
          return res.status(400).json({
            detail:
              'WhatsApp polls require at least 2 voting options (maximum 12). If you need a single confirmation button, provide at least two distinct choices.',
          });
        }
        if (cleanedOptions.length > 12) {
          return res.status(400).json({
            detail: 'WhatsApp polls support a maximum of 12 options.',
          });
        }
        const uniqueSet = new Set(cleanedOptions);
        if (uniqueSet.size !== cleanedOptions.length) {
          return res.status(400).json({
            detail:
              'WhatsApp polls require unique voting options. Duplicate options are not supported by WhatsApp.',
          });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const sentMsg = await session.sock.sendMessage(jid, {
          poll: {
            name: pollTitle,
            values: cleanedOptions,
            selectableCount: selectableCount || 1,
          },
        });
        trackSent(session, number, `[Poll] ${pollTitle}`);
        res.json({ status: 'sent', id: sentMsg?.key?.id });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/send_location',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, degreesLatitude, degreesLongitude, name, address } = req.body;
        if (!number || degreesLatitude == null || degreesLongitude == null) {
          return res.status(400).json({ detail: 'Missing number, latitude, or longitude' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const sentMsg = await session.sock.sendMessage(jid, {
          location: { degreesLatitude, degreesLongitude, name, address },
        });
        trackSent(
          session,
          number,
          `[Location] ${name || `${degreesLatitude},${degreesLongitude}`}`
        );
        res.json({ status: 'sent', id: sentMsg?.key?.id });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/send_event',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        // Accept both 'startTime' (direct API) and 'date' (stable integration v1.7.5)
        const {
          number,
          name,
          description,
          startTime,
          date,
          endTime,
          location,
          joinLink,
          isCanceled,
          expiration,
        } = req.body;
        if (!number || !name) return res.status(400).json({ detail: 'Missing number or name' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        // Normalise the start timestamp: prefer startTime, fall back to date
        const rawStart = startTime ?? date;
        const rawEnd = endTime;

        const jid = getJid(number);
        const sentMsg = await session.sock.sendMessage(jid, {
          event: {
            name,
            description: description || '',
            startTime: rawStart ? Math.floor(new Date(rawStart).getTime() / 1000) : undefined,
            endTime: rawEnd ? Math.floor(new Date(rawEnd).getTime() / 1000) : undefined,
            location: location
              ? typeof location === 'string'
                ? { name: location }
                : location
              : undefined,
            joinLink: joinLink || undefined,
            isCanceled: isCanceled ?? undefined,
            expiration: expiration ?? undefined,
          },
        });
        trackSent(session, number, `[Event] ${name}`);
        res.json({ status: 'sent', id: sentMsg?.key?.id });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/send_buttons',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, text, buttons, footer } = req.body;
        if (!number || !text || !buttons)
          return res.status(400).json({ detail: 'Missing parameters' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        logger.warn(
          { recipient: number },
          '⚠️ WhatsApp has deprecated interactive buttons on standard Multi-Device web accounts. Mobile clients will likely render only plain text without buttons. Use /send_poll instead for interactive choices.'
        );
        const formattedButtons = buttons.map((b, i) => ({
          buttonId: b.id || `btn_${i}`,
          buttonText: { displayText: b.text || b.displayText },
          type: 1,
        }));
        const sentMsg = await session.sock.sendMessage(jid, {
          text,
          footer: footer || '',
          buttons: formattedButtons,
          headerType: 1,
        });
        trackSent(session, number, `[Buttons] ${text}`);
        res.json({
          status: 'sent',
          id: sentMsg?.key?.id,
          warning:
            'Interactive buttons are deprecated by WhatsApp for standard web accounts and may render only as plain text on client apps. Consider using send_poll.',
        });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/send_document',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, url, fileName, caption, mimetype, mimeType, mime_type } = req.body;
        if (!number || !url) return res.status(400).json({ detail: 'Missing number or url' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const name = fileName || 'document';
        const resolvedMime =
          mimetype ||
          mimeType ||
          mime_type ||
          mime.lookup(name) ||
          mime.lookup(url) ||
          'application/octet-stream';

        const sentMsg = await session.sock.sendMessage(jid, {
          document: { url },
          fileName: name,
          mimetype: resolvedMime,
          caption: caption || '',
        });
        trackSent(session, number, `[Document] ${name}`);
        res.json({ status: 'sent', id: sentMsg?.key?.id });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/send_sticker',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, url } = req.body;
        if (!number || !url) return res.status(400).json({ detail: 'Missing number or url' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const sentMsg = await session.sock.sendMessage(jid, {
          sticker: { url },
        });
        trackSent(session, number, `[Sticker]`);
        res.json({ status: 'sent', id: sentMsg?.key?.id });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/send_gif',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, url, caption } = req.body;
        if (!number || !url) return res.status(400).json({ detail: 'Missing number or url' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const sentMsg = await session.sock.sendMessage(jid, {
          video: { url },
          caption: caption || '',
          gifPlayback: true,
        });
        trackSent(session, number, `[GIF] ${caption || ''}`);
        res.json({ status: 'sent', id: sentMsg?.key?.id });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/send_video',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, url, caption, gifPlayback } = req.body;
        if (!number || !url) return res.status(400).json({ detail: 'Missing number or url' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const sentMsg = await session.sock.sendMessage(jid, {
          video: { url },
          caption: caption || '',
          gifPlayback: !!gifPlayback,
        });
        trackSent(session, number, `[Video] ${caption || ''}`);
        res.json({ status: 'sent', id: sentMsg?.key?.id });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/send_audio',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, url, ptt } = req.body;
        if (!number || !url) return res.status(400).json({ detail: 'Missing number or url' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const sentMsg = await session.sock.sendMessage(jid, {
          audio: { url },
          ptt: ptt || false,
          mimetype: 'audio/mp4',
        });
        trackSent(session, number, `[Audio]`);
        res.json({ status: 'sent', id: sentMsg?.key?.id });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/revoke_message',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, messageId } = req.body;
        if (!number || !messageId)
          return res.status(400).json({ detail: 'Missing number or messageId' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.sendMessage(jid, {
          delete: { remoteJid: jid, fromMe: true, id: messageId },
        });
        syncWhatsAppDeleteToTelegram(messageId, jid);
        res.json({ status: 'revoked' });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/edit_message',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const number = req.body.number;
        const messageId = req.body.messageId || req.body.message_id || req.body.id;
        const newText =
          req.body.newText || req.body.new_content || req.body.text || req.body.message;
        if (!number || !messageId || !newText) {
          return res.status(400).json({ detail: 'Missing number, messageId, or newText' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.sendMessage(jid, {
          text: newText,
          edit: { remoteJid: jid, fromMe: true, id: messageId },
        });
        syncWhatsAppEditToTelegram(messageId, jid, newText);
        res.json({ status: 'edited' });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/send_list',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, title, buttonText, sections } = req.body;
        if (!number || !title || !sections)
          return res.status(400).json({ detail: 'Missing parameters' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const sentMsg = await session.sock.sendMessage(jid, {
          text: title,
          buttonText: buttonText || 'Select Option',
          sections,
        });
        trackSent(session, number, `[List] ${title}`);
        res.json({ status: 'sent', id: sentMsg?.key?.id });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/send_contact',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, contactName, contactNumber } = req.body;
        if (!number || !contactName || !contactNumber) {
          return res.status(400).json({ detail: 'Missing parameters' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const vcard =
          'BEGIN:VCARD\n' +
          'VERSION:3.0\n' +
          `FN:${contactName}\n` +
          `TEL;type=CELL;type=VOICE;waid=${contactNumber.replace(/[^0-9]/g, '')}:+${contactNumber.replace(/[^0-9]/g, '')}\n` +
          'END:VCARD';

        const sentMsg = await session.sock.sendMessage(jid, {
          contacts: { displayName: contactName, contacts: [{ vcard }] },
        });
        trackSent(session, number, `[Contact] ${contactName}`);
        res.json({ status: 'sent', id: sentMsg?.key?.id });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/send_reaction',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, messageId, reaction } = req.body;
        if (!number || !messageId) {
          return res.status(400).json({ detail: 'Missing number or messageId' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const targetMsg = session.messageStore?.get(messageId);

        // Use the full stored key (includes fromMe + participant for groups).
        // Reconstruct manually only as a fallback when the message isn't cached.
        const msgKey = targetMsg?.key ?? {
          remoteJid: jid,
          fromMe: false,
          id: messageId,
        };

        await session.sock.sendMessage(jid, {
          react: {
            text: reaction || '',
            key: msgKey,
          },
        });
        syncWhatsAppReactionToTelegram(messageId, jid, reaction || '').catch(() => null);

        // Update reaction locally in messageStore immediately
        if (targetMsg) {
          if (!targetMsg._reactions) targetMsg._reactions = [];
          const myJid = session.sock?.user?.id
            ? session.sock.user.id.split(':')[0] + '@s.whatsapp.net'
            : 'me';
          targetMsg._reactions = targetMsg._reactions.filter((r) => r.sender !== myJid);
          if (reaction) {
            targetMsg._reactions.push({ emoji: reaction, sender: myJid });
          }
        }

        res.json({ status: 'reaction_sent' });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/star_message',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, messageId, star = true } = req.body;
        if (!number || !messageId) {
          return res.status(400).json({ detail: 'Missing number or messageId' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const targetMsg = session.messageStore?.get(messageId);
        const msgKey = targetMsg?.key ?? { remoteJid: jid, id: messageId, fromMe: false };

        await session.sock.chatModify({ star: { messages: [msgKey], star: !!star } }, jid);
        res.json({ status: star ? 'starred' : 'unstarred', messageId });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/unstar_message',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, messageId } = req.body;
        if (!number || !messageId) {
          return res.status(400).json({ detail: 'Missing number or messageId' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const targetMsg = session.messageStore?.get(messageId);
        const msgKey = targetMsg?.key ?? { remoteJid: jid, id: messageId, fromMe: false };

        await session.sock.chatModify({ star: { messages: [msgKey], star: false } }, jid);
        res.json({ status: 'unstarred', messageId });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/pin_message',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, messageId, duration = 86400 } = req.body;
        if (!number || !messageId) {
          return res.status(400).json({ detail: 'Missing number or messageId' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const targetMsg = session.messageStore?.get(messageId);
        const msgKey = targetMsg?.key ?? { remoteJid: jid, id: messageId, fromMe: false };

        await session.sock.sendMessage(jid, {
          pin: {
            key: msgKey,
            type: 1,
            time: duration,
          },
        });
        res.json({ status: 'pinned', messageId });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/unpin_message',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, messageId } = req.body;
        if (!number || !messageId) {
          return res.status(400).json({ detail: 'Missing number or messageId' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const targetMsg = session.messageStore?.get(messageId);
        const msgKey = targetMsg?.key ?? { remoteJid: jid, id: messageId, fromMe: false };

        await session.sock.sendMessage(jid, {
          pin: {
            key: msgKey,
            type: 2,
          },
        });
        res.json({ status: 'unpinned', messageId });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/forward_message',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, messageId, targetNumber } = req.body;
        if (!number || !messageId || !targetNumber) {
          return res.status(400).json({ detail: 'Missing number, messageId, or targetNumber' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const targetJid = getJid(targetNumber);
        const storedMsg = session.messageStore?.get(messageId);
        if (!storedMsg) {
          return res.status(404).json({ detail: 'Message not found in memory store' });
        }

        const sentMsg = await session.sock.sendMessage(targetJid, { forward: storedMsg });
        trackSent(session, targetNumber, `[Forwarded Message]`);
        res.json({ status: 'forwarded', id: sentMsg?.key?.id });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/send_status',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { message, url, caption } = req.body;
        if (!message && !url) {
          return res.status(400).json({ detail: 'Missing message or url for status' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const statusJid = 'status@broadcast';
        let payload = {};
        if (url) {
          payload = { image: { url }, caption: caption || message || '' };
        } else {
          payload = { text: message };
        }

        const sentMsg = await session.sock.sendMessage(statusJid, payload);
        trackSent(session, 'status@broadcast', `[Status Update] ${message || caption || ''}`);
        res.json({ status: 'sent', id: sentMsg?.key?.id });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/chats/archive',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const lastMessages = getLastMessagesForChat(session, jid);
        await session.sock.chatModify({ archive: true, lastMessages }, jid);
        res.json({ status: 'archived', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/chats/unarchive',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const lastMessages = getLastMessagesForChat(session, jid);
        await session.sock.chatModify({ archive: false, lastMessages }, jid);
        res.json({ status: 'unarchived', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/chats/mute',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, durationMs = 8 * 3600 * 1000 } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.chatModify({ mute: durationMs }, jid);
        res.json({ status: 'muted', jid, durationMs });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/chats/unmute',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.chatModify({ mute: null }, jid);
        res.json({ status: 'unmuted', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/mark_as_unread',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const lastMessages = getLastMessagesForChat(session, jid);
        await session.sock.chatModify({ markRead: false, lastMessages }, jid);
        res.json({ status: 'marked_unread', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/chats/clear',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const lastMessages = getLastMessagesForChat(session, jid);
        if (!lastMessages.length) {
          return res
            .status(409)
            .json({ detail: 'No known messages in message store for this chat to clear range' });
        }
        await session.sock.chatModify({ clear: true, lastMessages }, jid);
        res.json({ status: 'cleared', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.all(
    '/chats/delete',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const number = req.body?.number || req.query?.number;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const lastMessages = getLastMessagesForChat(session, jid);
        if (!lastMessages.length) {
          return res
            .status(409)
            .json({ detail: 'No known messages in message store for this chat to delete range' });
        }
        await session.sock.chatModify({ delete: true, lastMessages }, jid);
        res.json({ status: 'deleted', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.all(
    '/chats/messages',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const number = req.body?.number || req.query?.number;
        const limit = parseInt(req.body?.limit || req.query?.limit || '50', 10);
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const jid = getJid(number);
        const messages = [];

        if (session.messageStore) {
          for (const msg of session.messageStore.values()) {
            if (
              msg.key?.remoteJid === jid ||
              msg.key?.remoteJid?.split('@')[0] === jid.split('@')[0]
            ) {
              messages.push(msg);
              if (messages.length >= limit) break;
            }
          }
        }
        res.json({ jid, count: messages.length, messages });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );
}
