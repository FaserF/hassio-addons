import { delay } from '@whiskeysockets/baileys';
import fs from 'fs';
import os from 'os';
import { authMiddleware, uiAuthMiddleware } from '../middleware.js';
import {
  getReqSession,
  getSession,
  sessions,
  sanitizeSessionId,
  signalInterest,
  getAuthDir,
  addLog,
} from '../session.js';
import { getJid } from '../utils/jid.js';
import { maskData, generateMessageID } from '../utils/security.js';
import {
  BAILEYS_VERSION,
  SEND_MESSAGE_TIMEOUT,
  KEEP_ALIVE_INTERVAL,
  API_TOKEN,
  UI_AUTH_ENABLED,
  MASK_SENSITIVE_DATA,
  ADDON_VERSION,
  INTEGRATION_VERSION,
  ADMIN_NUMBERS,
  WELCOME_MESSAGE_ENABLED,
  ADMIN_NOTIFICATIONS_ENABLED,
  MARK_ONLINE,
  SHOULD_RESET,
  PORT,
} from '../config.js';
import {
  WEBHOOK_ENABLED,
  WEBHOOK_URL,
  WEBHOOK_TOKEN,
  WEBHOOK_CONFIG_FILE,
  updateWebhookConfig,
} from '../webhook.js';
import { trackSent, trackFailure } from '../whatsapp/actions.js';
import { getQuotedMessage } from '../whatsapp/events.js';
import { SYSTEM_STATE, SEEN_USERS } from '../state.js';
import { logger } from '../logger.js';
import { connectToWhatsApp } from '../whatsapp/connection.js';

export function registerAPIRoutes(app) {
  // --- Session API ---
  app.post('/session/start', (req, res) => {
    const session = getReqSession(req);
    addLog(session, `Received Session Start request (session: ${session.id})`, 'info');
    if (session.isConnected) return res.json({ status: 'connected', message: 'Already connected' });
    if (session.sock && !session.sock.ws?.isClosed)
      return res.json({ status: 'scanning', message: 'Session negotiation in progress' });
    signalInterest(session.id, connectToWhatsApp);
    res.json({ status: 'starting', message: 'Session init started' });
  });

  app.delete('/session', async (req, res) => {
    const session = getReqSession(req);
    addLog(session, 'Received Logout/Reset request', 'warning');
    try {
      if (session.sock) {
        await Promise.race([
          session.sock.logout(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Logout timeout')), 5000)),
        ]).catch((e) =>
          logger.warn({ error: e.message, sessionId: session.id }, 'Logout failed or timed out')
        );
        session.sock.end(undefined);
        session.sock = undefined;
      }
      const authDir = getAuthDir(session.id);
      if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
      fs.mkdirSync(authDir, { recursive: true });
      session.isConnected = false;
      session.currentQR = null;
      session.eventQueue = [];
      session.connectionLogs = [];
      session.messageStore.clear();
      session.stats = {
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
        start_time: Date.now(),
        my_number: 'Unknown',
        version: BAILEYS_VERSION,
      };
      addLog(session, 'Session data cleared. Ready for new pair.', 'success');
      res.json({ status: 'success', message: 'Session deleted and logged out' });
    } catch (e) {
      addLog(session, `Logout failed: ${e.toString()}`, 'error');
      res.status(500).json({ error: e.toString() });
    }
  });

  app.get('/qr', (req, res) => {
    const session = getReqSession(req);
    signalInterest(session.id, connectToWhatsApp);
    if (session.isConnected) return res.json({ status: 'connected', qr: null });
    if (session.currentQR) return res.json({ status: 'scanning', qr: session.currentQR });
    return res.json({ status: 'waiting', detail: 'QR generation in progress' });
  });

  app.get('/status', (req, res) => {
    const session = getReqSession(req);
    res.json({
      connected: session.isConnected,
      version: BAILEYS_VERSION,
      session_id: session.id,
      disconnect_reason: session.isConnected ? null : session.disconnectReason,
    });
  });

  app.get('/events', (req, res) => {
    const session = getReqSession(req);
    const events = [...session.eventQueue];
    session.eventQueue = [];
    res.json(events);
  });

  app.get('/logs', (req, res) => res.json(getReqSession(req).connectionLogs));
  app.get('/stats', (req, res) => {
    const session = getReqSession(req);
    res.json({
      ...session.stats,
      uptime: Math.floor((Date.now() - session.stats.start_time) / 1000),
    });
  });

  // --- Messaging API ---
  app.post('/send_message', async (req, res) => {
    const session = getReqSession(req);
    const { number, message, quotedMessageId, expiration } = req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    const quoted = getQuotedMessage(session, quotedMessageId);
    try {
      const jid = getJid(number);
      if (!session.sock) throw new Error('Socket not initialized');
      await session.sock.sendPresenceUpdate('composing', jid);
      await delay(250);
      const sentMsg = await Promise.race([
        session.sock.sendMessage(
          jid,
          { text: message },
          { quoted, ephemeralExpiration: expiration }
        ),
        new Promise((_, reject) =>
          setTimeout(() => {
            session.sock.end(new Error(`Send message timeout (${SEND_MESSAGE_TIMEOUT}ms)`));
            reject(new Error('Send message timeout'));
          }, SEND_MESSAGE_TIMEOUT)
        ),
      ]);
      session.stats.sent += 1;
      session.stats.last_sent_message = maskData(message);
      session.stats.last_sent_target = maskData(number);
      session.stats.last_sent_time = Date.now();
      trackSent(session, number, message);
      res.json({ status: 'sent', id: sentMsg.key.id });
    } catch (e) {
      session.stats.failed += 1;
      session.stats.last_failed_time = Date.now();
      session.stats.last_error_reason = e.message;
      trackFailure(session, number, message, e.message);
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.post('/send_image', async (req, res) => {
    const session = getReqSession(req);
    const { number, url, caption, quotedMessageId, expiration } = req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    const quoted = getQuotedMessage(session, quotedMessageId);
    try {
      const jid = getJid(number);
      const sentMsg = await session.sock.sendMessage(
        jid,
        { image: { url: url }, caption: caption },
        { quoted, ephemeralExpiration: expiration }
      );
      session.stats.sent += 1;
      session.stats.last_sent_message = 'Image';
      session.stats.last_sent_target = maskData(number);
      session.stats.last_sent_time = Date.now();
      trackSent(session, number, caption ? `Image: ${caption}` : 'Image');
      res.json({ status: 'sent', id: sentMsg.key.id });
    } catch (e) {
      session.stats.failed += 1;
      session.stats.last_error_reason = e.message;
      trackFailure(session, number, caption ? `Image: ${caption}` : 'Image', e.message);
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.post('/send_poll', async (req, res) => {
    const session = getReqSession(req);
    const { number, question, options, quotedMessageId, expiration } = req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    const quoted = getQuotedMessage(session, quotedMessageId);
    try {
      const jid = getJid(number);
      const sentMsg = await session.sock.sendMessage(
        jid,
        { poll: { name: question, values: options, selectableCount: 1 } },
        { quoted, ephemeralExpiration: expiration }
      );
      session.stats.sent += 1;
      session.stats.last_sent_message = `Poll: ${question}`;
      session.stats.last_sent_target = maskData(number);
      session.stats.last_sent_time = Date.now();
      trackSent(session, number, `Poll: ${question}`);
      res.json({ status: 'sent', id: sentMsg.key.id });
    } catch (e) {
      session.stats.failed += 1;
      session.stats.last_error_reason = e.message;
      trackFailure(session, number, `Poll: ${question}`, e.message);
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.post('/send_location', async (req, res) => {
    const session = getReqSession(req);
    const { number, latitude, longitude, title, description, quotedMessageId, expiration } =
      req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    const quoted = getQuotedMessage(session, quotedMessageId);
    try {
      const jid = getJid(number);
      const sentMsg = await session.sock.sendMessage(
        jid,
        {
          location: {
            degreesLatitude: latitude,
            degreesLongitude: longitude,
            name: title,
            address: description,
          },
        },
        { quoted, ephemeralExpiration: expiration }
      );
      session.stats.sent += 1;
      session.stats.last_sent_message = `Location: ${title || 'Pinned'}`;
      session.stats.last_sent_target = maskData(number);
      session.stats.last_sent_time = Date.now();
      trackSent(session, number, `Location: ${title || 'Pinned'}`);
      res.json({ status: 'sent', id: sentMsg.key.id });
    } catch (e) {
      session.stats.failed += 1;
      session.stats.last_error_reason = e.message;
      trackFailure(session, number, `Location: ${title || 'Pinned'}`, e.message);
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.post('/send_reaction', async (req, res) => {
    const session = getReqSession(req);
    const { number, reaction, messageId } = req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    try {
      const jid = getJid(number);
      const sentMsg = await session.sock.sendMessage(jid, {
        react: { text: reaction, key: { remoteJid: jid, fromMe: false, id: messageId } },
      });
      res.json({ status: 'sent', id: sentMsg.key.id });
    } catch (e) {
      session.stats.failed += 1;
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.post('/send_buttons', async (req, res) => {
    const session = getReqSession(req);
    const { number, message, buttons, footer, quotedMessageId, expiration } = req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    const quoted = getQuotedMessage(session, quotedMessageId);
    try {
      const jid = getJid(number);
      const formattedButtons = (buttons || []).map((b) => ({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: b.displayText || b.text || 'Button',
          id: b.id || b.buttonId || String(Math.random()),
        }),
      }));
      const messageId = generateMessageID();
      await session.sock.relayMessage(
        jid,
        {
          viewOnceMessage: {
            message: {
              interactiveMessage: {
                header: { title: '', hasMediaAttachment: false },
                body: { text: message },
                footer: { text: footer || '' },
                nativeFlowMessage: { buttons: formattedButtons },
              },
            },
          },
        },
        { messageId, quoted, ephemeralExpiration: expiration }
      );
      session.stats.sent += 1;
      session.stats.last_sent_message = `Buttons: ${message}`;
      session.stats.last_sent_target = maskData(number);
      trackSent(session, number, `Buttons: ${message}`);
      res.json({ status: 'sent', id: messageId });
    } catch (e) {
      session.stats.failed += 1;
      trackFailure(session, number, `Buttons: ${message}`, e.message);
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.post('/send_document', async (req, res) => {
    const session = getReqSession(req);
    const { number, url, fileName, caption, quotedMessageId, expiration } = req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    const quoted = getQuotedMessage(session, quotedMessageId);
    try {
      const jid = getJid(number);
      const sentMsg = await session.sock.sendMessage(
        jid,
        {
          document: { url: url },
          fileName: fileName,
          caption: caption,
          mimetype: 'application/octet-stream',
        },
        { quoted, ephemeralExpiration: expiration }
      );
      session.stats.sent += 1;
      session.stats.last_sent_message = `Document: ${fileName || 'unnamed'}`;
      trackSent(session, number, `Document: ${fileName || 'unnamed'}`);
      res.json({ status: 'sent', id: sentMsg.key.id });
    } catch (e) {
      session.stats.failed += 1;
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.post('/send_video', async (req, res) => {
    const session = getReqSession(req);
    const { number, url, caption, quotedMessageId, expiration } = req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    const quoted = getQuotedMessage(session, quotedMessageId);
    try {
      const jid = getJid(number);
      const sentMsg = await session.sock.sendMessage(
        jid,
        { video: { url: url }, caption: caption },
        { quoted, ephemeralExpiration: expiration }
      );
      session.stats.sent += 1;
      session.stats.last_sent_time = Date.now();
      trackSent(session, number, caption ? `Video: ${caption}` : 'Video');
      res.json({ status: 'sent', id: sentMsg.key.id });
    } catch (e) {
      session.stats.failed += 1;
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.post('/send_audio', async (req, res) => {
    const session = getReqSession(req);
    const { number, url, ptt, quotedMessageId, expiration } = req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    const quoted = getQuotedMessage(session, quotedMessageId);
    try {
      const jid = getJid(number);
      await session.sock.sendMessage(
        jid,
        { audio: { url: url }, ptt: !!ptt, mimetype: 'audio/mp4' },
        { quoted, ephemeralExpiration: expiration }
      );
      session.stats.sent += 1;
      trackSent(session, number, ptt ? 'Voice Note' : 'Audio');
      res.json({ status: 'sent' });
    } catch (e) {
      session.stats.failed += 1;
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.post('/revoke_message', async (req, res) => {
    const session = getReqSession(req);
    const { number, message_id, fromMe } = req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    try {
      const jid = getJid(number);
      const key = {
        remoteJid: jid,
        fromMe: fromMe !== undefined ? Boolean(fromMe) : true,
        id: message_id,
      };
      await session.sock.sendMessage(jid, { delete: key });
      session.stats.sent += 1;
      trackSent(session, number, `Revoke: ${message_id}`);
      res.json({ status: 'sent' });
    } catch (e) {
      session.stats.failed += 1;
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.post('/edit_message', async (req, res) => {
    const session = getReqSession(req);
    const { number, message_id, new_content } = req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    try {
      const jid = getJid(number);
      const key = { remoteJid: jid, fromMe: true, id: message_id };
      await session.sock.sendMessage(jid, { text: new_content, edit: key });
      session.stats.sent += 1;
      trackSent(session, number, `Edit: ${message_id}`);
      res.json({ status: 'sent' });
    } catch (e) {
      session.stats.failed += 1;
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.post('/set_presence', async (req, res) => {
    const session = getReqSession(req);
    const { number, presence } = req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    try {
      const jid = getJid(number);
      await session.sock.sendPresenceUpdate(presence, jid);
      res.json({ status: 'sent' });
    } catch (e) {
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.get('/groups', async (req, res) => {
    const session = getReqSession(req);
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    try {
      if (!session.sock) throw new Error('Socket not initialized');
      const groups = await session.sock.groupFetchAllParticipating();
      const result = Object.values(groups).map((g) => ({
        id: g.id,
        name: g.subject,
        participants: g.participants.length,
      }));
      res.json(result);
    } catch (e) {
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.post('/mark_as_read', async (req, res) => {
    const session = getReqSession(req);
    const { number, messageId } = req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    try {
      const jid = getJid(number);
      if (messageId) {
        await session.sock.readMessages([{ remoteJid: jid, id: messageId, fromMe: false }]);
      } else {
        await session.sock.chatModify({ markRead: true, lastMessages: [] }, jid);
      }
      res.json({ status: 'success' });
    } catch (e) {
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.post('/send_list', async (req, res) => {
    const session = getReqSession(req);
    const { number, title, text, footer, button_text, sections, quotedMessageId, expiration } =
      req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    const quoted = getQuotedMessage(session, quotedMessageId);
    try {
      const jid = getJid(number);
      const formattedSections = (sections || []).map((s) => ({
        title: s.title || '',
        rows: (s.rows || []).map((r) => ({
          header: r.title || '',
          title: r.title || '',
          description: r.description || '',
          id: r.id || String(Math.random()),
        })),
      }));
      const messageId = generateMessageID();
      await session.sock.relayMessage(
        jid,
        {
          viewOnceMessage: {
            message: {
              interactiveMessage: {
                header: { title: title || '', hasMediaAttachment: false },
                body: { text: text || 'Menu' },
                footer: { text: footer || '' },
                nativeFlowMessage: {
                  buttons: [
                    {
                      name: 'single_select',
                      buttonParamsJson: JSON.stringify({
                        title: button_text || 'Open Menu',
                        sections: formattedSections,
                      }),
                    },
                  ],
                },
              },
            },
          },
        },
        { messageId, quoted, ephemeralExpiration: expiration }
      );
      session.stats.sent += 1;
      trackSent(session, number, `List: ${title || text}`);
      res.json({ status: 'sent' });
    } catch (e) {
      session.stats.failed += 1;
      trackFailure(session, number, `List: ${title || text}`, e.message);
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.post('/send_contact', async (req, res) => {
    const session = getReqSession(req);
    const { number, contact_name, contact_number, quotedMessageId, expiration } = req.body;
    if (!session.isConnected) return res.status(503).json({ detail: 'Not connected' });
    try {
      const jid = getJid(number);
      const vcard =
        'BEGIN:VCARD\nVERSION:3.0\n' +
        `FN:${contact_name}\n` +
        `ORG:Home Assistant;\n` +
        `TEL;type=CELL;type=VOICE;waid=${contact_number}:${contact_number}\n` +
        'END:VCARD';
      const quoted = getQuotedMessage(session, quotedMessageId);
      await session.sock.sendMessage(
        jid,
        { contacts: { displayName: contact_name, contacts: [{ vcard }] } },
        { quoted, ephemeralExpiration: expiration }
      );
      session.stats.sent += 1;
      trackSent(session, number, `Contact: ${contact_name}`);
      res.json({ status: 'sent' });
    } catch (e) {
      session.stats.failed += 1;
      trackFailure(session, number, `Contact: ${contact_name}`, e.message);
      res.status(500).json({ detail: e.toString() });
    }
  });

  app.get('/health', (req, res) =>
    res.status(200).json({ status: 'ok', service: 'whatsapp-homeassistant-app' })
  );

  // --- Dashboard and Settings API ---
  app.get('/api/dashboard', (req, res) => {
    const sessionId = sanitizeSessionId(req.query.session_id || 'default');
    const session = getSession(sessionId);
    signalInterest(sessionId, connectToWhatsApp);
    const sessionList = Array.from(sessions.keys()).map((sid) => ({
      id: sid,
      connected: sessions.get(sid).isConnected,
      number: sessions.get(sid).stats?.my_number || 'Unknown',
    }));
    res.json({
      sessionId: session.id,
      isConnected: session.isConnected,
      currentQR: session.currentQR,
      disconnectReason: session.disconnectReason,
      reconnectAttempts: session.reconnectAttempts,
      stats: session.stats || { sent: 0, received: 0, failed: 0 },
      uptime: session.stats?.start_time
        ? new Date(Date.now() - session.stats.start_time).toISOString().substr(11, 8)
        : 'N/A',
      sessionList,
      recentLogs: (session.connectionLogs || []).slice(0, 10),
      recentSent: (session.recentSent || []).slice(0, 5),
      recentReceived: (session.recentReceived || []).slice(0, 5),
      recentFailures: (session.recentFailures || []).slice(0, 5),
      nodeVersion: process.version,
      addonVersion: ADDON_VERSION,
      integrationVersion: INTEGRATION_VERSION,
      baileysVersion: BAILEYS_VERSION,
      webhookEnabled: WEBHOOK_ENABLED,
      webhookUrl: WEBHOOK_URL,
      deviceInfo: session.deviceInfo || {},
    });
  });

  app.post('/api/session/restart', uiAuthMiddleware, (req, res) => {
    const sessionId = sanitizeSessionId(req.body.session_id || 'default');
    const session = getSession(sessionId);
    addLog(session, 'User requested session restart via Dashboard', 'warning');
    if (session.sock) {
      session.sock.end(new Error('User requested restart'));
    } else {
      connectToWhatsApp(sessionId, sessions, getSession);
    }
    res.json({ status: 'success' });
  });

  app.post('/api/logs/clear', uiAuthMiddleware, (req, res) => {
    const session = getReqSession(req);
    session.connectionLogs = [];
    addLog(session, 'Logs cleared by user', 'info');
    res.json({ status: 'success' });
  });

  app.get('/api/debug/download', (req, res) => {
    const session = getReqSession(req);

    // Gather system metrics
    const mem = process.memoryUsage();
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const networkInterfaces = os.networkInterfaces();

    const debugInfo = {
      timestamp: new Date().toISOString(),
      metadata: {
        generated_by: 'WhatsApp Addon',
        version: ADDON_VERSION,
        report_id: generateMessageID(),
      },
      system: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime_seconds: Math.floor(process.uptime()),
        system_uptime: Math.floor(os.uptime()),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          process_rss: mem.rss,
          process_heap_total: mem.heapTotal,
          process_heap_used: mem.heapUsed,
          process_external: mem.external,
        },
        cpu: {
          model: cpus[0]?.model,
          cores: cpus.length,
          load_avg: loadAvg,
        },
        versions: {
          addon: ADDON_VERSION,
          integration: INTEGRATION_VERSION,
          baileys: BAILEYS_VERSION,
        },
      },
      network: {
        interfaces: Object.keys(networkInterfaces).reduce((acc, name) => {
          acc[name] = networkInterfaces[name].map((iface) => ({
            family: iface.family,
            address: iface.address.includes(':') ? 'REDACTED' : iface.address, // Partial redact IPv6
            internal: iface.internal,
          }));
          return acc;
        }, {}),
        host_networking: process.env.HASSIO_HOST_NETWORK === 'true',
      },
      config: {
        port: PORT,
        ui_auth_enabled: UI_AUTH_ENABLED,
        webhook: {
          enabled: WEBHOOK_ENABLED,
          url: (function () {
            if (!WEBHOOK_URL) return 'none';
            try {
              const u = new URL(WEBHOOK_URL);
              if (u.password || u.username) {
                u.username = '[REDACTED]';
                u.password = '';
              }
              return u.toString();
            } catch {
              return '[INVALID_URL]';
            }
          })(),
        },
        mask_sensitive_data: MASK_SENSITIVE_DATA,
        welcome_message_enabled: WELCOME_MESSAGE_ENABLED,
        admin_notifications_enabled: ADMIN_NOTIFICATIONS_ENABLED,
        mark_online: MARK_ONLINE,
        should_reset: SHOULD_RESET,
        send_message_timeout: SEND_MESSAGE_TIMEOUT,
        keep_alive_interval: KEEP_ALIVE_INTERVAL,
        admin_numbers_count: ADMIN_NUMBERS.length,
        admin_numbers_masked: ADMIN_NUMBERS.map((n) => maskData(n)),
      },
      state: {
        ...SYSTEM_STATE,
        seen_users_count: SEEN_USERS.size,
      },
      session: {
        id: session.id,
        connected: session.isConnected,
        reconnect_attempts: session.reconnectAttempts,
        disconnect_reason: session.disconnectReason,
        uptime: session.stats?.start_time
          ? Math.floor((Date.now() - session.stats.start_time) / 1000)
          : 0,
        store_stats: {
          chats: session.messageStore ? 'available' : 'disabled',
          message_logs_count: session.connectionLogs?.length || 0,
        },
      },
      stats: session.stats,
      logs: (session.connectionLogs || []).map((l) => ({
        ...l,
        msg: l.msg
          .replace(API_TOKEN, '[REDACTED_API_TOKEN]')
          .replace(WEBHOOK_TOKEN, '[REDACTED_WEBHOOK_TOKEN]'),
      })),
    };

    res.setHeader(
      'Content-disposition',
      `attachment; filename=whatsapp-debug-${session.id}-${Date.now()}.json`
    );
    res.setHeader('Content-type', 'application/json');
    res.write(JSON.stringify(debugInfo, null, 2));
    res.end();
  });

  app.post('/settings/webhook', authMiddleware, (req, res) => {
    const { url, enabled, token } = req.body;
    const config = { enabled, url, token };
    try {
      fs.writeFileSync(WEBHOOK_CONFIG_FILE, JSON.stringify(config, null, 2));
      updateWebhookConfig(config);
      addLog(getSession('default'), 'Webhook configuration updated', 'info');
      res.json({ status: 'success', config });
    } catch {
      res.status(500).json({ error: 'Failed to update webhook config' });
    }
  });
}
