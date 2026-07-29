import { authMiddleware, uiAuthMiddleware } from '../../middleware.js';
import { getSession, sessions, sanitizeSessionId, addLog } from '../../session.js';
import {
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

export function registerSystemRoutes(app) {
  app.get('/health', (req, res) => {
    res.json({
      status: HEALTH_STATE.status || 'ok',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  });

  app.get('/api/dashboard', (req, res) => {
    const sessionId = sanitizeSessionId(req.query.session_id || 'default');
    const session = getSession(sessionId);

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

    res.json({
      sessionId: session.id,
      isConnected: session.isConnected,
      currentQR: session.qr,
      disconnectReason: session.disconnectReason,
      passkeyDetected: session.passkeyDetected || false,
      stats: session.stats,
      recentSent: session.recentSent || [],
      recentReceived: session.recentReceived || [],
      recentFailures: session.recentFailures || [],
      webhookEnabled: WEBHOOK_ENABLED,
      webhookUrl: WEBHOOK_URL,
      deviceInfo: session.sock?.user
        ? {
            name: session.sock.user.name || session.sock.user.notify,
            number: session.sock.user.id ? session.sock.user.id.split('@')[0].split(':')[0] : null,
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
      isStandalone: false,
    });
  });

  app.post('/api/session/restart', uiAuthMiddleware, (req, res) => {
    const sessionId = sanitizeSessionId(req.body.session_id || 'default');
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
  });

  app.post('/api/logs/clear', uiAuthMiddleware, (req, res) => {
    const sessionId = sanitizeSessionId(req.body.session_id || 'default');
    const session = getSession(sessionId);
    session.connectionLogs = [];
    res.json({ status: 'cleared' });
  });

  app.get('/api/debug/download', (req, res) => {
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
  });

  app.post('/settings/webhook', authMiddleware, (req, res) => {
    const { enabled, url, token } = req.body;
    updateWebhookConfig(enabled, url, token);
    res.json({ status: 'updated', enabled: WEBHOOK_ENABLED, url: WEBHOOK_URL });
  });
}
