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

  const targetNormalizedJid = jid.replace(/:.*@/, '@');
  const targetUser = targetNormalizedJid.split('@')[0];
  const targetDigits = targetUser.replace(/\D/g, '');

  // 0. Implicit Admin: If it's our own JID / account, we are always an admin
  if (session?.sock?.user) {
    const myUser = session.sock.user;
    const myId = myUser.id ? myUser.id.replace(/:.*@/, '@') : '';
    const myLid = myUser.lid ? myUser.lid.replace(/:.*@/, '@') : '';

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
        const cId = contact.id ? contact.id.replace(/:.*@/, '@') : '';
        const cLid = contact.lid ? contact.lid.replace(/:.*@/, '@') : '';

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
