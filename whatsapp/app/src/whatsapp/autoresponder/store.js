import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../../config.js';
import { logger } from '../../logger.js';

export function getAutoResponderFilePath() {
  const dir = process.env.DATA_DIR || DATA_DIR;
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, 'autoresponder_config.json');
  } catch (e) {
    const fallbackDir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(fallbackDir)) {
      try {
        fs.mkdirSync(fallbackDir, { recursive: true });
      } catch (err) {}
    }
    return path.join(fallbackDir, 'autoresponder_config.json');
  }
}

export const DEFAULT_MESSAGE_TEMPLATE =
  'Hello {sender_name},\n\n' +
  'Thank you for your message! 🌴\n' +
  'This is an automated reply: I am currently away / on vacation{end_time_text} and have limited or no access to WhatsApp.\n\n' +
  '{once_notice}';

export function getDefaultAutoResponderStore() {
  return {
    enabled: false,
    start_time: null, // ISO string or null (null = immediately)
    end_time: null, // ISO string or null (null = indefinitely)
    direct_only: true, // true = 1:1 private chats only, false = 1:1 & groups
    once_per_contact: true, // true = reply only once per active period, false = reply on every message
    message_template: DEFAULT_MESSAGE_TEMPLATE,
    seen_recipients: {}, // jid -> timestamp
  };
}

let storeMemory = null;

export function clearAutoResponderStoreCache() {
  storeMemory = null;
}

export function loadAutoResponderStore() {
  if (storeMemory) {
    return storeMemory;
  }

  const file = getAutoResponderFilePath();
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = JSON.parse(raw);
      storeMemory = { ...getDefaultAutoResponderStore(), ...parsed };
      if (!storeMemory.seen_recipients || typeof storeMemory.seen_recipients !== 'object') {
        storeMemory.seen_recipients = {};
      }
      return storeMemory;
    }
  } catch (err) {
    logger.error(
      { error: err.message },
      '⚠️ Failed to read autoresponder_config.json, using defaults.'
    );
  }

  storeMemory = getDefaultAutoResponderStore();
  saveAutoResponderStore(storeMemory);
  return storeMemory;
}

export function saveAutoResponderStore(data) {
  try {
    storeMemory = data;
    const file = getAutoResponderFilePath();
    const parentDir = path.dirname(file);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    logger.error({ error: err.message }, '❌ Failed to save autoresponder_config.json');
  }
}

/**
 * Checks if the auto-responder is currently active according to start_time and end_time.
 */
export function isAutoResponderActive(nowMs = Date.now()) {
  const store = loadAutoResponderStore();
  if (!store.enabled) return false;

  if (store.start_time) {
    const startMs = new Date(store.start_time).getTime();
    if (!isNaN(startMs) && nowMs < startMs) {
      return false;
    }
  }

  if (store.end_time) {
    const endMs = new Date(store.end_time).getTime();
    if (!isNaN(endMs) && nowMs > endMs) {
      return false;
    }
  }

  return true;
}

/**
 * Resets the seen recipients list (e.g. when responder is re-enabled).
 */
export function resetSeenRecipients() {
  const store = loadAutoResponderStore();
  store.seen_recipients = {};
  saveAutoResponderStore(store);
  return store;
}

/**
 * Records that a recipient was replied to.
 */
export function recordRecipientReplied(jid, timestamp = Date.now()) {
  const store = loadAutoResponderStore();
  if (!store.seen_recipients) store.seen_recipients = {};
  store.seen_recipients[jid] = timestamp;
  saveAutoResponderStore(store);
}
