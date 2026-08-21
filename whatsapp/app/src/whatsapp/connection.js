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
import dns from 'dns';
import { logger, LOG_LEVEL } from '../logger.js';

const resolveDNSHost = async (url) => {
  try {
    const hostname = new URL(url).hostname;
    const res = await dns.promises.lookup(hostname);
    return res.address;
  } catch (e) {
    return null;
  }
};
import {
  KEEP_ALIVE_INTERVAL,
  MARK_ONLINE,
  SYNC_FULL_HISTORY,
  NOTIFY_RESTORE_THRESHOLD,
  ADMIN_NOTIFICATIONS_ENABLED,
} from '../config.js';
import { getAuthDir, addLog, deleteSession } from '../session.js';
import { SYSTEM_STATE, setHealthStatus } from '../state.js';
import { formatDuration } from '../utils/format.js';
import { notifyAdmins } from './actions.js';
import {
  bindStore,
  handleIncomingMessages,
  registerAllListeners,
  checkSystemUpdates,
  monitorHACore,
} from './events/index.js';
import { restorePendingCaptchas } from './moderation/engine/captcha.js';
import { PORT, API_TOKEN } from '../config.js';
import { isHANetwork } from '../ha.js';
import {
  recordDisconnectTime,
  consumeDisconnectTime,
  clearNotifiedChats,
} from './startup/missedMessages.js';

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

  // Safely cleanup previous unclosed socket instance to avoid Stream Errored (conflict)
  if (session.sock) {
    try {
      logger.debug({ sessionId }, '🧹 Destroying existing socket before reconnecting...');
      session.sock.ev.removeAllListeners();
      session.sock.end(new Error('Replacing existing socket instance'));
    } catch (e) {
      logger.debug(
        { sessionId, error: e.message },
        'Error closing previous socket before reconnecting'
      );
    }
    session.sock = null;
  }

  session.isConnecting = true;
  session.passkeyDetected = false;
  session.passkeyWaiting = false;
  session.passkeyChallenge = null;
  session.qrGenerated = false;

  // Set a safety timeout to unstick session.isConnecting if Baileys hangs during socket creation
  if (session._connectingTimeout) clearTimeout(session._connectingTimeout);
  session._connectingTimeout = setTimeout(() => {
    if (session.isConnecting && !session.isConnected) {
      logger.warn({ sessionId }, '⏰ Connection attempt timed out, resetting connecting flag.');
      session.isConnecting = false;
    }
  }, 45000);

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

  let state, saveCreds;
  try {
    const authResult = await useMultiFileAuthState(sessionAuthDir);
    state = authResult.state;
    saveCreds = authResult.saveCreds;
  } catch (err) {
    session.isConnecting = false;
    logger.error(
      { sessionId, error: err.message },
      '💥 Failed to load auth state (corrupted creds?)'
    );
    addLog(
      session,
      `Failed to load auth state: ${err.message} — try resetting credentials.`,
      'error'
    );
    setHealthStatus('faulty', `Failed to load auth state: ${err.message}`);
    return;
  }

  try {
    const { version, isLatest } = await fetchLatestBaileysVersion().catch((err) => {
      logger.warn({ error: err.message }, '⚠️ Failed to fetch latest WA version, using fallback.');
      return { version: [2, 3000, 1015901307], isLatest: false };
    });

    logger.info(
      { version, isLatest, sessionId, sessionAuthDir, hasCreds },
      '📡 Initializing Baileys WASocket...'
    );

    const baileysLogLevel = LOG_LEVEL === 'debug' || LOG_LEVEL === 'trace' ? LOG_LEVEL : 'info';
    session.sock = makeWASocket({
      auth: state,
      version,
      logger: logger.child({ module: `baileys-${sessionId}` }, { level: baileysLogLevel }),
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: SYNC_FULL_HISTORY,
      markOnlineOnConnect: MARK_ONLINE,

      keepAliveIntervalMs: KEEP_ALIVE_INTERVAL,
      connectTimeoutMs: 90000,
      defaultQueryTimeoutMs: 90000,
      retryRequestDelayMs: 5000,
      generateHighQualityLinkPreview: true,
      linkPreviewImageOptions: {
        resolveDNSHost,
      },
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
  session.sock.ev.on('creds.update', async (creds) => {
    logger.debug(
      { sessionId },
      '🔑 Received creds.update from Baileys, saving updated credentials to disk.'
    );
    await saveCreds(creds);
  });

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
        session.qrGenerated = true;
        session.isConnecting = false;
        if (session._connectingTimeout) clearTimeout(session._connectingTimeout);
      } catch (err) {
        logger.error({ sessionId, error: err.message }, '❌ Failed to generate QR Code DataURL');
        addLog(session, 'Failed to process QR Code. Check logs.', 'error');
        setHealthStatus('faulty', 'Failed to generate QR Code');
      }
    }

    // If we receive any pairing/login updates, it means the QR code has been scanned.
    // We clear currentQR so the UI stops showing the scanned QR code.
    const isPairingUpdate =
      typeof update.isNewLogin !== 'undefined' ||
      typeof update.isOnlineOnAnotherDevice !== 'undefined' ||
      typeof update.receivedPendingNotifications !== 'undefined';

    if (isPairingUpdate && session.qrGenerated) {
      session.currentQR = null;
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

    const hasCreds = fs.existsSync(path.join(getAuthDir(sessionId), 'creds.json'));
    if (
      !hasCreds &&
      session.qrGenerated &&
      (hasPasskeyField || (isPasskeyRequest && session.currentQR === null && !session.isConnected))
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
      // Track disconnect time for missed-messages feature
      recordDisconnectTime(sessionId);
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const errorMsg =
        lastDisconnect?.error?.message || lastDisconnect?.error?.toString() || 'Unknown';

      // Detailed Baileys disconnect status code mapping for clear diagnostics
      let disconnectReason = `Connection Closed (Code ${statusCode || 'N/A'})`;
      const errorCode = lastDisconnect?.error?.code || lastDisconnect?.error?.output?.payload?.code;

      if (isLoggedOut) {
        disconnectReason = 'Session Expired / Logged Out (401)';
      } else if (errorMsg.includes('QR refs attempts ended')) {
        disconnectReason = 'QR Code Expired (Timed out after 5 attempts)';
      } else if (statusCode === DisconnectReason.connectionLost) {
        disconnectReason = 'Connection Lost to WhatsApp Servers (408)';
      } else if (statusCode === DisconnectReason.connectionReplaced) {
        disconnectReason = 'Connection Replaced by another Session/Device (428)';
      } else if (statusCode === DisconnectReason.restartRequired) {
        disconnectReason = 'WhatsApp Server requested Session Restart (515)';
      } else if (statusCode === DisconnectReason.multideviceMismatch) {
        disconnectReason = 'Multi-Device Mismatch (411)';
      } else if (statusCode === 405) {
        disconnectReason = 'Rate Limited by WhatsApp (Code 405)';
      } else if (
        ['ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ETIMEDOUT', 'ECONNRESET'].includes(errorCode)
      ) {
        disconnectReason = `Network Unreachable (${errorCode})`;
      } else if (SYSTEM_STATE.last_ha_disconnect_time) {
        disconnectReason = 'Home Assistant Integration Unreachable';
      } else if (errorMsg.includes('Handshake')) {
        disconnectReason = 'WhatsApp TLS/WebSocket Handshake Error';
      }

      if (errorMsg.includes('QR refs attempts ended')) {
        session.currentQR = null;
        session.qrGenerated = false;
        logger.info({ sessionId }, '⌛ QR Code expired, auto-cleared QR state for fresh retry.');
        addLog(
          session,
          'QR Code expired. Click reconnect or refresh to generate a new QR Code.',
          'warning'
        );
      }

      logger.warn(
        { sessionId, statusCode, errorCode, errorMsg, disconnectReason, isLoggedOut },
        `🔻 Connection closed event received`
      );

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

        // Clear any existing disconnect timer to prevent duplicate alerts
        if (session._disconnectTimer) {
          clearTimeout(session._disconnectTimer);
          session._disconnectTimer = null;
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
        session.stats.totalReconnects = (session.stats.totalReconnects || 0) + 1;
        session.stats.lifetime_reconnects = (session.stats.lifetime_reconnects || 0) + 1;
        if (!session.firstFailureTime) session.firstFailureTime = Date.now();

        setHealthStatus('running', `Disconnected: ${disconnectReason}`);

        let baseDelay = 3000;
        if (statusCode === 405) {
          // Exponential backoff for rate limits (405): 15s, 30s, 60s max
          const consecutive405 = (session.consecutive405Count || 0) + 1;
          session.consecutive405Count = consecutive405;
          baseDelay = Math.min(15000 * Math.pow(2, consecutive405 - 1), 60000);
          logger.warn(
            { sessionId, statusCode, consecutive405, baseDelay },
            `Rate limited by WhatsApp (405). Waiting ${baseDelay / 1000}s before reconnect...`
          );
        } else {
          session.consecutive405Count = 0;
        }
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
      session.consecutive405Count = 0;
      addLog(session, 'WhatsApp Connection Established! 🟢', 'success');
      session.isConnecting = false;
      session.isConnected = true;
      session.disconnectReason = null;
      session.reconnectAttempts = 0;
      session.firstFailureTime = null;
      session.qrGenerated = false;
      session.currentQR = null;

      // Initialize missed-messages window: record when we reconnected and when we went offline
      session._reconnectedAt = Date.now();
      session._offlineSince = consumeDisconnectTime(sessionId) || session._reconnectedAt;
      clearNotifiedChats();

      // Restore any pending captchas across server restart / reconnect
      restorePendingCaptchas(session);

      // Populate groupCache with all participating group subjects (names)
      if (sock.groupFetchAllParticipating) {
        sock
          .groupFetchAllParticipating()
          .then((groups) => {
            for (const [gId, g] of Object.entries(groups)) {
              if (g && g.subject) {
                session.groupCache?.set(gId, g.subject);
              }
            }
            logger.info(
              { sessionId, groupCount: Object.keys(groups).length },
              '👥 Populated group subjects in groupCache'
            );
          })
          .catch((err) => {
            logger.debug(
              { sessionId, error: err.message },
              'Failed to fetch participating groups on connect'
            );
          });
      }
      // Reset cached status so it's re-fetched with fresh data
      session._myStatusText = null;
      session._fetchingStatus = false;
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
          number: session.sock.user.id.split(':')[0],
          name: session.sock.user.name || null,
        };
      }
    }
  });

  handleIncomingMessages(session);
  registerAllListeners(session);
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

  const anyHasCreds = Array.from(sessions.keys()).some((id) =>
    fs.existsSync(path.join(getAuthDir(id), 'creds.json'))
  );

  // 1. Should we broadcast at all?
  // Stop broadcasting if already fully set up (has credentials), or if both sides are active.
  // This prevents spurious "Discovered WhatsApp Integration" popups in HA after restarts.
  const shouldBroadcast = !anyHasCreds && !(anyConnected && integrationActive);

  // 2. Should we include the secret?
  // Security: Only even consider it on trusted networks.
  let showSecret = isHANetwork();

  // Hide secret if ALREADY set up (connected or has creds)
  if (anyConnected) showSecret = false;
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

    if (currentMdnsService._server?.unref) currentMdnsService._server.unref();
    if (mdnsInstance._server?.unref) mdnsInstance._server.unref();

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
      const intervalId = setInterval(() => {
        const current = getDiscoveryStatus(sessions);
        const needsUpdate =
          current.shouldBroadcast !== DISCOVERY_STATE.lastShouldBroadcast ||
          current.showSecret !== DISCOVERY_STATE.lastShowSecret;

        if (needsUpdate) {
          logger.info('🔄 Updating mDNS discovery based on state change');
          publishMDNS(name, sessions, 0);
        }
      }, 30000);
      if (intervalId.unref) intervalId.unref();
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
