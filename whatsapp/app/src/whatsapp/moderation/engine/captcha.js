import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../store.js';
import { reply } from '../../actions.js';
import { logger } from '../../../logger.js';
import {
  resolveCanonicalUserKey,
  resolveUserDisplayName,
  normalizeJid,
  isSameUser,
} from '../../../utils/security.js';
import { gt } from './translations.js';

export const pendingCaptchas = new Map(); // key: groupId:userId -> { answer, mode, timeoutHandle, timestamp, delivered, participantJid, attempts, expiresAt }
export const recentKickReasons = new Map(); // key: groupId:userId -> { reason, expires }

/**
 * Saves a pending captcha entry to the persistent moderation store so it survives addon/server restarts.
 */
export function savePendingCaptcha(groupId, userId, data) {
  try {
    const store = loadModerationStore();
    if (!store.pending_captchas) store.pending_captchas = {};
    const key = getWindowKey(groupId, userId);
    store.pending_captchas[key] = {
      groupId,
      userId,
      participantJid: data.participantJid,
      answer: data.answer,
      mode: data.mode,
      timestamp: data.timestamp || Date.now(),
      timeoutSec: data.timeoutSec || 120,
      expiresAt: data.expiresAt || Date.now() + (data.timeoutSec || 120) * 1000,
      attempts: data.attempts || 0,
      delivered: Boolean(data.delivered),
    };
    saveModerationStore(store);
  } catch (err) {
    logger.warn({ error: err.message, groupId, userId }, 'Failed to persist pending captcha to store');
  }
}

/**
 * Removes a pending captcha from the persistent moderation store.
 */
export function removePendingCaptchaFromStore(groupId, userId) {
  try {
    const store = loadModerationStore();
    if (!store.pending_captchas) return;
    const key = getWindowKey(groupId, userId);
    const cleanDigits = userId ? userId.replace(/\D/g, '') : '';
    let deleted = false;
    if (store.pending_captchas[key]) {
      delete store.pending_captchas[key];
      deleted = true;
    }
    if (cleanDigits) {
      const key2 = getWindowKey(groupId, cleanDigits);
      if (store.pending_captchas[key2]) {
        delete store.pending_captchas[key2];
        deleted = true;
      }
    }
    if (deleted) {
      saveModerationStore(store);
    }
  } catch (err) {
    logger.warn({ error: err.message, groupId, userId }, 'Failed to remove pending captcha from store');
  }
}

/**
 * Restores pending captchas from disk upon server restart / reconnect and reschedules their expiration timers.
 */
export function restorePendingCaptchas(session) {
  try {
    const store = loadModerationStore();
    const saved = store.pending_captchas || {};
    const now = Date.now();
    let restoredCount = 0;
    let expiredCount = 0;

    for (const [key, obj] of Object.entries(saved)) {
      if (!obj || !obj.groupId || !obj.userId) continue;

      // If user is already verified, clean up and skip
      if (isUserVerified(obj.groupId, obj.userId, session)) {
        delete saved[key];
        continue;
      }

      const expiresAt = obj.expiresAt || obj.timestamp + (obj.timeoutSec || 120) * 1000;
      const remainingMs = expiresAt - now;

      if (remainingMs <= 0) {
        // Captcha expired during downtime
        delete saved[key];
        expiredCount++;
        continue;
      }

      const timeoutHandle = setTimeout(async () => {
        const pendingCheck = findPendingCaptcha(obj.groupId, obj.userId, session);
        if (!pendingCheck || isUserVerified(obj.groupId, obj.userId, session)) {
          clearPendingCaptcha(obj.groupId, obj.userId, session);
          return;
        }

        clearPendingCaptcha(obj.groupId, obj.userId, session);
        const groupConfig = getGroupModerationConfig(obj.groupId);
        const action = groupConfig?.greetings?.captcha_timeout_action || 'kick';
        const targetJid = obj.participantJid || `${obj.userId.replace(/\D/g, '')}@s.whatsapp.net`;

        if (action === 'kick' || action === 'remove') {
          try {
            await session?.sock?.groupParticipantsUpdate(obj.groupId, [targetJid], 'remove');
          } catch (_e) {
            /* ignore */
          }
        }
      }, remainingMs);
      if (timeoutHandle.unref) timeoutHandle.unref();

      pendingCaptchas.set(key, {
        answer: obj.answer,
        mode: obj.mode,
        timestamp: obj.timestamp,
        timeoutHandle,
        delivered: obj.delivered,
        participantJid: obj.participantJid,
        attempts: obj.attempts || 0,
        expiresAt,
      });
      restoredCount++;
    }

    if (expiredCount > 0) {
      saveModerationStore(store);
    }

    if (restoredCount > 0) {
      logger.info({ restoredCount }, '🛡️ Restored active pending captchas across server restart');
    }
  } catch (err) {
    logger.warn({ error: err.message }, 'Failed to restore pending captchas from disk');
  }
}

/**
 * Periodically purges expired pending captchas and kick reasons to prevent memory leaks.
 */
export function cleanupExpiredCaptchas() {
  const now = Date.now();
  for (const [key, obj] of pendingCaptchas.entries()) {
    // If pending captcha is older than 15 minutes without timer, purge it
    if (obj?.timestamp && now - obj.timestamp > 15 * 60 * 1000) {
      if (obj.timeoutHandle) clearTimeout(obj.timeoutHandle);
      pendingCaptchas.delete(key);
      const colonIdx = key.indexOf(':');
      if (colonIdx !== -1) {
        removePendingCaptchaFromStore(key.slice(0, colonIdx), key.slice(colonIdx + 1));
      }
    }
  }
  for (const [key, kick] of recentKickReasons.entries()) {
    if (kick?.expires && now > kick.expires) {
      recentKickReasons.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredCaptchas, 5 * 60 * 1000).unref?.();

export function getWindowKey(groupId, userId) {
  return `${groupId}:${userId}`;
}

/**
 * Normalizes input string for Captcha comparisons by removing surrounding WhatsApp formatting
 * (*, _, ~, `, ', ", whitespace, emojis/symbols like 👉, etc.) and trailing punctuation.
 */
export function cleanCaptchaInput(text) {
  if (!text) return '';
  let str = String(text).trim();
  str = str.replace(/^[*_~`'"\s:👉]+|[*_~`'"\s:!.]+$|/gu, '');
  const alphanumericOnly = str.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
  if (alphanumericOnly) {
    return alphanumericOnly.toLowerCase();
  }
  return str.toLowerCase();
}

/**
 * Finds a pending captcha entry matching the given groupId and user identifiers (PN, LID, canonical key, alt JIDs).
 */
export function findPendingCaptcha(groupId, userId, session = null, rawMsg = null) {
  if (!groupId || !userId) return null;

  // 1. Direct lookup
  const key1 = getWindowKey(groupId, userId);
  if (pendingCaptchas.has(key1)) {
    return { key: key1, captchaObj: pendingCaptchas.get(key1) };
  }

  // 2. Lookup by clean digits
  const cleanDigits = userId.replace(/\D/g, '');
  if (cleanDigits && cleanDigits !== userId) {
    const key2 = getWindowKey(groupId, cleanDigits);
    if (pendingCaptchas.has(key2)) {
      return { key: key2, captchaObj: pendingCaptchas.get(key2) };
    }
  }

  // 3. Lookup by canonical user key (LID <-> PN mapping)
  const canonicalKey = resolveCanonicalUserKey(userId, session);
  if (canonicalKey && canonicalKey !== userId && canonicalKey !== cleanDigits) {
    const key3 = getWindowKey(groupId, canonicalKey);
    if (pendingCaptchas.has(key3)) {
      return { key: key3, captchaObj: pendingCaptchas.get(key3) };
    }
  }

  // 4. Lookup using participant / participantAlt from raw message
  const rawParticipant = rawMsg?.key?.participant || rawMsg?.participant;
  if (rawParticipant) {
    const pUser = rawParticipant.split('@')[0];
    const pKey = getWindowKey(groupId, pUser);
    if (pendingCaptchas.has(pKey)) {
      return { key: pKey, captchaObj: pendingCaptchas.get(pKey) };
    }
  }
  const participantAlt = rawMsg?.key?.participantAlt;
  if (participantAlt) {
    const altUser = participantAlt.split('@')[0];
    const altKey = getWindowKey(groupId, altUser);
    if (pendingCaptchas.has(altKey)) {
      return { key: altKey, captchaObj: pendingCaptchas.get(altKey) };
    }
  }

  // 5. Fallback scan entries for this groupId
  const prefix = `${groupId}:`;
  for (const [key, captchaObj] of pendingCaptchas.entries()) {
    if (key.startsWith(prefix)) {
      const storedUserId = key.slice(prefix.length);
      const storedClean = storedUserId.replace(/\D/g, '');
      if (
        storedUserId === userId ||
        (cleanDigits && storedClean === cleanDigits) ||
        (canonicalKey && resolveCanonicalUserKey(storedUserId, session) === canonicalKey)
      ) {
        return { key, captchaObj };
      }
    }
  }

  return null;
}

/**
 * Clears and removes a pending captcha and its timeout timer for a given user in a group.
 */
export function clearPendingCaptcha(groupId, userId, session = null) {
  if (!groupId || !userId) return;
  const entry = findPendingCaptcha(groupId, userId, session);
  if (entry && entry.captchaObj) {
    if (entry.captchaObj.timeoutHandle) {
      clearTimeout(entry.captchaObj.timeoutHandle);
    }
    for (const [k, obj] of pendingCaptchas.entries()) {
      if (obj === entry.captchaObj) {
        pendingCaptchas.delete(k);
      }
    }
  }
  removePendingCaptchaFromStore(groupId, userId);
}

export function isUserVerified(groupId, userId, session = null, _rawMsg = null) {
  if (!groupId || !userId) return false;
  const config = getGroupModerationConfig(groupId);
  const verifiedUsers = config.verified_users || {};

  // 1. Direct key/ID or digits lookup
  const checkId = (id) => {
    if (!id) return false;
    if (verifiedUsers[id]?.verified === true) return true;
    const digits = String(id).replace(/\D/g, '');
    if (digits && verifiedUsers[digits]?.verified === true) return true;
    return false;
  };

  if (checkId(userId)) return true;

  // 2. Canonical user key lookup (LID <-> PN mapping)
  const canonicalKey = resolveCanonicalUserKey(userId, session);
  if (canonicalKey && checkId(canonicalKey)) return true;

  // 3. Universal user matching using isSameUser against every verified record
  for (const [vKey, vVal] of Object.entries(verifiedUsers)) {
    if (vVal?.verified === true) {
      if (isSameUser(vKey, userId, session)) return true;
    }
  }

  return false;
}

export function setUserCaptchaVerification(groupId, userId, verified, session = null) {
  const store = loadModerationStore();
  const config = getGroupModerationConfig(groupId);
  config.verified_users = config.verified_users || {};

  const cleanId = (userId || '').replace(/\D/g, '');
  const canonicalKey = resolveCanonicalUserKey(userId, session);

  const record = {
    verified: Boolean(verified),
    timestamp: Date.now(),
    mode: 'manual',
  };

  config.verified_users[userId] = record;
  if (cleanId) config.verified_users[cleanId] = record;
  if (canonicalKey) config.verified_users[canonicalKey] = record;

  if (verified) {
    const entry = findPendingCaptcha(groupId, userId, session);
    if (entry) {
      clearTimeout(entry.captchaObj.timeoutHandle);
      pendingCaptchas.delete(entry.key);
    }
  }

  store.groups[groupId] = config;
  saveModerationStore(store);
  return record;
}

export async function getGroupCaptchaUsers(groupId, session = null) {
  const config = getGroupModerationConfig(groupId);
  const verifiedMap = config.verified_users || {};

  let participants = [];
  if (session?.sock?.groupMetadata) {
    try {
      const meta = await session.sock.groupMetadata(groupId);
      participants = meta?.participants || [];
    } catch (e) {
      logger.debug(
        { error: e.message, groupId },
        'Failed to fetch group metadata for captcha users'
      );
    }
  }

  const result = [];
  const processedUserIds = new Set();

  for (const p of participants) {
    const pJid = p.id ? normalizeJid(p.id) : '';
    const pUser = pJid.split('@')[0];
    const cleanDigits = pUser.replace(/\D/g, '');
    const canonicalKey = resolveCanonicalUserKey(pJid, session);

    processedUserIds.add(pUser);
    if (cleanDigits) processedUserIds.add(cleanDigits);
    if (canonicalKey) processedUserIds.add(canonicalKey);

    const isCaptchaEnabled = Boolean(config.greetings?.captcha_enabled);
    const verRecord =
      verifiedMap[pUser] ||
      (cleanDigits ? verifiedMap[cleanDigits] : null) ||
      (canonicalKey ? verifiedMap[canonicalKey] : null);

    const pendingResult = findPendingCaptcha(groupId, pUser, session);
    const pendingObj = pendingResult?.captchaObj || null;

    const isVerified = verRecord
      ? Boolean(verRecord.verified)
      : isCaptchaEnabled
        ? false
        : !pendingObj;

    result.push({
      userId: pUser,
      jid: pJid,
      name: resolveUserDisplayName(pUser, session) || pUser,
      verified: isVerified,
      pending: Boolean(pendingObj),
      timestamp: verRecord?.timestamp || pendingObj?.timestamp || null,
      mode: verRecord?.mode || (pendingObj ? 'pending' : 'auto'),
      isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
    });
  }

  for (const [uId, verRecord] of Object.entries(verifiedMap)) {
    if (!processedUserIds.has(uId)) {
      processedUserIds.add(uId);
      result.push({
        userId: uId,
        jid: uId.includes('@') ? uId : `${uId}@s.whatsapp.net`,
        name: resolveUserDisplayName(uId, session) || uId,
        verified: Boolean(verRecord?.verified),
        pending: false,
        timestamp: verRecord?.timestamp || null,
        mode: verRecord?.mode || 'manual',
        isAdmin: false,
      });
    }
  }

  return result;
}

/**
 * Handles incoming private (DM) messages to check if the sender is trying to resolve a pending Captcha
 * for any group where private captcha verification is enabled.
 */
export async function handlePrivateCaptchaMessage(session, event) {
  const userId = event.sender_number;
  const text = (event.content || '').trim();
  if (!userId || !text) return false;

  // Scan all pending captchas for an entry matching this user (by PN, LID, canonical key)
  let foundMatch = null;
  let targetGroupId = null;
  let targetKey = null;

  for (const [key, captchaObj] of pendingCaptchas.entries()) {
    const colonIdx = key.indexOf(':');
    if (colonIdx === -1) continue;
    const gId = key.slice(0, colonIdx);
    const storedUserId = key.slice(colonIdx + 1);

    const matchUser =
      storedUserId === userId ||
      storedUserId.replace(/\D/g, '') === userId.replace(/\D/g, '') ||
      resolveCanonicalUserKey(storedUserId, session) === resolveCanonicalUserKey(userId, session);

    if (matchUser) {
      foundMatch = captchaObj;
      targetGroupId = gId;
      targetKey = key;
      break;
    }
  }

  if (!foundMatch || !targetGroupId) return false;

  const cleanAnswer = String(foundMatch.answer || '')
    .trim()
    .toLowerCase();
  const rawInput = text.trim().toLowerCase();
  const cleanInput = cleanCaptchaInput(text);
  const words = text.split(/\s+/).map((w) => cleanCaptchaInput(w));
  const noFormatText = text.toLowerCase().replace(/[*_~`'"\s]/g, '');

  const isMatch =
    rawInput === cleanAnswer ||
    cleanInput === cleanAnswer ||
    words.includes(cleanAnswer) ||
    noFormatText === cleanAnswer;

  if (isMatch) {
    clearTimeout(foundMatch.timeoutHandle);
    pendingCaptchas.delete(targetKey);
    const cleanUserDigits = userId.replace(/\D/g, '');
    if (cleanUserDigits) pendingCaptchas.delete(`${targetGroupId}:${cleanUserDigits}`);
    const userCanonical = resolveCanonicalUserKey(userId, session);
    if (userCanonical) pendingCaptchas.delete(`${targetGroupId}:${userCanonical}`);
    const participantUser = userId.split('@')[0];
    if (participantUser) pendingCaptchas.delete(`${targetGroupId}:${participantUser}`);
    if (foundMatch.captchaObj?.participantJid) {
      pendingCaptchas.delete(`${targetGroupId}:${foundMatch.captchaObj.participantJid}`);
      const partUser = foundMatch.captchaObj.participantJid.split('@')[0];
      if (partUser) pendingCaptchas.delete(`${targetGroupId}:${partUser}`);
    }

    const store = loadModerationStore();
    const config = getGroupModerationConfig(targetGroupId);
    const verRecord = { verified: true, timestamp: Date.now(), mode: 'auto' };

    config.verified_users = config.verified_users || {};
    config.verified_users[userId] = verRecord;
    const storedUserVal = targetKey.slice(targetKey.indexOf(':') + 1);
    if (storedUserVal) config.verified_users[storedUserVal] = verRecord;
    const cleanId = userId.replace(/\D/g, '');
    if (cleanId) config.verified_users[cleanId] = verRecord;
    const canonical = resolveCanonicalUserKey(userId, session);
    if (canonical) config.verified_users[canonical] = verRecord;
    if (foundMatch.participantJid) {
      const pUser = foundMatch.participantJid.split('@')[0];
      if (pUser) config.verified_users[pUser] = verRecord;
    }

    store.groups[targetGroupId] = config;
    saveModerationStore(store);

    let groupSubject = targetGroupId.split('@')[0];
    if (session?.sock?.groupMetadata) {
      try {
        const meta = await session.sock.groupMetadata(targetGroupId);
        if (meta?.subject) groupSubject = meta.subject;
      } catch (_e) {
        /* ignore */
      }
    }

    const confirmText = `✅ *Captcha Verified!*\n\nYou have been successfully verified for *${groupSubject}*. You can now post messages in the group.`;
    const dmJid = `${userId.replace(/\D/g, '')}@s.whatsapp.net`;
    try {
      await session.sock.sendMessage(dmJid, { text: confirmText });
    } catch (_e) {
      /* ignore */
    }

    // Also send brief notification into group
    try {
      const userLabel = resolveUserDisplayName(userId, session, config.greetings);
      await reply(session, targetGroupId, {
        text: gt(config, 'bot_replies.captcha_verified_via_dm', { user: userLabel }),
        mentions: [`${userId.replace(/\D/g, '')}@s.whatsapp.net`],
      });
    } catch (_e) {
      /* ignore */
    }

    return true;
  }

  return false;
}
