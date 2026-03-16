import path from 'path';
import fs from 'fs';
import { LRUCache } from 'lru-cache';
import { logger } from './logger.js';
import { DATA_DIR, AUTH_DIR, BAILEYS_VERSION } from './config.js';
import { formatHATime } from './utils/format.js';

export const sessions = new Map();
export const SESSION_ID_REGEX = /^[a-zA-Z0-9_.-]+$/;

/**
 * Sanitizes a session ID to prevent path traversal and ensure safe characters.
 */
export function sanitizeSessionId(sessionId) {
  if (!sessionId) return 'default';
  const base = path.basename(sessionId);
  const sanitized = base.replace(/[^\w.-]/g, '');

  if (!sanitized || sanitized === '..' || !SESSION_ID_REGEX.test(sanitized)) {
    return 'default';
  }
  return sanitized.toLowerCase();
}

/**
 * Retrieves the authorization directory for a given session.
 */
export function getAuthDir(sessionId) {
  const safeSessionId = sanitizeSessionId(sessionId);
  const dir =
    safeSessionId === 'default' ? AUTH_DIR : path.join(DATA_DIR, 'sessions', safeSessionId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Retrieves or creates a session object.
 */
export function getSession(rawSessionId) {
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
      messageStore: new LRUCache({ max: 1000, ttl: 1000 * 60 * 60 * 24 }), // 1000 messages or 24h
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
        totalReconnects: 0,
        last_disconnect_time: null,
        last_disconnect_reason: null,
        start_time: Date.now(),
        my_number: 'Unknown',
        version: BAILEYS_VERSION,
      },
    });
    loadMessageStore(sessions.get(sessionId));
  }
  return sessions.get(sessionId);
}

/**
 * Persists the message store to disk.
 */
export function saveMessageStore(session) {
  if (!session.messageStore) return;
  const file = path.join(getAuthDir(session.id), 'message_store.json');
  try {
    const data = session.messageStore.dump();
    fs.writeFileSync(file, JSON.stringify(data));
    logger.debug({ sessionId: session.id }, '💾 Message store saved to disk');
  } catch (e) {
    logger.error({ sessionId: session.id, error: e.message }, '❌ Failed to save message store');
  }
}

/**
 * Loads the message store from disk.
 */
export function loadMessageStore(session) {
  const file = path.join(getAuthDir(session.id), 'message_store.json');
  if (fs.existsSync(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      session.messageStore.load(data);
      logger.info({ sessionId: session.id, entries: data.length }, '📂 Message store loaded from disk');
    } catch (e) {
      logger.error({ sessionId: session.id, error: e.message }, '❌ Failed to load message store');
    }
  }
}

/**
 * Helper to get session from request query, body or headers.
 */
export function getReqSession(req) {
  const sessionId = sanitizeSessionId(
    req.query.session_id || req.body?.session_id || req.headers['x-session-id'] || 'default'
  );
  return getSession(sessionId);
}

/**
 * Adds a log entry to the session's in-memory log.
 */
export function addLog(session, msg, type = 'info') {
  const timestamp = formatHATime(new Date());
  session.connectionLogs.unshift({ timestamp, msg, type });
  if (session.connectionLogs.length > 50) session.connectionLogs.pop();
}

/**
 * Removes a session and its data completely.
 */
export async function deleteSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session && session.sock) {
    try {
      session.sock.logout();
      session.sock.ev.removeAllListeners();
      session.sock.end(new Error('Session deleted'));
    } catch (e) {
      logger.debug({ sessionId, error: e.message }, 'Error closing socket during delete');
    }
  }

  if (session && session.haMonitorInterval) {
    clearInterval(session.haMonitorInterval);
  }

  sessions.delete(sessionId);

  const authDir = getAuthDir(sessionId);
  if (sessionId !== 'default') {
    try {
      if (fs.existsSync(authDir)) {
        logger.info({ sessionId, authDir }, '🗑️ Deleting session directory...');
        fs.rmSync(authDir, { recursive: true, force: true });
        return true;
      }
    } catch (e) {
      logger.error({ sessionId, error: e.message }, 'Failed to delete session directory');
    }
  }
  return false;
}

/**
 * Signals that someone is actively watching/configuring this session.
 */
export function signalInterest(sessionId, connectFn) {
  const session = getSession(sessionId);
  const now = Date.now();
  const alreadyInterested = now - session.lastInterestTime < 60000;
  session.lastInterestTime = now;

  if (
    (!alreadyInterested || !session.sock || sessionId === 'default') &&
    !session.isConnected &&
    (!session.sock || session.sock.ws?.isClosed)
  ) {
    const authDir = getAuthDir(sessionId);
    const hasCreds = fs.existsSync(path.join(authDir, 'creds.json'));

    if (!hasCreds || (sessionId === 'default' && !session.sock)) {
      logger.info({ sessionId }, '🎯 Interest signaled - starting connection...');
      addLog(session, 'Interest signaled - initiating connection...', 'info');
      connectFn(sessionId, sessions, getSession).catch((err) => {
        logger.error({ error: err.message, sessionId }, 'Failed to start WhatsApp connection');
        addLog(session, `Failed to start connection: ${err.message}`, 'error');
      });
    }
  }
}

/**
 * Background task to clean up stale sessions.
 */
export function startSessionCleanupTask(deleteSessionFn) {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  const STALE_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30 days

  setInterval(async () => {
    logger.info('🧹 Running session cleanup task...');
    const now = Date.now();

    for (const [id, session] of sessions.entries()) {
      if (id === 'default') continue;
      if (session.isConnected) continue;

      const lastActivity = Math.max(
        session.lastInterestTime,
        session.stats.last_received_time || 0
      );
      if (now - lastActivity > STALE_THRESHOLD) {
        logger.info({ sessionId: id }, '🧹 Removing stale in-memory session');
        await deleteSessionFn(id);
      }
    }

    const sessionsDir = path.join(DATA_DIR, 'sessions');
    if (fs.existsSync(sessionsDir)) {
      const sessionDirs = fs
        .readdirSync(sessionsDir)
        .filter((d) => fs.statSync(path.join(sessionsDir, d)).isDirectory());
      for (const sDir of sessionDirs) {
        if (sessions.has(sDir)) continue;

        const fullPath = path.join(sessionsDir, sDir);
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > STALE_THRESHOLD) {
          logger.info({ sessionId: sDir }, '🧹 Removing stale session directory from disk');
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      }
    }
  }, CLEANUP_INTERVAL);
}
