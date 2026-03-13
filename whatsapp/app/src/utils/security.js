import { MASK_SENSITIVE_DATA, ADMIN_NUMBERS, refreshAdminNumbers } from '../config.js';
import { logger } from '../logger.js';

/**
 * Masks sensitive data if configured.
 */
export function maskData(str) {
  if (!MASK_SENSITIVE_DATA || !str) return str;
  if (typeof str !== 'string') str = String(str);
  if (str.length <= 4) return '****';
  return str.substring(0, 3) + '****' + str.substring(str.length - 2);
}

/**
 * Checks if a JID belongs to an administrator.
 */
export function isAdmin(jid, session = null) {
  if (!jid) return false;

  // 0. Implicit Admin: If it's our own JID, we are always an admin
  if (session?.sock?.user?.id) {
    const myJid = session.sock.user.id.replace(/:.*@/, '@');
    if (jid.replace(/:.*@/, '@') === myJid) return true;
  }

  const currentAdmins = ADMIN_NUMBERS;
  if (!currentAdmins || currentAdmins.length === 0) {
    // One-time retry if list is empty (might be late config population)
    const refreshedAdmins = refreshAdminNumbers();
    if (refreshedAdmins.length > 0) return isAdmin(jid, session);
    return false;
  }

  // 1. Extract pure sender number from JID
  const numberPart = jid.split('@')[0];
  const pureSender = numberPart.split(':')[0].replace(/\D/g, ''); // e.g. 491761234567

  // Normalize sender (strip leading zeros)
  let cleanSender = pureSender;
  if (cleanSender.startsWith('00')) cleanSender = cleanSender.substring(2);
  if (cleanSender.startsWith('0')) cleanSender = cleanSender.substring(1);

  const matched = currentAdmins.some((admin) => {
    let cleanAdmin = admin.replace(/\D/g, '');
    if (cleanAdmin.startsWith('00')) cleanAdmin = cleanAdmin.substring(2);
    if (cleanAdmin.startsWith('0')) cleanAdmin = cleanAdmin.substring(1);

    // Exact match of normalized parts
    if (cleanSender === cleanAdmin) return true;

    // Suffix match (handles one being local "176..." and other international "49176...")
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
