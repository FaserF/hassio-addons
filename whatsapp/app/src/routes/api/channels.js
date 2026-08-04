import { authMiddleware } from '../../middleware.js';
import { getReqSession } from '../../session.js';
import { getJid } from '../../utils/jid.js';
import { ensureConnected, asyncHandler } from './helpers.js';

export function registerChannelRoutes(app) {
  app.all(
    '/channels/info',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const number = req.body?.number || req.query?.number || req.query?.jid;
        const code = req.body?.code || req.query?.code;
        if (!number && !code) {
          return res.status(400).json({ detail: 'Missing channel jid/number or invite code' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        let metadata;
        if (code) {
          metadata = await session.sock.newsletterMetadata('invite', code);
        } else {
          const jid = getJid(number);
          metadata = await session.sock.newsletterMetadata('jid', jid);
        }
        res.json(metadata);
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/channels/follow',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.newsletterFollow(jid);
        res.json({ status: 'followed', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/channels/unfollow',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.newsletterUnfollow(jid);
        res.json({ status: 'unfollowed', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/channels/mute',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.newsletterMute(jid);
        res.json({ status: 'muted', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/channels/unmute',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.newsletterUnmute(jid);
        res.json({ status: 'unmuted', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/labels/add_to_chat',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, labelId } = req.body;
        if (!number || !labelId) {
          return res.status(400).json({ detail: 'Missing number or labelId' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.chatModify({ addLabel: { labelId } }, jid);
        res.json({ status: 'label_added', jid, labelId });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/labels/remove_from_chat',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, labelId } = req.body;
        if (!number || !labelId) {
          return res.status(400).json({ detail: 'Missing number or labelId' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.chatModify({ removeLabel: { labelId } }, jid);
        res.json({ status: 'label_removed', jid, labelId });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );
}
