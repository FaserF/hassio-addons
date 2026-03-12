import express from 'express';
import os from 'os';
// Note: Bonjour is imported dynamically to handle potential environment constraints
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  delay,
  downloadMediaMessage,
  generateMessageID,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import mime from 'mime-types';
import { rateLimit } from 'express-rate-limit';

// --- Log Level ---
const RAW_LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_LEVEL_MAP = {
  trace: 'trace',
  debug: 'debug',
  info: 'info',
  notice: 'info',
  warning: 'warn',
  error: 'error',
  fatal: 'fatal',
};
const LOG_LEVEL = LOG_LEVEL_MAP[RAW_LOG_LEVEL.toLowerCase()] || 'info';

// --- Global Logger ---
const logger = pino({
  level: LOG_LEVEL,
  base: null, // Remove pid/hostname for cleaner logs
});

logger.info(`📝 Log Level set to: ${LOG_LEVEL} (from: ${RAW_LOG_LEVEL})`);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8066;
// Adapt path for local Windows testing vs Docker
const IS_WIN = process.platform === 'win32';
const DATA_DIR = IS_WIN ? path.resolve('data') : '/data';
const AUTH_DIR = path.join(DATA_DIR, 'auth_info_baileys');
const TOKEN_FILE = path.join(DATA_DIR, 'api_token.txt');

// --- Startup Reset ---
const SHOULD_RESET = process.env.RESET_SESSION === 'true';
if (SHOULD_RESET) {
  logger.warn('⚠️ RESET_SESSION ENABLED - Clearing authentication data...');
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    logger.info('✅ Authentication directory cleared.');
  }

  // Automatically disable the toggle in Addon Config
  disableResetSession();
}

/**
 * Calls the Home Assistant Supervisor API to set reset_session to false.
 */
async function disableResetSession() {
  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) {
    logger.debug('No SUPERVISOR_TOKEN found, skipping auto-disable of reset_session.');
    return;
  }

  const data = JSON.stringify({
    options: {
      reset_session: false,
    },
  });

  const options = {
    hostname: 'supervisor',
    port: 80,
    path: '/addons/self/options',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': data.length,
    },
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        logger.info('✅ Successfully disabled reset_session via Supervisor API.');
      } else {
        logger.error(
          { statusCode: res.statusCode },
          '❌ Failed to disable reset_session via Supervisor API.'
        );
      }
      resolve();
    });

    req.on('error', (error) => {
      logger.error({ error: error.message }, '❌ Error calling Supervisor API');
      resolve();
    });

    req.write(data);
    req.end();
  });
}

// Ensure data root exists
if (IS_WIN && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// --- Configuration ---
const SEND_MESSAGE_TIMEOUT = parseInt(process.env.SEND_MESSAGE_TIMEOUT || '25000', 10);
const KEEP_ALIVE_INTERVAL = parseInt(process.env.KEEP_ALIVE_INTERVAL || '30000', 10);
const MASK_SENSITIVE_DATA = process.env.MASK_SENSITIVE_DATA === 'true';

// --- Webhook Configuration ---
let WEBHOOK_ENABLED = process.env.WEBHOOK_ENABLED === 'true';
let WEBHOOK_URL = process.env.WEBHOOK_URL || '';
let WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || '';
const WEBHOOK_CONFIG_FILE = path.join(DATA_DIR, 'webhook.json');

// Load persistent webhook config
if (fs.existsSync(WEBHOOK_CONFIG_FILE)) {
  try {
    const savedConfig = JSON.parse(fs.readFileSync(WEBHOOK_CONFIG_FILE, 'utf8'));
    if (savedConfig.enabled !== undefined) WEBHOOK_ENABLED = savedConfig.enabled;
    if (savedConfig.url !== undefined) WEBHOOK_URL = savedConfig.url;
    if (savedConfig.token !== undefined) WEBHOOK_TOKEN = savedConfig.token;
    logger.info('📂 Loaded specific webhook configuration from storage.');
  } catch (e) {
    logger.error({ error: e.message }, '❌ Failed to load saved webhook config');
  }
}

const UI_AUTH_ENABLED = process.env.UI_AUTH_ENABLED === 'true';
const UI_AUTH_PASSWORD = process.env.UI_AUTH_PASSWORD || '';
const MARK_ONLINE = process.env.MARK_ONLINE === 'true';
// --- Admin Numbers Loading ---
function loadAdminNumbers() {
  // 1. Try environment variables (standard and CONFIG_ prefix)
  let raw = process.env.ADMIN_NUMBERS || process.env.CONFIG_ADMIN_NUMBERS || '';

  // 2. Fallback: try reading /data/options.json directly (standard for HA Addons)
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

let ADMIN_NUMBERS = loadAdminNumbers();
const WELCOME_MESSAGE_ENABLED = process.env.WELCOME_MESSAGE_ENABLED !== 'false';
const ADMIN_NOTIFICATIONS_ENABLED = process.env.ADMIN_NOTIFICATIONS_ENABLED !== 'false';

logger.info(
  {
    count: ADMIN_NUMBERS.length,
    rawEnvPresent: !!process.env.ADMIN_NUMBERS,
    configEnvPresent: !!process.env.CONFIG_ADMIN_NUMBERS,
    envValueLength: (process.env.ADMIN_NUMBERS || process.env.CONFIG_ADMIN_NUMBERS || '').length,
  },
  '👥 admin_numbers configuration checked'
);
logger.info(`👋 Welcome Message: ${WELCOME_MESSAGE_ENABLED ? 'ENABLED' : 'DISABLED'}`);
logger.info(`🔔 Admin Notifications: ${ADMIN_NOTIFICATIONS_ENABLED ? 'ENABLED' : 'DISABLED'}`);

// --- First Contact Memory ---
const SEEN_USERS_FILE = path.join(DATA_DIR, 'seen_users.json');
let SEEN_USERS = new Set();
if (fs.existsSync(SEEN_USERS_FILE)) {
  try {
    SEEN_USERS = new Set(JSON.parse(fs.readFileSync(SEEN_USERS_FILE, 'utf8')));
  } catch (e) {
    logger.error({ error: e.message }, '❌ Failed to load seen users');
  }
}

// --- Persistent System State ---
const SYSTEM_STATE_FILE = path.join(DATA_DIR, 'system_state.json');
let SYSTEM_STATE = {
  last_addon_version: process.env.ADDON_VERSION || 'Unknown',
  last_integration_version: process.env.INTEGRATION_VERSION || 'Unknown',
  last_ha_version: 'Unknown',
  last_ha_safe_mode: false,
  last_whatsapp_online: null,
  last_ha_online: null,
};

if (fs.existsSync(SYSTEM_STATE_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(SYSTEM_STATE_FILE, 'utf8'));
    SYSTEM_STATE = { ...SYSTEM_STATE, ...saved };
  } catch (e) {
    logger.error({ error: e.message }, '❌ Failed to load system state');
  }
}

function saveSystemState() {
  try {
    fs.writeFileSync(SYSTEM_STATE_FILE, JSON.stringify(SYSTEM_STATE, null, 2));
  } catch (e) {
    logger.error({ error: e.message }, '❌ Failed to save system state');
  }
}

async function notifyAdmins(session, text) {
  if (!ADMIN_NOTIFICATIONS_ENABLED) return;

  const targets = [...ADMIN_NUMBERS];
  // If no admins are configured, send to ourself
  if (targets.length === 0 && session.sock?.user?.id) {
    targets.push(session.sock.user.id.split(':')[0]);
  }

  if (targets.length === 0) return;

  for (const admin of targets) {
    const jid = getJid(admin);
    await reply(session, jid, { text }).catch((e) =>
      logger.error({ error: e.message, admin: maskData(jid) }, 'Failed to notify admin')
    );
  }
}

function formatDuration(ms) {
  if (!ms) return 'unknown';
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

/**
 * Formats a date into HA-friendly string (consistent across environments)
 * Format: YYYY-MM-DD, HH:mm:ss
 */
function formatHATime(date) {
  if (!date) return 'Unknown';
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');

  const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timePart = `${pad(d.getHours())}:${pad(pad(d.getMinutes()))}:${pad(d.getSeconds())}`;

  return `${datePart}, ${timePart}`;
}

async function checkSystemUpdates(session) {
  const currentAddonVersion = process.env.ADDON_VERSION || 'Unknown';
  const currentIntegrationVersion = process.env.INTEGRATION_VERSION || 'Unknown';
  const haVersions = await fetchHAVersions();
  const currentHAVersion = haVersions.core;
  const now = formatHATime(new Date());

  let updateMessages = [];

  // 1. Addon Update
  if (
    SYSTEM_STATE.last_addon_version !== 'Unknown' &&
    SYSTEM_STATE.last_addon_version !== currentAddonVersion
  ) {
    updateMessages.push(
      `📦 *WhatsApp App Updated*\n` +
        `• *Version:* ${SYSTEM_STATE.last_addon_version} ➔ ${currentAddonVersion}`
    );
  }

  // 2. Integration Update
  if (
    SYSTEM_STATE.last_integration_version !== 'Unknown' &&
    SYSTEM_STATE.last_integration_version !== currentIntegrationVersion
  ) {
    updateMessages.push(
      `🧩 *Integration Updated*\n` +
        `• *Version:* ${SYSTEM_STATE.last_integration_version} ➔ ${currentIntegrationVersion}`
    );
  }

  // 3. HA Core Update or Restart
  if (SYSTEM_STATE.last_ha_online) {
    const downtime = Date.now() - SYSTEM_STATE.last_ha_online;
    const durationStr = formatDuration(downtime);

    if (haVersions.safe_mode) {
      const haLogs = await fetchHALogs();
      updateMessages.push(
        `⚠️ *Home Assistant Booted in SAFE MODE*\n` +
          `• *Status:* Critical issue detected during boot.\n` +
          `• *Downtime:* ${durationStr}\n\n` +
          `📋 *Recent System Logs:*\n` +
          `\`\`\`\n${haLogs}\n\`\`\``
      );
    } else if (
      SYSTEM_STATE.last_ha_version !== 'Unknown' &&
      SYSTEM_STATE.last_ha_version !== currentHAVersion
    ) {
      updateMessages.push(
        `✅ *Home Assistant Update Successful*\n` +
          `• *Core:* ${SYSTEM_STATE.last_ha_version} ➔ ${currentHAVersion}\n` +
          `• *Downtime:* ${durationStr}`
      );
    } else {
      updateMessages.push(
        `🔄 *Home Assistant back online*\n` +
          `• *Status:* Likely restart/reboot completed.\n` +
          `• *Downtime:* ${durationStr}`
      );
    }
  }

  if (updateMessages.length > 0) {
    const fullText =
      `🔔 *System Status Update*\n` +
      `• *Time:* ${now}\n\n` +
      updateMessages.join('\n\n') +
      `\n\n✨ *Everything is up to date and running!*`;
    await notifyAdmins(session, fullText);
  }

  // Update stored versions
  SYSTEM_STATE.last_addon_version = currentAddonVersion;
  SYSTEM_STATE.last_integration_version = currentIntegrationVersion;
  SYSTEM_STATE.last_ha_version = currentHAVersion;
  SYSTEM_STATE.last_ha_safe_mode = haVersions.safe_mode;
  SYSTEM_STATE.last_ha_online = null; // Clear if it was set
  saveSystemState();
}

/**
 * Periodically checks connection to HA Core/Supervisor
 */
async function monitorHACore(session) {
  setInterval(async () => {
    // Force refresh to bypass 30m cache for critical restart detection
    const haVersions = await fetchHAVersions(true);
    const isOnline = haVersions.core !== 'Unknown';

    if (!isOnline && !SYSTEM_STATE.last_ha_online) {
      // Transition from Online -> Offline
      SYSTEM_STATE.last_ha_online = Date.now();
      saveSystemState();
      logger.warn('⚠️ HA Core is unreachable. Admin notification pending restore.');

      notifyAdmins(
        session,
        `🔴 *Home Assistant Core Unreachable*\n\n` +
          `• *Status:* The bot can no longer reach HA Core or the Supervisor.\n` +
          `• *Likely Causes:* HA restart, update, or network issue.\n` +
          `• *Note:* Automations are temporarily offline. The bot will notify you once restored.`
      ).catch(() => {});
    } else if (isOnline && SYSTEM_STATE.last_ha_online) {
      // Transition from Offline -> Online
      await checkSystemUpdates(session); // Includes restore notification
    }
  }, 60000); // Check every 1 minute
}

function markUserAsSeen(jid) {
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

// --- Home Assistant Version Helper ---
const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN;
let cachedHAVersions = { core: 'Unknown', os: 'Unknown', safe_mode: false, lastUpdate: 0 };

async function fetchHAVersions(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && now - cachedHAVersions.lastUpdate < 30 * 60 * 1000) return cachedHAVersions;

  if (!SUPERVISOR_TOKEN) {
    cachedHAVersions.lastUpdate = now;
    return cachedHAVersions;
  }

  try {
    const fetch = async (urlPath) => {
      const options = {
        hostname: 'supervisor',
        port: 80,
        path: urlPath,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${SUPERVISOR_TOKEN}`,
          'Content-Type': 'application/json',
        },
      };
      return new Promise((resolve) => {
        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(null);
            }
          });
        });
        req.on('error', () => resolve(null));
        req.end();
      });
    };

    const coreData = await fetch('/core/info');
    const osData = await fetch('/os/info');

    if (coreData && coreData.result === 'ok') {
      cachedHAVersions.core = coreData.data.version;
      cachedHAVersions.safe_mode = coreData.data.safe_mode || false;
    }
    if (osData && osData.result === 'ok') cachedHAVersions.os = osData.data.version || 'Unknown';
    cachedHAVersions.lastUpdate = now;
  } catch (e) {
    logger.debug({ error: e.message }, 'Failed to fetch HA versions');
  }
  return cachedHAVersions;
}

/**
 * Fetches the last 50 lines of Home Assistant Core logs
 */
async function fetchHALogs() {
  if (!SUPERVISOR_TOKEN) return 'Supervisor Token not available.';

  return new Promise((resolve) => {
    const options = {
      hostname: 'supervisor',
      port: 80,
      path: '/core/logs',
      method: 'GET',
      headers: { Authorization: `Bearer ${SUPERVISOR_TOKEN}` },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        // Return last 50 lines
        const lines = data.split('\n').filter((l) => l.trim().length > 0);
        resolve(lines.slice(-50).join('\n'));
      });
    });

    req.on('error', (e) => resolve(`Error fetching logs: ${e.message}`));
    req.end();
  });
}

logger.info(`⏱️  Send Message Timeout set to: ${SEND_MESSAGE_TIMEOUT} ms`);
logger.info(`💓 Keep Alive Interval set to: ${KEEP_ALIVE_INTERVAL} ms`);
logger.info(`🔒 Mask Sensitive Data: ${MASK_SENSITIVE_DATA ? 'ENABLED' : 'DISABLED'}`);
logger.info(
  `🔗 Webhook: ${WEBHOOK_ENABLED ? 'ENABLED' : 'DISABLED'} ${WEBHOOK_URL ? `(${WEBHOOK_URL})` : ''}`
);
logger.info(`🌐 Mark Online on Connect: ${MARK_ONLINE ? 'ENABLED' : 'DISABLED'}`);

if (UI_AUTH_ENABLED) {
  logger.info('🔒 UI Authentication: ENABLED');
} else {
  logger.info('🔓 UI Authentication: DISABLED');
}

// --- Authorization Logic ---
let API_TOKEN = '';

if (fs.existsSync(TOKEN_FILE)) {
  API_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
} else {
  API_TOKEN = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(TOKEN_FILE, API_TOKEN);
}

// --- Rate Limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Significantly increased for dynamic dashboard updates
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const uiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
});

logger.info('---------------------------------------------------');
logger.info('🔒 Secure API Token loaded');
logger.info('ℹ️  Find the API Token in the Ingress UI under "Home Assistant Setup"');
logger.info('---------------------------------------------------');

// --- Helper Functions ---
function getJid(number) {
  if (!number) return '';
  if (typeof number !== 'string') number = String(number);

  // 1. If it already has a domain, return it as is.
  if (number.includes('@')) return number;

  // 2. If it has a dash, it's an old-style group ID (creator-timestamp)
  if (number.includes('-')) {
    const cleanGroup = number.replace(/[^\d-]/g, '');
    return `${cleanGroup}@g.us`;
  }

  // 3. Clean all non-numeric characters (e.g. + for phone numbers)
  const cleanNumber = number.replace(/\D/g, '');

  // 4. Heuristic for Group IDs vs Personal Numbers
  // Modern Group IDs (numeric only) are typically much longer than E.164 phone numbers (max 15 digits).
  // Most group IDs are 16-20 digits.
  if (cleanNumber.length >= 16) {
    return `${cleanNumber}@g.us`;
  }

  // 5. Default to the standard WhatsApp user domain
  return number.endsWith('@s.whatsapp.net') || number.endsWith('@g.us')
    ? number
    : `${number}@s.whatsapp.net`;
}

/**
 * Normalizes a phone number for comparison.
 * Handles +49, 49, 0... formats.
 */
function normalizeNumber(number) {
  if (!number) return '';
  // Remove all non-digits
  let digits = number.replace(/\D/g, '');

  // Handle local vs international formats by stripping leading zeros
  if (digits.startsWith('0') && !digits.startsWith('00')) {
    digits = digits.substring(1);
  }

  // Strip leading 00
  if (digits.startsWith('00')) {
    digits = digits.substring(2);
  }

  return digits;
}

function isAdmin(jid, session = null) {
  if (!jid) return false;

  // 0. Implicit Admin: If it's our own JID, we are always an admin
  if (session?.sock?.user?.id) {
    const myJid = session.sock.user.id.replace(/:.*@/, '@');
    if (jid.replace(/:.*@/, '@') === myJid) return true;
  }

  if (!ADMIN_NUMBERS || ADMIN_NUMBERS.length === 0) return false;

  // 1. Extract pure sender number from JID
  const numberPart = jid.split('@')[0];
  const pureSender = numberPart.split(':')[0].replace(/\D/g, ''); // e.g. 491761234567

  // Normalize sender (strip leading zeros)
  let cleanSender = pureSender;
  if (cleanSender.startsWith('00')) cleanSender = cleanSender.substring(2);
  if (cleanSender.startsWith('0')) cleanSender = cleanSender.substring(1);

  const matched = ADMIN_NUMBERS.some((admin) => {
    let cleanAdmin = admin.replace(/\D/g, '');
    if (cleanAdmin.startsWith('00')) cleanAdmin = cleanAdmin.substring(2);
    if (cleanAdmin.startsWith('0')) cleanAdmin = cleanAdmin.substring(1);

    // Exact match of normalized parts
    if (cleanSender === cleanAdmin) return true;

    // Suffix match (handles one being local "176..." and other international "49176...")
    // Only allow if both are at least 7 digits to avoid false positives
    if (cleanSender.length >= 7 && cleanAdmin.length >= 7) {
      if (cleanSender.endsWith(cleanAdmin) || cleanAdmin.endsWith(cleanSender)) {
        return true;
      }
    }
    return false;
  });

  if (!matched && (!ADMIN_NUMBERS || ADMIN_NUMBERS.length === 0)) {
    // One-time retry if list is empty (might be late config population)
    ADMIN_NUMBERS = loadAdminNumbers();
    if (ADMIN_NUMBERS.length > 0) return isAdmin(jid); // Re-run once
  }

  if (!matched) {
    logger.debug(
      { jid: maskData(jid), senderDigits: cleanSender.slice(-4), adminCount: ADMIN_NUMBERS.length },
      'isAdmin check failed'
    );
  }

  return matched;
}

/**
 * Ported diagnostic logic from Integration.
 */
async function runDiagnostic(session, senderJid) {
  try {
    addLog(session, `Starting diagnostic test for ${maskData(senderJid)}`, 'info');

    // 1. Text Message
    const textMsg = await reply(session, senderJid, {
      text: '🧪 *Diagnostic Test [1/6]*: Text message works!',
    });
    await delay(1000);

    // 2. Reaction
    if (textMsg) {
      await reply(session, senderJid, {
        react: { text: '✅', key: textMsg.key },
      });
      await delay(1000);
    }

    // 3. Buttons
    await reply(session, senderJid, {
      text: '🧪 *Diagnostic Test [2/6]*: Checking Buttons...',
      footer: 'HA App Test',
      buttons: [
        { buttonId: 'diag_1', displayText: 'Button 1' },
        { buttonId: 'diag_2', displayText: 'Button 2' },
      ],
    });
    await delay(1000);

    // 4. List
    await reply(session, senderJid, {
      title: '🧪 Diagnostic Test [3/6]',
      text: 'Checking List Message...',
      buttonText: 'View Options',
      sections: [
        {
          title: 'Test Section',
          rows: [
            { title: 'Option 1', id: 'opt_1' },
            { title: 'Option 2', id: 'opt_2' },
          ],
        },
      ],
    });
    await delay(1000);

    // 5. Location
    await reply(session, senderJid, {
      location: { degreesLatitude: 52.52, degreesLongitude: 13.405 },
      title: '🧪 Diagnostic Test [4/6]',
      address: 'Berlin, Germany',
    });
    await delay(1000);

    // 6. Final Text & Help Tip
    await reply(session, senderJid, {
      text: '🧪 *Diagnostic Test [5/6]*: Overall bridge check complete.',
    });
    await delay(1000);

    // 7. Cleanup (Delete first message)
    if (textMsg) {
      await reply(session, senderJid, { delete: textMsg.key });
      await reply(session, senderJid, {
        text: '🧪 *Diagnostic Test [6/6]*: Cleanup (Delete) verified. All tests finished!',
      });
    }

    addLog(session, `Diagnostic test for ${maskData(senderJid)} finished`, 'success');
  } catch (err) {
    logger.error({ error: err.message }, 'Diagnostic test failed');
    await reply(session, senderJid, { text: `❌ *Diagnostic Failed:* ${err.message}` });
  }
}

/**
 * Sends a role-aware welcome message.
 */
async function sendWelcomeMessage(session, jid) {
  const isAdminUser = isAdmin(jid);
  const role = isAdminUser ? '*Admin*' : '*Standard User*';

  let welcomeText =
    `👋 *Welcome to the Home Assistant WhatsApp Bridge!*\n\n` + `Your current role: ${role}\n\n`;

  if (isAdminUser) {
    welcomeText += `💡 *Admin Tip:* Use \`ha-app-status\` for health checks or \`ha-app-help\` for all control commands.\n\n`;
  } else {
    welcomeText += `💡 *Tip:* Use \`ha-app-status\` to view the integration status.\n\n`;
  }

  welcomeText +=
    `🔗 *Docs & Support:*\n` +
    `• https://faserf.github.io/ha-whatsapp/\n` +
    `• https://faserf.github.io/ha-whatsapp/support.html`;

  await reply(session, jid, { text: welcomeText });
}

/**
 * Retrieves a message from the session store for quoting.
 */
function getQuotedMessage(session, quotedMessageId) {
  if (!quotedMessageId) return undefined;

  // Note: messageStore is in-memory and ephemeral. It only contains messages
  // received/sent during the current session. If the addon restarts,
  // quoting will fall back to unquoted if the ID is not in the new store.
  const rawMsg = session.messageStore.get(quotedMessageId);
  if (rawMsg) return rawMsg;

  logger.warn({ quotedMessageId, sessionId: session.id }, 'Quoted message not found in store');
  return undefined;
}

async function triggerWebhook(data) {
  if (!WEBHOOK_ENABLED || !WEBHOOK_URL) return;

  try {
    const payload = JSON.stringify(data);
    const url = new URL(WEBHOOK_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Webhook-Token': WEBHOOK_TOKEN,
      },
    };

    const protocol = url.protocol === 'https:' ? await import('https') : http;
    const req = protocol.request(options, (res) => {
      logger.debug({ statusCode: res.statusCode }, '[Webhook] Message forwarded');
      // Update integration state since the webhook responded
      SYSTEM_STATE.last_integration_online = Date.now();
    });

    req.on('error', (e) => {
      logger.error({ error: e.message }, '[Webhook] Failed to forward message');
    });

    req.write(payload);
    req.end();
  } catch (e) {
    logger.error({ error: e.message }, '[Webhook] Error during trigger');
  }
}

function maskData(str) {
  if (!MASK_SENSITIVE_DATA || !str) return str;
  if (str.length <= 4) return '****';
  return str.substring(0, 3) + '****' + str.substring(str.length - 2);
}

const sessions = new Map();
const SESSION_ID_REGEX = /^[a-zA-Z0-9_.-]+$/;

function sanitizeSessionId(sessionId) {
  if (!sessionId) return 'default';
  // Use path.basename to extract the deepest name, preventing path traversal
  const base = path.basename(sessionId);
  // Restrict to a safe character set
  const sanitized = base.replace(/[^\w.-]/g, '');

  if (!sanitized || sanitized === '..' || !SESSION_ID_REGEX.test(sanitized)) {
    return 'default';
  }
  return sanitized;
}

function getSession(rawSessionId) {
  const sessionId = sanitizeSessionId(rawSessionId);
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      sock: null,
      currentQR: null,
      isConnected: false,
      disconnectReason: null,
      reconnectAttempts: 0,
      firstFailureTime: null,
      eventQueue: [],
      connectionLogs: [],
      recentSent: [],
      recentReceived: [],
      recentFailures: [],
      messageStore: new Map(),
      statusRateLimit: new Map(), // sender -> lastStatusTime
      unauthorizedWarned: new Set(), // sender IDs
      lastInterestTime: 0, // Track when someone last looked at this session
      stats: {
        sent: 0,
        received: 0,
        failed: 0,
        last_sent_message: 'None',
        last_sent_target: 'None',
        last_received_message: 'None',
        last_received_sender: 'None',
        last_failed_message: 'None',
        last_failed_target: 'None',
        last_error_reason: 'None',
        last_sent_time: null,
        last_received_time: null,
        last_failed_time: null,
        start_time: Date.now(),
        my_number: 'Unknown',
        version: BAILEYS_VERSION,
      },
    });
  }
  return sessions.get(sessionId);
}

function addLog(session, msg, type = 'info') {
  const timestamp = formatHATime(new Date());
  session.connectionLogs.unshift({ timestamp, msg, type });
  if (session.connectionLogs.length > 50) session.connectionLogs.pop();
}

/**
 * Signals that someone is actively watching/configuring this session.
 * Used for lazy-starting connections only when needed.
 */
function signalInterest(sessionId) {
  const session = getSession(sessionId);
  const now = Date.now();
  const alreadyInterested = now - session.lastInterestTime < 60000;
  session.lastInterestTime = now;

  // If we weren't interested before, and we aren't connected/connecting, start it
  if (!alreadyInterested && !session.isConnected && (!session.sock || session.sock.ws?.isClosed)) {
    const authDir = getAuthDir(sessionId);
    const hasCreds = fs.existsSync(path.join(authDir, 'creds.json'));

    // We only auto-start on interest if we DON'T have creds.
    // If we DO have creds, we are likely already in a retry loop or connected.
    if (!hasCreds) {
      logger.info({ sessionId }, '🎯 Interest signaled for unauthenticated session - starting...');
      connectToWhatsApp(sessionId).catch(() => {});
    }
  }
}

function trackSent(session, target, message) {
  const timestamp = formatHATime(new Date());
  session.recentSent.unshift({ timestamp, target: maskData(target), message: maskData(message) });
  if (session.recentSent.length > 5) session.recentSent.pop();
}

function trackReceived(session, sender, message) {
  const timestamp = formatHATime(new Date());
  session.recentReceived.unshift({
    timestamp,
    sender: maskData(sender),
    message: maskData(message),
  });
  if (session.recentReceived.length > 5) session.recentReceived.pop();
}

/**
 * Unified helper to send a message and track it in stats/recent outbound.
 */
async function reply(session, jid, content) {
  try {
    const result = await session.sock.sendMessage(jid, content);
    const text = typeof content === 'string' ? content : content.text || '[Mixed Content]';
    const target = jid.split('@')[0].split(':')[0];

    session.stats.sent += 1;
    session.stats.last_sent_message = maskData(text);
    session.stats.last_sent_target = maskData(target);
    session.stats.last_sent_time = Date.now();
    trackSent(session, target, text);
    return result;
  } catch (err) {
    logger.error({ error: err.message, jid }, 'Failed to send reply');
    session.stats.failed += 1;
    return null;
  }
}

function trackFailure(session, target, message, reason) {
  const timestamp = formatHATime(new Date());
  session.recentFailures.unshift({
    timestamp,
    target: maskData(target),
    message: maskData(message),
    reason: reason,
  });
  if (session.recentFailures.length > 5) session.recentFailures.pop();
}

function getAuthDir(sessionId) {
  const dir = sessionId === 'default' ? AUTH_DIR : path.join(DATA_DIR, 'sessions', sessionId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// --- Version Check ---
let BAILEYS_VERSION = 'Unknown';
try {
  const pkgPath = path.resolve('node_modules', '@whiskeysockets', 'baileys', 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    BAILEYS_VERSION = pkg.version;
    getSession('default').stats.version = BAILEYS_VERSION; // Update stats object with early version info
  }
} catch (e) {
  logger.warn({ error: e.message }, 'Could not read Baileys version');
}

// --- Baileys 405 Workaround (GitHub Issue #2370) ---
// Baileys 7.0.0-rc.9 has a bug causing 405 connection errors.
// Pinning the WA version tuple fixes it. This workaround is ONLY
// applied for 7.0.0-rc.9; when Renovate bumps Baileys the patch
// is automatically skipped.
const BAILEYS_405_AFFECTED_VERSION = '7.0.0-rc.9';
const BAILEYS_405_VERSION_OVERRIDE = [2, 3000, 1033893291];
const APPLY_BAILEYS_405_FIX = BAILEYS_VERSION === BAILEYS_405_AFFECTED_VERSION;

if (APPLY_BAILEYS_405_FIX) {
  logger.warn(`⚠️  Applying Baileys 405 workaround (version override) for v${BAILEYS_VERSION}`);
} else {
  logger.info(`✅ Baileys v${BAILEYS_VERSION} — no 405 workaround needed`);
}

// --- mDNS / Bonjour ---
// Advertise service for Home Assistant Discovery
async function publishMDNS(name, attempt = 0) {
  try {
    const { Bonjour } = await import('bonjour-service');
    const instance = new Bonjour();
    const serviceName = attempt === 0 ? name : `${name} ${attempt}`;

    const service = instance.publish({
      name: serviceName,
      type: 'ha-whatsapp',
      protocol: 'tcp',
      port: PORT,
      txt: {
        version: '1.0.0', // Protocol version
        api_path: '/',
        auth_type: 'token',
      },
    });

    service.on('error', (err) => {
      if (err.message.includes('already in use') && attempt < 10) {
        logger.warn({ serviceName }, 'mDNS name in use, retrying with incremented name...');
        instance.destroy();
        publishMDNS(name, attempt + 1);
      } else {
        logger.error({ serviceName, error: err.message }, 'mDNS advertisement error');
        addLog(getSession('default'), `mDNS error: ${err.message}`, 'warning');
      }
    });

    service.on('up', () => {
      logger.info({ serviceName, port: PORT }, '📢 Publishing mDNS service');
    });
  } catch (e) {
    logger.warn({ error: e.message }, 'mDNS advertisement failed to initialize');
  }
}

const baseMDNSName = process.env.MDNS_NAME || 'whatsapp homeassistant app';
publishMDNS(baseMDNSName);

// --- Middleware ---
const ipFilterMiddleware = (req, res, next) => {
  // If UI Auth is enabled, we allow access from everywhere (protected by password)
  if (UI_AUTH_ENABLED) return next();

  // Special case: Home Assistant Ingress requests always have this header
  if (req.headers['x-ingress-path'] || req.headers['x-hass-source']) {
    return next();
  }

  let ip = req.ip || req.connection.remoteAddress;

  // Normalize IPv6 mapped IPv4 addresses
  if (ip.startsWith('::ffff:')) {
    ip = ip.substr(7);
  }

  // Allow Localhost
  if (ip === '127.0.0.1' || ip === '::1') return next();

  // Allow Private Networks
  // 10.0.0.0/8
  // 172.16.0.0/12
  // 192.168.0.0/16
  // fc00::/7 (Unique Local Address IPv6)
  const isPrivate = /^(10)\.|^(172\.(1[6-9]|2[0-9]|3[0-1]))\.|^(192\.168)\.|^fc[0-9a-f]{2}:/.test(
    ip
  );

  if (isPrivate) return next();

  // If we reach here, it's potentially an external or unknown access attempt
  addLog(getSession('default'), `Blocked access attempt from ${ip}`, 'warning');
  logger.warn({ ip, headers: req.headers }, '[SECURITY] Blocked access attempt (UI Auth Disabled)');
  return res
    .status(403)
    .send('Forbidden: External access is disabled when UI Authentication is off.');
};

const authMiddleware = (req, res, next) => {
  const providedToken = req.header('X-Auth-Token');
  if (providedToken !== API_TOKEN) {
    addLog(getSession('default'), `Unauthorized API access attempt from ${req.ip}`, 'error');
    logger.warn(
      { ip: req.ip, path: req.originalUrl, tokenProvided: !!providedToken },
      '[AUTH] Unauthorized access attempt'
    );
    return res.status(401).json({
      error: 'Unauthorized',
      detail: 'Invalid or missing X-Auth-Token',
    });
  }
  next();
};

const uiAuthMiddleware = (req, res, next) => {
  if (!UI_AUTH_ENABLED) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="WhatsApp Addon"');
    return res.status(401).send('Unauthorized');
  }

  const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  const user = auth[0];
  const pass = auth[1];

  if (user === 'admin' && pass === UI_AUTH_PASSWORD) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="WhatsApp Addon"');
    return res.status(401).send('Unauthorized');
  }
};

const ingressPrefixMiddleware = (req, res, next) => {
  // Normalize multiple slashes at the start of any request
  if (req.url.startsWith('//')) {
    req.url = req.url.replace(/\/+/g, '/');
  }

  const ingressPath = req.headers['x-ingress-path'];
  if (ingressPath) {
    const urlBefore = req.url;
    // Ensure prefix is stripped regardless of trailing slash mismatches
    const cleanPrefix = ingressPath.replace(/\/$/, '');
    if (req.url.startsWith(cleanPrefix)) {
      req.url = req.url.substring(cleanPrefix.length);
      if (!req.url.startsWith('/')) req.url = '/' + req.url;
    }

    // Final normalization
    req.url = req.url.replace(/\/+/g, '/');

    if (urlBefore !== req.url) {
      logger.debug(
        { urlBefore, urlAfter: req.url, ingressPath },
        'Stripped Ingress prefix & normalized'
      );
    }
  } else {
    // Normalization fallback for non-ingress too
    const urlBefore = req.url;
    req.url = req.url.replace(/\/+/g, '/');
    if (urlBefore !== req.url) {
      logger.debug({ urlBefore, urlAfter: req.url }, 'Normalized slashes');
    }
  }
  next();
};

// Global Middleware
app.use(ingressPrefixMiddleware);
app.use(ipFilterMiddleware);

// Apply UI Rate Limit
app.use('/', uiLimiter);

// Protect API routes exclusively with Rate Limiting
app.use('/session', apiLimiter, authMiddleware);
app.use('/qr', apiLimiter, authMiddleware);
app.use('/status', apiLimiter, authMiddleware);
app.use('/events', apiLimiter, authMiddleware);
app.use('/stats', apiLimiter, authMiddleware);
app.use('/send_message', apiLimiter, authMiddleware);
app.use('/send_image', apiLimiter, authMiddleware);
app.use('/send_poll', apiLimiter, authMiddleware);
app.use('/send_location', apiLimiter, authMiddleware);
app.use('/send_reaction', apiLimiter, authMiddleware);
app.use('/send_buttons', apiLimiter, authMiddleware);
app.use('/send_document', apiLimiter, authMiddleware);
app.use('/send_video', apiLimiter, authMiddleware);
app.use('/send_audio', apiLimiter, authMiddleware);
app.use('/send_list', apiLimiter, authMiddleware);
app.use('/send_contact', apiLimiter, authMiddleware);
app.use('/revoke_message', apiLimiter, authMiddleware);
app.use('/edit_message', apiLimiter, authMiddleware);
app.use('/set_presence', apiLimiter, authMiddleware);
app.use('/groups', apiLimiter, authMiddleware);
app.use('/mark_as_read', apiLimiter, authMiddleware);
app.use('/logs', apiLimiter, authMiddleware);

const getReqSession = (req) => {
  const rawId = req.query.session_id || req.body?.session_id || 'default';
  return getSession(rawId);
};

// --- Media Support ---
const MEDIA_DIR = process.env.MEDIA_FOLDER || path.join(process.cwd(), 'media');
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}
logger.info(`📂 Media Directory: ${MEDIA_DIR}`);

// Serve media files publicly (or protected if needed, but usually HA needs access)
// We use a random token in the filename to provide obscure URLs instead of full auth complexity specific for HA
app.use('/media', express.static(MEDIA_DIR));

// Clean up old media files every hour (keep for 24h)
// ONLY if not using a custom media folder (to prevent deleting user data)
if (!process.env.MEDIA_FOLDER) {
  setInterval(
    () => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000;
      fs.readdir(MEDIA_DIR, (err, files) => {
        if (err) return;
        files.forEach((file) => {
          const filePath = path.join(MEDIA_DIR, file);
          fs.stat(filePath, (err, stats) => {
            if (err) return;
            if (now - stats.mtimeMs > maxAge) {
              fs.unlink(filePath, () => {});
            }
          });
        });
      });
    },
    60 * 60 * 1000
  );
} else {
  logger.info('⚠️  Custom Media Folder in use - Automatic cleanup DISABLED.');
}

// --- Store Initialization ---
// Session-specific message stores are managed within the session object.

// Helper to bind store to events
function bindStore(session, ev) {
  ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.id) {
        session.messageStore.set(msg.key.id, msg);
      }
    }
  });
}

async function connectToWhatsApp(sessionId = 'default') {
  const session = getSession(sessionId);
  const sessionAuthDir = getAuthDir(sessionId);
  const hasCreds = fs.existsSync(path.join(sessionAuthDir, 'creds.json'));

  // Logic for QR Request Optimization (Lazy Loading)
  // If we don't have credentials, only proceed if there is active interest
  const now = Date.now();
  const isInterested = now - session.lastInterestTime < 60000;

  if (!hasCreds && !isInterested) {
    logger.info(
      { sessionId },
      '💤 No credentials and no active interest (Dashboard/Flow closed). Skipping connection.'
    );
    addLog(session, 'Waiting for user to open Dashboard to start pairing...', 'info');
    session.currentQR = null;
    return;
  }

  addLog(session, `Starting request for session: ${sessionId}...`, 'info');
  const { state, saveCreds } = await useMultiFileAuthState(sessionAuthDir);

  session.sock = makeWASocket({
    auth: state,
    logger: logger.child({ module: `baileys-${sessionId}` }, { level: 'warn' }),
    browser: Browsers.macOS('Chrome'),
    ...(APPLY_BAILEYS_405_FIX && { version: BAILEYS_405_VERSION_OVERRIDE }),
    syncFullHistory: false,
    markOnlineOnConnect: MARK_ONLINE,

    keepAliveIntervalMs: KEEP_ALIVE_INTERVAL,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    retryRequestDelayMs: 5000,
    getMessage: async (key) => {
      // Check our custom store
      if (session.messageStore.has(key.id)) {
        logger.debug({ msgId: key.id, sessionId }, '[Store] Retrieving message from store');
        return session.messageStore.get(key.id).message;
      }
      logger.debug({ msgId: key.id, sessionId }, '[Store] Message not found in store');
      return undefined;
    },
  });

  // Bind custom store to events
  bindStore(session, session.sock.ev);

  session.sock.ev.on('creds.update', saveCreds);

  const sock = session.sock;
  sock.ev.on('connection.update', async (update) => {
    // Ignore events from old/closed sockets to prevent race conditions
    if (session.sock !== sock) {
      logger.debug({ sessionId }, 'Ignoring connection.update from stale socket');
      return;
    }

    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info({ sessionId }, 'QR Code received');
      addLog(session, 'QR Code generated. Waiting for scan...', 'success');
      session.currentQR = await QRCode.toDataURL(qr);
    }

    if (connection === 'close') {
      const isLoggedOut = lastDisconnect.error?.output?.statusCode === DisconnectReason.loggedOut;
      const shouldReconnect = !isLoggedOut;
      const reason = lastDisconnect.error?.message || lastDisconnect.error?.toString() || 'Unknown';
      addLog(session, `Connection closed: ${reason}`, 'warning');

      logger.warn({ reason, shouldReconnect, sessionId }, 'Connection closed');
      session.isConnected = false;

      // Notify Admin about WhatsApp disconnect
      if (ADMIN_NOTIFICATIONS_ENABLED && !SYSTEM_STATE.last_whatsapp_online) {
        // Only if we were previously online or just started
        SYSTEM_STATE.last_whatsapp_online = Date.now();
        saveSystemState();
      }

      if (isLoggedOut) {
        session.disconnectReason = 'logged_out';
        session.reconnectAttempts = 0;
        session.firstFailureTime = null;
        addLog(session, 'Session logged out. Clean up metadata required.', 'error');
        logger.error({ sessionId }, `Logged out. Please delete ${sessionAuthDir} to re-pair.`);
      } else {
        session.disconnectReason = 'connection_error';
        session.reconnectAttempts += 1;
        if (!session.firstFailureTime) {
          session.firstFailureTime = Date.now();
        }

        // Adaptive backoff: escalate to 2min after 15min of sustained failures
        const baseDelay = APPLY_BAILEYS_405_FIX ? 15000 : 3000;
        const failDuration = Date.now() - session.firstFailureTime;
        const reconnectDelay = failDuration > 15 * 60 * 1000 ? 120000 : baseDelay;

        addLog(
          session,
          `Reconnecting in ${reconnectDelay / 1000}s... (attempt ${session.reconnectAttempts})`,
          'info'
        );
        logger.info(
          { sessionId, attempt: session.reconnectAttempts, delayMs: reconnectDelay },
          'Scheduling reconnect'
        );

        setTimeout(() => {
          // Re-check interest before actually re-triggering connection if no creds
          const authDir = getAuthDir(sessionId);
          const stillHasNoCreds = !fs.existsSync(path.join(authDir, 'creds.json'));
          const interestCheck = Date.now() - session.lastInterestTime < 60000;

          if (stillHasNoCreds && !interestCheck) {
            logger.info({ sessionId }, '😴 Reconnect cancelled: No interest and no credentials.');
            addLog(session, 'Pairing paused (Dashboard closed).', 'info');
            return;
          }

          connectToWhatsApp(sessionId);
        }, reconnectDelay);
      }
    } else if (connection === 'open') {
      logger.info({ sessionId }, 'WhatsApp connection opened');
      addLog(session, 'WhatsApp Connection Established! 🟢', 'success');
      session.isConnected = true;
      session.disconnectReason = null;
      session.reconnectAttempts = 0;
      session.firstFailureTime = null;

      // Notify Admin about WhatsApp restore
      if (ADMIN_NOTIFICATIONS_ENABLED && SYSTEM_STATE.last_whatsapp_online) {
        const downtime = Date.now() - SYSTEM_STATE.last_whatsapp_online;
        const durationStr = formatDuration(downtime);
        const timestamp = new Date().toLocaleString();

        notifyAdmins(
          session,
          `🟢 *WhatsApp Connection Restored*\n\n` +
            `• *Time:* ${timestamp}\n` +
            `• *Downtime:* ${durationStr}\n` +
            `• *Status:* Bot is back online and responding to messages.`
        );
        SYSTEM_STATE.last_whatsapp_online = null;
        saveSystemState();
      }

      // Start background monitors on first open
      if (!session._monitorsStarted) {
        session._monitorsStarted = true;
        checkSystemUpdates(session).catch(() => {});
        monitorHACore(session).catch(() => {});
      }
      session.firstFailureTime = null;
      session.currentQR = null;
      if (session.sock && session.sock.user) {
        session.stats.my_number = session.sock.user.id.split(':')[0]; // Extract number from JID
        session.stats.version = BAILEYS_VERSION;

        // Extract basic device info from credentials if available
        const creds = state.creds;
        session.deviceInfo = {
          manufacturer:
            creds.registration?.deviceManufacturer ||
            creds.verifiedName?.details?.verifiedName ||
            'Unknown',
          model: creds.registration?.deviceName || 'WhatsApp Web',
          platform: creds.platform || 'web',
          battery: undefined,
        };
      }
    } else if (connection === 'connecting') {
      addLog(session, 'Connecting to WhatsApp...', 'info');
    }
  });

  // Handle Incoming Messages
  session.sock.ev.on('messages.upsert', async (m) => {
    if (m.messages && m.messages.length > 0) {
      session.stats.received += m.messages.length;

      const events = m.messages
        .filter((msg) => {
          // Always ignore status broadcasts
          if (msg.key.remoteJid === 'status@broadcast') return false;

          // If the message is from me, only allow it if it's sent to my own JID (self-message)
          if (msg.key.fromMe) {
            const myJid = session.sock.user.id.replace(/:.*@/, '@');
            return msg.key.remoteJid === myJid;
          }

          // Allow all other incoming messages
          return true;
        })
        .map(async (msg) => {
          let text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.buttonsResponseMessage?.selectedDisplayText ||
            msg.message?.templateButtonReplyMessage?.selectedId ||
            '';

          // Check for alternative JID (useful when primary is LID but we want Phone JID)
          const remoteJidAlt = msg.key.remoteJidAlt;
          let senderJid = msg.key.remoteJid;

          if (
            senderJid.endsWith('@lid') &&
            remoteJidAlt &&
            remoteJidAlt.endsWith('@s.whatsapp.net')
          ) {
            // Swap them: Use Phone JID as primary sender for HA compatibility
            senderJid = remoteJidAlt;
          }

          let senderNumber = senderJid.split('@')[0];
          const isGroup = senderJid.endsWith('@g.us');

          // Check for media
          const messageType = Object.keys(msg.message || {})[0];
          let mediaUrl = null;
          let mediaPath = null;
          let mediaType = null;
          let mimeType = null;
          let caption = null;

          const supportedMediaTypes = [
            'imageMessage',
            'videoMessage',
            'audioMessage',
            'documentMessage',
            'stickerMessage',
          ];

          if (supportedMediaTypes.includes(messageType)) {
            try {
              const mediaContent = msg.message[messageType];
              caption = mediaContent.caption || '';
              text = text || caption || `[Media: ${messageType}]`;
              mediaType = messageType.replace('Message', '');
              mimeType = mediaContent.mimetype;

              // Download media
              const buffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                {
                  logger: logger.child({ module: `media-dl-${sessionId}` }),
                  reuploadRequest: session.sock.updateMediaMessage,
                }
              );

              if (buffer) {
                const ext = mime.extension(mimeType) || 'bin';
                const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
                const savePath = path.join(MEDIA_DIR, filename);

                fs.writeFileSync(savePath, buffer);
                mediaPath = savePath;

                // Construct accessible URL
                mediaUrl = `/media/${filename}`;
              }
            } catch (err) {
              text = `${text} (Media Download Failed)`;
              trackFailure(session, senderNumber, `Media: ${messageType}`, err.message);
            }
          }

          trackReceived(session, senderNumber, text);

          if (!text && !mediaUrl) {
            text = 'Unknown/Unsupported Message Type';
          }

          // Update session stats with the latest message detail
          session.stats.last_received_message = maskData(text);
          session.stats.last_received_sender = maskData(senderNumber);
          session.stats.last_received_time = Date.now();

          // Determine effective sender number (handle Groups and LIDs)
          const participant = msg.key.participant || msg.participant;
          let effectiveSenderJid = senderJid;

          if (
            participant &&
            typeof participant === 'string' &&
            participant.includes('@s.whatsapp.net')
          ) {
            effectiveSenderJid = participant;
          }

          senderNumber = effectiveSenderJid.split('@')[0];

          return {
            content: text,
            sender: senderJid, // origin (Group or Phone JID, preferred over LID)
            sender_number: senderNumber, // The actual user phone number (best effort)
            sender_lid: msg.key.remoteJid.endsWith('@lid') ? msg.key.remoteJid : undefined, // Expose raw LID if available
            is_group: isGroup,
            media_url: mediaUrl,
            media_path: mediaPath,
            media_type: mediaType,
            media_mimetype: mimeType,
            caption: caption,
            raw: msg, // Keep raw for power users
            session_id: sessionId,
          };
        });

      const resolvedEvents = await Promise.all(events);
      session.eventQueue.push(...resolvedEvents);

      // --- Webhook Integration ---
      for (const event of resolvedEvents) {
        triggerWebhook(event);

        // --- First Contact Welcome Message ---
        if (WELCOME_MESSAGE_ENABLED && !event.is_group && event.content) {
          const personJid = event.raw.key.participant || event.sender;
          if (markUserAsSeen(personJid)) {
            logger.info({ jid: maskData(personJid) }, '👋 Sending first-contact welcome message');
            sendWelcomeMessage(session, event.sender).catch((e) =>
              logger.error({ error: e.message }, 'Failed to send welcome message')
            );
          }
        }

        // --- Native Command Handling ---
        if (event.content && typeof event.content === 'string') {
          const body = event.content.trim().toLowerCase();
          const sender = event.sender;

          try {
            // Check for HA App Commands (ha-app-*)
            if (body.startsWith('ha-app-')) {
              // For admin checks, always use the individual person ID
              const personJid = event.raw.key.participant || event.sender;
              const isAdminUser = isAdmin(personJid, session);

              logger.debug(
                { body, sender, personJid: maskData(personJid), isAdminUser },
                'Processing ha-app command'
              );

              if (body === 'ha-app-ping') {
                await reply(session, sender, { text: 'Pong! 🏓' });
                continue;
              } else if (body === 'ha-app-getid') {
                await reply(session, sender, { text: `Chat ID: \`${sender}\`` });
                continue;
              } else if (body === 'ha-app-sponsor') {
                const sponsorText =
                  '💖 *Support HA WhatsApp*\n\n' +
                  'Thank you for your interest in supporting this project! Your contributions help keep development active.\n\n' +
                  '🔗 *Sponsor Link:* https://faserf.github.io/ha-whatsapp/support.html';
                await reply(session, sender, { text: sponsorText });
                continue;
              } else if (body === 'ha-app-status') {
                const now = Date.now();
                if (!isAdminUser) {
                  // Rate limit based on the person (array of timestamps for rolling window)
                  const requests = session.statusRateLimit.get(personJid) || [];
                  const lastMinute = now - 60000;
                  const recentRequests = requests.filter((t) => t > lastMinute);

                  if (recentRequests.length >= 5) {
                    continue;
                  }
                  recentRequests.push(now);
                  session.statusRateLimit.set(personJid, recentRequests);
                }

                const uptimeMs = now - session.stats.start_time;
                const days = Math.floor(uptimeMs / (24 * 60 * 60 * 1000));
                const hours = Math.floor((uptimeMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                const minutes = Math.floor((uptimeMs % (60 * 60 * 1000)) / (60 * 1000));
                const uptimeStr = `${days}d ${hours}h ${minutes}m`;

                // Anonymization for non-admins
                const displaySessionId = isAdminUser ? session.id : maskData(session.id);
                const addonVersion = process.env.ADDON_VERSION || 'Unknown';
                const integrationVersion = process.env.INTEGRATION_VERSION || 'Unknown';
                const haVersions = await fetchHAVersions();

                let statusText =
                  '📊 *WhatsApp Integration Status*\n\n' +
                  `• *HA App Version:* ${addonVersion} (https://github.com/FaserF/hassio-addons)\n` +
                  `• *Integration Version:* ${integrationVersion} (https://github.com/FaserF/ha-whatsapp)\n` +
                  `• *HA Core Version:* ${haVersions.core}\n` +
                  `• *HA OS Version:* ${haVersions.os}\n` +
                  `• *Uptime:* ${uptimeStr}\n` +
                  `• *Session:* ${displaySessionId}\n` +
                  `• *Connected:* ${session.isConnected ? '✅' : '❌'}\n\n` +
                  '*Message Statistics:*\n' +
                  `• Sent: ${session.stats.sent}\n` +
                  `• Received: ${session.stats.received}\n` +
                  `• Failed: ${session.stats.failed}\n\n`;

                if (!isAdminUser) {
                  statusText += '💡 *Tip:* Send `ha-app-help` for a list of all commands.\n\n';
                }

                statusText +=
                  '📑 *Support:*\n' +
                  '• Docs: https://faserf.github.io/ha-whatsapp/\n' +
                  '• Issues: https://github.com/FaserF/ha-whatsapp/issues';

                await reply(session, sender, { text: statusText });
                continue;
              }

              // Permission check for all other commands
              if (!isAdminUser) {
                if (!session.unauthorizedWarned.has(personJid)) {
                  // Debug logging - masked but informative
                  const rawNum = personJid.split('@')[0].split(':')[0];
                  const normNum = normalizeNumber(rawNum);

                  logger.warn(
                    {
                      personJid: maskData(personJid),
                      sender: maskData(sender),
                      last4Digits: rawNum.slice(-4),
                      normalizedValue: normNum.slice(-4),
                      adminListCount: ADMIN_NUMBERS.length,
                    },
                    '[SECURITY] Unauthorized command attempt details'
                  );

                  await reply(session, sender, {
                    text: '⛔ *Permission Denied*\nYour number is not in the admin whitelist. This attempt has been logged.',
                  });
                  session.unauthorizedWarned.add(personJid);
                  addLog(
                    session,
                    `Unauthorized command attempt from ${maskData(personJid)}`,
                    'warning'
                  );
                }
                continue;
              }

              if (body === 'ha-app-help') {
                const helpText =
                  '📖 *HA WhatsApp Control Help*\n\n' +
                  'Available commands:\n\n' +
                  '• `ha-app-status`: Full system status report (Public)\n' +
                  '• `ha-app-ping`: Basic connectivity check (Public)\n' +
                  '• `ha-app-getid`: Show current Chat ID (Public)\n' +
                  '• `ha-app-sponsor`: Support this project (Public)\n' +
                  '• `ha-app-help`: This help message\n' +
                  '• `ha-app-welcome`: Show role & welcome info\n' +
                  '• `ha-app-diagnose`: Run full message type diagnostic\n' +
                  '• `ha-app-restart`: Restart the WhatsApp connection\n' +
                  '• `ha-app-logs`: View the latest 10 connection events\n' +
                  '• `ha-app-stats [range]`: View message statistics\n' +
                  '  _Examples: ha-app-stats 24h, ha-app-stats 7d_\n\n' +
                  '🔗 *Docs:* https://faserf.github.io/ha-whatsapp/';
                await reply(session, sender, { text: helpText });
              } else if (body === 'ha-app-welcome') {
                await sendWelcomeMessage(session, sender);
              } else if (body === 'ha-app-diagnose') {
                await runDiagnostic(session, sender);
              } else if (body === 'ha-app-restart') {
                await reply(session, sender, {
                  text: '🔄 *Restarting...*\nThe connection will be reset in 2 seconds.',
                });
                addLog(session, `Admin ${maskData(sender)} requested restart`, 'warning');
                setTimeout(() => {
                  session.sock.end(new Error('Admin requested restart'));
                }, 2000);
              } else if (body === 'ha-app-logs') {
                const logs = session.connectionLogs.slice(0, 10);
                if (logs.length === 0) {
                  await reply(session, sender, {
                    text: '📜 *Logs:* No events recorded yet.',
                  });
                } else {
                  const logText = logs
                    .map((l) => `[${l.timestamp}] ${l.msg}`)
                    .reverse()
                    .join('\n');
                  await reply(session, sender, {
                    text: `📜 *Recent Connection Events:*\n\n${logText}`,
                  });
                }
              } else if (body.startsWith('ha-app-stats')) {
                const range = body.replace('ha-app-stats', '').trim() || 'all-time';
                const statsText =
                  `📈 *Message Statistics (${range})*\n\n` +
                  `• Sent: ${session.stats.sent}\n` +
                  `• Received: ${session.stats.received}\n` +
                  `• Failed: ${session.stats.failed}\n\n` +
                  '_(Note: Hourly/Daily filtering is currently being calculated based on current session life)_';
                await reply(session, sender, { text: statsText });
              } else {
                // Unknown command fallback for admins
                await reply(session, sender, {
                  text: `❓ *Unknown Command: ${body}*\n\nSend \`ha-app-help\` to see a list of all available control commands.`,
                });
              }
            }
          } catch (cmdErr) {
            logger.error(
              { error: cmdErr.message, sessionId: session.id },
              'Failed to process command'
            );
          }
        }
      }
    }
  });
}

// --- API Endpoints ---

// POST /session/start
app.post('/session/start', (req, res) => {
  const session = getReqSession(req);
  addLog(session, `Received Session Start request (session: ${session.id})`, 'info');
  if (session.isConnected) {
    return res.json({ status: 'connected', message: 'Already connected' });
  }
  if (session.sock && !session.sock.ws?.isClosed) {
    return res.json({
      status: 'scanning',
      message: 'Session negotiation in progress',
    });
  }

  signalInterest(session.id);
  res.json({ status: 'starting', message: 'Session init started' });
});

// DELETE /session
app.delete('/session', async (req, res) => {
  const session = getReqSession(req);
  addLog(session, 'Received Logout/Reset request', 'warning');
  logger.info({ sessionId: session.id }, 'Received DELETE /session request (Logout)');
  try {
    if (session.sock) {
      await Promise.race([
        session.sock.logout(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Logout timeout')), 5000)),
      ]).catch((e) =>
        logger.warn({ error: e.message, sessionId: session.id }, 'Logout failed or timed out')
      );

      session.sock.end(undefined);
      session.sock = undefined;
    }

    const sessionAuthDir = getAuthDir(session.id);
    if (fs.existsSync(sessionAuthDir)) {
      fs.rmSync(sessionAuthDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sessionAuthDir, { recursive: true });

    session.isConnected = false;
    session.currentQR = null;
    session.eventQueue = [];
    session.connectionLogs = [];
    session.messageStore.clear();
    session.stats = {
      sent: 0,
      received: 0,
      failed: 0,
      last_sent_message: 'None',
      last_sent_target: 'None',
      last_received_message: 'None',
      last_received_sender: 'None',
      last_failed_message: 'None',
      last_failed_target: 'None',
      last_error_reason: 'None',
      last_sent_time: null,
      last_received_time: null,
      last_failed_time: null,
      start_time: Date.now(),
      my_number: 'Unknown',
      version: BAILEYS_VERSION,
    };

    addLog(session, 'Session data cleared. Ready for new pair.', 'success');
    res.json({ status: 'success', message: 'Session deleted and logged out' });
  } catch (e) {
    addLog(session, `Logout failed: ${e.toString()}`, 'error');
    logger.error({ error: e.message, sessionId: session.id }, 'Error during session delete');
    res.status(500).json({ error: e.toString() });
  }
});

// GET /qr
app.get('/qr', (req, res) => {
  const session = getReqSession(req);
  signalInterest(session.id); // Active interest from config flow
  if (session.isConnected) {
    return res.json({ status: 'connected', qr: null });
  }
  if (session.currentQR) {
    return res.json({ status: 'scanning', qr: session.currentQR });
  }
  return res.json({ status: 'waiting', detail: 'QR generation in progress' });
});

// GET /status
app.get('/status', (req, res) => {
  const session = getReqSession(req);
  res.json({
    connected: session.isConnected,
    version: BAILEYS_VERSION,
    session_id: session.id,
    disconnect_reason: session.isConnected ? null : session.disconnectReason,
  });
});

// GET /events (Polling)
app.get('/events', (req, res) => {
  const session = getReqSession(req);
  const events = [...session.eventQueue];
  session.eventQueue = [];
  res.json(events);
});

// GET /logs
app.get('/logs', (req, res) => {
  const session = getReqSession(req);
  res.json(session.connectionLogs);
});

// GET /stats
app.get('/stats', (req, res) => {
  const session = getReqSession(req);
  res.json({
    ...session.stats,
    uptime: Math.floor((Date.now() - session.stats.start_time) / 1000),
  });
});

// POST /send_message
app.post('/send_message', async (req, res) => {
  const session = getReqSession(req);
  const { number, message, quotedMessageId } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  const quoted = getQuotedMessage(session, quotedMessageId);

  try {
    const jid = getJid(number);
    logger.debug(
      {
        input: maskData(number),
        jid: maskData(jid),
        socketExists: !!session.sock,
        isConnected: session.isConnected,
        sessionId: session.id,
      },
      '[SendMessage] Processing request'
    );

    if (!session.sock) {
      throw new Error('Socket not initialized');
    }

    // Try to wake up connection with presence update
    await session.sock.sendPresenceUpdate('composing', jid);
    await delay(250);

    const { expiration } = req.body;

    const sentMsg = await Promise.race([
      session.sock.sendMessage(jid, { text: message }, { quoted, ephemeralExpiration: expiration }),
      new Promise((_, reject) =>
        setTimeout(() => {
          logger.error(
            { target: maskData(number), sessionId: session.id },
            'Send message timeout reached. Triggering forced reconnect.'
          );
          // Force close the socket to trigger a reconnect if Baileys is deadlocked
          session.sock.end(
            new Error(`Send message timeout (${SEND_MESSAGE_TIMEOUT}ms) - Connection stale`)
          );
          reject(
            new Error(
              `Send message timeout (${SEND_MESSAGE_TIMEOUT}ms) - Connection stale, reconnecting...`
            )
          );
        }, SEND_MESSAGE_TIMEOUT)
      ),
    ]);
    session.stats.sent += 1;
    session.stats.last_sent_message = maskData(message);
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    trackSent(session, number, message);
    res.json({ status: 'sent', id: sentMsg.key.id });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = maskData(message);
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send message: ${e.message}`, 'error');
    trackFailure(session, number, message, e.message);
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_image
app.post('/send_image', async (req, res) => {
  const session = getReqSession(req);
  const { number, url, caption, quotedMessageId, expiration } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  const quoted = getQuotedMessage(session, quotedMessageId);

  try {
    const jid = getJid(number);
    const sentMsg = await session.sock.sendMessage(
      jid,
      {
        image: { url: url },
        caption: caption,
      },
      { quoted, ephemeralExpiration: expiration }
    );
    session.stats.sent += 1;
    session.stats.last_sent_message = 'Image';
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    trackSent(session, number, caption ? `Image: ${caption}` : 'Image');
    res.json({ status: 'sent', id: sentMsg.key.id });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = caption ? `Image: ${maskData(caption)}` : 'Image';
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send image: ${e.message}`, 'error');
    trackFailure(session, number, caption ? `Image: ${caption}` : 'Image', e.message);
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_poll
app.post('/send_poll', async (req, res) => {
  const session = getReqSession(req);
  const { number, question, options, quotedMessageId, expiration } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  const quoted = getQuotedMessage(session, quotedMessageId);

  try {
    const jid = getJid(number);
    const sentMsg = await session.sock.sendMessage(
      jid,
      {
        poll: {
          name: question,
          values: options,
          selectableCount: 1,
        },
      },
      { quoted, ephemeralExpiration: expiration }
    );
    session.stats.sent += 1;
    session.stats.last_sent_message = `Poll: ${question}`;
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    trackSent(session, number, `Poll: ${question}`);
    res.json({ status: 'sent', id: sentMsg.key.id });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Poll: ${maskData(question)}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send poll: ${e.message}`, 'error');
    trackFailure(session, number, `Poll: ${question}`, e.message);
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_location
app.post('/send_location', async (req, res) => {
  const session = getReqSession(req);
  const { number, latitude, longitude, title, description, quotedMessageId, expiration } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  const quoted = getQuotedMessage(session, quotedMessageId);

  try {
    const jid = getJid(number);
    const sentMsg = await session.sock.sendMessage(
      jid,
      {
        location: {
          degreesLatitude: latitude,
          degreesLongitude: longitude,
          name: title,
          address: description,
        },
      },
      { quoted, ephemeralExpiration: expiration }
    );
    session.stats.sent += 1;
    session.stats.last_sent_message = `Location: ${title || 'Pinned'}`;
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    trackSent(session, number, `Location: ${title || 'Pinned'}`);
    res.json({ status: 'sent', id: sentMsg.key.id });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Location: ${maskData(title) || 'Pinned'}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send location: ${e.message}`, 'error');
    trackFailure(session, number, `Location: ${title || 'Pinned'}`, e.message);
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_reaction
app.post('/send_reaction', async (req, res) => {
  const session = getReqSession(req);
  const { number, reaction, messageId } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    const sentMsg = await session.sock.sendMessage(jid, {
      react: {
        text: reaction,
        key: {
          remoteJid: jid,
          fromMe: false,
          id: messageId,
        },
      },
    });
    res.json({ status: 'sent', id: sentMsg.key.id });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Reaction: ${maskData(reaction)}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send reaction: ${e.message}`, 'error');
    trackFailure(session, number, `Reaction: ${reaction}`, e.message);
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_buttons
app.post('/send_buttons', async (req, res) => {
  const session = getReqSession(req);
  const { number, message, buttons, footer, quotedMessageId, expiration } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  const quoted = getQuotedMessage(session, quotedMessageId);

  try {
    const jid = getJid(number);
    const formattedButtons = (buttons || []).map((b) => ({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: b.displayText || b.text || 'Button',
        id: b.id || b.buttonId || String(Math.random()),
      }),
    }));

    const messageId = generateMessageID();

    await session.sock.relayMessage(
      jid,
      {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              header: {
                title: '',
                hasMediaAttachment: false,
              },
              body: { text: message },
              footer: { text: footer || '' },
              nativeFlowMessage: {
                buttons: formattedButtons,
              },
            },
          },
        },
      },
      { messageId, quoted, ephemeralExpiration: expiration }
    );
    session.stats.sent += 1;
    session.stats.last_sent_message = `Buttons: ${message}`;
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    trackSent(session, number, `Buttons: ${message}`);
    res.json({ status: 'sent', id: messageId });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Buttons: ${maskData(message)}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send buttons: ${e.message}`, 'error');
    trackFailure(session, number, `Buttons: ${message}`, e.message);
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_document
app.post('/send_document', async (req, res) => {
  const session = getReqSession(req);
  const { number, url, fileName, caption, quotedMessageId, expiration } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  const quoted = getQuotedMessage(session, quotedMessageId);

  try {
    const jid = getJid(number);
    const sentMsg = await session.sock.sendMessage(
      jid,
      {
        document: { url: url },
        fileName: fileName,
        caption: caption,
        mimetype: 'application/octet-stream',
      },
      { quoted, ephemeralExpiration: expiration }
    );
    session.stats.sent += 1;
    session.stats.last_sent_message = `Document: ${fileName || 'unnamed'}`;
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    trackSent(session, number, `Document: ${fileName || 'unnamed'}`);
    res.json({ status: 'sent', id: sentMsg.key.id });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Document: ${maskData(fileName) || 'unnamed'}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send document: ${e.message}`, 'error');
    trackFailure(session, number, `Document: ${fileName || 'unnamed'}`, e.message);
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_video
app.post('/send_video', async (req, res) => {
  const session = getReqSession(req);
  const { number, url, caption, quotedMessageId, expiration } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  const quoted = getQuotedMessage(session, quotedMessageId);

  try {
    const jid = getJid(number);
    const sentMsg = await session.sock.sendMessage(
      jid,
      {
        video: { url: url },
        caption: caption,
      },
      { quoted, ephemeralExpiration: expiration }
    );
    session.stats.sent += 1;
    session.stats.last_sent_message = caption ? `Video: ${maskData(caption)}` : 'Video';
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    trackSent(session, number, caption ? `Video: ${caption}` : 'Video');
    res.json({ status: 'sent', id: sentMsg.key.id });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = caption ? `Video: ${maskData(caption)}` : 'Video';
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send video: ${e.message}`, 'error');
    trackFailure(session, number, caption ? `Video: ${caption}` : 'Video', e.message);
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_audio
app.post('/send_audio', async (req, res) => {
  const session = getReqSession(req);
  const { number, url, ptt, quotedMessageId, expiration } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  const quoted = getQuotedMessage(session, quotedMessageId);

  try {
    const jid = getJid(number);
    await session.sock.sendMessage(
      jid,
      {
        audio: { url: url },
        ptt: !!ptt,
        mimetype: 'audio/mp4',
      },
      { quoted, ephemeralExpiration: expiration }
    );
    session.stats.sent += 1;
    session.stats.last_sent_message = ptt ? 'Voice Note' : 'Audio';
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    trackSent(session, number, ptt ? 'Voice Note' : 'Audio');
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = ptt ? 'Voice Note' : 'Audio';
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send audio: ${e.message}`, 'error');
    trackFailure(session, number, ptt ? 'Voice Note' : 'Audio', e.message);
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /revoke_message
app.post('/revoke_message', async (req, res) => {
  const session = getReqSession(req);
  const { number, message_id, fromMe } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    const key = {
      remoteJid: jid,
      fromMe: fromMe !== undefined ? Boolean(fromMe) : true,
      id: message_id,
    };

    await session.sock.sendMessage(jid, { delete: key });

    session.stats.sent += 1;
    session.stats.last_sent_message = `Revoke: ${message_id}`;
    session.stats.last_sent_target = maskData(number);
    trackSent(session, number, `Revoke: ${message_id}`);
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Revoke: ${message_id}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to revoke message: ${e.message}`, 'error');
    trackFailure(session, number, `Revoke: ${message_id}`, e.message);
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /edit_message
app.post('/edit_message', async (req, res) => {
  const session = getReqSession(req);
  const { number, message_id, new_content } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    const key = {
      remoteJid: jid,
      fromMe: true,
      id: message_id,
    };

    await session.sock.sendMessage(jid, {
      text: new_content,
      edit: key,
    });

    session.stats.sent += 1;
    session.stats.last_sent_message = `Edit: ${message_id}`;
    session.stats.last_sent_target = maskData(number);
    trackSent(session, number, `Edit: ${message_id}`);
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Edit: ${message_id}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to edit message: ${e.message}`, 'error');
    trackFailure(session, number, `Edit: ${message_id}`, e.message);
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /set_presence
app.post('/set_presence', async (req, res) => {
  const session = getReqSession(req);
  const { number, presence } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    await session.sock.sendPresenceUpdate(presence, jid);
    res.json({ status: 'sent' });
  } catch (e) {
    addLog(session, `Failed to set presence: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// GET /groups
app.get('/groups', async (req, res) => {
  const session = getReqSession(req);
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    if (!session.sock) throw new Error('Socket not initialized');

    const groups = await session.sock.groupFetchAllParticipating();
    const result = Object.values(groups).map((g) => ({
      id: g.id,
      name: g.subject,
      participants: g.participants.length,
    }));

    res.json(result);
  } catch (e) {
    logger.error({ error: e.message, sessionId: session.id }, 'Failed to fetch groups');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /mark_as_read
app.post('/mark_as_read', async (req, res) => {
  const session = getReqSession(req);
  const { number, messageId } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);

    if (messageId) {
      await session.sock.readMessages([
        {
          remoteJid: jid,
          id: messageId,
          fromMe: false,
        },
      ]);
    } else {
      await session.sock.chatModify({ markRead: true, lastMessages: [] }, jid);
    }
    res.json({ status: 'success' });
  } catch (e) {
    addLog(session, `Failed to mark read: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'whatsapp-homeassistant-app' });
});

// --- API / Internal Dashboard Data ---
app.get('/api/dashboard', (req, res) => {
  const sessionId = req.query.session_id || 'default';
  const session = getSession(sessionId);

  // If dashboard is being polled, someone is looking!
  signalInterest(sessionId);

  logger.debug({ sessionId, requestedSessionId: sessionId }, 'Dashboard API request');

  if (session.stats.sent > 0 || session.stats.received > 0) {
    logger.debug({ sessionId, stats: session.stats }, '📊 Session has activity');
  }

  const sessionList = Array.from(sessions.keys()).map((sid) => {
    const s = sessions.get(sid);
    return {
      id: sid,
      connected: s.isConnected,
      number: s.stats?.my_number || 'Unknown',
    };
  });

  const uptimeStr = session.stats?.start_time
    ? new Date(Date.now() - session.stats.start_time).toISOString().substr(11, 8)
    : 'N/A';

  res.json({
    sessionId: session.id,
    isConnected: session.isConnected,
    currentQR: session.currentQR,
    disconnectReason: session.disconnectReason,
    reconnectAttempts: session.reconnectAttempts,
    stats: session.stats || { sent: 0, received: 0, failed: 0 },
    uptime: uptimeStr,
    sessionList: sessionList,
    recentLogs: (session.connectionLogs || []).slice(0, 10),
    recentSent: (session.recentSent || []).slice(0, 5),
    recentReceived: (session.recentReceived || []).slice(0, 5),
    recentFailures: (session.recentFailures || []).slice(0, 5),
    nodeVersion: process.version,
    addonVersion: process.env.ADDON_VERSION || '1.0.0',
    integrationVersion: process.env.INTEGRATION_VERSION || 'Unknown',
    baileysVersion: BAILEYS_VERSION,
    webhookEnabled: WEBHOOK_ENABLED,
    webhookUrl: WEBHOOK_URL,
    deviceInfo: session.deviceInfo || {},
  });
});

// --- API / Quick Actions ---
app.post('/api/session/restart', uiAuthMiddleware, (req, res) => {
  const sessionId = req.body.session_id || 'default';
  const session = getSession(sessionId);
  addLog(session, 'User requested session restart via Dashboard', 'warning');
  if (session.sock) {
    session.sock.end(new Error('User requested restart'));
  } else {
    connectToWhatsApp(sessionId);
  }
  res.json({ status: 'success' });
});

app.post('/api/logs/clear', uiAuthMiddleware, (req, res) => {
  const sessionId = req.body.session_id || 'default';
  const session = getSession(sessionId);
  session.connectionLogs = [];
  addLog(session, 'Logs cleared by user', 'info');
  res.json({ status: 'success' });
});

// --- API / Debug Download ---
app.get('/api/debug/download', (req, res) => {
  const sessionId = req.query.session_id || 'default';
  const session = getSession(sessionId);

  const debugInfo = {
    timestamp: new Date().toISOString(),
    system: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      addon_version: process.env.ADDON_VERSION || '1.0.0',
      integration_version: process.env.INTEGRATION_VERSION || 'Unknown',
      baileys_version: BAILEYS_VERSION,
      is_edge:
        (process.env.ADDON_VERSION || '').toLowerCase().includes('edge') ||
        (process.env.ADDON_VERSION || '').toLowerCase().includes('dev') ||
        (process.env.INTEGRATION_VERSION || '').toLowerCase().includes('dev') ||
        (process.env.INTEGRATION_VERSION || '').toLowerCase().includes('beta'),
    },
    config: {
      port: PORT,
      ui_auth_enabled: UI_AUTH_ENABLED,
      webhook_enabled: WEBHOOK_ENABLED,
      mask_sensitive_data: MASK_SENSITIVE_DATA,
    },
    session: {
      id: session.id,
      connected: session.isConnected,
      reconnect_attempts: session.reconnectAttempts,
      uptime: session.stats?.start_time
        ? Math.floor((Date.now() - session.stats.start_time) / 1000)
        : 0,
    },
    stats: session.stats,
    logs: (session.connectionLogs || []).map((l) => ({
      ...l,
      msg: l.msg
        .replace(API_TOKEN, '[REDACTED - See Ingress UI Home Assistant Setup card for the key]')
        .replace(WEBHOOK_TOKEN, '[REDACTED]'),
    })),
  };

  res.setHeader('Content-disposition', `attachment; filename=whatsapp-debug-${sessionId}.json`);
  res.setHeader('Content-type', 'application/json');
  res.write(JSON.stringify(debugInfo, null, 2));
  res.end();
});

// --- Dashboard (Server-Side Rendered) ---
app.get('/', uiAuthMiddleware, (req, res) => {
  const sessionId = req.query.session_id || 'default';
  res.send(renderDashboard(sessionId));
});

// Catch-all for other UI routes/tabs to support single-page app behavior
app.get(
  /^(?!\/(api|qr|status|events|logs|health|media|session\/start)).+/,
  uiAuthMiddleware,
  (req, res) => {
    // If it looks like an API call but wasn't caught (e.g. missing trailing slash or prefix issue),
    // don't serve the dashboard HTML.
    if (req.path.includes('/api/')) {
      logger.warn(
        { path: req.path, url: req.url, headers: req.headers },
        'Catch-all hit for API path - check Ingress prefixing'
      );
      return res.status(404).json({ error: 'API route not found' });
    }
    const sessionId = req.query.session_id || 'default';
    res.send(renderDashboard(sessionId));
  }
);

function renderDashboard(sessionId) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>WhatsApp Homeassistant App</title>
        <style>
            :root {
                --primary: #00a884;
                --primary-dark: #008f6f;
                --bg: #f0f2f5;
                --card-bg: #ffffff;
                --text: #111b21;
                --text-secondary: #667781;
                --danger: #ea0038;
                --warning: #ffbc00;
                --success: #d9fdd3;
                --border: #e9edef;
                --sidebar-bg: #111b21;
                --sidebar-text: #ffffff;
            }
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); margin: 0; display: flex; min-height: 100vh; font-size: 14px; }

            .sidebar { width: 280px; background: var(--sidebar-bg); color: var(--sidebar-text); padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; transition: all 0.3s; }
            .sidebar h1 { font-size: 1.8rem; line-height: 1.2; margin: 0; color: var(--primary); }
            .sidebar-links { display: flex; flex-direction: column; gap: 10px; margin-top: 1rem; }
            .sidebar-link { color: #8696a0; text-decoration: none; padding: 10px; border-radius: 8px; transition: all 0.2s; display: flex; align-items: center; gap: 10px; border: 1px solid transparent; font-size: 0.95rem; }
            .sidebar-link:hover { background: #202c33; color: #fff; border-color: #313d45; }

            .main-content { flex: 1; padding: 2rem; overflow-y: auto; width: 100%; display: flex; flex-direction: column; gap: 2rem; }

            .warning-banner {
                background: #fff3cd;
                border: 1px solid #ffeeba;
                color: #856404;
                padding: 12px 20px;
                border-radius: 8px;
                margin-bottom: 5px;
                display: none;
                align-items: center;
                gap: 15px;
                font-weight: 500;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            .warning-banner b { color: #533f03; }
            .dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
            .session-switcher { display: flex; align-items: center; gap: 10px; background: var(--card-bg); padding: 8px 16px; border-radius: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
            select { border: none; background: none; font-weight: 600; color: var(--text); cursor: pointer; outline: none; font-size: 0.9rem; }

            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; }
            .card { background: var(--card-bg); border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 1rem; }
            .card-title { font-weight: 700; font-size: 1.1rem; color: var(--text); display: flex; align-items: center; gap: 10px; }

            .status-section { display: flex; flex-direction: column; align-items: center; text-align: center; width: 100%; }
            .status-badge { padding: 10px 20px; border-radius: 30px; font-weight: 700; font-size: 1.1rem; margin: 10px 0; letter-spacing: 0.5px; width: fit-content; }
            .status-badge.connected { background: var(--success); color: var(--primary-dark); }
            .status-badge.disconnected { background: #fee; color: var(--danger); }
            .status-badge.waiting { background: #fff8c5; color: #9a6700; }

            .stats-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; text-align: center; margin-top: 10px; }
            .stat-box { background: var(--bg); padding: 10px; border-radius: 12px; }
            .stat-val { font-weight: 800; font-size: 1.2rem; color: var(--primary); }
            .stat-label { font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-top: 4px; }

            .qr-container { background: #fff; border: 2px dashed var(--border); border-radius: 12px; padding: 20px; text-align: center; }
            .qr-code { max-width: 100%; height: auto; border-radius: 8px; }

            .history-list { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
            .history-item { background: var(--bg); padding: 10px; border-radius: 10px; position: relative; word-wrap: break-word; }
            .history-item.failure { border-left: 4px solid var(--danger); }
            .history-time { font-size: 0.7rem; color: var(--text-secondary); display: block; }
            .history-target, .history-sender { font-weight: 700; font-size: 0.85rem; margin: 4px 0; display: block; }
            .history-msg { font-size: 0.9rem; color: #111b21; white-space: pre-wrap; word-break: break-all; }
            .history-reason { color: var(--danger); font-size: 0.75rem; margin-top: 5px; font-style: italic; }
            .empty-state { color: var(--text-secondary); font-style: italic; text-align: center; padding: 20px; }

            .details-box { background: #f8f9fa; border: 1px solid var(--border); border-radius: 10px; padding: 12px; font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 0.85rem; }
            code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; word-break: break-all; text-decoration: none; }

            .logs-view { background: #111b21; color: #00ff41; padding: 15px; border-radius: 10px; font-family: monospace; font-size: 0.75rem; max-height: 250px; overflow-y: auto; }
            .log-entry { margin-bottom: 4px; border-bottom: 1px solid #202c33; padding-bottom: 2px; }

            .footer-info { margin-top: 2rem; color: var(--text-secondary); font-size: 0.75rem; text-align: center; border-top: 1px solid var(--border); padding-top: 1rem; width: 100%; }

            .highlight-token { background: #fff8c5; color: #9a6700; padding: 4px 8px; border-radius: 6px; font-weight: 700; border: 1px solid #d4a017; user-select: all; text-decoration: none; }
            .btn { cursor: pointer; padding: 10px 16px; border-radius: 8px; border: none; font-weight: 600; transition: transform 0.1s, background 0.2s; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.9rem; min-height: 44px; }
            .btn:active { transform: scale(0.98); }
            .btn-primary { background: var(--primary); color: white; }
            .btn-primary:hover { background: var(--primary-dark); }
            .btn-secondary { background: #e9edef; color: var(--text); }
            .btn-secondary:hover { background: #d1d7db; }
            .btn-danger { background: #fee; color: var(--danger); }
            .btn-danger:hover { background: #fdd; }

            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .info-item { display: flex; flex-direction: column; }
            .info-label { font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; }
            .info-value { font-weight: 600; font-size: 0.9rem; }

            @media (max-width: 768px) {
                body { flex-direction: column; }
                .sidebar { width: 100%; padding: 1rem; border-bottom: 1px solid #202c33; height: auto; }
                .main-content { padding: 1.5rem; }
                .grid { grid-template-columns: 1fr; }
                .dashboard-header { flex-direction: column; align-items: flex-start; }
            }

            @media (max-width: 480px) {
                .main-content { padding: 1rem; }
                .card { padding: 1rem; }
                .stats-row { grid-template-columns: 1fr 1fr; }
                .info-grid { grid-template-columns: 1fr; }
            }
        </style>
    </head>
    <body>
        <div class="sidebar">
            <h1 id="ui-title">WhatsApp<br><span style="color: var(--sidebar-text); opacity: 0.8; font-size: 1.4rem;">HA-App</span></h1>
            <div class="sidebar-links">
                <a href="https://faserf.github.io/ha-whatsapp/" target="_blank" class="sidebar-link">📖 Documentation</a>
                <a href="https://github.com/FaserF/ha-whatsapp" target="_blank" class="sidebar-link">🧩 Integration Repo</a>
                <a href="https://github.com/FaserF/hassio-addons" target="_blank" class="sidebar-link">📦 HA App Repo</a>
                <a href="logs" target="_blank" class="sidebar-link">📄 Raw Backend Logs</a>
            </div>

            <div style="margin-top: auto; padding-top: 1rem;">
                <div class="stat-label">System Info</div>
                <div style="font-size: 0.8rem; color: #8696a0;">
                    Node: <span id="node-version">...</span><br>
                    HA App: <span id="addon-version-sidebar" style="color: var(--primary);">...</span><br>
                    Integration: <span id="int-version-sidebar" style="color: var(--primary);">...</span><br>
                    Baileys: <span id="baileys-version">...</span>
                </div>
            </div>
        </div>

        <div class="main-content">
            <div id="dev-banner" class="warning-banner">
                <span style="font-size: 1.5rem;">⚠️</span>
                <div>
                    <b>Experimental Version Active</b><br>
                    <span style="font-size: 0.85rem; opacity: 0.9;">You are running a development, edge, or beta version. Features may be unstable.</span>
                </div>
            </div>
            <div class="dashboard-header">
                <h2 style="margin:0;">Dashboard Overview</h2>
                <div class="session-switcher">
                    <span>Session:</span>
                    <select id="session-select" onchange="switchSession(this.value)">
                        <!-- Populated dynamically -->
                    </select>
                </div>
            </div>

            <div class="grid">
                <!-- Status Card -->
                <div class="card">
                    <div class="card-title">🔌 Connection Status</div>
                    <div class="status-section">
                        <div id="status-badge" class="status-badge disconnected">Initializing...</div>
                        <div id="disconnect-reason" style="color:var(--danger); font-size:0.8rem; margin-bottom: 10px;"></div>
                    </div>

                    <div id="qr-container" class="qr-container" style="display:none;">
                        <span class="stat-label">Scan to Connect</span><br>
                        <img id="qr-code" class="qr-code" src="" alt="QR" />
                    </div>

                    <div id="init-placeholder" class="qr-container">
                        <i style="font-size:2rem; color:var(--text-secondary);">⌛</i><br>
                        <span class="stat-label">Initializing WhatsApp...</span>
                    </div>

                    <div class="stats-row">
                        <div class="stat-box"><div id="stat-sent" class="stat-val">0</div><div class="stat-label">Sent</div></div>
                        <div class="stat-box"><div id="stat-received" class="stat-val">0</div><div class="stat-label">Received</div></div>
                        <div class="stat-box"><div id="stat-failed" class="stat-val">0</div><div class="stat-label">Failed</div></div>
                    </div>
                    <div style="margin-top:10px; text-align:center;">
                        <span class="stat-label">Uptime:</span> <strong id="val-uptime">00:00:00</strong> •
                        <span class="stat-label">Reconnections:</span> <strong id="val-reconnects">0</strong>
                    </div>
                </div>

                <!-- Integration Card -->
                <div class="card">
                    <div class="card-title">🏠 Home Assistant Setup</div>
                    <div class="details-box">
                        <span class="stat-label">Addon Host (Auto-detected)</span><br>
                        <code>http://${os.hostname()}:${PORT}</code><br><br>

                        <span class="stat-label">API Token</span><br>
                        <code class="highlight-token" title="Click to select all">${API_TOKEN}</code><br><br>

                        <span class="stat-label">Static / Internal IP</span><br>
                        <code>http://${os.networkInterfaces().eth0?.[0]?.address || 'localhost'}:${PORT}</code>
                    </div>
                    <p style="font-size:0.75rem; color:var(--text-secondary);">
                        Enter one of the Host URLs in the Home Assistant integration config flow.
                    </p>
                </div>

                <!-- Webhook Status Card -->
                <div class="card">
                    <div class="card-title">🔗 Webhook Configuration</div>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Status</span>
                            <span id="webhook-status" class="info-value">...</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Host</span>
                            <span id="webhook-url" class="info-value">...</span>
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                        Webhook token is active and hidden for security.
                    </div>
                </div>

                <!-- Device Information Card -->
                <div class="card" id="device-card">
                    <div class="card-title">📱 Connected Device</div>
                    <div id="device-info-grid" class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Model</span>
                            <span id="device-model" class="info-value">...</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Platform</span>
                            <span id="device-platform" class="info-value">...</span>
                        </div>
                    </div>
                    <div id="no-device-msg" class="empty-state" style="display:none;">
                        Connect a device to see details.
                    </div>
                </div>

                <!-- Quick Actions Card -->
                <div class="card">
                    <div class="card-title">⚡ Quick Actions</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button class="btn btn-secondary" onclick="restartSession()">
                            🔄 Restart
                        </button>
                        <button class="btn btn-danger" onclick="clearLogs()">
                            🧹 Clear Logs
                        </button>
                    </div>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">
                        Restarting will attempt a fresh connection without deleting credentials.
                    </p>
                </div>

                <!-- Bug Report Widget -->
                <div class="card">
                    <div class="card-title">🐛 Integration Bug Report</div>
                    <p style="font-size:0.85rem; color:var(--text-secondary);">
                        Encountered an issue? Download an anonymized debug bundle and report it on GitHub.
                    </p>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button class="btn btn-primary" onclick="downloadDebugInfo()">
                            📥 Download Issue Debug Info
                        </button>
                        <a href="https://github.com/FaserF/ha-whatsapp/issues/new" target="_blank" class="btn btn-secondary">
                            🔗 Open GitHub Issue
                        </a>
                    </div>
                </div>

                <!-- System Diagnostics -->
                <div class="card" id="card-diagnostics" style="display:none; border: 2px solid var(--warning); background: #fffcf0; grid-column: 1 / -1; order: 999;">
                    <div class="card-title">🔍 System Diagnostics</div>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Base Path</span>
                            <span id="diag-basepath" class="info-value" style="word-break: break-all; font-family: monospace;">...</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Actual URL</span>
                            <span id="diag-pathname" class="info-value" style="word-break: break-all; font-family: monospace;">...</span>
                        </div>
                    </div>
                    <p style="font-size:0.75rem; color:var(--text-secondary); margin:0;">
                      If you see 404 errors, please report these paths on GitHub.
                    </p>
                </div>

                <!-- Recent Sent -->
                <div class="card">
                    <div class="card-title">📤 Recent Outbound</div>
                    <div id="list-sent" class="history-list">
                        <div class="empty-state">Loading...</div>
                    </div>
                </div>

                <!-- Recent Received -->
                <div class="card">
                    <div class="card-title">📥 Recent Inbound</div>
                    <div id="list-received" class="history-list">
                        <div class="empty-state">Loading...</div>
                    </div>
                </div>

                <!-- Recent Failures -->
                <div class="card">
                    <div class="card-title">⚠️ Failed Actions</div>
                    <div id="list-failures" class="history-list">
                        <div class="empty-state">Loading...</div>
                    </div>
                </div>

                <!-- Live Logs -->
                <div class="card" style="grid-column: 1 / -1;">
                    <div class="card-title">📜 Connection Events</div>
                    <div id="list-logs" class="logs-view">
                        <div class="log-entry">Loading events...</div>
                    </div>
                </div>
            </div>
            <div class="footer-info">
                 WhatsApp Homeassistant App Dashboard • Real-time Monitoring • HA App: <span id="footer-addon-version">...</span> • Integration: <span id="footer-int-version">...</span>
            </div>
        </div>

        <script>
            let currentSession = ${JSON.stringify(sessionId)};

            // Robust base path detection for Home Assistant Ingress
            const getBasePath = () => {
                try {
                    // This is the cleanest way to get the folder path
                    const path = window.location.pathname;
                    const folder = path.substring(0, path.lastIndexOf('/') + 1);
                    return folder || '/';
                } catch (e) {
                    return '/';
                }
            };
            const basePath = getBasePath().replace(/[/]+/g, '/');
            console.log('Detected Base Path:', basePath);

            document.getElementById('diag-basepath').textContent = basePath;
            document.getElementById('diag-pathname').textContent = window.location.pathname;

            function switchSession(id) {
                currentSession = id;
                const url = new URL(window.location);
                url.searchParams.set('session_id', id);
                window.history.replaceState({}, '', url);
                updateDashboard();
            }

            async function downloadDebugInfo() {
                try {
                    const response = await fetch(basePath + 'api/debug/download?session_id=' + currentSession, {
                        headers: { 'Accept': 'application/json' }
                    });
                    if (!response.ok) throw new Error('Download failed');
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = 'whatsapp-debug-' + currentSession + '.json';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                } catch (e) {
                    alert('Failed to download debug info: ' + e.message);
                }
            }

            async function restartSession() {
                if (!confirm('Are you sure you want to restart this session?')) return;
                try {
                    const response = await fetch(basePath + 'api/session/restart', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ session_id: currentSession })
                    });
                    if (response.ok) {
                        alert('Restart command sent successfully.');
                        updateDashboard();
                    }
                } catch (e) {
                    alert('Failed to restart session: ' + e.message);
                }
            }

            async function clearLogs() {
                if (!confirm('Clear all connection logs for this session?')) return;
                try {
                    const response = await fetch(basePath + 'api/logs/clear', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ session_id: currentSession })
                    });
                    if (response.ok) {
                        updateDashboard();
                    }
                } catch (e) {
                    alert('Failed to clear logs: ' + e.message);
                }
            }

            async function updateDashboard() {
                try {
                    const response = await fetch(basePath + 'api/dashboard?session_id=' + currentSession, {
                        headers: { 'Accept': 'application/json' }
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('Update failed:', response.status, errorText);
                        document.getElementById('card-diagnostics').style.display = 'block';
                        // If we are getting 403 or 401, maybe show something helpful?
                        if (response.status === 403) {
                            document.getElementById('status-badge').textContent = 'Access Blocked (403) ⛔';
                        } else {
                            document.getElementById('status-badge').textContent = 'API Error (' + response.status + ') ⚠️';
                        }
                        throw new Error('API request failed with status: ' + response.status);
                    }
                    // Hide diagnostics if it was open from a previous error but now works
                    document.getElementById('card-diagnostics').style.display = 'none';
                    const data = await response.json();

                    // Update Version Info
                    const addonVer = data.addonVersion || 'Unknown';
                    const intVer = data.integrationVersion || 'Unknown';

                    document.getElementById('node-version').textContent = data.nodeVersion;
                    document.getElementById('addon-version-sidebar').textContent = addonVer;
                    document.getElementById('int-version-sidebar').textContent = intVer;
                    document.getElementById('baileys-version').textContent = data.baileysVersion;
                    document.getElementById('footer-addon-version').textContent = addonVer;
                    document.getElementById('footer-int-version').textContent = intVer;

                    // Show Banner if Dev/Beta
                    const isDev = addonVer.toLowerCase().includes('edge') ||
                                  addonVer.toLowerCase().includes('dev') ||
                                  intVer.toLowerCase().includes('dev') ||
                                  intVer.toLowerCase().includes('beta') ||
                                  intVer.toLowerCase().includes('pre');
                    document.getElementById('dev-banner').style.display = isDev ? 'flex' : 'none';

                    // Update Session Switcher
                    const select = document.getElementById('session-select');
                    let options = '';
                    data.sessionList.forEach(s => {
                        const isSelected = s.id === currentSession ? 'selected' : '';
                        const statusIcon = s.connected ? '\u2705' : '\u274C';
                        options += '<option value="' + s.id + '" ' + isSelected + '>' + s.id + ' (' + statusIcon + ')</option>';
                    });
                    select.innerHTML = options;

                    // Update Status Badge
                    const badge = document.getElementById('status-badge');
                    badge.className = 'status-badge ' + (data.isConnected ? 'connected' : (data.currentQR ? 'waiting' : 'disconnected'));
                    badge.textContent = data.isConnected ? 'Connected \u2705' : (data.currentQR ? 'Scan QR Code \uD83D\uDCF1' : (data.disconnectReason === 'logged_out' ? 'Logged Out \uD83D\uDEAB' : 'Disconnected \u274C'));

                    document.getElementById('disconnect-reason').textContent = data.disconnectReason ? 'Reason: ' + data.disconnectReason : '';

                    // QR Code logic
                    const qrContainer = document.getElementById('qr-container');
                    const initPlaceholder = document.getElementById('init-placeholder');
                    if (!data.isConnected && data.currentQR) {
                        qrContainer.style.display = 'block';
                        initPlaceholder.style.display = 'none';
                        document.getElementById('qr-code').src = data.currentQR;
                    } else if (!data.isConnected && !data.currentQR) {
                        qrContainer.style.display = 'none';
                        initPlaceholder.style.display = 'block';
                    } else {
                        qrContainer.style.display = 'none';
                        initPlaceholder.style.display = 'none';
                    }

                    // Webhook Status
                    document.getElementById('webhook-status').textContent = data.webhookEnabled ? 'Enabled ✅' : 'Disabled ❌';
                    document.getElementById('webhook-status').style.color = data.webhookEnabled ? 'var(--primary-dark)' : 'var(--danger)';
                    document.getElementById('webhook-url').textContent = data.webhookUrl || 'Not configured';

                    // Device Info
                    const hasDevice = data.deviceInfo && (data.deviceInfo.manufacturer || data.deviceInfo.model);
                    document.getElementById('device-info-grid').style.display = hasDevice ? 'grid' : 'none';
                    document.getElementById('no-device-msg').style.display = hasDevice ? 'none' : 'block';
                    if (hasDevice) {
                        document.getElementById('device-model').textContent = data.deviceInfo.model || 'N/A';
                        document.getElementById('device-platform').textContent = data.deviceInfo.platform || 'N/A';
                    }

                    // Update Stats
                    document.getElementById('stat-sent').textContent = data.stats.sent;
                    document.getElementById('stat-received').textContent = data.stats.received;
                    document.getElementById('stat-failed').textContent = data.stats.failed;
                    document.getElementById('val-uptime').textContent = data.uptime;
                    document.getElementById('val-reconnects').textContent = data.reconnectAttempts;

                    // Update Lists
                    document.getElementById('list-sent').innerHTML = data.recentSent.length ?
                        data.recentSent.map(m =>
                            '<div class="history-item">' +
                                '<span class="history-time">' + m.timestamp + '</span>' +
                                '<span class="history-target">To: ' + m.target + '</span>' +
                                '<div class="history-msg">' + m.message + '</div>' +
                            '</div>'
                        ).join('') : '<div class="empty-state">No messages sent recently</div>';

                    document.getElementById('list-received').innerHTML = data.recentReceived.length ?
                        data.recentReceived.map(m =>
                            '<div class="history-item">' +
                                '<span class="history-time">' + m.timestamp + '</span>' +
                                '<span class="history-sender">From: ' + m.sender + '</span>' +
                                '<div class="history-msg">' + m.message + '</div>' +
                            '</div>'
                        ).join('') : '<div class="empty-state">No messages received recently</div>';

                    document.getElementById('list-failures').innerHTML = data.recentFailures.length ?
                        data.recentFailures.map(m =>
                            '<div class="history-item failure">' +
                                '<span class="history-time">' + m.timestamp + '</span>' +
                                '<span class="history-target">Target: ' + m.target + '</span>' +
                                '<div class="history-msg">' + m.message + '</div>' +
                                '<div class="history-reason">Error: ' + m.reason + '</div>' +
                            '</div>'
                        ).join('') : '<div class="empty-state">No failures recorded</div>';

                    document.getElementById('list-logs').innerHTML = data.recentLogs.length ?
                        data.recentLogs.map(l =>
                            '<div class="log-entry"><span class="log-time" style="color: #8696a0; margin-right: 8px;">' + l.timestamp + '</span><span class="log-type-' + l.type + '">' + l.msg + '</span></div>'
                        ).join('') : '<div class="log-entry">No logs yet</div>';

                } catch (e) {
                    console.error('Fetch error:', e);
                }
            }

            // Initial load
            updateDashboard();
            // refresh loop
            setInterval(updateDashboard, 5000);
        </script>
    </body>
    </html>
  `;
}

// POST /settings/webhook
app.post('/settings/webhook', authMiddleware, (req, res) => {
  const { url, enabled, token } = req.body;

  if (enabled !== undefined) WEBHOOK_ENABLED = Boolean(enabled);
  if (url !== undefined) WEBHOOK_URL = url;
  if (token !== undefined) WEBHOOK_TOKEN = token;

  const configToSave = {
    enabled: WEBHOOK_ENABLED,
    url: WEBHOOK_URL,
    token: WEBHOOK_TOKEN,
  };

  try {
    fs.writeFileSync(WEBHOOK_CONFIG_FILE, JSON.stringify(configToSave, null, 2));
    logger.info('💾 Webhook configuration updated and saved.');
    // Global webhook settings, but we log to 'default' session for visibility
    addLog(getSession('default'), 'Webhook configuration updated', 'info');
    res.json({ status: 'success', config: configToSave });
  } catch (e) {
    logger.error({ error: e.message }, '❌ Failed to save webhook config');
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// POST /send_list
app.post('/send_list', async (req, res) => {
  const session = getReqSession(req);
  const { number, title, text, footer, button_text, sections, quotedMessageId, expiration } =
    req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  const quoted = getQuotedMessage(session, quotedMessageId);

  try {
    const jid = getJid(number);

    const formattedSections = (sections || []).map((s) => ({
      title: s.title || '',
      rows: (s.rows || []).map((r) => ({
        header: r.title || '',
        title: r.title || '',
        description: r.description || '',
        id: r.id || String(Math.random()),
      })),
    }));

    const messageId = generateMessageID();

    await session.sock.relayMessage(
      jid,
      {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              header: {
                title: title || '',
                hasMediaAttachment: false,
              },
              body: { text: text || 'Menu' },
              footer: { text: footer || '' },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({
                      title: button_text || 'Open Menu',
                      sections: formattedSections,
                    }),
                  },
                ],
              },
            },
          },
        },
      },
      { messageId, quoted, ephemeralExpiration: expiration }
    );

    session.stats.sent += 1;
    session.stats.last_sent_message = `List: ${title || text}`;
    session.stats.last_sent_target = number;
    session.stats.last_sent_time = Date.now();
    trackSent(session, number, `List: ${title || text}`);
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `List: ${title || text}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send list: ${e.message}`, 'error');
    trackFailure(session, number, `List: ${title || text}`, e.message);
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_contact
app.post('/send_contact', async (req, res) => {
  const session = getReqSession(req);
  const { number, contact_name, contact_number, quotedMessageId, expiration } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);

    const vcard =
      'BEGIN:VCARD\n' +
      'VERSION:3.0\n' +
      `FN:${contact_name}\n` +
      `ORG:Home Assistant;\n` +
      `TEL;type=CELL;type=VOICE;waid=${contact_number}:${contact_number}\n` +
      'END:VCARD';

    const quoted = getQuotedMessage(session, quotedMessageId);

    await session.sock.sendMessage(
      jid,
      {
        contacts: {
          displayName: contact_name,
          contacts: [{ vcard }],
        },
      },
      { quoted, ephemeralExpiration: expiration }
    );

    session.stats.sent += 1;
    session.stats.last_sent_message = `Contact: ${contact_name}`;
    session.stats.last_sent_target = number;
    session.stats.last_sent_time = Date.now();
    trackSent(session, number, `Contact: ${contact_name}`);
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Contact: ${contact_name}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send contact: ${e.message}`, 'error');
    trackFailure(session, number, `Contact: ${contact_name}`, e.message);
    res.status(500).json({ detail: e.toString() });
  }
});

// Listen on all interfaces in the container (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, 'WhatsApp API listening');
  logger.info('✅ Service ready - Health check available at /health');

  // Auto-start session for 'default'
  const defaultDir = getAuthDir('default');
  if (fs.existsSync(path.join(defaultDir, 'creds.json'))) {
    logger.info('📦 Default session credentials found, auto-starting...');
  } else {
    logger.info('📦 First run or no credentials - auto-starting default session for pairing...');
  }
  connectToWhatsApp('default').catch(() => {});

  // Auto-start all other sessions
  const sessionsDir = path.join(DATA_DIR, 'sessions');
  if (fs.existsSync(sessionsDir)) {
    const sessionDirs = fs.readdirSync(sessionsDir);
    for (const sDir of sessionDirs) {
      const fullPath = path.join(sessionsDir, sDir);
      if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'creds.json'))) {
        logger.info({ sessionId: sDir }, '📦 Session credentials found, auto-starting...');
        connectToWhatsApp(sDir).catch(() => {});
      }
    }
  }
});

/**
 * --- Graceful Shutdown ---
 * Ensures system state is saved so that downtime can be tracked on restart.
 */
async function handleShutdown(signal) {
  logger.info({ signal }, '👋 Shutdown signal received. Saving state and cleaning up...');

  // Track downtime if any session was connected
  let anyConnected = false;
  for (const session of sessions.values()) {
    if (session.isConnected) {
      anyConnected = true;
      break;
    }
  }

  if (anyConnected && !SYSTEM_STATE.last_whatsapp_online) {
    SYSTEM_STATE.last_whatsapp_online = Date.now();
    saveSystemState();
  }

  // Graceful exit
  setTimeout(() => {
    logger.info('🛑 Process exiting.');
    process.exit(0);
  }, 500);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGHUP', () => handleShutdown('SIGHUP'));
