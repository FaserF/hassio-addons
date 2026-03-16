import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
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
import { SYSTEM_STATE, saveSystemState } from '../state.js';
import { formatDuration } from '../utils/format.js';
import { notifyAdmins } from './actions.js';
import { bindStore, handleIncomingMessages, checkSystemUpdates, monitorHACore } from './events.js';
import { PORT } from '../config.js';

import { BAILEYS_VERSION } from '../config.js';
const BAILEYS_405_AFFECTED_VERSION = '7.0.0-rc.9';
const BAILEYS_405_VERSION_OVERRIDE = [2, 3000, 1033893291];
const APPLY_BAILEYS_405_FIX = BAILEYS_VERSION === BAILEYS_405_AFFECTED_VERSION;

export async function connectToWhatsApp(sessionId = 'default', sessions, getSession) {
  const session = getSession(sessionId);
  const sessionAuthDir = getAuthDir(sessionId);
  const hasCreds = fs.existsSync(path.join(sessionAuthDir, 'creds.json'));

  const now = Date.now();
  const isInterested = sessionId === 'default' || now - session.lastInterestTime < 60000;

  if (!hasCreds && !isInterested) {
    logger.info({ sessionId }, '💤 No credentials and no active interest. Skipping connection.');
    addLog(session, 'Waiting for user to open Dashboard to start pairing...', 'info');
    session.currentQR = null;
    return;
  }

  addLog(session, `Starting connection request for session: ${sessionId}...`, 'info');
  const { state, saveCreds } = await useMultiFileAuthState(sessionAuthDir);

  try {
    session.sock = makeWASocket({
      auth: state,
      logger: logger.child({ module: `baileys-${sessionId}` }, { level: 'warn' }),
      browser: Browsers.ubuntu('Chrome'),
      ...(APPLY_BAILEYS_405_FIX && { version: BAILEYS_405_VERSION_OVERRIDE }),
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
  } catch (err) {
    logger.error({ sessionId, error: err.message }, '💥 Failed to initialize WASocket');
    addLog(session, `Failed to initialize WhatsApp: ${err.message}`, 'error');
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
      } catch (err) {
        logger.error({ sessionId, error: err.message }, '❌ Failed to generate QR Code DataURL');
        addLog(session, 'Failed to process QR Code. Check logs.', 'error');
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

      session.isConnected = false;

      if (ADMIN_NOTIFICATIONS_ENABLED && !SYSTEM_STATE.last_disconnect_time) {
        SYSTEM_STATE.last_disconnect_time = Date.now();
        SYSTEM_STATE.last_disconnect_reason = disconnectReason;
        saveSystemState();
        logger.warn({ sessionId }, '⚠️ WhatsApp disconnected. Admin notification pending restore.');

        notifyAdmins(
          session,
          `🔴 *WhatsApp Disconnected*\n\n• *Session:* \`${sessionId}\`\n• *Reason:* ${disconnectReason}\n• *Detail:* ${errorMsg}\n• *Status:* Attempting to reconnect.`
        );
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

        const baseDelay = APPLY_BAILEYS_405_FIX ? 5000 : 3000;
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
      session.isConnected = true;
      session.disconnectReason = null;
      session.reconnectAttempts = 0;
      session.firstFailureTime = null;

      if (ADMIN_NOTIFICATIONS_ENABLED && SYSTEM_STATE.last_disconnect_time) {
        const downtime = Date.now() - SYSTEM_STATE.last_disconnect_time;
        if (downtime > NOTIFY_RESTORE_THRESHOLD) {
          const reasonText = SYSTEM_STATE.last_disconnect_reason
            ? `\n• *Reason:* ${SYSTEM_STATE.last_disconnect_reason}`
            : '';
          notifyAdmins(
            session,
            `🟢 *WhatsApp Connection Restored*\n\n• *Downtime:* ${formatDuration(downtime)}${reasonText}\n• *Status:* Bot is back online.`
          );
        }
        SYSTEM_STATE.last_disconnect_time = null;
        SYSTEM_STATE.last_disconnect_reason = null;
        saveSystemState();
      }

      if (!session._monitorsStarted) {
        session._monitorsStarted = true;
        checkSystemUpdates(session).catch(() => {});
        monitorHACore(session).catch(() => {});
      }
      if (session.sock?.user) {
        session.stats.my_number = session.sock.user.id.split(':')[0];
      }
    }
  });

  handleIncomingMessages(session);
}

/**
 * mDNS / Bonjour advertisement
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function publishMDNS(name, attempt = 0) {
  try {
    const { Bonjour } = await import('bonjour-service');
    const instance = new Bonjour();
    const serviceName = attempt === 0 ? name : `${name} ${attempt}`;

    const service = instance.publish({
      name: serviceName,
      type: 'ha-whatsapp',
      protocol: 'tcp',
      port: PORT,
      txt: { version: '1.0.0', api_path: '/', auth_type: 'token' },
    });

    service.on('error', async (err) => {
      if (err.message.includes('already in use') && attempt < 10) {
        logger.warn({ serviceName }, 'mDNS name in use, retrying...');
        instance.destroy();
        await delay(1000);
        publishMDNS(name, attempt + 1);
      } else {
        logger.error({ serviceName, error: err.message }, 'mDNS advertisement error');
      }
    });

    service.on('up', () => {
      logger.info({ serviceName, port: PORT }, '📢 Publishing mDNS service');
    });
  } catch (e) {
    logger.warn({ error: e.message }, 'mDNS advertisement failed to initialize');
  }
}
