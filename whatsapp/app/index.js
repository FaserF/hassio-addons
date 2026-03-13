/**
 * WhatsApp Homeassistant Addon - Main Entry Point
 * Modularized Refactor
 */

import express from 'express';
import { logger } from './src/logger.js';
import { PORT } from './src/config.js';
import { ingressPrefixMiddleware } from './src/middleware.js';
import {
  startSessionCleanupTask,
  getSession,
  sessions,
  connectToWhatsApp,
  getAuthDir,
} from './src/session.js';
import { registerRoutes } from './src/routes/index.js';
import { SHOULD_RESET, DATA_DIR, AUTH_DIR } from './src/config.js';
import { disableResetSession } from './src/ha.js';
import { saveSystemState, SYSTEM_STATE } from './src/state.js';
import { publishMDNS } from './src/whatsapp/connection.js';
import fs from 'fs';
import path from 'path';

const app = express();

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

// --- Register Routes ---
registerRoutes(app);

// --- Start Server ---
app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, 'WhatsApp API listening');
  logger.info('✅ Service ready - Health check available at /health');

  // Auto-start session for 'default'
  const defaultSession = getSession('default');
  if (!defaultSession.isConnected) {
    const defaultDir = getAuthDir('default');
    if (fs.existsSync(path.join(defaultDir, 'creds.json'))) {
      logger.info('🚀 Auto-starting default session...');
    } else {
      logger.info('🚀 First run or no credentials - auto-starting default session for pairing...');
    }
    connectToWhatsApp('default', sessions, getSession);
  }

  // Auto-start all other sessions
  const sessionsDir = path.join(DATA_DIR, 'sessions');
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
  startSessionCleanupTask(connectToWhatsApp);
});

async function handleShutdown(signal) {
  logger.info({ signal }, '👋 Shutdown signal received. Saving state and cleaning up...');
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
  setTimeout(() => {
    logger.info('🛑 Process exiting.');
    process.exit(0);
  }, 500);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGHUP', () => handleShutdown('SIGHUP'));

// Start mDNS advertisement
const baseMDNSName = process.env.MDNS_NAME || 'whatsapp homeassistant app';
publishMDNS(baseMDNSName);

// --- Process Error Handling ---
process.on('uncaughtException', (err) => {
  logger.fatal({ error: err.message, stack: err.stack }, 'Uncaught Exception');
  // In a container, we might want to exit and let s6-overlay restart us
  // but for now we'll just log and hope for the best
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
});
