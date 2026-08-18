import path from 'path';
import { MASK_SENSITIVE_DATA, ADMIN_NUMBERS, refreshAdminNumbers } from '../config.js';
import { logger } from '../logger.js';

/**
 * Ensures strings are well-formed UTF-8 without lone surrogates.
 */
export function sanitizeUnicode(str) {
  if (!str) return str;
  if (typeof str !== 'string') str = String(str);
  if (typeof str.toWellFormed === 'function') {
    return str.toWellFormed();
  }
  return str.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    '\uFFFD'
  );
}

/**
 * Masks sensitive data if configured and sanitizes invalid Unicode surrogates.
 */
export function maskData(str) {
  if (!str) return str;
  if (typeof str !== 'string') str = String(str);
  str = sanitizeUnicode(str);
  if (!MASK_SENSITIVE_DATA) return str;
  if (str.length <= 4) return '****';
  return str.substring(0, 3) + '****' + str.substring(str.length - 2);
}

/**
 * Normalizes a WhatsApp JID by removing device/agent suffix before '@'
 * (e.g. "123456:0@s.whatsapp.net" -> "123456@s.whatsapp.net").
 * Avoids regular expressions to prevent ReDoS (CWE-1333 / js/polynomial-redos).
 */
export function normalizeJid(jid) {
  if (!jid) return '';
  const str = String(jid).trim();
  const atIndex = str.indexOf('@');
  if (atIndex === -1) return str;
  const colonIndex = str.indexOf(':');
  if (colonIndex !== -1 && colonIndex < atIndex) {
    return str.slice(0, colonIndex) + str.slice(atIndex);
  }
  return str;
}

/**
 * Checks if a JID belongs to an administrator.
 */
export function isAdmin(jid, session = null) {
  if (!jid) return false;

  const targetNormalizedJid = normalizeJid(jid);
  const targetUser = targetNormalizedJid.split('@')[0];
  const targetDigits = targetUser.replace(/\D/g, '');

  // 0. Implicit Admin: If it's our own JID / account, we are always an admin
  if (session?.sock?.user) {
    const myUser = session.sock.user;
    const myId = myUser.id ? normalizeJid(myUser.id) : '';
    const myLid = myUser.lid ? normalizeJid(myUser.lid) : '';

    // Direct match against user.id or user.lid
    if (targetNormalizedJid === myId || (myLid && targetNormalizedJid === myLid)) {
      return true;
    }

    const myIdUser = myId ? myId.split('@')[0] : '';
    const myLidUser = myLid ? myLid.split('@')[0] : '';

    if (myIdUser && targetUser === myIdUser) return true;
    if (myLidUser && targetUser === myLidUser) return true;

    // Check my_number from session stats
    if (session.stats?.my_number) {
      const myNumDigits = session.stats.my_number.replace(/\D/g, '');
      if (myNumDigits && targetDigits) {
        if (
          myNumDigits === targetDigits ||
          (myNumDigits.length >= 7 &&
            targetDigits.length >= 7 &&
            (myNumDigits.endsWith(targetDigits) || targetDigits.endsWith(myNumDigits)))
        ) {
          return true;
        }
      }
    }

    // Check contactCache for LID <-> PN mapping for our own account or target
    if (session.contactCache) {
      for (const contact of session.contactCache.values()) {
        const cId = contact.id ? normalizeJid(contact.id) : '';
        const cLid = contact.lid ? normalizeJid(contact.lid) : '';

        const isSelfContact =
          (myId && (cId === myId || cLid === myId)) || (myLid && (cId === myLid || cLid === myLid));

        if (isSelfContact) {
          if (
            targetNormalizedJid === cId ||
            (cLid && targetNormalizedJid === cLid) ||
            targetUser === cId.split('@')[0] ||
            (cLid && targetUser === cLid.split('@')[0])
          ) {
            return true;
          }
        }
      }
    }
  }

  const currentAdmins = ADMIN_NUMBERS;
  if (!currentAdmins || currentAdmins.length === 0) {
    const refreshedAdmins = refreshAdminNumbers();
    if (refreshedAdmins.length > 0) return isAdmin(jid, session);
    return false;
  }

  let cleanSender = targetDigits;
  if (cleanSender.startsWith('00')) cleanSender = cleanSender.substring(2);
  if (cleanSender.startsWith('0')) cleanSender = cleanSender.substring(1);

  const matched = currentAdmins.some((admin) => {
    let cleanAdmin = admin.replace(/\D/g, '');
    if (cleanAdmin.startsWith('00')) cleanAdmin = cleanAdmin.substring(2);
    if (cleanAdmin.startsWith('0')) cleanAdmin = cleanAdmin.substring(1);

    if (cleanSender === cleanAdmin) return true;

    if (cleanSender.length >= 7 && cleanAdmin.length >= 7) {
      if (cleanSender.endsWith(cleanAdmin) || cleanAdmin.endsWith(cleanSender)) {
        return true;
      }
    }
    return false;
  });

  if (!matched) {
    logger.debug(
      { jid: maskData(jid), senderDigits: cleanSender.slice(-4), adminCount: currentAdmins.length },
      'isAdmin check failed'
    );
  }

  return matched;
}

export function generateMessageID() {
  return 'APP-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

/**
 * Checks if two JIDs/User IDs represent the exact same person,
 * resolving LID <-> PN aliases via contactCache and session data.
 */
export function isSameUser(jidA, jidB, session = null) {
  if (!jidA || !jidB) return false;

  const normA = normalizeJid(jidA);
  const normB = normalizeJid(jidB);

  if (normA === normB) return true;

  const userA = normA.split('@')[0];
  const userB = normB.split('@')[0];
  if (userA === userB) return true;

  const digitsA = userA.replace(/\D/g, '');
  const digitsB = userB.replace(/\D/g, '');

  if (digitsA && digitsB && digitsA === digitsB) return true;

  // 1. Check self user matching against session.sock.user & stats
  if (session?.sock?.user) {
    const myUser = session.sock.user;
    const myId = myUser.id ? normalizeJid(myUser.id).split('@')[0] : '';
    const myLid = myUser.lid ? normalizeJid(myUser.lid).split('@')[0] : '';
    const myNum = session.stats?.my_number ? session.stats.my_number.replace(/\D/g, '') : '';

    const selfDigits = [myId, myLid, myNum].map((x) => x.replace(/\D/g, '')).filter(Boolean);

    const matchA = selfDigits.some(
      (d) => d && (d === digitsA || (d.length >= 7 && digitsA.endsWith(d)))
    );
    const matchB = selfDigits.some(
      (d) => d && (d === digitsB || (d.length >= 7 && digitsB.endsWith(d)))
    );

    if (matchA && matchB) return true;
  }

  // 2. Check contactCache for LID <-> PN association
  if (session?.contactCache) {
    for (const contact of session.contactCache.values()) {
      const cIdDigits = contact.id ? normalizeJid(contact.id).split('@')[0].replace(/\D/g, '') : '';
      const cLidDigits = contact.lid
        ? normalizeJid(contact.lid).split('@')[0].replace(/\D/g, '')
        : '';
      const cNumDigits = contact.phoneNumber ? contact.phoneNumber.replace(/\D/g, '') : '';

      const known = [cIdDigits, cLidDigits, cNumDigits].filter(Boolean);

      const hasA = known.includes(digitsA);
      const hasB = known.includes(digitsB);

      if (hasA && hasB) return true;
    }
  }

  return false;
}

/**
 * Resolves a raw User ID or LID into the canonical phone number (PN) string,
 * avoiding LID duplication (e.g. mapping 123456789012345 -> 491761234567).
 */
export function resolveCanonicalUserKey(rawUserId, session = null) {
  if (!rawUserId) return '';
  const rawStr = normalizeJid(rawUserId);
  const rawUser = rawStr.split('@')[0];
  const digits = rawUser.replace(/\D/g, '');

  if (!digits) return rawUser;

  // If it is already a regular phone number (not starting with LID prefix 1576 or 15-digit LID), return as is
  const isLid = rawStr.includes('@lid') || (digits.length >= 14 && digits.startsWith('1576'));
  if (!isLid) return digits;

  // Check if this LID matches our own bot account first
  if (session?.sock?.user) {
    const myUser = session.sock.user;
    const myIdDigits = myUser.id ? myUser.id.split('@')[0].replace(/\D/g, '') : '';
    const myLidDigits = myUser.lid ? myUser.lid.split('@')[0].replace(/\D/g, '') : '';
    const myNumDigits = session.stats?.my_number ? session.stats.my_number.replace(/\D/g, '') : '';

    const selfPN = myNumDigits || (myIdDigits && !myIdDigits.startsWith('1576') ? myIdDigits : '');
    if (selfPN) {
      if (digits === myIdDigits || digits === myLidDigits || digits === myNumDigits) {
        return selfPN;
      }
    }
  }

  // Check contactCache for LID <-> PN mapping
  if (session?.contactCache) {
    // Direct JID / LID lookup
    let cached =
      session.contactCache.get(rawStr) || session.contactCache.get(`${digits}@s.whatsapp.net`);

    if (!cached) {
      // Fuzzy search across contactCache values
      for (const contact of session.contactCache.values()) {
        const cId = contact.id ? contact.id.split('@')[0].replace(/\D/g, '') : '';
        const cLid = contact.lid ? contact.lid.split('@')[0].replace(/\D/g, '') : '';
        if (digits === cId || digits === cLid) {
          cached = contact;
          break;
        }
      }
    }

    if (cached) {
      // Prefer PN over LID
      const pnJid =
        cached.id && !cached.id.includes('@lid') ? cached.id.split('@')[0].replace(/\D/g, '') : '';
      const pnField = cached.phoneNumber ? cached.phoneNumber.replace(/\D/g, '') : '';
      const canonical = pnJid || pnField;
      if (canonical && !canonical.startsWith('1576')) {
        return canonical;
      }
    }
  }

  return digits;
}

/**
 * Resolves a User ID into a clean display label following configurable priority and fallback settings.
 * @param {string} rawUserId
 * @param {object} session
 * @param {object|string} options Config object { name_priority, name_fallback } or priority mode string
 */
export function resolveUserDisplayName(rawUserId, session = null, options = {}) {
  if (!rawUserId) return '@User';
  const opts = typeof options === 'string' ? { name_priority: options } : options || {};
  const priorityMode = opts.name_priority || 'name_push_phone'; // 'name_push_phone' | 'push_name_phone' | 'phone_only'
  const fallbackMode = opts.name_fallback || 'phone'; // 'phone' | 'user'

  const canonicalKey = resolveCanonicalUserKey(rawUserId, session);

  let cached = null;
  if (session?.contactCache) {
    cached =
      session.contactCache.get(`${canonicalKey}@s.whatsapp.net`) ||
      session.contactCache.get(String(rawUserId));
    if (!cached) {
      for (const contact of session.contactCache.values()) {
        const cIdDigits = contact.id ? contact.id.split('@')[0].replace(/\D/g, '') : '';
        const cLidDigits = contact.lid ? contact.lid.split('@')[0].replace(/\D/g, '') : '';
        if (canonicalKey === cIdDigits || canonicalKey === cLidDigits) {
          cached = contact;
          break;
        }
      }
    }
  }

  const contactName = cached?.name || cached?.verifiedName || '';
  const pushname = cached?.notify || '';
  const isLid = String(rawUserId).includes('@lid') || (canonicalKey || '').startsWith('1576');
  const phoneNumber =
    canonicalKey && !isLid && /^\d+$/.test(canonicalKey) ? `+${canonicalKey}` : '';

  if (priorityMode === 'phone_only') {
    if (phoneNumber) return phoneNumber;
  } else if (priorityMode === 'push_name_phone') {
    if (pushname) return pushname;
    if (contactName) return contactName;
  } else {
    // Default: 'name_push_phone'
    if (contactName) return contactName;
    if (pushname) return pushname;
  }

  // Fallback step
  if (phoneNumber) return phoneNumber;
  if (fallbackMode === 'user') return '@User';
  return isLid ? '@User' : canonicalKey || String(rawUserId);
}

const BLOCKED_SSRF_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  '100.100.100.200',
  '169.254.170.2',
  'instance-data',
]);

/**
 * Validates and normalizes an external HTTP/HTTPS URL to prevent Server-Side Request Forgery (SSRF, CWE-918).
 * Ensures safe protocol, rejects credentials, blocks cloud metadata endpoints, and canonicalizes destination URLs.
 */
export function validateSafeHttpUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  // 1. Strict protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  // 2. Reject credentials in URL
  if (parsed.username || parsed.password) {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || BLOCKED_SSRF_HOSTS.has(hostname)) {
    return null;
  }

  // 3. Reject cloud link-local, metadata IP ranges, and local loopback/private bypasses
  if (
    hostname.startsWith('169.254.') ||
    hostname.startsWith('fe80:') ||
    hostname.startsWith('::ffff:169.254.') ||
    hostname === '::1' ||
    hostname === 'localhost' ||
    hostname === '0.0.0.0'
  ) {
    return null;
  }

  // 4. Clean base path
  let basePath = parsed.pathname || '';
  while (basePath.endsWith('/')) {
    basePath = basePath.slice(0, -1);
  }
  basePath = path.posix.normalize(basePath);
  if (basePath === '.') basePath = '';

  const protocol = parsed.protocol;
  const port = parsed.port ? `:${parsed.port}` : '';
  const cleanOrigin = `${protocol}//${hostname}${port}`;

  return {
    origin: cleanOrigin,
    basePath,
    cleanUrl: `${cleanOrigin}${basePath}`,
    healthUrl: `${cleanOrigin}${basePath}/api/v1/health`,
    configUrl: `${cleanOrigin}${basePath}/api/v1/ai/stt/config`,
  };
}
