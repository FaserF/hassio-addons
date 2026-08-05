import { authMiddleware } from '../../middleware.js';
import { getReqSession } from '../../session.js';
import { getJid } from '../../utils/jid.js';
import { ensureConnected, asyncHandler } from './helpers.js';

export function registerContactRoutes(app) {
  app.get('/contacts', authMiddleware, (req, res) => {
    const session = getReqSession(req);
    const contacts = Array.from(session.contactCache?.values() || []).map((c) => ({
      id: c.id,
      name: c.name || c.notify || c.id.split('@')[0],
      notify: c.notify,
      verifiedName: c.verifiedName,
    }));
    res.json(contacts);
  });

  app.get(
    '/groups',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const groups = await session.sock.groupFetchAllParticipating();
        const result = Object.values(groups).map((g) => ({
          id: g.id,
          subject: g.subject,
          owner: g.owner,
          creation: g.creation,
          participantsCount: g.participants?.length || 0,
        }));
        res.json(result);
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.get(
    '/chats',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const chatJids = new Set(session.chatCache?.keys() || []);
        if (session.messageStore) {
          for (const msg of session.messageStore.values()) {
            if (msg?.key?.remoteJid) chatJids.add(msg.key.remoteJid);
          }
        }
        if (session.groupCache) {
          for (const gId of session.groupCache.keys()) {
            chatJids.add(gId);
          }
        }
        if (session.contactCache) {
          for (const cId of session.contactCache.keys()) {
            if (cId && cId !== 'status@broadcast') chatJids.add(cId);
          }
        }
        chatJids.delete('status@broadcast');

        const chats = Array.from(chatJids).map((jid) => ({
          jid,
          name:
            session.groupCache?.get(jid) ||
            session.contactCache?.get(jid)?.name ||
            session.contactCache?.get(jid)?.notify ||
            jid.split('@')[0],
        }));
        res.json(chats);
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/mark_as_read',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.readMessages([{ remoteJid: jid, id: req.body.messageId || '' }]);
        res.json({ status: 'marked_as_read' });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/set_presence',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, presence } = req.body;
        if (!number || !presence)
          return res.status(400).json({ detail: 'Missing number or presence' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.sendPresenceUpdate(presence, jid);
        res.json({ status: 'presence_updated' });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/subscribe_presence',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.presenceSubscribe(jid);
        res.json({ status: 'subscribed' });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/contacts/check',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const formattedNumber = number.replace(/[^\d]/g, '');
        const jid = getJid(formattedNumber);

        // Check if number exists on WhatsApp using Baileys onWhatsApp
        const result = await session.sock.onWhatsApp(jid);
        const existsInfo = Array.isArray(result) && result.length > 0 ? result[0] : null;

        if (!existsInfo || !existsInfo.exists) {
          return res.json({
            exists: false,
            in_contacts: false,
            name: null,
            notify: null,
            verified_name: null,
            jid,
            number: formattedNumber,
          });
        }

        const targetJid = existsInfo.jid || jid;

        // Check contacts cache
        let cachedContact = session.contactCache?.get(targetJid);

        // Fallback to socket store contacts if available
        if (!cachedContact && session.sock?.store?.contacts) {
          cachedContact = session.sock.store.contacts[targetJid];
        }

        // Try fuzzy lookup if exact match not found
        if (!cachedContact && session.contactCache) {
          const targetUserDigits = targetJid.split('@')[0].split(':')[0].replace(/[^\d]/g, '');
          for (const [cJid, contact] of session.contactCache.entries()) {
            const cUserDigits = cJid.split('@')[0].split(':')[0].replace(/[^\d]/g, '');
            if (!cUserDigits || !targetUserDigits) continue;

            const cLast8 = cUserDigits.slice(-8);
            const targetLast8 = targetUserDigits.slice(-8);
            const cCC = cUserDigits.length >= 10 ? cUserDigits.slice(0, 2) : '';
            const targetCC = targetUserDigits.length >= 10 ? targetUserDigits.slice(0, 2) : '';

            if (
              cJid === targetJid ||
              cUserDigits === targetUserDigits ||
              cUserDigits.endsWith(targetUserDigits) ||
              targetUserDigits.endsWith(cUserDigits) ||
              (cLast8.length >= 7 &&
                targetLast8.length >= 7 &&
                cLast8 === targetLast8 &&
                (!cCC || !targetCC || cCC === targetCC))
            ) {
              cachedContact = contact;
              break;
            }
          }
        }

        const isInContacts = !!(
          cachedContact &&
          (cachedContact.name || cachedContact.verifiedName)
        );

        res.json({
          exists: true,
          in_contacts: isInContacts,
          name: cachedContact?.name || cachedContact?.verifiedName || null,
          notify: cachedContact?.notify || null,
          verified_name: cachedContact?.verifiedName || null,
          jid: targetJid,
          number: formattedNumber,
        });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/contacts/profile_picture',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const profilePictureUrl = await session.sock
          .profilePictureUrl(jid, 'image')
          .catch(() => null);
        res.json({ jid, profile_picture_url: profilePictureUrl });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/contacts/about',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const statusObj = await session.sock.fetchStatus(jid).catch(() => null);
        res.json({ jid, status: statusObj?.status || null, setAt: statusObj?.setAt || null });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/contacts/block',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.updateBlockStatus(jid, 'block');
        res.json({ status: 'blocked', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/contacts/unblock',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.updateBlockStatus(jid, 'unblock');
        res.json({ status: 'unblocked', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );
}
