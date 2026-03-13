import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

export const PORT = process.env.PORT || 8066;

// --- Paths & Directories ---
export const IS_WIN = process.platform === 'win32';
export const DATA_DIR = IS_WIN ? path.resolve('data') : '/data';
export const AUTH_DIR = path.join(DATA_DIR, 'auth_info_baileys');
export const MEDIA_DIR = process.env.MEDIA_FOLDER || path.join(process.cwd(), 'media');
export const TOKEN_FILE = path.join(DATA_DIR, 'api_token.txt');

// Ensure data root exists
if (IS_WIN && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// --- Configuration ---
export const SEND_MESSAGE_TIMEOUT = parseInt(process.env.SEND_MESSAGE_TIMEOUT || '25000', 10);
export const KEEP_ALIVE_INTERVAL = parseInt(process.env.KEEP_ALIVE_INTERVAL || '60000', 10);
export const NOTIFY_RESTORE_THRESHOLD = 60000; // 1 minute
export const MASK_SENSITIVE_DATA = process.env.MASK_SENSITIVE_DATA === 'true';

export const UI_AUTH_ENABLED = process.env.UI_AUTH_ENABLED === 'true';
export const UI_AUTH_PASSWORD = process.env.UI_AUTH_PASSWORD || '';
export const MARK_ONLINE = process.env.MARK_ONLINE === 'true';
export const SHOULD_RESET = process.env.RESET_SESSION === 'true';

export const WELCOME_MESSAGE_ENABLED = process.env.WELCOME_MESSAGE_ENABLED !== 'false';
export const ADMIN_NOTIFICATIONS_ENABLED = process.env.ADMIN_NOTIFICATIONS_ENABLED !== 'false';

export const ADDON_VERSION = process.env.ADDON_VERSION || 'Unknown';
export const INTEGRATION_VERSION = process.env.INTEGRATION_VERSION || 'Unknown';

// --- Baileys Version Check ---
function getBaileysVersion() {
  try {
    const pkgPath = path.resolve('node_modules', '@whiskeysockets', 'baileys', 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version;
    }
  } catch (e) {
    logger.warn({ error: e.message }, 'Could not read Baileys version');
  }
  return 'Unknown';
}

export const BAILEYS_VERSION = getBaileysVersion();

/**
 * Loads admin numbers from environment or HA options.
 */
export function loadAdminNumbers() {
  let raw = process.env.ADMIN_NUMBERS || process.env.CONFIG_ADMIN_NUMBERS || '';

  if (!raw && fs.existsSync('/data/options.json')) {
    try {
      const options = JSON.parse(fs.readFileSync('/data/options.json', 'utf8'));
      raw = options.admin_numbers || '';
      logger.info('📂 Loaded admin_numbers directly from /data/options.json');
    } catch (e) {
      logger.error({ error: e.message }, '❌ Failed to read /data/options.json');
    }
  }

  return (raw || '')
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
}

export let ADMIN_NUMBERS = loadAdminNumbers();

export function refreshAdminNumbers() {
    ADMIN_NUMBERS = loadAdminNumbers();
    return ADMIN_NUMBERS;
}
