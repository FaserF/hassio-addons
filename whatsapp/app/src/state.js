import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { DATA_DIR, ADDON_VERSION, INTEGRATION_VERSION } from './config.js';
import { logger } from './logger.js';

// --- First Contact Memory ---
const SEEN_USERS_FILE = path.join(DATA_DIR, 'seen_users.json');
export let SEEN_USERS = new Set();
if (fs.existsSync(SEEN_USERS_FILE)) {
  try {
    SEEN_USERS = new Set(JSON.parse(fs.readFileSync(SEEN_USERS_FILE, 'utf8')));
  } catch (e) {
    logger.error({ error: e.message }, '❌ Failed to load seen users');
  }
}

export function markUserAsSeen(jid) {
  if (!SEEN_USERS.has(jid)) {
    SEEN_USERS.add(jid);
    try {
      fs.writeFileSync(SEEN_USERS_FILE, JSON.stringify([...SEEN_USERS]));
    } catch (e) {
      logger.error({ error: e.message }, '❌ Failed to save seen users');
    }
    return true; // Was new
  }
  return false;
}

// --- Persistent System State ---
const SYSTEM_STATE_FILE = path.join(DATA_DIR, 'system_state.json');
export let SYSTEM_STATE = {
  system_id: crypto.randomUUID(), // Stable ID for discovery
  last_addon_version: ADDON_VERSION || 'Unknown',
  last_integration_version: INTEGRATION_VERSION || 'Unknown',
  last_ha_version: 'Unknown',
  last_ha_safe_mode: false,
  last_disconnect_time: null,
  last_ha_disconnect_time: null,
  last_integration_online: null,
  last_disconnect_reason: null,
};

if (fs.existsSync(SYSTEM_STATE_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(SYSTEM_STATE_FILE, 'utf8'));
    SYSTEM_STATE = { ...SYSTEM_STATE, ...saved };
  } catch (e) {
    logger.error({ error: e.message }, '❌ Failed to load system state');
  }
}

export function saveSystemState() {
  try {
    fs.writeFileSync(SYSTEM_STATE_FILE, JSON.stringify(SYSTEM_STATE, null, 2));
  } catch (e) {
    logger.error({ error: e.message }, '❌ Failed to save system state');
  }
}

// --- Webhook Configuration Persistence ---
export const WEBHOOK_CONFIG_FILE = path.join(DATA_DIR, 'webhook.json');

export function loadWebhookConfig() {
  if (fs.existsSync(WEBHOOK_CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(WEBHOOK_CONFIG_FILE, 'utf8'));
    } catch (e) {
      logger.error({ error: e.message }, '❌ Failed to load saved webhook config');
    }
  }
  return null;
}

export function saveWebhookConfig(config) {
  try {
    fs.writeFileSync(WEBHOOK_CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (e) {
    logger.error({ error: e.message }, '❌ Failed to save webhook config');
  }
}
