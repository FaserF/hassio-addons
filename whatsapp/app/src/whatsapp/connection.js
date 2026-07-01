import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { logger } from '../logger.js';
import {
  KEEP_ALIVE_INTERVAL,
  MARK_ONLINE,
  NOTIFY_RESTORE_THRESHOLD,
  ADMIN_NOTIFICATIONS_ENABLED,
} from '../config.js';
import { getAuthDir, addLog, deleteSession } from '../session.js';
import { SYSTEM_STATE, setHealthStatus } from '../state.js';
import { formatDuration } from '../utils/format.js';
import { notifyAdmins } from './actions.js';
import { bindStore, handleIncomingMessages, checkSystemUpdates, monitorHACore } from './events.js';
import { PORT, API_TOKEN } from '../config.js';
import { isHANetwork } from '../ha.js';

export async function connectToWhatsApp(sessionId = 'default', sessions, getSession) {
  const session = getSession(sessionId);

  if (session.isConnecting) {
    logger.debug({ sessionId }, 'Already connecting, skipping redundant call');
    return;
  }

  // If already connected and socket is active, don't restart unless explicitly requested
  if (session.isConnected && session.sock && !session.sock.ws?.isClosed) {
    logger.debug({ sessionId }, 'Already connected and active, skipping');
    return;
  }

  session.isConnecting = true;
  session.passkeyDetected = false;
  session.passkeyWaiting = false;
  session.passkeyChallenge = null;
  const sessionAuthDir = getAuthDir(sessionId);
  const hasCreds = fs.existsSync(path.join(sessionAuthDir, 'creds.json'));

  const now = Date.now();
  const isInterested = sessionId === 'default' || now - session.lastInterestTime < 60000;

  if (!hasCreds && !isInterested) {
    logger.info({ sessionId }, '💤 No credentials and no active interest. Skipping connection.');
    addLog(session, 'Waiting for user to open Dashboard to start pairing...', 'info');
    session.currentQR = null;
    session.isConnecting = false;
    return;
  }

  addLog(session, `Starting connection request for session: ${sessionId}...`, 'info');
  setHealthStatus('starting', `Connecting session: ${sessionId}`);
  const { state, saveCreds } = await useMultiFileAuthState(sessionAuthDir);

  try {
    const { version, isLatest } = await fetchLatestBaileysVersion().catch((err) => {
      logger.warn({ error: err.message }, '⚠️ Failed to fetch latest WA version, using fallback.');
      return { version: [2, 3000, 1015901307], isLatest: false };
    });

    logger.info({ version, isLatest, sessionId }, '📡 Initializing socket with WA version');

    session.sock = makeWASocket({
      auth: state,
      version,
      logger: logger.child({ module: `baileys-${sessionId}` }, { level: 'warn' }),
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: MARK_ONLINE,

      keepAliveIntervalMs: KEEP_ALIVE_INTERVAL,
      connectTimeoutMs: 90000,
      defaultQueryTimeoutMs: 90000,
      retryRequestDelayMs: 5000,
      getMessage: async (key) => {
        if (session.messageStore.has(key.id)) {
          return session.messageStore.get(key.id).message;
        }
        return undefined;
      },
    });

    // Workaround for TypeError in fetchPrivacySettings (Baileys RC.9 bug)
    // This prevents the connection from dropping if the privacy settings fetch fails
    if (session.sock.fetchPrivacySettings) {
      const oldFetchPrivacySettings = session.sock.fetchPrivacySettings;
      session.sock.fetchPrivacySettings = async () => {
        try {
          return await oldFetchPrivacySettings.call(session.sock);
        } catch (e) {
          logger.debug(
            { sessionId, error: e.message },
            '🛡️ Suppressed Baileys privacy settings fetch error'
          );
          return {};
        }
      };
    }
  } catch (err) {
    session.isConnecting = false;
    logger.error({ sessionId, error: err.message }, '💥 Failed to initialize WASocket');
    addLog(session, `Failed to initialize WhatsApp: ${err.message}`, 'error');
    setHealthStatus('faulty', `Failed to initialize WASocket: ${err.message}`);
    return;
  }

  bindStore(session, session.sock.ev);
  session.sock.ev.on('creds.update', saveCreds);

  const sock = session.sock;
  logger.info({ sessionId }, '📡 Attaching connection listeners...');

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    logger.info({ sessionId, connection, hasQR: !!qr }, '🔄 connection.update');

    if (session.sock !== sock) {
      logger.debug({ sessionId }, 'Old socket event received, ignoring');
      return;
    }

    if (qr) {
      logger.info({ sessionId }, '✨ QR Code received, converting to DataURL...');
      try {
        session.currentQR = await QRCode.toDataURL(qr);
        logger.info({ sessionId }, '✅ QR Code DataURL generated');
        addLog(session, 'QR Code generated. Please scan to connect.', 'success');
        setHealthStatus('running', 'Waiting for QR scan');
        // Reset passkey flag on fresh QR so banner clears when user retries
        session.passkeyDetected = false;
      } catch (err) {
        logger.error({ sessionId, error: err.message }, '❌ Failed to generate QR Code DataURL');
        addLog(session, 'Failed to process QR Code. Check logs.', 'error');
        setHealthStatus('faulty', 'Failed to generate QR Code');
      }
    }

    // Detect WhatsApp passkey / "Continue on WhatsApp Web" ceremony (Baileys issue #2672).
    // WhatsApp >= ~2025 may require a passkey verification after QR scan. Baileys does not
    // implement the full FIDO2/passkey handshake yet, so the pairing stalls silently.
    // We detect this state so the dashboard can show clear guidance to the user.
    const isPasskeyRequest =
      update.isOnlineOnAnotherDevice === false ||
      update.isNewLogin === false ||
      (update.receivedPendingNotifications === false && !update.isOnlineOnAnotherDevice);

    // Alternative heuristic: WhatsApp sends a specific IQ type during passkey ceremony.
    // We also check if the update contains a passkey-related field that may be added
    // by community forks (Qiua/Baileys PR #2676).
    const hasPasskeyField =
      typeof update.passkey !== 'undefined' ||
      typeof update.passkeyChallenge !== 'undefined' ||
      typeof update.shortcakePasskey !== 'undefined';

    if (
      hasPasskeyField ||
      (isPasskeyRequest && session.currentQR === null && !session.isConnected)
    ) {
      if (!session.passkeyDetected) {
        session.passkeyDetected = true;
        session.passkeyWaiting = true;
        // Store the raw challenge data so the API can expose it
        session.passkeyChallenge =
          update.shortcakePasskey || update.passkeyChallenge || update.passkey || null;
        logger.warn(
          { sessionId },
          '🔑 Passkey ceremony detected! WhatsApp is requesting passkey verification. ' +
            'This is a known Baileys limitation (issue #2672). ' +
            'User must either disable passkey in WhatsApp app settings, or approve the prompt on their phone.'
        );
        addLog(
          session,
          '🔑 Passkey required by WhatsApp. Option 1: Open WhatsApp → Settings → Account → Passkeys → Remove all passkeys, then restart. Option 2: Approve the passkey prompt on your phone — the connection will complete automatically.',
          'error'
        );
        // Do NOT set health to faulty — the socket must remain alive so WhatsApp
        // can deliver the passkey confirmation from the phone.
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const errorMsg =
        lastDisconnect.error?.message || lastDisconnect.error?.toString() || 'Unknown';

      // Determine disconnect reason
      let disconnectReason = 'Connection to WhatsApp Lost';
      const errorCode = lastDisconnect.error?.code || lastDisconnect.error?.output?.payload?.code;

      if (isLoggedOut) {
        disconnectReason = 'Session Expired / Logged Out';
      } else if (
        ['ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ETIMEDOUT', 'ECONNRESET'].includes(errorCode)
      ) {
        disconnectReason = 'Server Host Internet Connection Lost';
      } else if (SYSTEM_STATE.last_ha_disconnect_time) {
        disconnectReason = 'Home Assistant Integration Unreachable';
      } else if (errorMsg.includes('Handshake')) {
        disconnectReason = 'Connection Error (WhatsApp Handshake)';
      }

      addLog(
        session,
        `Connection closed (Code: ${statusCode || 'None'}): ${errorMsg} [Reason: ${disconnectReason}]`,
        'warning'
      );

      session.isConnecting = false;
      session.isConnected = false;
      const sessionStats = session.stats;

      if (ADMIN_NOTIFICATIONS_ENABLED && !sessionStats.last_disconnect_time) {
        sessionStats.last_disconnect_time = Date.now();
        sessionStats.last_disconnect_reason = disconnectReason;

        logger.warn({ sessionId }, '⚠️ WhatsApp disconnected. Admin notification pending restore.');

        // Clear any existing restore timer
        if (session._restoreTimer) {
          clearTimeout(session._restoreTimer);
          session._restoreTimer = null;
        }

        // Delay the disconnect notification to avoid spam during quick reconnects
        session._disconnectTimer = setTimeout(() => {
          if (session.isConnected) return; // Already reconnected, suppress alarm

          notifyAdmins(
            session,
            `🔴 *WhatsApp Disconnected*\n\n• *Session:* \`${sessionId}\`\n• *Reason:* ${disconnectReason}\n• *Detail:* ${errorMsg}\n• *Status:* Attempting to reconnect.`
          );
        }, NOTIFY_RESTORE_THRESHOLD);
      }

      if (isLoggedOut) {
        session.disconnectReason = 'logged_out';
        session.reconnectAttempts = 0;
        session.firstFailureTime = null;
        if (sessionId !== 'default') {
          logger.info({ sessionId }, 'Auto-cleaning logged out session...');
          deleteSession(sessionId);
        } else {
          // For default session, clear creds to allow fresh pairing
          const authDir = getAuthDir(sessionId);
          if (fs.existsSync(authDir)) {
            logger.info({ sessionId }, '🗑️ Clearing credentials for logged out default session...');
            fs.rmSync(authDir, { recursive: true, force: true });
          }
        }
      } else {
        session.disconnectReason = 'connection_error';
        session.reconnectAttempts += 1;
        session.stats.totalReconnects += 1;
        if (!session.firstFailureTime) session.firstFailureTime = Date.now();

        setHealthStatus('running', `Disconnected: ${disconnectReason}`);

        const baseDelay = 3000;
        const failDuration = Date.now() - session.firstFailureTime;
        const reconnectDelay = failDuration > 15 * 60 * 1000 ? 120000 : baseDelay;

        setTimeout(() => {
          const stillHasNoCreds = !fs.existsSync(path.join(getAuthDir(sessionId), 'creds.json'));
          const interestCheck = Date.now() - session.lastInterestTime < 60000;
          if (stillHasNoCreds && !interestCheck) return;
          connectToWhatsApp(sessionId, sessions, getSession);
        }, reconnectDelay);
      }
    } else if (connection === 'open') {
      addLog(session, 'WhatsApp Connection Established! 🟢', 'success');
      session.isConnecting = false;
      session.isConnected = true;
      session.disconnectReason = null;
      session.reconnectAttempts = 0;
      session.firstFailureTime = null;
      // If a passkey ceremony was in progress, it just completed successfully
      if (session.passkeyDetected || session.passkeyWaiting) {
        logger.info(
          { sessionId },
          '🔑✅ Passkey ceremony completed successfully — connection established.'
        );
        addLog(session, '🔑✅ Passkey approved on phone — connection established!', 'success');
        session.passkeyDetected = false;
        session.passkeyWaiting = false;
        session.passkeyChallenge = null;
      }
      setHealthStatus('connected', 'WhatsApp connected');
      // Set a 1-minute cooldown for group fetching after establishing connection
      // to prevent triggering WhatsApp's rate-overlimit on immediate queries.
      session.groupFetchCooldownUntil = Date.now() + 60000;

      if (!MARK_ONLINE) {
        sock.sendPresenceUpdate('unavailable').catch((e) => {
          logger.warn({ error: e.message }, '⚠️ Failed to send presence update to unavailable');
        });
      }

      const sessionStats = session.stats;

      if (ADMIN_NOTIFICATIONS_ENABLED && sessionStats.last_disconnect_time) {
        const downtime = Date.now() - sessionStats.last_disconnect_time;

        // Clear existing timer if it exists (prevents flapping notifications)
        if (session._restoreTimer) {
          clearTimeout(session._restoreTimer);
          session._restoreTimer = null;
        }

        // Also clear any pending disconnect alarm
        if (session._disconnectTimer) {
          clearTimeout(session._disconnectTimer);
          session._disconnectTimer = null;
        }

        if (downtime > NOTIFY_RESTORE_THRESHOLD) {
          // Debounce restore notification by 5 seconds to ensure it stays open
          session._restoreTimer = setTimeout(() => {
            if (!session.isConnected) return; // Connection dropped again before notify

            const reasonText = sessionStats.last_disconnect_reason
              ? `\n• *Reason:* ${sessionStats.last_disconnect_reason}`
              : '';
            notifyAdmins(
              session,
              `🟢 *WhatsApp Connection Restored*\n\n• *Downtime:* ${formatDuration(downtime)}${reasonText}\n• *Status:* Bot is back online.`
            );
            sessionStats.last_disconnect_time = null;
            sessionStats.last_disconnect_reason = null;
          }, 5000);
        } else {
          sessionStats.last_disconnect_time = null;
          sessionStats.last_disconnect_reason = null;
        }
      }

      if (!session._monitorsStarted) {
        session._monitorsStarted = true;
        checkSystemUpdates(session).catch(() => {});
        monitorHACore(session).catch(() => {});
      }
      if (session.sock?.user) {
        session.stats.my_number = session.sock.user.id.split(':')[0];
        session.deviceInfo = {
          manufacturer: 'WhatsApp',
          model: session.sock.user.id.split(':')[0].replace(/\D/g, '') + '@s.whatsapp.net',
          platform: session.sock.user.name || session.sock.user.id.split('@')[0],
          number: session.sock.user.id.split(':')[0],
          name: session.sock.user.name || null,
        };
      }
    }
  });

  handleIncomingMessages(session);
}

/**
 * mDNS / Bonjour advertisement - Conditional for security
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let mdnsInstance = null;
let currentMdnsService = null;

const DISCOVERY_STATE = {
  lastShowSecret: null,
  lastShouldBroadcast: null,
};

function getDiscoveryStatus(sessions) {
  const anyConnected = Array.from(sessions.values()).some((s) => s.isConnected);
  const now = Date.now();
  const integrationActive = now - (SYSTEM_STATE.last_integration_online || 0) < 120000;

  // 1. Should we broadcast at all?
  // If we have a working connection to both sides, we stop broadcasting entirely (Stealth Mode)
  // as requested to prevent redundant discovery.
  const shouldBroadcast = !(anyConnected && integrationActive);

  // 2. Should we include the secret?
  // Security: Only even consider it on trusted networks.
  let showSecret = isHANetwork();

  // Hide secret if ALREADY set up (connected or has creds)
  if (anyConnected) showSecret = false;
  const anyHasCreds = Array.from(sessions.keys()).some((id) =>
    fs.existsSync(path.join(getAuthDir(id), 'creds.json'))
  );
  if (anyHasCreds) showSecret = false;

  // Hide secret if integration is already talking to us
  if (integrationActive) showSecret = false;

  return { shouldBroadcast, showSecret };
}

export async function publishMDNS(name, sessions, attempt = 0) {
  try {
    const { Bonjour } = await import('bonjour-service');
    if (!mdnsInstance) mdnsInstance = new Bonjour();

    const { shouldBroadcast, showSecret } = getDiscoveryStatus(sessions);
    DISCOVERY_STATE.lastShouldBroadcast = shouldBroadcast;
    DISCOVERY_STATE.lastShowSecret = showSecret;

    if (currentMdnsService) {
      currentMdnsService.stop();
      currentMdnsService = null;
    }

    if (!shouldBroadcast) {
      logger.info('🤫 Stealth Mode: Discovery stopped (Setup complete & active)');
      return;
    }

    const serviceName = attempt === 0 ? name : `${name} ${attempt}`;

    const txt = {
      version: '1.0.0',
      api_path: '/',
      auth_type: 'token',
      system_id: SYSTEM_STATE.system_id,
    };

    if (showSecret) {
      txt.api_key = API_TOKEN;
      logger.info('🔑 Including API Key in mDNS discovery (Initial Setup Mode)');
    }

    currentMdnsService = mdnsInstance.publish({
      name: serviceName,
      type: 'ha-whatsapp',
      protocol: 'tcp',
      port: PORT,
      txt,
    });

    currentMdnsService.on('error', async (err) => {
      if (err.message.includes('already in use') && attempt < 10) {
        logger.warn({ serviceName }, 'mDNS name in use, retrying...');
        currentMdnsService.stop();
        await delay(1000);
        publishMDNS(name, sessions, attempt + 1);
      } else {
        logger.error({ serviceName, error: err.message }, 'mDNS advertisement error');
      }
    });

    currentMdnsService.on('up', () => {
      logger.info(
        { serviceName, port: PORT, secretManifested: showSecret },
        '📢 Publishing mDNS service'
      );
    });

    // Re-evaluate every 30 seconds
    if (attempt === 0) {
      setInterval(() => {
        const current = getDiscoveryStatus(sessions);
        const needsUpdate =
          current.shouldBroadcast !== DISCOVERY_STATE.lastShouldBroadcast ||
          current.showSecret !== DISCOVERY_STATE.lastShowSecret;

        if (needsUpdate) {
          logger.info('🔄 Updating mDNS discovery based on state change');
          publishMDNS(name, sessions, 0);
        }
      }, 30000);
    }
  } catch (e) {
    logger.warn({ error: e.message }, 'mDNS advertisement failed to initialize');
  }
}

export async function stopMDNS() {
  if (currentMdnsService) {
    logger.info('🛑 Stopping mDNS advertisement...');
    currentMdnsService.stop();
    currentMdnsService = null;
  }
  if (mdnsInstance) {
    mdnsInstance.destroy();
    mdnsInstance = null;
  }
}
