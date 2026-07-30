import { authMiddleware } from '../../middleware.js';
import { getReqSession } from '../../session.js';
import { getJid } from '../../utils/jid.js';
import { trackSent } from '../../whatsapp/actions.js';
import { getQuotedMessage } from '../../whatsapp/events/index.js';
import { ensureConnected, asyncHandler } from './helpers.js';
import { generateMessageID } from '../../utils/security.js';

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
        const { number, name, options, selectableCount } = req.body;
        if (!number || !name || !options || !Array.isArray(options)) {
          return res.status(400).json({ detail: 'Missing number, name, or options array' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const sentMsg = await session.sock.sendMessage(jid, {
          poll: {
            name,
            values: options,
            selectableCount: selectableCount || 1,
          },
        });
        trackSent(session, number, `[Poll] ${name}`);
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
        const { number, name, description, startTime, endTime, location } = req.body;
        if (!number || !name) return res.status(400).json({ detail: 'Missing number or name' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const sentMsg = await session.sock.sendMessage(jid, {
          event: {
            name,
            description: description || '',
            startTime: startTime ? Math.floor(new Date(startTime).getTime() / 1000) : undefined,
            endTime: endTime ? Math.floor(new Date(endTime).getTime() / 1000) : undefined,
            location: location ? { name: location } : undefined,
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
        res.json({ status: 'sent', id: sentMsg?.key?.id });
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
        const { number, url, fileName, caption } = req.body;
        if (!number || !url) return res.status(400).json({ detail: 'Missing number or url' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const sentMsg = await session.sock.sendMessage(jid, {
          document: { url },
          fileName: fileName || 'document',
          caption: caption || '',
        });
        trackSent(session, number, `[Document] ${fileName || 'document'}`);
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
        const { number, url, caption } = req.body;
        if (!number || !url) return res.status(400).json({ detail: 'Missing number or url' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const sentMsg = await session.sock.sendMessage(jid, {
          video: { url },
          caption: caption || '',
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
        const { number, messageId, newText } = req.body;
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
}
