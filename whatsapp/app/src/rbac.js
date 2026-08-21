import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from './logger.js';
import { DATA_DIR, UI_AUTH_PASSWORD, UI_AUTH_ENABLED } from './config.js';
import { t } from './locales/loader.js';

const RBAC_FILE = path.join(DATA_DIR, 'rbac.json');

// Memory store for OTP requests
// phone -> { code, expiresAt, lastSentAt, attempts }
const otpStore = new Map();

// Memory store for session tokens
// token -> { phone, role, superAdmin, createdAt, lastSeen }
const sessionStore = new Map();

export const DEFAULT_RBAC_CONFIG = {
  superadmin_numbers: [], // List of phone numbers mapped to Super Admin e.g. ["491761234567"]
  blocked_numbers: [], // Numbers that issued /stoplogin or !stoplogin
};

export function loadRbacConfig() {
  try {
    if (fs.existsSync(RBAC_FILE)) {
      const data = JSON.parse(fs.readFileSync(RBAC_FILE, 'utf8'));
      return {
        superadmin_numbers: Array.isArray(data.superadmin_numbers) ? data.superadmin_numbers : [],
        blocked_numbers: Array.isArray(data.blocked_numbers) ? data.blocked_numbers : [],
      };
    }
  } catch (err) {
    logger.error({ error: err.message }, 'Failed to load rbac.json');
  }
  return { ...DEFAULT_RBAC_CONFIG };
}

export function saveRbacConfig(config) {
  try {
    const cleanConfig = {
      superadmin_numbers: Array.isArray(config.superadmin_numbers)
        ? [...new Set(config.superadmin_numbers.map((n) => String(n).replace(/\D/g, '')))].filter(
            Boolean
          )
        : [],
      blocked_numbers: Array.isArray(config.blocked_numbers)
        ? [...new Set(config.blocked_numbers.map((n) => String(n).replace(/\D/g, '')))].filter(
            Boolean
          )
        : [],
    };
    fs.writeFileSync(RBAC_FILE, JSON.stringify(cleanConfig, null, 2), 'utf8');
    return cleanConfig;
  } catch (err) {
    logger.error({ error: err.message }, 'Failed to save rbac.json');
    return loadRbacConfig();
  }
}

export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let str = String(phone).split('@')[0].replace(/\D/g, '');
  return str;
}

export function isPrivateIP(ip) {
  if (!ip) return false;
  let cleanIp = ip;
  if (cleanIp.startsWith('::ffff:')) cleanIp = cleanIp.substr(7);
  return (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    /^(10)\.|^(172\.(1[6-9]|2[0-9]|3[0-1]))\.|^(192\.168)\.|^fc[0-9a-f]{2}:|^fe80:/.test(cleanIp)
  );
}

/**
  Evaluates user role based on request headers, IP address, auth config, and session tokens.
 */
export function determineUserRole(req) {
  const isIngress = Boolean(req.headers['x-ingress-path']);
  const rawIp = req.ip || req.socket?.remoteAddress || '';
  const isPrivate = isPrivateIP(rawIp);

  // 1. Ingress access -> ALWAYS Super Admin
  if (isIngress) {
    return {
      role: 'superadmin',
      isSuperAdmin: true,
      isIngress: true,
      authMethod: 'ingress',
      phone: null,
    };
  }

  // 2. Local network / IP access
  // Auto Super Admin UNLESS UI_AUTH_PASSWORD is set in Addon Settings
  const hasPasswordConfigured = Boolean(UI_AUTH_ENABLED || UI_AUTH_PASSWORD);
  if (isPrivate && !hasPasswordConfigured) {
    return {
      role: 'superadmin',
      isSuperAdmin: true,
      isIngress: false,
      authMethod: 'local_trusted',
      phone: null,
    };
  }

  // 3. Check for valid active session token (Cookie or Header)
  const sessionToken = getSessionTokenFromReq(req);
  if (sessionToken && sessionStore.has(sessionToken)) {
    const session = sessionStore.get(sessionToken);
    // 24 hour session expiration
    if (Date.now() - session.createdAt < 24 * 60 * 60 * 1000) {
      session.lastSeen = Date.now();
      // Re-verify if phone is still mapped to superadmin in latest rbac config
      const rbacConfig = loadRbacConfig();
      const isMappedSuperAdmin =
        session.phone && rbacConfig.superadmin_numbers.includes(session.phone);

      return {
        role: isMappedSuperAdmin ? 'superadmin' : 'user',
        isSuperAdmin: Boolean(session.isSuperAdmin || isMappedSuperAdmin),
        isIngress: false,
        authMethod: 'wa_2fa',
        phone: session.phone,
        sessionToken,
      };
    } else {
      sessionStore.delete(sessionToken);
    }
  }

  // No authorization
  return {
    role: 'unauthenticated',
    isSuperAdmin: false,
    isIngress: false,
    authMethod: null,
    phone: null,
    isPrivate,
    hasPasswordConfigured,
  };
}

export function getSessionTokenFromReq(req) {
  if (req.headers['x-session-token']) return req.headers['x-session-token'];
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/wa_session=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

export function createSessionToken(phone, isSuperAdmin = false) {
  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    token,
    phone,
    isSuperAdmin,
    createdAt: Date.now(),
    lastSeen: Date.now(),
  };
  sessionStore.set(token, session);
  return token;
}

export function destroySessionToken(token) {
  if (token) sessionStore.delete(token);
}

// --- OTP & Anti-Spam Logic ---

export function requestOtpCode(phone, lang = 'en') {
  const cleanPhone = normalizePhoneNumber(phone);
  if (!cleanPhone || cleanPhone.length < 7) {
    return { success: false, error: 'invalid_phone', message: t(lang, 'rbac.invalid_phone') };
  }

  const rbacConfig = loadRbacConfig();

  // Anti-Spam check: Blocked numbers cannot receive login codes
  if (rbacConfig.blocked_numbers.includes(cleanPhone)) {
    return {
      success: false,
      error: 'blocked',
      message: t(lang, 'rbac.phone_blocked'),
    };
  }

  const now = Date.now();
  const existing = otpStore.get(cleanPhone);

  // Rate-limiting check: Max 1 message every 60 seconds
  if (existing && now - existing.lastSentAt < 60000) {
    const waitSeconds = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000);
    return {
      success: false,
      error: 'rate_limited',
      message: t(lang, 'rbac.rate_limited', { waitSeconds }),
      waitSeconds,
    };
  }

  // Generate 6-digit OTP code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = now + 5 * 60 * 1000; // 5 minutes validity

  otpStore.set(cleanPhone, {
    code,
    expiresAt,
    lastSentAt: now,
    attempts: 0,
  });

  const isSuperAdmin = rbacConfig.superadmin_numbers.includes(cleanPhone);

  return {
    success: true,
    phone: cleanPhone,
    code,
    isSuperAdmin,
    messageText: t(lang, 'rbac.otp_message_text', { code }),
  };
}

export function verifyOtpCode(phone, code, lang = 'en') {
  const cleanPhone = normalizePhoneNumber(phone);
  if (!cleanPhone || !code) {
    return {
      success: false,
      error: 'invalid_input',
      message: t(lang, 'rbac.invalid_input'),
    };
  }

  const entry = otpStore.get(cleanPhone);
  if (!entry) {
    return {
      success: false,
      error: 'no_otp',
      message: t(lang, 'rbac.no_otp'),
    };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(cleanPhone);
    return {
      success: false,
      error: 'expired',
      message: t(lang, 'rbac.otp_expired'),
    };
  }

  entry.attempts += 1;
  if (entry.attempts > 3) {
    otpStore.delete(cleanPhone);
    return {
      success: false,
      error: 'too_many_attempts',
      message: t(lang, 'rbac.too_many_attempts'),
    };
  }

  if (String(code).trim() !== entry.code) {
    return {
      success: false,
      error: 'invalid_code',
      message: t(lang, 'rbac.invalid_code'),
    };
  }

  // Code correct! Consume OTP
  otpStore.delete(cleanPhone);

  const rbacConfig = loadRbacConfig();
  const isSuperAdmin = rbacConfig.superadmin_numbers.includes(cleanPhone);

  const sessionToken = createSessionToken(cleanPhone, isSuperAdmin);

  return {
    success: true,
    sessionToken,
    phone: cleanPhone,
    isSuperAdmin,
  };
}

export function handleOptOutCommand(senderJid) {
  const cleanPhone = normalizePhoneNumber(senderJid);
  if (!cleanPhone) return false;

  const rbacConfig = loadRbacConfig();
  if (!rbacConfig.blocked_numbers.includes(cleanPhone)) {
    rbacConfig.blocked_numbers.push(cleanPhone);
    saveRbacConfig(rbacConfig);
    // Clear active OTP
    otpStore.delete(cleanPhone);
    logger.info(
      { phone: cleanPhone },
      '🚫 Phone number opted out from login notifications via /stoplogin'
    );
    return true;
  }
  return false;
}
