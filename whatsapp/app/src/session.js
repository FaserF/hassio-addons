import path from 'path';
import fs from 'fs';
import { LRUCache } from 'lru-cache';
import { BufferJSON, delay } from '@whiskeysockets/baileys';
import { logger } from './logger.js';
import { DATA_DIR, AUTH_DIR, BAILEYS_VERSION, MESSAGE_SEND_INTERVAL } from './config.js';
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
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      if (e.code !== 'EACCES') throw e;
    }
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
      get qr() {
        return this.currentQR;
      },
      set qr(val) {
        this.currentQR = val;
      },
      isConnected: false,
      disconnectReason: null,
      reconnectAttempts: 0,
      firstFailureTime: null,
      eventQueue: [],
      connectionLogs: [],
      recentSent: [],
      recentReceived: [],
      recentFailures: [],
      messageStore: new LRUCache({ max: 5000, ttl: 1000 * 60 * 60 * 24 * 7 }), // 5000 messages or 7 days
      processedMessageIds: new LRUCache({ max: 5000, ttl: 1000 * 60 * 15 }), // 15 minutes deduplication window
      chatCache: new Map(),
      groupCache: new Map(),
      contactCache: new Map(),
      initialChatsReceived: false,
      statusRateLimit: new Map(), // sender -> lastStatusTime
      unauthorizedWarned: new Set(), // sender IDs
      lastGroupFetch: 0,
      groupFetchCooldownUntil: 0,
      sendQueue: Promise.resolve(),
      lastInterestTime: 0, // Track when someone last looked at this session
      passkeyDetected: false, // True when WhatsApp enforces a passkey during device linking
      passkeyWaiting: false, // True while waiting for phone approval during passkey ceremony
      passkeyChallenge: null, // Raw challenge data from WhatsApp (if available)
      qrGenerated: false,
      stats: {
        sent: 0,
        received: 0,
        failed: 0,
        lifetime_sent: 0,
        lifetime_received: 0,
        lifetime_failed: 0,
        lifetime_reconnects: 0,
        first_install_time: null,
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
    loadStats(sessions.get(sessionId));
    loadMessageStore(sessions.get(sessionId));
    loadContactCache(sessions.get(sessionId));
    loadChatCache(sessions.get(sessionId));
    // Start periodic save for this session
    const saveInterval = setInterval(
      () => {
        const s = sessions.get(sessionId);
        if (!s) {
          clearInterval(saveInterval);
          return;
        }
        saveStats(s);
        saveMessageStore(s);
        saveContactCache(s);
        saveChatCache(s);
      },
      5 * 60 * 1000
    ); // Every 5 minutes
    if (saveInterval.unref) saveInterval.unref();
    sessions.get(sessionId)._saveInterval = saveInterval;
  }
  return sessions.get(sessionId);
}

/**
 * Enqueues a task (like sending a message) to be executed sequentially with rate limiting.
 * Ensures the queue continues even if a single task fails.
 */
export async function enqueue(session, task) {
  if (!session.sendQueue) {
    session.sendQueue = Promise.resolve();
  }
  const taskPromise = session.sendQueue.then(async () => {
    try {
      const res = await task();
      return res;
    } catch (e) {
      if (e.message?.includes('rate-overlimit')) {
        logger.warn(
          { sessionId: session.id },
          '🚀 Rate limit hit during enqueued task, waiting 5s before next attempt...'
        );
        await delay(5000);
      }
      throw e;
    } finally {
      if (MESSAGE_SEND_INTERVAL > 0) await delay(MESSAGE_SEND_INTERVAL);
    }
  });

  // Ensure the next task always starts even if this one failed
  session.sendQueue = taskPromise.catch(() => {});

  return taskPromise;
}

/**
 * Persists the message store to disk.
 */
export function saveMessageStore(session) {
  if (!session || !session.messageStore) return;
  const file = path.join(getAuthDir(session.id), 'message_store.json');
  try {
    const data = session.messageStore.dump();
    fs.writeFileSync(file, JSON.stringify(data, BufferJSON.replacer));
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
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'), BufferJSON.reviver);
      session.messageStore.load(data);
      logger.info(
        { sessionId: session.id, entries: data.length },
        '📂 Message store loaded from disk'
      );
    } catch (e) {
      logger.error({ sessionId: session.id, error: e.message }, '❌ Failed to load message store');
    }
  }
}

/**
 * Persists the contact cache to disk.
 */
export function saveContactCache(session) {
  if (!session || !session.contactCache) return;
  const file = path.join(getAuthDir(session.id), 'contact_cache.json');
  try {
    const entries = Array.from(session.contactCache.entries());
    fs.writeFileSync(file, JSON.stringify(entries));
    logger.debug(
      { sessionId: session.id, count: entries.length },
      '💾 Contact cache saved to disk'
    );
  } catch (e) {
    logger.error({ sessionId: session.id, error: e.message }, '❌ Failed to save contact cache');
  }
}

/**
 * Loads the contact cache from disk.
 */
export function loadContactCache(session) {
  const file = path.join(getAuthDir(session.id), 'contact_cache.json');
  if (fs.existsSync(file)) {
    try {
      const entries = JSON.parse(fs.readFileSync(file, 'utf-8'));
      for (const [id, contact] of entries) {
        session.contactCache.set(id, contact);
      }
      logger.info(
        { sessionId: session.id, count: entries.length },
        '📂 Contact cache loaded from disk'
      );
    } catch (e) {
      logger.error({ sessionId: session.id, error: e.message }, '❌ Failed to load contact cache');
    }
  }
}

/**
 * Persists session stats (including lifetime stats) to disk.
 */
export function saveStats(session) {
  if (!session || !session.stats) return;
  const file = path.join(getAuthDir(session.id), 'stats.json');
  try {
    fs.writeFileSync(file, JSON.stringify(session.stats, null, 2), 'utf-8');
  } catch (e) {
    logger.error({ sessionId: session.id, error: e.message }, '❌ Failed to save session stats');
  }
}

/**
 * Loads persisted stats from disk and merges lifetime counters.
 */
export function loadStats(session) {
  const file = path.join(getAuthDir(session.id), 'stats.json');
  if (fs.existsSync(file)) {
    try {
      const persisted = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (persisted && typeof persisted === 'object') {
        session.stats.lifetime_sent = persisted.lifetime_sent || persisted.sent || 0;
        session.stats.lifetime_received = persisted.lifetime_received || persisted.received || 0;
        session.stats.lifetime_failed = persisted.lifetime_failed || persisted.failed || 0;
        session.stats.lifetime_reconnects =
          persisted.lifetime_reconnects || persisted.totalReconnects || 0;
        if (persisted.first_install_time) {
          session.stats.first_install_time = persisted.first_install_time;
        }
        logger.info(
          { sessionId: session.id, lifetimeSent: session.stats.lifetime_sent },
          '📂 Session stats loaded from disk'
        );
      }
    } catch (e) {
      logger.error({ sessionId: session.id, error: e.message }, '❌ Failed to load session stats');
    }
  }
  if (!session.stats.first_install_time) {
    session.stats.first_install_time = Date.now();
  }
  saveStats(session);
}

/**
 * Persists the chat cache to disk.
 */
export function saveChatCache(session) {
  if (!session || !session.chatCache) return;
  const file = path.join(getAuthDir(session.id), 'chat_cache.json');
  try {
    const entries = Array.from(session.chatCache.keys());
    fs.writeFileSync(file, JSON.stringify(entries), 'utf-8');
  } catch (e) {
    logger.error({ sessionId: session.id, error: e.message }, '❌ Failed to save chat cache');
  }
}

/**
 * Loads the chat cache from disk.
 */
export function loadChatCache(session) {
  const file = path.join(getAuthDir(session.id), 'chat_cache.json');
  if (fs.existsSync(file)) {
    try {
      const keys = JSON.parse(fs.readFileSync(file, 'utf-8'));
      for (const k of keys) {
        session.chatCache.set(k, true);
      }
      logger.info({ sessionId: session.id, count: keys.length }, '📂 Chat cache loaded from disk');
    } catch (e) {
      logger.error({ sessionId: session.id, error: e.message }, '❌ Failed to load chat cache');
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
  if (session) {
    session.isDestroyed = true;
    session.isConnecting = false;
    session.isConnected = false;

    if (session.sock) {
      try {
        session.sock.ev.removeAllListeners();
        session.sock.end(new Error('Session deleted'));
      } catch (e) {
        logger.debug({ sessionId, error: e.message }, 'Error closing socket during delete');
      }
      session.sock = null;
    }

    if (session.haMonitorInterval) clearInterval(session.haMonitorInterval);
    if (session._saveInterval) clearInterval(session._saveInterval);
    if (session._connectingTimeout) clearTimeout(session._connectingTimeout);
    if (session._restoreTimer) clearTimeout(session._restoreTimer);
    if (session._disconnectTimer) clearTimeout(session._disconnectTimer);
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
 * Purges all disconnected/stale sessions from memory and disk.
 */
export async function purgeDisconnectedSessions() {
  let purgedCount = 0;
  const now = Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;

  for (const [id, session] of sessions.entries()) {
    // Multi-Account Protection: Never purge a session that is connected, has an active QR code,
    // is in progress of connecting, or had user interest/pairing activity in the last 5 minutes.
    const isActiveOrPairing =
      session.isConnected ||
      session.currentQR ||
      session.isConnecting ||
      (session.lastInterestTime && now - session.lastInterestTime < FIVE_MINUTES);

    if (isActiveOrPairing) {
      continue;
    }

    logger.info({ sessionId: id }, '🧹 Purging inactive disconnected session');
    await deleteSession(id);
    purgedCount++;
  }

  const sessionsDir = path.join(DATA_DIR, 'sessions');
  if (fs.existsSync(sessionsDir)) {
    try {
      const sessionDirs = fs
        .readdirSync(sessionsDir)
        .filter((d) => fs.statSync(path.join(sessionsDir, d)).isDirectory());
      for (const sDir of sessionDirs) {
        if (!sessions.has(sDir)) {
          const fullPath = path.join(sessionsDir, sDir);
          fs.rmSync(fullPath, { recursive: true, force: true });
          purgedCount++;
        }
      }
    } catch (e) {
      logger.error({ error: e.message }, 'Failed to scan/delete orphan session directories');
    }
  }
  return purgedCount;
}

/**
 * Signals that someone is actively watching/configuring this session.
 */
export function signalInterest(sessionId, connectFn) {
  const session = getSession(sessionId);
  session.lastInterestTime = Date.now(); // Needed by connectToWhatsApp to know the user is watching

  // Socket is considered missing/dead if:
  // - there is no sock object at all, OR
  // - there is a sock, but session has no active QR code and is neither connected nor connecting
  const socketMissing =
    !session.sock || (!session.isConnected && !session.isConnecting && !session.currentQR);
  logger.debug(
    {
      sessionId,
      isConnected: session.isConnected,
      isConnecting: session.isConnecting,
      hasSock: !!session.sock,
      socketMissing,
    },
    '🎯 signalInterest evaluated'
  );

  if (!session.isConnected && socketMissing) {
    logger.info({ sessionId }, '🎯 Interest signaled - starting connection...');
    addLog(session, 'Interest signaled - initiating connection...', 'info');
    const fn =
      typeof connectFn === 'function'
        ? connectFn
        : async (sId, sessMap, getSess) => {
            const { connectToWhatsApp } = await import('./whatsapp/connection.js');
            return connectToWhatsApp(sId, sessMap, getSess);
          };
    fn(sessionId, sessions, getSession).catch((err) => {
      logger.error({ error: err.message, sessionId }, 'Failed to start WhatsApp connection');
      addLog(session, `Failed to start connection: ${err.message}`, 'error');
    });
  }
}

/**
 * Background task to clean up stale sessions.
 */
export function startSessionCleanupTask(deleteSessionFn) {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  const STALE_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30 days

  const timer = setInterval(async () => {
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
        if (typeof deleteSessionFn === 'function') {
          await deleteSessionFn(id);
        } else {
          sessions.delete(id);
        }
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

    // Media directory cleanup (files older than MEDIA_RETENTION_DAYS)
    const { MEDIA_DIR, MEDIA_RETENTION_DAYS } = await import('./config.js');
    if (MEDIA_RETENTION_DAYS > 0 && fs.existsSync(MEDIA_DIR)) {
      const maxAgeMs = MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      try {
        const files = fs.readdirSync(MEDIA_DIR);
        let removedCount = 0;
        for (const file of files) {
          const filePath = path.join(MEDIA_DIR, file);
          try {
            const fileStats = fs.statSync(filePath);
            if (fileStats.isFile() && now - fileStats.mtimeMs > maxAgeMs) {
              fs.unlinkSync(filePath);
              removedCount += 1;
            }
          } catch (e) {
            /* ignore individual file errors */
          }
        }
        if (removedCount > 0) {
          logger.info(
            { removedCount, retentionDays: MEDIA_RETENTION_DAYS },
            '🧹 Cleaned up old media files'
          );
        }
      } catch (err) {
        logger.warn({ error: err.message }, '⚠️ Media cleanup failed');
      }
    }
  }, CLEANUP_INTERVAL);
  if (timer.unref) timer.unref();
}
