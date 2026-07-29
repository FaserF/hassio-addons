import { authMiddleware } from '../../middleware.js';
import {
  getReqSession,
  getSession,
  sessions,
  sanitizeSessionId,
  signalInterest,
  getAuthDir,
} from '../../session.js';
import { connectToWhatsApp } from '../../whatsapp/connection.js';
import fs from 'fs';

export function registerSessionRoutes(app) {
  app.post('/session/start', authMiddleware, (req, res) => {
    const sessionId = sanitizeSessionId(req.body?.session_id || req.query?.session_id || 'default');
    signalInterest(sessionId);
    let session = sessions.get(sessionId);
    if (!session) {
      session = getSession(sessionId);
    }
    if (!session.sock) {
      connectToWhatsApp(session);
    }
    res.json({ status: 'starting', session_id: sessionId, isConnected: session.isConnected });
  });

  app.delete('/session', async (req, res) => {
    const session = getReqSession(req);
    const authDir = getAuthDir(session.id);
    try {
      if (session.sock) {
        try {
          await session.sock.logout();
        } catch (e) {}
        session.sock.end(undefined);
        session.sock = null;
      }
      session.isConnected = false;
      session.isConnecting = false;
      session.qr = null;
      session.disconnectReason = 'logged_out';

      if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
      }

      setTimeout(() => {
        connectToWhatsApp(session);
      }, 1000);

      res.json({ status: 'logged_out', message: 'Session logged out and auth data deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/qr', authMiddleware, (req, res) => {
    const session = getReqSession(req);
    if (session.isConnected) return res.json({ status: 'connected', qr: null });
    if (session.qr) return res.json({ status: 'qr_ready', qr: session.qr });
    res.json({ status: 'waiting_for_qr', qr: null });
  });

  app.get('/passkey/status', authMiddleware, (req, res) => {
    const session = getReqSession(req);
    res.json({
      passkeyDetected: session.passkeyDetected || false,
      message: session.passkeyDetected
        ? 'WhatsApp Passkey restriction detected. Please remove Passkeys in WhatsApp settings and restart daemon.'
        : 'No passkey issues detected.',
    });
  });

  app.post('/session/pair', authMiddleware, async (req, res) => {
    const session = getReqSession(req);
    const phoneNumber = req.body?.phone_number;
    if (!phoneNumber) return res.status(400).json({ error: 'phone_number required' });
    if (session.isConnected) return res.json({ status: 'already_connected' });
    if (!session.sock) return res.status(500).json({ error: 'Socket not initialized' });

    try {
      const code = await session.sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
      res.json({ status: 'pairing_code_generated', code });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/status', authMiddleware, (req, res) => {
    const session = getReqSession(req);
    res.json({
      connected: session.isConnected,
      connecting: session.isConnecting,
      session_id: session.id,
      user: session.sock?.user || null,
      stats: session.stats,
    });
  });

  app.get('/events', authMiddleware, (req, res) => {
    const session = getReqSession(req);
    const events = [...session.eventQueue];
    session.eventQueue = [];
    res.json(events);
  });

  app.get('/logs', (req, res) => res.json(getReqSession(req).connectionLogs));

  app.get('/stats', authMiddleware, (req, res) => {
    const session = getReqSession(req);
    res.json(session.stats);
  });
}
