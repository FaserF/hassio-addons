import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../../config.js';
import { logger } from '../../logger.js';
import { loadModerationStore } from '../moderation/store.js';
import { t } from '../../locales/loader.js';

const NOTIFIED_FILE = 'missed_messages_notified.json';
const DOWNTIME_FILE = 'missed_messages_downtime.json';

function getDataPath(filename) {
  const dir = process.env.DATA_DIR || DATA_DIR;
  return path.join(dir, filename);
}

function loadJson(filename) {
  try {
    const p = getDataPath(filename);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (_) {}
  return {};
}

function saveJson(filename, data) {
  try {
    const p = getDataPath(filename);
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    logger.warn({ error: err.message }, '⚠️ Failed to save missed messages file');
  }
}

/**
 * Records the current timestamp as the session disconnect time.
 * Call this when the WhatsApp session disconnects.
 * @param {string} sessionId
 */
export function recordDisconnectTime(sessionId) {
  const data = loadJson(DOWNTIME_FILE);
  data[sessionId] = Date.now();
  saveJson(DOWNTIME_FILE, data);
}

/**
 * Reads and clears the recorded disconnect time for a session.
 * Returns null if no disconnect was recorded.
 * @param {string} sessionId
 * @returns {number|null}
 */
export function consumeDisconnectTime(sessionId) {
  const data = loadJson(DOWNTIME_FILE);
  const ts = data[sessionId] ?? null;
  if (ts !== null) {
    delete data[sessionId];
    saveJson(DOWNTIME_FILE, data);
  }
  return ts;
}

/**
 * Clears per-restart notification tracking so each restart starts fresh.
 */
export function clearNotifiedChats() {
  saveJson(NOTIFIED_FILE, {});
}

/**
 * Checks whether a specific JID has already received a "skipped" notification
 * during the current restart window.
 * @param {string} jid
 * @returns {boolean}
 */
function hasBeenNotified(jid) {
  const data = loadJson(NOTIFIED_FILE);
  return Boolean(data[jid]);
}

/**
 * Marks a JID as notified for the current restart window.
 * @param {string} jid
 */
function markNotified(jid) {
  const data = loadJson(NOTIFIED_FILE);
  data[jid] = Date.now();
  saveJson(NOTIFIED_FILE, data);
}

/**
 * Checks if an incoming message is a "missed" message (arrived while addon was offline)
 * and optionally sends a one-time "skipped" notification if the message is outside
 * the lookback window.
 *
 * Called for each message in messages.upsert during the reconnect window.
 *
 * @param {object} session - WhatsApp session
 * @param {object} msg - Baileys message object
 * @returns {{ shouldProcess: boolean, isMissed: boolean }}
 */
export async function evaluateMissedMessage(session, msg) {
  // Only evaluate during the reconnect window (first 60s after connect)
  const reconnectedAt = session._reconnectedAt;
  if (!reconnectedAt || Date.now() - reconnectedAt > 60000) {
    return { shouldProcess: true, isMissed: false };
  }

  // Skip fromMe and protocol messages — never relevant
  if (msg?.key?.fromMe) return { shouldProcess: true, isMissed: false };
  if (msg?.message?.protocolMessage) return { shouldProcess: true, isMissed: false };
  if (!msg?.messageTimestamp) return { shouldProcess: true, isMissed: false };

  const store = loadModerationStore();
  const cfg = store.missed_messages || {};
  if (cfg.enabled === false) {
    // Feature disabled — don't process, but possibly notify
    const jid = msg.key.remoteJid;
    if (cfg.notify_skipped && jid && !hasBeenNotified(jid)) {
      const lang = store.groups?.[jid]?.language || 'en';
      const notifyText = t(lang, 'missed_messages.notify_skipped_default');
      try {
        await session.sock.sendMessage(jid, { text: notifyText });
        markNotified(jid);
        logger.info({ jid }, '📭 Sent missed-messages disabled notification');
      } catch (e) {
        logger.debug({ error: e.message }, 'Failed to send missed-messages disabled notification');
      }
    }
    return { shouldProcess: false, isMissed: false };
  }

  const lookbackMs = (cfg.lookback_hours ?? 3) * 3600 * 1000;
  const offlineSince = session._offlineSince || reconnectedAt;
  const cutoffTs = offlineSince - lookbackMs;
  const msgTs = Number(msg.messageTimestamp) * 1000;

  // Message arrived while we were online (normal path)
  if (msgTs >= reconnectedAt) {
    return { shouldProcess: true, isMissed: false };
  }

  // Message is within the lookback window — process it as a missed message
  if (msgTs >= cutoffTs) {
    logger.info(
      { msgId: msg.key?.id, msgTs, cutoffTs, offlineSince },
      '🔄 Replaying missed message within lookback window'
    );
    return { shouldProcess: true, isMissed: true };
  }

  // Message is too old — skip processing, optionally notify once per chat
  const jid = msg.key.remoteJid;
  if (cfg.notify_skipped && jid && !hasBeenNotified(jid)) {
    const lang = store.groups?.[jid]?.language || 'en';
    const notifyText = t(lang, 'missed_messages.notify_skipped_too_old');
    try {
      await session.sock.sendMessage(jid, { text: notifyText });
      markNotified(jid);
      logger.info({ jid, msgTs, cutoffTs }, '📭 Sent missed-messages too-old notification');
    } catch (e) {
      logger.debug({ error: e.message }, 'Failed to send missed-messages too-old notification');
    }
  }

  return { shouldProcess: false, isMissed: false };
}
