import { authMiddleware } from '../../middleware.js';
import { getReqSession } from '../../session.js';
import { getJid } from '../../utils/jid.js';
import { ensureConnected, asyncHandler } from './helpers.js';

export function registerGroupRoutes(app) {
  app.post(
    '/groups/create',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { subject, participants } = req.body;
        if (
          !subject ||
          !participants ||
          !Array.isArray(participants) ||
          participants.length === 0
        ) {
          return res
            .status(400)
            .json({
              detail: 'Missing subject or participants array (at least 1 participant required)',
            });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const formattedParticipants = participants.map((p) => getJid(p));
        const group = await session.sock.groupCreate(subject, formattedParticipants);
        res.json({ status: 'created', group });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.all(
    '/groups/info',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const number = req.body?.number || req.query?.number || req.query?.jid;
        if (!number) return res.status(400).json({ detail: 'Missing group number/jid' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const metadata = await session.sock.groupMetadata(jid);
        res.json(metadata);
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/groups/participants/add',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, participants } = req.body;
        if (!number || !participants || !Array.isArray(participants)) {
          return res.status(400).json({ detail: 'Missing number or participants array' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const formattedParticipants = participants.map((p) => getJid(p));
        const result = await session.sock.groupParticipantsUpdate(
          jid,
          formattedParticipants,
          'add'
        );
        res.json({ status: 'updated', result });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/groups/participants/remove',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, participants } = req.body;
        if (!number || !participants || !Array.isArray(participants)) {
          return res.status(400).json({ detail: 'Missing number or participants array' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const formattedParticipants = participants.map((p) => getJid(p));
        const result = await session.sock.groupParticipantsUpdate(
          jid,
          formattedParticipants,
          'remove'
        );
        res.json({ status: 'updated', result });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/groups/participants/promote',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, participants } = req.body;
        if (!number || !participants || !Array.isArray(participants)) {
          return res.status(400).json({ detail: 'Missing number or participants array' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const formattedParticipants = participants.map((p) => getJid(p));
        const result = await session.sock.groupParticipantsUpdate(
          jid,
          formattedParticipants,
          'promote'
        );
        res.json({ status: 'promoted', result });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/groups/participants/demote',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, participants } = req.body;
        if (!number || !participants || !Array.isArray(participants)) {
          return res.status(400).json({ detail: 'Missing number or participants array' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const formattedParticipants = participants.map((p) => getJid(p));
        const result = await session.sock.groupParticipantsUpdate(
          jid,
          formattedParticipants,
          'demote'
        );
        res.json({ status: 'demoted', result });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/groups/leave',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.groupLeave(jid);
        res.json({ status: 'left', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/groups/subject',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, subject } = req.body;
        if (!number || !subject)
          return res.status(400).json({ detail: 'Missing number or subject' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.groupUpdateSubject(jid, subject);
        res.json({ status: 'subject_updated', jid, subject });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/groups/description',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, description } = req.body;
        if (!number || description == null) {
          return res.status(400).json({ detail: 'Missing number or description' });
        }

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        await session.sock.groupUpdateDescription(jid, description);
        res.json({ status: 'description_updated', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/groups/settings',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number, announce, locked } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        if (announce !== undefined) {
          await session.sock.groupSettingUpdate(
            jid,
            announce ? 'announcement' : 'not_announcement'
          );
        }
        if (locked !== undefined) {
          await session.sock.groupSettingUpdate(jid, locked ? 'locked' : 'unlocked');
        }
        res.json({ status: 'settings_updated', jid });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.all(
    '/groups/invite_code',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const number = req.body?.number || req.query?.number || req.query?.jid;
        if (!number) return res.status(400).json({ detail: 'Missing group number/jid' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const code = await session.sock.groupInviteCode(jid);
        res.json({ code, link: `https://chat.whatsapp.com/${code}` });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/groups/revoke_invite',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { number } = req.body;
        if (!number) return res.status(400).json({ detail: 'Missing number' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const jid = getJid(number);
        const code = await session.sock.groupRevokeInvite(jid);
        res.json({ status: 'revoked', code, link: `https://chat.whatsapp.com/${code}` });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );

  app.post(
    '/groups/join',
    authMiddleware,
    asyncHandler(async (req, res) => {
      try {
        const session = getReqSession(req);
        const { code } = req.body;
        if (!code) return res.status(400).json({ detail: 'Missing invite code' });

        const connected = await ensureConnected(session);
        if (!connected) return res.status(503).json({ detail: 'Not connected' });

        const cleanCode = code.replace('https://chat.whatsapp.com/', '').trim();
        const groupId = await session.sock.groupAcceptInvite(cleanCode);
        res.json({ status: 'joined', groupId });
      } catch (err) {
        res.status(500).json({ detail: err.message });
      }
    })
  );
}
