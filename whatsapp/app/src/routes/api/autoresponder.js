import {
  loadAutoResponderStore,
  saveAutoResponderStore,
  resetSeenRecipients,
  isAutoResponderActive,
  parseDateTimeToMs,
} from '../../whatsapp/autoresponder/store.js';
import { sessions } from '../../session.js';
import { logger } from '../../logger.js';

export function registerAutoResponderRoutes(app) {
  // GET /api/autoresponder/config
  app.get('/api/autoresponder/config', (req, res) => {
    try {
      const store = loadAutoResponderStore();
      const isActive = isAutoResponderActive();
      res.json({
        success: true,
        data: {
          ...store,
          is_active: isActive,
          seen_count: Object.keys(store.seen_recipients || {}).length,
        },
      });
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to get auto responder config');
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/autoresponder/config
  app.post('/api/autoresponder/config', (req, res) => {
    try {
      const store = loadAutoResponderStore();
      const wasEnabled = store.enabled;
      const { enabled, start_time, end_time, direct_only, once_per_contact, message_template } =
        req.body || {};

      if (enabled !== undefined) {
        store.enabled = Boolean(enabled);
        // If turning on from disabled state:
        // Automatically default start_time to now (formatted for datetime-local) and end_time to unlimited (null)
        // unless explicitly specified in the payload.
        if (store.enabled && !wasEnabled) {
          if (start_time === undefined) {
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const localIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
            store.start_time = localIso;
          }
          if (end_time === undefined) {
            store.end_time = null;
          }
          store.seen_recipients = {};
        } else if (store.enabled && store.end_time && end_time === undefined) {
          // If enabling and existing end_time was already in the past, clear expired end_time
          const endMs = parseDateTimeToMs(store.end_time);
          if (endMs !== null && Date.now() > endMs) {
            store.end_time = null;
          }
        }
      }

      if (start_time !== undefined) {
        store.start_time = start_time ? String(start_time).trim() : null;
      }

      if (end_time !== undefined) {
        store.end_time = end_time ? String(end_time).trim() : null;
      }

      if (direct_only !== undefined) {
        store.direct_only = Boolean(direct_only);
      }

      if (once_per_contact !== undefined) {
        store.once_per_contact = Boolean(once_per_contact);
      }

      if (message_template !== undefined) {
        store.message_template = String(message_template);
      }

      saveAutoResponderStore(store);

      // Notify connected sessions & HA coordinator of config update
      for (const s of sessions.values()) {
        if (s.eventQueue) {
          s.eventQueue.push({ type: 'config_updated', feature: 'autoresponder' });
        }
      }

      const isActive = isAutoResponderActive();
      res.json({
        success: true,
        data: {
          ...store,
          is_active: isActive,
          seen_count: Object.keys(store.seen_recipients || {}).length,
        },
      });
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to update auto responder config');
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/autoresponder/reset-seen
  app.post('/api/autoresponder/reset-seen', (req, res) => {
    try {
      const updatedStore = resetSeenRecipients();
      res.json({
        success: true,
        data: {
          ...updatedStore,
          is_active: isAutoResponderActive(),
          seen_count: 0,
        },
      });
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to reset seen recipients');
      res.status(500).json({ success: false, error: err.message });
    }
  });
}
