import { anyAuthMiddleware, apiLimiter } from '../../middleware.js';
import { ADMIN_NUMBERS } from '../../config.js';
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
  app.post('/session/start', apiLimiter, anyAuthMiddleware, (req, res) => {
    try {
      const sessionId = sanitizeSessionId(
        req.body?.session_id || req.query?.session_id || 'default'
      );
      signalInterest(sessionId, connectToWhatsApp);
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

  app.delete(
    '/session',
    apiLimiter,
    anyAuthMiddleware,
    asyncHandler(async (req, res) => {
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
    })
  );

  app.get('/qr', apiLimiter, anyAuthMiddleware, (req, res) => {
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

  app.get('/passkey/status', apiLimiter, anyAuthMiddleware, (req, res) => {
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

  app.post(
    '/session/pair',
    apiLimiter,
    anyAuthMiddleware,
    asyncHandler(async (req, res) => {
      const session = getReqSession(req);
      const phoneNumber = req.body?.phone_number;
      if (!phoneNumber) return res.status(400).json({ error: 'phone_number required' });
      if (session.isConnected) {
        return res.json({
          status: 'already_connected',
          connected: true,
          my_number: session.stats?.my_number || session.sock?.user?.id?.split(':')[0] || null,
        });
      }
      if (!session.sock) return res.status(500).json({ error: 'Socket not initialized' });

      try {
        const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
        if (!cleanPhone || cleanPhone.length < 6) {
          return res.status(400).json({ error: 'Invalid phone number format' });
        }
        const code = await session.sock.requestPairingCode(cleanPhone);
        res.json({ status: 'pairing_code_generated', code });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    })
  );

  app.get('/status', apiLimiter, anyAuthMiddleware, (req, res) => {
    try {
      const session = getReqSession(req);
      res.json({
        connected: session.isConnected,
        connecting: session.isConnecting,
        session_id: session.id,
        user: session.sock?.user || null,
        stats: session.stats,
        admin_numbers: ADMIN_NUMBERS || [],
      });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.get('/events', apiLimiter, anyAuthMiddleware, (req, res) => {
    try {
      const session = getReqSession(req);
      const events = [...session.eventQueue];
      session.eventQueue = [];
      res.json(events);
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.get('/logs', apiLimiter, anyAuthMiddleware, (req, res) => {
    try {
      const sessionId = sanitizeSessionId(req.query.session_id || 'default');
      const session = getSession(sessionId);
      res.json(session.connectionLogs || []);
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.get('/stats', apiLimiter, anyAuthMiddleware, (req, res) => {
    try {
      const session = getReqSession(req);
      const isConnected = Boolean(session.isConnected);
      res.json({
        ...session.stats,
        connected: isConnected,
        isConnected,
        isConnecting: Boolean(session.isConnecting),
        my_number: session.stats?.my_number || session.sock?.user?.id?.split(':')[0] || null,
      });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });
}
