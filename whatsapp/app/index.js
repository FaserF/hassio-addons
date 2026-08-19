/**
 * WhatsApp Homeassistant App - Main Entry Point
 */

import express from 'express';
import { logger } from './src/logger.js';
import { PORT } from './src/config.js';
import { ingressPrefixMiddleware, httpLoggerMiddleware } from './src/middleware.js';
import {
  startSessionCleanupTask,
  getSession,
  sessions,
  getAuthDir,
  deleteSession,
  saveMessageStore,
  saveStats,
} from './src/session.js';
import { registerRoutes } from './src/routes/index.js';
import { SHOULD_RESET, DATA_DIR, AUTH_DIR } from './src/config.js';
import { disableResetSession } from './src/ha.js';
import { saveSystemState, SYSTEM_STATE, setHealthStatus } from './src/state.js';
import { publishMDNS, connectToWhatsApp, stopMDNS } from './src/whatsapp/connection.js';
import { ADDON_SLUG } from './src/config.js';
import fs from 'fs';
import path from 'path';

const app = express();
app.set('trust proxy', true);

// Suppress unhandled promise rejections from Baileys connection resets/closures
process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);
  const code = reason?.output?.statusCode || reason?.statusCode;

  if (
    code === 428 ||
    code === 408 ||
    code === 401 ||
    msg?.includes('Connection Closed') ||
    msg?.includes('Stream Errored') ||
    msg?.includes('QR refs attempts ended')
  ) {
    logger.debug({ error: msg, code }, '🛡️ Handled expected Baileys connection closure rejection');
    return;
  }
  logger.warn({ error: msg, code }, '⚠️ Unhandled promise rejection');
});

if (SHOULD_RESET) {
  logger.warn('⚠️ RESET_SESSION ENABLED - Clearing authentication data...');
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    logger.info('✅ Authentication directory cleared.');
  }
  disableResetSession();
}

// --- Global Middleware ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(ingressPrefixMiddleware);
app.use(httpLoggerMiddleware);

// --- Register Routes ---
registerRoutes(app);

// --- Start Server ---
app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, 'WhatsApp API listening');
  logger.info('✅ Service ready - Health check available at /health');
  setHealthStatus('running', 'API server is listening');

  // Auto-start session for 'default'
  const defaultSession = getSession('default');
  const defaultDir = getAuthDir('default');
  const hasDefaultCreds = fs.existsSync(path.join(defaultDir, 'creds.json'));

  // Check if any other session already has credentials
  const sessionsDir = path.join(DATA_DIR, 'sessions');
  let otherHasCreds = false;
  if (fs.existsSync(sessionsDir)) {
    otherHasCreds = fs.readdirSync(sessionsDir).some((sDir) => {
      return fs.existsSync(path.join(sessionsDir, sDir, 'creds.json'));
    });
  }

  if (!defaultSession.isConnected && (hasDefaultCreds || !otherHasCreds)) {
    if (hasDefaultCreds) {
      logger.info('🚀 Auto-starting default session...');
    } else {
      logger.info('🚀 First run or no credentials - auto-starting default session for pairing...');
    }
    connectToWhatsApp('default', sessions, getSession).catch((err) => {
      logger.warn({ error: err?.message || err }, '⚠️ Default session auto-start failed');
    });
  }

  // Auto-start all other sessions
  if (fs.existsSync(sessionsDir)) {
    const sessionDirs = fs.readdirSync(sessionsDir);
    for (const sDir of sessionDirs) {
      const fullPath = path.join(sessionsDir, sDir);
      if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'creds.json'))) {
        logger.info({ sessionId: sDir }, '📦 Session credentials found, auto-starting...');
        connectToWhatsApp(sDir, sessions, getSession).catch(() => {});
      }
    }
  }

  // Start background tasks
  startSessionCleanupTask(deleteSession);
});

async function handleShutdown(signal) {
  logger.info({ signal }, '👋 Shutdown signal received. Saving state and cleaning up...');
  const isUpdating = fs.existsSync(path.join(DATA_DIR, 'updating.flag'));
  const statusStr = isUpdating ? 'updating' : 'shutting_down';
  const descStr = isUpdating
    ? 'Addon is updating to new version'
    : 'Addon is restarting / shutting down';

  setHealthStatus(statusStr, descStr);
  for (const session of sessions.values()) {
    if (session.stats) {
      session.stats.shutting_down = true;
      session.stats.last_disconnect_reason = statusStr;
    }
  }
  let anyConnected = false;
  for (const session of sessions.values()) {
    if (session.isConnected) {
      anyConnected = true;
      break;
    }
  }
  if (anyConnected && !SYSTEM_STATE.last_disconnect_time) {
    SYSTEM_STATE.last_disconnect_time = Date.now();
    saveSystemState();
  }

  // Save all message stores and stats
  for (const session of sessions.values()) {
    saveMessageStore(session);
    saveStats(session);
  }

  // Stop mDNS
  await stopMDNS();

  setTimeout(() => {
    logger.info('🛑 Process exiting.');
    process.exit(0);
  }, 500);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGHUP', () => handleShutdown('SIGHUP'));

// Start mDNS advertisement (skip in CI to avoid hanging event loop)
const baseMDNSName =
  process.env.MDNS_NAME ||
  (process.env.SUPERVISOR_TOKEN
    ? `WhatsApp Homeassistant App (${ADDON_SLUG})`
    : `WhatsApp Gateway (${ADDON_SLUG})`);
if (!process.env.CI) {
  publishMDNS(baseMDNSName, sessions);
}

// --- Process Error Handling ---
process.on('uncaughtException', (err) => {
  logger.fatal({ error: err.message, stack: err.stack }, 'Uncaught Exception');
  setHealthStatus('faulty', `Uncaught Exception: ${err.message}`);
  // In a container, we might want to exit and let s6-overlay restart us
  // but for now we'll just log and hope for the best
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
});
