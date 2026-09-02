import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { logger } from './logger.js';

/**
 * Reads an environment variable case-insensitively and returns its string value or default.
 */
function getEnv(key, defaultValue = '') {
  if (process.env[key] !== undefined) return process.env[key];
  const upperKey = key.toUpperCase();
  if (process.env[upperKey] !== undefined) return process.env[upperKey];
  const lowerKey = key.toLowerCase();
  if (process.env[lowerKey] !== undefined) return process.env[lowerKey];
  // Fallback: search process.env case-insensitively
  const foundKey = Object.keys(process.env).find((k) => k.toLowerCase() === key.toLowerCase());
  return foundKey ? process.env[foundKey] : defaultValue;
}

/**
 * Parses a boolean environment variable case-insensitively.
 */
function parseEnvBool(key, defaultValue = false) {
  const val = getEnv(key);
  if (val === undefined || val === '' || val === null) return defaultValue;
  const lower = String(val).trim().toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no') return false;
  return defaultValue;
}

/**
 * Parses an integer environment variable case-insensitively.
 */
function parseEnvInt(key, defaultValue) {
  const val = getEnv(key);
  if (val === undefined || val === '' || val === null) return defaultValue;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export const PORT = parseEnvInt('PORT', 8066);

// --- Paths & Directories ---
export const IS_WIN = process.platform === 'win32';
export const DATA_DIR = IS_WIN ? path.resolve('data') : '/data';
export const AUTH_DIR = path.join(DATA_DIR, 'auth_info_baileys');
export const MEDIA_DIR =
  getEnv('MEDIA_FOLDER') || getEnv('MEDIA_DIR') || path.join(process.cwd(), 'media');
export const TOKEN_FILE = path.join(DATA_DIR, '.api_token');

// --- API Token: load from env, file, or auto-generate ---
function loadOrGenerateToken() {
  const envToken = getEnv('API_TOKEN');
  if (envToken) return envToken;
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const token = fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
      if (token) return token;
    }
  } catch {
    /* fall through */
  }
  const newToken = crypto.randomUUID();
  try {
    fs.writeFileSync(TOKEN_FILE, newToken, 'utf-8');
    logger.info('🔑 Generated new API token and saved to disk.');
  } catch (e) {
    logger.warn({ error: e.message }, '⚠️ Could not persist API token to disk.');
  }
  return newToken;
}
export const API_TOKEN = loadOrGenerateToken();

// Ensure data root exists
if (IS_WIN && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// --- Configuration ---
export const SEND_MESSAGE_TIMEOUT = parseEnvInt('SEND_MESSAGE_TIMEOUT', 25000);
export const MEDIA_UPLOAD_TIMEOUT = parseEnvInt('MEDIA_UPLOAD_TIMEOUT', 60000);
export const KEEP_ALIVE_INTERVAL = parseEnvInt('KEEP_ALIVE_INTERVAL', 30000);
export const NOTIFY_RESTORE_THRESHOLD = 60000; // 1 minute
export const MASK_SENSITIVE_DATA = parseEnvBool('MASK_SENSITIVE_DATA', false);
export const GROUP_FETCH_INTERVAL = parseEnvInt('GROUP_FETCH_INTERVAL', 300000);
export const GROUP_FETCH_COOLDOWN_ON_ERROR = parseEnvInt('GROUP_FETCH_COOLDOWN_ON_ERROR', 60000);
export const GROUP_FETCH_COOLDOWN_ON_RATE_LIMIT = parseEnvInt(
  'GROUP_FETCH_COOLDOWN_ON_RATE_LIMIT',
  900000
);
export const MESSAGE_SEND_INTERVAL = parseEnvInt('MESSAGE_SEND_INTERVAL', 1000);
export const MEDIA_RETENTION_DAYS = parseEnvInt('MEDIA_RETENTION_DAYS', 7);

export const UI_AUTH_ENABLED = parseEnvBool('UI_AUTH_ENABLED', false);
export const UI_AUTH_PASSWORD = getEnv('UI_AUTH_PASSWORD', '');
export const MARK_ONLINE = parseEnvBool('MARK_ONLINE', false);
export const SYNC_FULL_HISTORY = parseEnvBool('SYNC_FULL_HISTORY', false);
export const SHOULD_RESET = parseEnvBool('RESET_SESSION', false);

export const WELCOME_MESSAGE_ENABLED = parseEnvBool('WELCOME_MESSAGE_ENABLED', false);
export const ADMIN_NOTIFICATIONS_ENABLED = parseEnvBool('ADMIN_NOTIFICATIONS_ENABLED', true);

function getAddonVersion() {
  const envVer = getEnv('ADDON_VERSION');
  if (envVer) return envVer;
  try {
    const configYamlPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
      '../../config.yaml'
    );
    if (fs.existsSync(configYamlPath)) {
      const content = fs.readFileSync(configYamlPath, 'utf8');
      const match =
        content.match(/^version:\s*"([^"]+)"/m) || content.match(/^version:\s*([^\s]+)/m);
      if (match) return match[1];
    }
  } catch (e) {}
  return 'Unknown';
}

function getAddonSlug() {
  const envSlug = getEnv('ADDON_SLUG');
  if (envSlug) return envSlug;
  try {
    const configYamlPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
      '../../config.yaml'
    );
    if (fs.existsSync(configYamlPath)) {
      const content = fs.readFileSync(configYamlPath, 'utf8');
      const match = content.match(/^slug:\s*"([^"]+)"/m) || content.match(/^slug:\s*([^\s]+)/m);
      if (match) return match[1];
    }
  } catch (e) {}
  return 'whatsapp';
}

export const ADDON_VERSION = getAddonVersion();
export const ADDON_SLUG = getAddonSlug();
export const INTEGRATION_VERSION = getEnv('INTEGRATION_VERSION', 'Unknown');

// --- Debugging Flags ---
logger.info(
  {
    WELCOME_MESSAGE_ENABLED,
    ADMIN_NOTIFICATIONS_ENABLED,
    MARK_ONLINE,
    SYNC_FULL_HISTORY,
    SHOULD_RESET,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED,
    ADDON_VERSION,
    INTEGRATION_VERSION,
  },
  process.env.SUPERVISOR_TOKEN
    ? '🛠️ HA APP Configuration Loaded'
    : '🛠️ Gateway Configuration Loaded'
);

function getBaileysVersion() {
  return getPackageVersion('@whiskeysockets/baileys');
}

export const BAILEYS_VERSION = getBaileysVersion();

function getPackageVersion(packageName) {
  try {
    const pkgPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
      '../node_modules',
      packageName,
      'package.json'
    );
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version;
    }
  } catch (e) {}
  try {
    const rootPkgPath = path.resolve('node_modules', packageName, 'package.json');
    if (fs.existsSync(rootPkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
      return pkg.version;
    }
  } catch (e) {}
  return 'Unknown';
}

function getAlpineVersion() {
  try {
    if (fs.existsSync('/etc/alpine-release')) {
      return fs.readFileSync('/etc/alpine-release', 'utf8').trim();
    }
  } catch (e) {}
  return getEnv('ALPINE_VERSION', 'Unknown');
}

export const EXPRESS_VERSION = getPackageVersion('express');
export const ALPINE_VERSION = getAlpineVersion();
export const NODE_VERSION = process.version;

/**
 * Loads admin numbers from environment or HA options.
 */
export function loadAdminNumbers() {
  let raw = getEnv('ADMIN_NUMBERS') || getEnv('CONFIG_ADMIN_NUMBERS') || '';

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
