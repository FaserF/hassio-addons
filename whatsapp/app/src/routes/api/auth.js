import express from 'express';
import {
  requestOtpCode,
  verifyOtpCode,
  destroySessionToken,
  getSessionTokenFromReq,
  loadRbacConfig,
  saveRbacConfig,
} from '../../rbac.js';
import { getSession } from '../../session.js';
import { logger } from '../../logger.js';
import { authLimiter } from '../../middleware.js';

const router = express.Router();

// Request 6-digit OTP via WhatsApp
router.post('/request-otp', authLimiter, async (req, res) => {
  const { phone } = req.body || {};
  const result = requestOtpCode(phone);

  if (!result.success) {
    return res.status(400).json(result);
  }

  // Attempt to send WhatsApp message via default active session
  const defaultSession = getSession('default');
  if (!defaultSession || !defaultSession.isConnected || !defaultSession.sock) {
    logger.warn(
      { phone: result.phone },
      '⚠️ Failed to send OTP code: WhatsApp Gateway session is disconnected.'
    );
    return res.status(503).json({
      success: false,
      error: 'session_disconnected',
      message:
        'WhatsApp Gateway ist aktuell nicht verbunden. Bitte den Administrator kontaktieren.',
    });
  }

  const recipientJid = `${result.phone}@s.whatsapp.net`;
  try {
    await defaultSession.sock.sendMessage(recipientJid, { text: result.messageText });
    logger.info({ phone: result.phone }, '📲 Sent WhatsApp OTP login code to recipient');
    return res.json({
      success: true,
      message: 'Code wurde erfolgreich per WhatsApp gesendet.',
    });
  } catch (err) {
    logger.error(
      { phone: result.phone, error: err.message },
      'Failed to send WhatsApp OTP message'
    );
    return res.status(500).json({
      success: false,
      error: 'send_failed',
      message: 'Fehler beim Senden des Codes über WhatsApp.',
    });
  }
});

// Verify 6-digit OTP
router.post('/verify-otp', authLimiter, (req, res) => {
  const { phone, code } = req.body || {};
  const result = verifyOtpCode(phone, code);

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// Logout
router.post('/logout', (req, res) => {
  const token = getSessionTokenFromReq(req);
  if (token) {
    destroySessionToken(token);
  }
  return res.json({ success: true, message: 'Erfolgreich abgemeldet.' });
});

// Get Current User / Role Info
router.get('/me', (req, res) => {
  return res.json({
    user: req.userRole || { role: 'unauthenticated' },
  });
});

// Manage RBAC Config (Super Admin Only)
router.get('/rbac/config', (req, res) => {
  if (!req.userRole?.isSuperAdmin) {
    return res
      .status(403)
      .json({ error: 'Forbidden', message: 'Super Admin Rechte erforderlich.' });
  }
  return res.json(loadRbacConfig());
});

router.post('/rbac/config', (req, res) => {
  if (!req.userRole?.isSuperAdmin) {
    return res
      .status(403)
      .json({ error: 'Forbidden', message: 'Super Admin Rechte erforderlich.' });
  }
  const updated = saveRbacConfig(req.body);
  return res.json({ success: true, config: updated });
});

export default router;
