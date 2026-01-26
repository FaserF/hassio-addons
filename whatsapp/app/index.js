import express from 'express';
// Note: Bonjour is imported dynamically to handle potential environment constraints
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  delay,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';

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
  console.log('⚠️ RESET_SESSION ENABLED - Clearing authentication data...');
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    console.log('✅ Authentication directory cleared.');
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
    console.debug('No SUPERVISOR_TOKEN found, skipping auto-disable of reset_session.');
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
        console.log('✅ Successfully disabled reset_session via Supervisor API.');
      } else {
        console.error(
          `❌ Failed to disable reset_session via Supervisor API. Status: ${res.statusCode}`
        );
      }
      resolve();
    });

    req.on('error', (error) => {
      console.error('❌ Error calling Supervisor API:', error);
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

// --- Authorization Logic ---
let API_TOKEN = '';

if (fs.existsSync(TOKEN_FILE)) {
  API_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
} else {
  API_TOKEN = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(TOKEN_FILE, API_TOKEN);
}

console.log('---------------------------------------------------');
console.log('🔒 Secure API Token generated/loaded:');
console.log(API_TOKEN);
console.log('---------------------------------------------------');

// --- Log Level ---
// Map addon log levels to pino-compatible levels
const RAW_LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_LEVEL_MAP = {
  trace: 'trace',
  debug: 'debug',
  info: 'info',
  notice: 'info', // pino doesn't have 'notice', map to info
  warning: 'warn',
  error: 'error',
  fatal: 'fatal',
};
const LOG_LEVEL = LOG_LEVEL_MAP[RAW_LOG_LEVEL.toLowerCase()] || 'info';
console.log(`📝 Log Level set to: ${LOG_LEVEL} (from: ${RAW_LOG_LEVEL})`);

// --- Configuration ---
const SEND_MESSAGE_TIMEOUT = parseInt(process.env.SEND_MESSAGE_TIMEOUT || '25000', 10);
const KEEP_ALIVE_INTERVAL = parseInt(process.env.KEEP_ALIVE_INTERVAL || '30000', 10);

console.log(`⏱️  Send Message Timeout set to: ${SEND_MESSAGE_TIMEOUT} ms`);
console.log(`💓 Keep Alive Interval set to: ${KEEP_ALIVE_INTERVAL} ms`);

// Ensure auth dir exists
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// --- Version Check ---
let BAILEYS_VERSION = 'Unknown';
try {
  const pkgPath = path.resolve('node_modules', '@whiskeysockets', 'baileys', 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    BAILEYS_VERSION = pkg.version;
  }
} catch (e) {
  console.warn('Could not read Baileys version:', e);
}

let sock;
let currentQR = null;
let isConnected = false;
let eventQueue = []; // Queue for polling events

// --- Helper Functions ---
function getJid(number) {
  if (number.includes('@')) return number;
  return `${number}@s.whatsapp.net`;
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
        console.warn(`⚠️ mDNS name "${serviceName}" in use, retrying with incremented name...`);
        instance.destroy();
        publishMDNS(name, attempt + 1);
      } else {
        console.warn(`⚠️ mDNS advertisement error for "${serviceName}":`, err.message);
        addLog(`mDNS error: ${err.message}`, 'warning');
      }
    });

    service.on('up', () => {
      console.log(
        `📢 Publishing mDNS service: ${serviceName} (_ha-whatsapp._tcp.local) on port ${PORT}`
      );
    });
  } catch (e) {
    console.warn('mDNS advertisement failed to initialize:', e);
  }
}

const baseMDNSName = process.env.MDNS_NAME || 'WhatsApp Addon';
publishMDNS(baseMDNSName);

// --- Status & Logs ---
let connectionLogs = [];
const stats = {
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
  start_time: Date.now(),
  my_number: 'Unknown',
  version: 'Unknown',
};

function addLog(msg, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  connectionLogs.unshift({ timestamp, msg, type });
  if (connectionLogs.length > 50) connectionLogs.pop();
}

// --- Middleware ---
const authMiddleware = (req, res, next) => {
  const providedToken = req.header('X-Auth-Token');
  if (providedToken !== API_TOKEN) {
    addLog(`Unauthorized API access attempt from ${req.ip} to ${req.originalUrl}`, 'error');
    console.warn(`[AUTH] Unauthorized access attempt from ${req.ip} to ${req.originalUrl}`);
    console.warn(
      `[AUTH] Token Mismatch - Expected: "${API_TOKEN.substring(0, 5)}...", Received: "${providedToken ? providedToken.substring(0, 5) + '...' : 'None'}"`
    );
    return res.status(401).json({
      error: 'Unauthorized',
      detail: 'Invalid or missing X-Auth-Token',
    });
  }
  next();
};

// Protect API routes exclusively
app.use('/session', authMiddleware);
app.use('/qr', authMiddleware);
app.use('/status', authMiddleware);
app.use('/events', authMiddleware);
app.use('/send_message', authMiddleware);
app.use('/send_image', authMiddleware);
app.use('/send_poll', authMiddleware);
app.use('/send_location', authMiddleware);
app.use('/send_reaction', authMiddleware);
app.use('/send_buttons', authMiddleware);
app.use('/set_presence', authMiddleware);
app.use('/logs', authMiddleware);

// --- Store Initialization ---
// Custom In-Memory Store to handle message retries
const messageStore = new Map();

// Helper to bind store to events
function bindStore(ev) {
  ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.id) {
        messageStore.set(msg.key.id, msg);
      }
    }
  });
}

async function connectToWhatsApp() {
  addLog('Starting request for new session...', 'info');
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: LOG_LEVEL }),
    browser: Browsers.macOS('Chrome'),
    syncFullHistory: false,
    keepAliveIntervalMs: KEEP_ALIVE_INTERVAL,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    retryRequestDelayMs: 5000,
    getMessage: async (key) => {
      // Check our custom store
      if (messageStore.has(key.id)) {
        console.debug(`[Store] Retrieving message ${key.id} from store`);
        return messageStore.get(key.id).message;
      }
      console.debug(`[Store] Message ${key.id} not found in store`);
      return undefined;
    },
  });

  // Bind custom store to events
  bindStore(sock.ev);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('QR Code received');
      addLog('QR Code generated. Waiting for scan...', 'success');
      currentQR = await QRCode.toDataURL(qr);
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      const reason = lastDisconnect.error ? lastDisconnect.error.toString() : 'Unknown';
      addLog(`Connection closed: ${reason}`, 'warning');

      console.log(
        'Connection closed due to ',
        lastDisconnect.error,
        ', reconnecting ',
        shouldReconnect
      );
      isConnected = false;

      if (shouldReconnect) {
        addLog('Reconnecting...', 'info');
        setTimeout(connectToWhatsApp, 1000);
      } else {
        addLog('Session logged out. Clean up metadata required.', 'error');
        console.log('Logged out. Please delete /data/auth_info_baileys to re-pair.');
      }
    } else if (connection === 'open') {
      console.log('Opened connection');
      addLog('WhatsApp Connection Established! 🟢', 'success');
      isConnected = true;
      currentQR = null;
      if (sock && sock.user) {
        stats.my_number = sock.user.id.split(':')[0]; // Extract number from JID
        stats.version = BAILEYS_VERSION;
      }
    } else if (connection === 'connecting') {
      addLog('Connecting to WhatsApp...', 'info');
    }
  });

  // Handle Incoming Messages
  sock.ev.on('messages.upsert', async (m) => {
    if (m.messages && m.messages.length > 0) {
      stats.received += m.messages.length;

      const events = m.messages.map((msg) => {
        let text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          'Media/Special Message';
        const sender = msg.key.remoteJid.split('@')[0];
        const isGroup = msg.key.remoteJid.endsWith('@g.us');

        // Update global stats with the latest message detail
        stats.last_received_message = text;
        stats.last_received_sender = sender;

        return {
          text,
          sender,
          is_group: isGroup,
          raw: msg, // Keep raw for power users
        };
      });
      eventQueue.push(...events);
    }
  });
}

// --- API Endpoints ---

// POST /session/start
app.post('/session/start', (req, res) => {
  addLog('Received Session Start request from Integration', 'info');
  if (isConnected) {
    return res.json({ status: 'connected', message: 'Already connected' });
  }
  if (sock && !sock.ws?.isClosed) {
    return res.json({
      status: 'scanning',
      message: 'Session negotiation in progress',
    });
  }

  connectToWhatsApp();
  res.json({ status: 'starting', message: 'Session init started' });
});

// DELETE /session
app.delete('/session', async (req, res) => {
  addLog('Received Logout/Reset request', 'warning');
  console.log('Received DELETE /session request (Logout)');
  try {
    if (sock) {
      // Baileys logout can sometimes hang if connection is bad
      await Promise.race([
        sock.logout(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Logout timeout')), 5000)),
      ]).catch((e) => console.warn('Logout failed or timed out:', e.message));

      sock.end(undefined);
      sock = undefined;
    }

    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(AUTH_DIR, { recursive: true });

    isConnected = false;
    currentQR = null;
    addLog('Session data cleared. Ready for new pair.', 'success');
    res.json({ status: 'success', message: 'Session deleted and logged out' });
  } catch (e) {
    addLog(`Logout failed: ${e.toString()}`, 'error');
    console.error('Error during session delete:', e);
    res.status(500).json({ error: e.toString() });
  }
});

// GET /qr
app.get('/qr', (req, res) => {
  if (isConnected) {
    return res.json({ status: 'connected', qr: null });
  }
  if (currentQR) {
    return res.json({ status: 'scanning', qr: currentQR });
  }
  // Change to 200 with status 'waiting' to prevent Frontend error handling issues
  return res.json({ status: 'waiting', detail: 'QR generation in progress' });
});

// GET /status
app.get('/status', (req, res) => {
  res.json({ connected: isConnected, version: BAILEYS_VERSION });
});

// GET /events (Polling)
app.get('/events', (req, res) => {
  // Return all queued events and clear queue
  const events = [...eventQueue];
  eventQueue = [];
  res.json(events);
});

// GET /logs
app.get('/logs', (req, res) => {
  res.json(connectionLogs);
});

// GET /stats
app.get('/stats', (req, res) => {
  res.json({
    ...stats,
    uptime: Math.floor((Date.now() - stats.start_time) / 1000),
  });
});

// POST /send_message
app.post('/send_message', async (req, res) => {
  const { number, message } = req.body;
  if (!isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    console.debug(
      `[SendMessage] Attempting to send to ${number}. Socket state: ${sock ? 'exists' : 'null'}, Connected: ${isConnected}`
    );

    if (!sock) {
      throw new Error('Socket not initialized');
    }

    await Promise.race([
      sock.sendMessage(jid, { text: message }),
      new Promise((_, reject) =>
        setTimeout(() => {
          console.error(
            `[SendMessage] Timeout reached for ${number}. Triggering forced reconnect.`
          );
          // Force close the socket to trigger a reconnect if Baileys is deadlocked
          sock.end(
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
    stats.sent += 1;
    stats.last_sent_message = message;
    stats.last_sent_target = number;
    res.json({ status: 'sent' });
  } catch (e) {
    stats.failed += 1;
    stats.last_failed_message = message;
    stats.last_failed_target = number;
    stats.last_error_reason = e.message || e.toString();
    addLog(`Failed to send message: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_image
app.post('/send_image', async (req, res) => {
  const { number, url, caption } = req.body;
  if (!isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    // Baileys supports URL directly
    await sock.sendMessage(jid, {
      image: { url: url },
      caption: caption,
    });
    stats.sent += 1;
    stats.last_sent_message = 'Image';
    stats.last_sent_target = number;
    res.json({ status: 'sent' });
  } catch (e) {
    stats.failed += 1;
    stats.last_failed_message = caption ? `Image: ${caption}` : 'Image';
    stats.last_failed_target = number;
    stats.last_error_reason = e.message || e.toString();
    addLog(`Failed to send image: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_poll
app.post('/send_poll', async (req, res) => {
  const { number, question, options } = req.body;
  if (!isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    await sock.sendMessage(jid, {
      poll: {
        name: question,
        values: options,
        selectableCount: 1, // Single select by default, maybe expose this?
      },
    });
    stats.sent += 1;
    stats.last_sent_message = `Poll: ${question}`;
    stats.last_sent_target = number;
    res.json({ status: 'sent' });
  } catch (e) {
    stats.failed += 1;
    stats.last_failed_message = `Poll: ${question}`;
    stats.last_failed_target = number;
    stats.last_error_reason = e.message || e.toString();
    addLog(`Failed to send poll: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_location
app.post('/send_location', async (req, res) => {
  const { number, latitude, longitude, title, description } = req.body;
  if (!isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    await sock.sendMessage(jid, {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name: title,
        address: description,
      },
    });
    stats.sent += 1;
    stats.last_sent_message = `Location: ${title || 'Pinned'}`;
    stats.last_sent_target = number;
    res.json({ status: 'sent' });
  } catch (e) {
    stats.failed += 1;
    stats.last_failed_message = `Location: ${title || 'Pinned'}`;
    stats.last_failed_target = number;
    stats.last_error_reason = e.message || e.toString();
    addLog(`Failed to send location: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_reaction
app.post('/send_reaction', async (req, res) => {
  const { number, reaction, messageId } = req.body;
  if (!isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    await sock.sendMessage(jid, {
      react: {
        text: reaction, // use empty string to remove reaction
        key: { id: messageId }, // Assuming remoteJid is implicit if not provided, or better provided?
      },
    });
    res.json({ status: 'sent' });
  } catch (e) {
    stats.failed += 1;
    stats.last_failed_message = `Reaction: ${reaction}`;
    stats.last_failed_target = number;
    stats.last_error_reason = e.message || e.toString();
    addLog(`Failed to send reaction: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_buttons
app.post('/send_buttons', async (req, res) => {
  const { number, message, buttons, footer } = req.body;
  if (!isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    // Buttons are tricky in Baileys and vary by version.
    // Assuming 'buttons' array matches Baileys structure: [{buttonId, buttonText: {displayText}, type: 1}]
    await sock.sendMessage(jid, {
      text: message,
      footer: footer,
      buttons: buttons,
      headerType: 1,
    });
    stats.sent += 1;
    stats.last_sent_message = `Buttons: ${message}`;
    stats.last_sent_target = number;
    res.json({ status: 'sent' });
  } catch (e) {
    stats.failed += 1;
    stats.last_failed_message = `Buttons: ${message}`;
    stats.last_failed_target = number;
    stats.last_error_reason = e.message || e.toString();
    addLog(`Failed to send buttons: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /set_presence
app.post('/set_presence', async (req, res) => {
  const { number, presence } = req.body;
  if (!isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    // presence: 'available' | 'composing' | 'recording' | 'paused'
    await sock.sendPresenceUpdate(presence, jid);
    res.json({ status: 'sent' });
  } catch (e) {
    addLog(`Failed to set presence: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// GET /health - Simple health check endpoint for ingress readiness
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'whatsapp-addon' });
});

// --- Dashboard (Server-Side Rendered) ---
// Root endpoint (/) is handled by the catch-all below
app.get(/(.*)/, (req, res) => {
  if (
    req.path.startsWith('/api') ||
    req.path === '/qr' ||
    req.path === '/status' ||
    req.path === '/session/start' ||
    req.path === '/send_message' ||
    req.path === '/send_image' ||
    req.path === '/send_poll' ||
    req.path === '/events' ||
    req.path === '/session' ||
    req.path === '/logs' ||
    req.path === '/health'
  ) {
    return res.status(404).send('Not Found');
  }

  // Determine current state
  const statusClass = isConnected ? 'connected' : currentQR ? 'waiting' : 'disconnected';
  const statusText = isConnected
    ? 'Connected 🟢'
    : currentQR
      ? 'Scan QR Code 📱'
      : 'Disconnected 🔴';
  const showQR = !isConnected && currentQR;
  const showQRPlaceholder = !isConnected && !currentQR;

  // Recent logs (last 10)
  const recentLogs =
    connectionLogs
      .slice(0, 10)
      .map(
        (l) =>
          `<div class="log-entry"><span class="log-time">${l.timestamp}</span><span class="log-type-${l.type}">${l.msg}</span></div>`
      )
      .join('') || '<div class="log-entry">No logs yet</div>';

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="5">
        <title>WhatsApp Addon</title>
        <style>
            body { font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; color: #111b21; }
            .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 600px; width: 95%; text-align: center; }
            h1 { color: #00a884; margin-bottom: 0.5rem; }
            .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 1rem; margin: 15px 0; }
            .status-badge.connected { background: #d9fdd3; color: #00a884; }
            .status-badge.disconnected { background: #fde8e8; color: #dc3545; }
            .status-badge.waiting { background: #fff8c5; color: #9a6700; }
            .qr-container { margin: 20px 0; min-height: 264px; display: flex; align-items: center; justify-content: center; background: #fff; border: 1px dashed #d1d7db; border-radius: 8px; }
            .qr-placeholder { color: #8696a0; font-size: 0.9rem; padding: 20px; }
            img.qr-code { max-width: 264px; border-radius: 8px; }
            .logs-container { margin-top: 20px; background: #111b21; color: #00ff41; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 0.75rem; text-align: left; max-height: 150px; overflow-y: auto; }
            .log-entry { margin-bottom: 4px; border-bottom: 1px solid #202c33; padding-bottom: 2px; }
            .log-time { color: #8696a0; margin-right: 8px; }
            .log-type-error { color: #ff5f5f; }
            .log-type-success { color: #00a884; }
            .log-type-info { color: #53bdeb; }
            .token-section { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e9edef; }
            .token-box { background: #f0f2f5; padding: 12px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 0.8rem; border: 1px solid #d1d7db; user-select: all; cursor: text; }
            .token-label { font-size: 0.8rem; color: #667781; margin-bottom: 8px; }
            .footer { margin-top: 20px; font-size: 0.75rem; color: #8696a0; }
            .refresh-hint { font-size: 0.75rem; color: #8696a0; margin-top: 10px; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>📱 WhatsApp Addon</h1>

            <div class="status-badge ${statusClass}">${statusText}</div>

            ${showQR
      ? `
            <div class="qr-container">
                <img class="qr-code" src="${currentQR}" alt="Scan QR Code with WhatsApp" />
            </div>
            `
      : ''
    }

            ${showQRPlaceholder
      ? `
            <div class="qr-container">
                <div class="qr-placeholder">
                    Waiting for QR Code...<br>
                    <small>Refresh this page or check logs below</small>
                </div>
            </div>
            `
      : ''
    }

            <div class="logs-container">
                ${recentLogs}
            </div>

            <div class="token-section">
                <div class="token-label">🔑 API Token (for Integration)</div>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="apiTokenInput" value="${API_TOKEN}" readonly
                        style="flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #d1d7db; font-family: monospace; background: #f0f2f5; color: #54656f;">
                    <button onclick="copyToken()" style="padding: 0 20px; background: #00a884; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
                        Copy
                    </button>
                </div>
                <div id="copyFeedback" style="display: none; color: #00a884; font-size: 0.8rem; margin-top: 5px; text-align: right;">Copied!</div>
            </div>

            <script>
                function copyToken() {
                    var copyText = document.getElementById("apiTokenInput");
                    copyText.select();
                    copyText.setSelectionRange(0, 99999); // For mobile devices
                    navigator.clipboard.writeText(copyText.value).then(() => {
                        showFeedback();
                    }).catch(err => {
                        // Fallback for non-secure contexts (http)
                        document.execCommand("copy");
                        showFeedback();
                    });
                }

                function showFeedback() {
                    const fb = document.getElementById("copyFeedback");
                    fb.style.display = "block";
                    setTimeout(() => { fb.style.display = "none"; }, 2000);
                }
            </script>

            <div class="footer">
                Addon v0.3.0 • Node.js ${process.version} • Baileys v${BAILEYS_VERSION}
            </div>

            <div class="refresh-hint">
                Page auto-refreshes every 5 seconds
            </div>
        </div>
    </body>
    </html>
    `);
});

// Listen on all interfaces in the container (0.0.0.0)
// This is safe because each addon runs in its own isolated Docker container
// Ports are isolated by Docker's network namespace, so no conflicts between addons
app.listen(PORT, '0.0.0.0', () => {
  console.log(`WhatsApp API listening on 0.0.0.0:${PORT}`);
  // Log that service is ready for health checks
  console.log('✅ Service ready - Health check available at /health');

  // Auto-start session if credentials exist
  const credsFile = path.join(AUTH_DIR, 'creds.json');
  if (fs.existsSync(credsFile)) {
    console.log('📦 Existing authentication found, auto-starting session...');
    connectToWhatsApp().catch((err) => {
      console.error('❌ Failed to auto-start session:', err);
    });
  }
});
