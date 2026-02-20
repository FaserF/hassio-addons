import express from 'express';
// Note: Bonjour is imported dynamically to handle potential environment constraints
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  delay,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import mime from 'mime-types';

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

logger.info('---------------------------------------------------');
logger.info(`🔒 Secure API Token loaded (Masked: ${maskData(API_TOKEN)})`);
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
      eventQueue: [],
      connectionLogs: [],
      messageStore: new Map(),
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
  const timestamp = new Date().toLocaleTimeString();
  session.connectionLogs.unshift({ timestamp, msg, type });
  if (session.connectionLogs.length > 50) session.connectionLogs.pop();
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

const baseMDNSName = process.env.MDNS_NAME || 'WhatsApp Addon';
publishMDNS(baseMDNSName);

// --- Middleware ---
const ipFilterMiddleware = (req, res, next) => {
  // If UI Auth is enabled, we allow access from everywhere (protected by password)
  if (UI_AUTH_ENABLED) return next();

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

  // Allow Docker internal ranges (often 172.x but covered above) or Hassio specific
  // For standard "Host Network" addons, requests from other containers might appear as public IP or gateway?
  // But usually Home Assistant Addons on Host Network see the real modification IP.

  addLog(getSession('default'), `Blocked external access attempt from ${ip}`, 'warning');
  logger.warn({ ip }, '[SECURITY] Blocked external access attempt (UI Auth Disabled)');
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

// Global IP Filter
app.use(ipFilterMiddleware);

// Protect API routes exclusively
app.use('/session', authMiddleware);
app.use('/qr', authMiddleware);
app.use('/status', authMiddleware);
app.use('/events', authMiddleware);
app.use('/stats', authMiddleware); // Added stats to protected routes
app.use('/send_message', authMiddleware);
app.use('/send_image', authMiddleware);
app.use('/send_poll', authMiddleware);
app.use('/send_location', authMiddleware);
app.use('/send_reaction', authMiddleware);
app.use('/send_buttons', authMiddleware);
app.use('/send_document', authMiddleware);
app.use('/send_video', authMiddleware);
app.use('/send_audio', authMiddleware);
app.use('/send_list', authMiddleware);
app.use('/send_contact', authMiddleware);
app.use('/revoke_message', authMiddleware);
app.use('/edit_message', authMiddleware);
app.use('/set_presence', authMiddleware);
app.use('/groups', authMiddleware);
app.use('/mark_as_read', authMiddleware);
app.use('/logs', authMiddleware);

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
              fs.unlink(filePath, () => { });
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

  addLog(session, `Starting request for session: ${sessionId}...`, 'info');
  const { state, saveCreds } = await useMultiFileAuthState(sessionAuthDir);

  session.sock = makeWASocket({
    auth: state,
    logger: logger.child({ module: `baileys-${sessionId}` }, { level: 'warn' }),
    browser: Browsers.macOS('Chrome'),
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

  session.sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info({ sessionId }, 'QR Code received');
      addLog(session, 'QR Code generated. Waiting for scan...', 'success');
      session.currentQR = await QRCode.toDataURL(qr);
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      const reason = lastDisconnect.error?.message || lastDisconnect.error?.toString() || 'Unknown';
      addLog(session, `Connection closed: ${reason}`, 'warning');

      logger.warn({ reason, shouldReconnect, sessionId }, 'Connection closed');
      session.isConnected = false;

      if (shouldReconnect) {
        addLog(session, 'Reconnecting...', 'info');
        setTimeout(() => connectToWhatsApp(sessionId), 1000);
      } else {
        addLog(session, 'Session logged out. Clean up metadata required.', 'error');
        logger.error({ sessionId }, `Logged out. Please delete ${sessionAuthDir} to re-pair.`);
      }
    } else if (connection === 'open') {
      logger.info({ sessionId }, 'WhatsApp connection opened');
      addLog(session, 'WhatsApp Connection Established! 🟢', 'success');
      session.isConnected = true;
      session.currentQR = null;
      if (session.sock && session.sock.user) {
        session.stats.my_number = session.sock.user.id.split(':')[0]; // Extract number from JID
        session.stats.version = BAILEYS_VERSION;
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
        .filter((msg) => !msg.key.fromMe && msg.key.remoteJid !== 'status@broadcast')
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
              logger.error({ error: err.message, sessionId }, 'Failed to download media');
              text = `${text} (Media Download Failed)`;
            }
          }

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

        // --- Native Command Handling ---
        if (event.content && typeof event.content === 'string' && event.content.startsWith('/')) {
          const body = event.content.trim();
          const sender = event.sender;

          try {
            if (body === '/ping') {
              await session.sock.sendMessage(sender, { text: 'Pong! 🏓' });
              addLog(session, `Processed command /ping from ${maskData(sender)}`, 'info');
            } else if (body === '/id') {
              await session.sock.sendMessage(sender, { text: `Chat ID: \`${sender}\`` });
              addLog(session, `Processed command /id from ${maskData(sender)}`, 'info');
            } else if (body === '/restart') {
              await session.sock.sendMessage(sender, {
                text: '🔄 Restarting WhatsApp connection...',
              });
              addLog(session, `Processed command /restart from ${maskData(sender)}`, 'warning');
              // Graceful restart
              setTimeout(() => {
                session.sock.end(new Error('User requested restart'));
              }, 1000);
            }
          } catch (cmdErr) {
            logger.error({ error: cmdErr.message, sessionId }, 'Failed to process native command');
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

  connectToWhatsApp(session.id);
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
  res.json({ connected: session.isConnected, version: BAILEYS_VERSION, session_id: session.id });
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

  let quoted = undefined;
  if (quotedMessageId) {
    // Note: messageStore is in-memory and ephemeral. It only contains messages
    // received/sent during the current session. If the addon restarts,
    // quoting will fall back to unquoted if the ID is not in the new store.
    const rawMsg = session.messageStore.get(quotedMessageId);
    if (rawMsg) {
      quoted = rawMsg;
    } else {
      logger.warn({ quotedMessageId, sessionId: session.id }, 'Quoted message not found in store');
    }
  }

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

    await Promise.race([
      session.sock.sendMessage(jid, { text: message }, { quoted }),
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
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = maskData(message);
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send message: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_image
app.post('/send_image', async (req, res) => {
  const session = getReqSession(req);
  const { number, url, caption } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    await session.sock.sendMessage(jid, {
      image: { url: url },
      caption: caption,
    });
    session.stats.sent += 1;
    session.stats.last_sent_message = 'Image';
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = caption ? `Image: ${maskData(caption)}` : 'Image';
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send image: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_poll
app.post('/send_poll', async (req, res) => {
  const session = getReqSession(req);
  const { number, question, options } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    await session.sock.sendMessage(jid, {
      poll: {
        name: question,
        values: options,
        selectableCount: 1,
      },
    });
    session.stats.sent += 1;
    session.stats.last_sent_message = `Poll: ${question}`;
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Poll: ${maskData(question)}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send poll: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_location
app.post('/send_location', async (req, res) => {
  const session = getReqSession(req);
  const { number, latitude, longitude, title, description } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    await session.sock.sendMessage(jid, {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name: title,
        address: description,
      },
    });
    session.stats.sent += 1;
    session.stats.last_sent_message = `Location: ${title || 'Pinned'}`;
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Location: ${maskData(title) || 'Pinned'}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send location: ${e.message}`, 'error');
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
    await session.sock.sendMessage(jid, {
      react: {
        text: reaction,
        key: {
          remoteJid: jid,
          fromMe: false,
          id: messageId,
        },
      },
    });
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Reaction: ${maskData(reaction)}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send reaction: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_buttons
app.post('/send_buttons', async (req, res) => {
  const session = getReqSession(req);
  const { number, message, buttons, footer } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    await session.sock.sendMessage(jid, {
      text: message,
      footer: footer,
      buttons: buttons,
      headerType: 1,
    });
    session.stats.sent += 1;
    session.stats.last_sent_message = `Buttons: ${message}`;
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Buttons: ${maskData(message)}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send buttons: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_document
app.post('/send_document', async (req, res) => {
  const session = getReqSession(req);
  const { number, url, fileName, caption } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    await session.sock.sendMessage(jid, {
      document: { url: url },
      fileName: fileName,
      caption: caption,
      mimetype: 'application/octet-stream',
    });
    session.stats.sent += 1;
    session.stats.last_sent_message = `Document: ${fileName || 'unnamed'}`;
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Document: ${maskData(fileName) || 'unnamed'}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send document: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_video
app.post('/send_video', async (req, res) => {
  const session = getReqSession(req);
  const { number, url, caption } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    await session.sock.sendMessage(jid, {
      video: { url: url },
      caption: caption,
    });
    session.stats.sent += 1;
    session.stats.last_sent_message = caption ? `Video: ${maskData(caption)}` : 'Video';
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = caption ? `Video: ${maskData(caption)}` : 'Video';
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send video: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_audio
app.post('/send_audio', async (req, res) => {
  const session = getReqSession(req);
  const { number, url, ptt } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    await session.sock.sendMessage(jid, {
      audio: { url: url },
      ptt: !!ptt,
      mimetype: 'audio/mp4',
    });
    session.stats.sent += 1;
    session.stats.last_sent_message = ptt ? 'Voice Note' : 'Audio';
    session.stats.last_sent_target = maskData(number);
    session.stats.last_sent_time = Date.now();
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = ptt ? 'Voice Note' : 'Audio';
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send audio: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /revoke_message
app.post('/revoke_message', async (req, res) => {
  const session = getReqSession(req);
  const { number, message_id } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);
    const key = {
      remoteJid: jid,
      fromMe: true,
      id: message_id,
    };

    await session.sock.sendMessage(jid, { delete: key });

    session.stats.sent += 1;
    session.stats.last_sent_message = `Revoke: ${message_id}`;
    session.stats.last_sent_target = maskData(number);
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Revoke: ${message_id}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to revoke message: ${e.message}`, 'error');
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
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Edit: ${message_id}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to edit message: ${e.message}`, 'error');
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

// GET /health - Simple health check endpoint for ingress readiness
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'whatsapp-addon' });
});

// --- Dashboard (Server-Side Rendered) ---
// Root endpoint (/) is handled by the catch-all below
app.get(/(.*)/, uiAuthMiddleware, (req, res) => {
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

  // Determine session to show (default to 'default' or first available)
  const sessionId = req.query.session_id || 'default';
  const session = getSession(sessionId);

  // Determine current state
  const statusClass = session.isConnected
    ? 'connected'
    : session.currentQR
      ? 'waiting'
      : 'disconnected';
  const statusText = session.isConnected
    ? 'Connected 🟢'
    : session.currentQR
      ? 'Scan QR Code 📱'
      : 'Disconnected 🔴';
  const showQR = !session.isConnected && session.currentQR;
  const showQRPlaceholder = !session.isConnected && !session.currentQR;

  // Recent logs (last 10)
  const recentLogs =
    session.connectionLogs
      .slice(-10)
      .reverse()
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
                <img class="qr-code" src="${session.currentQR}" alt="Scan QR Code with WhatsApp" />
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
                Addon v${process.env.ADDON_VERSION || '1.0.3'} • Node.js ${process.version} • Baileys v${BAILEYS_VERSION}
            </div>

            <div class="refresh-hint">
                Page auto-refreshes every 5 seconds
            </div>
        </div>
    </body>
    </html>
    `);
});

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
  const { number, title, text, button_text, sections } = req.body;
  if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });

  try {
    const jid = getJid(number);

    await session.sock.sendMessage(jid, {
      text: text || title || 'Menu',
      footer: title ? text : undefined,
      title: title,
      buttonText: button_text || 'Menu',
      sections: sections,
    });

    session.stats.sent += 1;
    session.stats.last_sent_message = `List: ${title || text}`;
    session.stats.last_sent_target = number;
    session.stats.last_sent_time = Date.now();
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `List: ${title || text}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send list: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// POST /send_contact
app.post('/send_contact', async (req, res) => {
  const session = getReqSession(req);
  const { number, contact_name, contact_number } = req.body;
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

    await session.sock.sendMessage(jid, {
      contacts: {
        displayName: contact_name,
        contacts: [{ vcard }],
      },
    });

    session.stats.sent += 1;
    session.stats.last_sent_message = `Contact: ${contact_name}`;
    session.stats.last_sent_target = number;
    session.stats.last_sent_time = Date.now();
    res.json({ status: 'sent' });
  } catch (e) {
    session.stats.failed += 1;
    session.stats.last_failed_message = `Contact: ${contact_name}`;
    session.stats.last_failed_target = maskData(number);
    session.stats.last_failed_time = Date.now();
    session.stats.last_error_reason = e.message || e.toString();
    addLog(session, `Failed to send contact: ${e.message}`, 'error');
    res.status(500).json({ detail: e.toString() });
  }
});

// Listen on all interfaces in the container (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, 'WhatsApp API listening');
  logger.info('✅ Service ready - Health check available at /health');

  // Auto-start session for 'default' if credentials exist
  const defaultDir = getAuthDir('default');
  if (fs.existsSync(path.join(defaultDir, 'creds.json'))) {
    logger.info('📦 Default session credentials found, auto-starting...');
    connectToWhatsApp('default').catch(() => { });
  }

  // Auto-start all other sessions
  const sessionsDir = path.join(DATA_DIR, 'sessions');
  if (fs.existsSync(sessionsDir)) {
    const sessionDirs = fs.readdirSync(sessionsDir);
    for (const sDir of sessionDirs) {
      const fullPath = path.join(sessionsDir, sDir);
      if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'creds.json'))) {
        logger.info({ sessionId: sDir }, '📦 Session credentials found, auto-starting...');
        connectToWhatsApp(sDir).catch(() => { });
      }
    }
  }
});
