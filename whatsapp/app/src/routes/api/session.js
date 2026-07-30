import { authMiddleware, apiLimiter } from '../../middleware.js';
import {
  getReqSession,
  getSession,
  sessions,
  sanitizeSessionId,
  signalInterest,
  getAuthDir,
} from '../../session.js';
import { connectToWhatsApp } from '../../whatsapp/connection.js';
import { asyncHandler } from './helpers.js';
import fs from 'fs';

export function registerSessionRoutes(app) {
  app.post('/session/start', apiLimiter, authMiddleware, (req, res) => {
    try {
    const sessionId = sanitizeSessionId(req.body?.session_id || req.query?.session_id || 'default');
    signalInterest(sessionId);
    let session = sessions.get(sessionId);
    if (!session) {
      session = getSession(sessionId);
    }
    if (!session.sock) {
      connectToWhatsApp(sessionId, sessions, getSession);
    }
    res.json({ status: 'starting', session_id: sessionId, isConnected: session.isConnected });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.delete('/session', apiLimiter, authMiddleware, asyncHandler(async (req, res) => {
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
  }));

  app.get('/qr', authMiddleware, (req, res) => {
    try {
    const session = getReqSession(req);
    const qrData = session.qr || session.currentQR;
    if (session.isConnected) return res.json({ status: 'connected', qr: null });
    if (qrData) return res.json({ status: 'qr_ready', qr: qrData });
    res.json({ status: 'waiting_for_qr', qr: null });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.get('/passkey/status', authMiddleware, (req, res) => {
    try {
    const session = getReqSession(req);
    res.json({
      passkeyDetected: session.passkeyDetected || false,
      message: session.passkeyDetected
        ? 'WhatsApp Passkey restriction detected. Please remove Passkeys in WhatsApp settings and restart daemon.'
        : 'No passkey issues detected.',
    });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.post('/session/pair', authMiddleware, asyncHandler(async (req, res) => {
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
  }));

  app.get('/status', authMiddleware, (req, res) => {
    try {
    const session = getReqSession(req);
    res.json({
      connected: session.isConnected,
      connecting: session.isConnecting,
      session_id: session.id,
      user: session.sock?.user || null,
      stats: session.stats,
    });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.get('/events', authMiddleware, (req, res) => {
    try {
    const session = getReqSession(req);
    const events = [...session.eventQueue];
    session.eventQueue = [];
    res.json(events);
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.get('/logs', authMiddleware, (req, res) => {
    try {
    const sessionId = sanitizeSessionId(req.query.session_id || 'default');
    const session = getSession(sessionId);
    res.json(session.connectionLogs || []);
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.get('/stats', authMiddleware, (req, res) => {
    try {
    const session = getReqSession(req);
    res.json(session.stats);
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });
}
