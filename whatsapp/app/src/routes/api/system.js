import fs from 'fs';
import path from 'path';
import { authMiddleware, uiAuthMiddleware, uiLimiter } from '../../middleware.js';
import {
  getSession,
  sessions,
  sanitizeSessionId,
  addLog,
  signalInterest,
  purgeDisconnectedSessions,
} from '../../session.js';
import {
  DATA_DIR,
  ADDON_VERSION,
  INTEGRATION_VERSION,
  BAILEYS_VERSION,
  EXPRESS_VERSION,
  ALPINE_VERSION,
  NODE_VERSION,
  ADDON_SLUG,
} from '../../config.js';
import { WEBHOOK_ENABLED, WEBHOOK_URL, updateWebhookConfig } from '../../webhook.js';
import { maskData } from '../../utils/security.js';
import { HEALTH_STATE } from '../../state.js';
import { logger } from '../../logger.js';
import { connectToWhatsApp } from '../../whatsapp/connection.js';

import { getLatestReleases } from '../../utils/versionCheck.js';
import { asyncHandler } from './helpers.js';

export function registerSystemRoutes(app) {
  app.get('/health', uiLimiter, (req, res) => {
    try {
      res.json({
        status: HEALTH_STATE.status || 'ok',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.get(
    '/api/dashboard',
    uiLimiter,
    asyncHandler(async (req, res) => {
      // Scan disk for all session folders so sessionList is complete
      const sessionsDir = path.join(DATA_DIR, 'sessions');
      if (fs.existsSync(sessionsDir)) {
        try {
          const sDirs = fs.readdirSync(sessionsDir);
          for (const sDir of sDirs) {
            const fullPath = path.join(sessionsDir, sDir);
            if (fs.statSync(fullPath).isDirectory()) {
              getSession(sDir);
            }
          }
        } catch (e) {}
      }

      const sessionId = sanitizeSessionId(req.query.session_id || 'default');
      const session = getSession(sessionId);

      // Signal interest: if the session is disconnected and has no active socket,
      // trigger a reconnect attempt so the dashboard auto-heals without a page reload.
      // Wrapped in try-catch so a signalInterest error never causes a 500 on the dashboard.
      try {
        signalInterest(sessionId, connectToWhatsApp);
      } catch (e) {
        logger.warn({ sessionId, error: e.message }, 'signalInterest threw during dashboard poll');
      }

      const sessionList = Array.from(sessions.values()).map((s) => ({
        id: s.id,
        connected: s.isConnected,
      }));

      let statusText = session._myStatusText || null;
      if (session.sock?.user) {
        const fullJid = session.sock.user.id || session.sock.user.jid;
        const cleanJid = fullJid ? fullJid.split(':')[0].split('@')[0] + '@s.whatsapp.net' : null;

        if (!session._myStatusText && !session._fetchingStatus) {
          session._fetchingStatus = true;
          (async () => {
            try {
              // fetchStatus returns an array of { jid, status: { status, setAt } }
              const list = await session.sock.fetchStatus(fullJid);
              const fallbackList =
                !list?.length && cleanJid ? await session.sock.fetchStatus(cleanJid) : null;
              const resultList = (list?.length ? list : fallbackList) || [];
              const entry = resultList[0];
              if (entry) {
                // Baileys USyncStatusProtocol nests the text under entry.status.status
                const resText =
                  entry?.status?.status ??
                  entry?.status ??
                  (typeof entry === 'string' ? entry : null);
                if (resText && typeof resText === 'string' && resText.length > 0) {
                  session._myStatusText = resText;
                }
              }
            } catch (e) {
            } finally {
              session._fetchingStatus = false;
            }
          })();
        }
        statusText = session._myStatusText || null;
      }

      let releases = {};
      try {
        releases = await getLatestReleases();
      } catch (e) {
        logger.error({ error: e.message }, 'Failed to get latest releases');
      }

      res.json({
        sessionId: session.id,
        isConnected: session.isConnected,
        isConnecting: session.isConnecting || false,
        currentQR: session.currentQR,
        disconnectReason: session.disconnectReason,
        passkeyDetected: session.passkeyDetected || false,
        stats: session.stats,
        recentSent: session.recentSent || [],
        recentReceived: session.recentReceived || [],
        recentFailures: session.recentFailures || [],
        connectionLogs: (session.connectionLogs || []).slice(0, 10),
        webhookEnabled: WEBHOOK_ENABLED,
        webhookUrl: WEBHOOK_URL,
        deviceInfo: session.sock?.user
          ? {
              name: session.sock.user.name || session.sock.user.notify,
              number: session.sock.user.id
                ? session.sock.user.id.split('@')[0].split(':')[0]
                : null,
              status: statusText,
            }
          : null,
        sessionList,
        nodeVersion: NODE_VERSION,
        alpineVersion: ALPINE_VERSION,
        addonVersion: ADDON_VERSION,
        integrationVersion: INTEGRATION_VERSION,
        baileysVersion: BAILEYS_VERSION,
        expressVersion: EXPRESS_VERSION,
        addonSlug: ADDON_SLUG,
        isStandalone: !process.env.SUPERVISOR_TOKEN,
        uptimeSeconds: Math.floor(process.uptime()),
        latestAddonVersion: releases.latestAddonVersion,
        addonChangelog: releases.addonChangelog,
        addonReleaseUrl: releases.addonReleaseUrl,
        latestIntegrationVersion: releases.latestIntegrationVersion,
        integrationChangelog: releases.integrationChangelog,
        integrationReleaseUrl: releases.integrationReleaseUrl,
      });
    })
  );

  app.post('/api/session/restart', uiAuthMiddleware, (req, res) => {
    try {
      const sessionId = sanitizeSessionId(req.body?.session_id || 'default');
      const session = getSession(sessionId);

      if (session.sock) {
        addLog(session, 'UI requested daemon restart', 'warning');
        setTimeout(() => {
          try {
            session.sock.end(new Error('UI requested restart'));
          } catch (e) {
            logger.error({ error: e.message }, 'Error ending socket during UI restart');
          }
        }, 500);
      }
      res.json({ status: 'restarting', session_id: sessionId });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.post('/api/sessions/purge', uiLimiter, uiAuthMiddleware, async (req, res) => {
    try {
      const purged = await purgeDisconnectedSessions();
      res.json({ status: 'success', purgedCount: purged });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.post('/api/logs/clear', uiLimiter, uiAuthMiddleware, (req, res) => {
    try {
      const sessionId = sanitizeSessionId(req.body?.session_id || 'default');
      const session = getSession(sessionId);
      session.connectionLogs = [];
      res.json({ status: 'cleared' });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.get('/api/debug/download', uiLimiter, (req, res) => {
    try {
      const sessionId = sanitizeSessionId(req.query.session_id || 'default');
      const session = getSession(sessionId);

      const debugBundle = {
        timestamp: new Date().toISOString(),
        session_id: session.id,
        connected: session.isConnected,
        stats: session.stats,
        logs: session.connectionLogs.map((l) => ({ ...l, msg: maskData(l.msg) })),
        system: {
          nodeVersion: NODE_VERSION,
          addonVersion: ADDON_VERSION,
          integrationVersion: INTEGRATION_VERSION,
          baileysVersion: BAILEYS_VERSION,
        },
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="whatsapp-debug-${session.id}.json"`
      );
      res.send(JSON.stringify(debugBundle, null, 2));
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.post('/settings/webhook', authMiddleware, (req, res) => {
    try {
      const { enabled, url, token } = req.body || {};
      updateWebhookConfig(enabled, url, token);
      res.json({ status: 'updated', enabled: WEBHOOK_ENABLED, url: WEBHOOK_URL });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.post(
    '/api/diagnostics/run',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const sessionId = sanitizeSessionId(req.query.session_id || req.body?.session_id || 'default');
      const session = getSession(sessionId);
      const { runDiagnostic } = await import('../../whatsapp/actions.js');
      
      // Trigger diagnostic in background so HTTP response returns fast
      runDiagnostic(session, session.stats.my_number || 'me', addLog).catch((err) => {
        logger.error({ error: err.message }, 'Failed background diagnostic run');
      });

      res.json({ status: 'started', session_id: session.id });
    })
  );
}
