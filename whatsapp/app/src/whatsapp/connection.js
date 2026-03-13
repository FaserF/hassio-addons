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

// --- Baileys 405 Workaround ---
import { BAILEYS_VERSION } from '../config.js';
const BAILEYS_405_AFFECTED_VERSION = '7.0.0-rc.9';
const BAILEYS_405_VERSION_OVERRIDE = [2, 3000, 1033893291];
const APPLY_BAILEYS_405_FIX = BAILEYS_VERSION === BAILEYS_405_AFFECTED_VERSION;

export async function connectToWhatsApp(sessionId = 'default', sessions, getSession) {
  const session = getSession(sessionId);
  const sessionAuthDir = getAuthDir(sessionId);
  const hasCreds = fs.existsSync(path.join(sessionAuthDir, 'creds.json'));

  const now = Date.now();
  const isInterested = now - session.lastInterestTime < 60000;

  if (!hasCreds && !isInterested) {
    logger.info({ sessionId }, '💤 No credentials and no active interest. Skipping connection.');
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

  bindStore(session, session.sock.ev);
  session.sock.ev.on('creds.update', saveCreds);

  const sock = session.sock;
  sock.ev.on('connection.update', async (update) => {
    if (session.sock !== sock) return;

    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info({ sessionId }, 'QR Code received');
      addLog(session, 'QR Code generated. Waiting for scan...', 'success');
      session.currentQR = await QRCode.toDataURL(qr);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const reason = lastDisconnect.error?.message || lastDisconnect.error?.toString() || 'Unknown';
      addLog(session, `Connection closed (Code: ${statusCode || 'None'}): ${reason}`, 'warning');

      session.isConnected = false;

      if (ADMIN_NOTIFICATIONS_ENABLED && !SYSTEM_STATE.last_whatsapp_online) {
        SYSTEM_STATE.last_whatsapp_online = Date.now();
        saveSystemState();
        logger.warn({ sessionId }, '⚠️ WhatsApp disconnected. Admin notification pending restore.');

        notifyAdmins(
          session,
          `🔴 *WhatsApp Disconnected*\n\n• *Session:* \`${sessionId}\`\n• *Reason:* ${reason}\n• *Status:* Attempting to reconnect.`
        );
      }

      if (isLoggedOut) {
        session.disconnectReason = 'logged_out';
        session.reconnectAttempts = 0;
        session.firstFailureTime = null;
        if (sessionId !== 'default') {
          logger.info({ sessionId }, 'Auto-cleaning logged out session...');
          deleteSession(sessionId);
        }
      } else {
        session.disconnectReason = 'connection_error';
        session.reconnectAttempts += 1;
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

      if (ADMIN_NOTIFICATIONS_ENABLED && SYSTEM_STATE.last_whatsapp_online) {
        const downtime = Date.now() - SYSTEM_STATE.last_whatsapp_online;
        if (downtime > NOTIFY_RESTORE_THRESHOLD) {
          SYSTEM_STATE.last_whatsapp_online = null;
          saveSystemState();
          notifyAdmins(
            session,
            `🟢 *WhatsApp Connection Restored*\n\n• *Downtime:* ${formatDuration(downtime)}\n• *Status:* Bot is back online.`
          );
        }
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

    service.on('error', (err) => {
      if (err.message.includes('already in use') && attempt < 10) {
        logger.warn({ serviceName }, 'mDNS name in use, retrying...');
        instance.destroy();
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
