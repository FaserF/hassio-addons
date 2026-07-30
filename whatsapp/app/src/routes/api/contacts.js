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

  app.get('/groups', authMiddleware, asyncHandler(async (req, res) => {
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
  }));

  app.get('/chats', authMiddleware, asyncHandler(async (req, res) => {
    try {
      const session = getReqSession(req);
      const chats = Array.from(session.chatCache?.keys() || []).map((jid) => ({
        jid,
        name: session.contactCache?.get(jid)?.name || jid.split('@')[0],
      }));
      res.json(chats);
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  }));

  app.post('/mark_as_read', authMiddleware, asyncHandler(async (req, res) => {
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
  }));

  app.post('/set_presence', authMiddleware, asyncHandler(async (req, res) => {
    try {
      const session = getReqSession(req);
      const { number, presence } = req.body;
      if (!number || !presence) return res.status(400).json({ detail: 'Missing number or presence' });

      const connected = await ensureConnected(session);
      if (!connected) return res.status(503).json({ detail: 'Not connected' });

      const jid = getJid(number);
      await session.sock.sendPresenceUpdate(presence, jid);
      res.json({ status: 'presence_updated' });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  }));

  app.post('/subscribe_presence', authMiddleware, asyncHandler(async (req, res) => {
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
  }));
}
