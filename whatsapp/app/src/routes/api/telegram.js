import { loadTelegramStore, saveTelegramStore } from '../../whatsapp/telegram/store.js';
import { TelegramBotClient } from '../../whatsapp/telegram/bot.js';

export function registerTelegramRoutes(app) {
  // GET /api/telegram/config
  app.get('/api/telegram/config', (req, res) => {
    const store = loadTelegramStore();
    res.json({ success: true, data: store });
  });

  // POST /api/telegram/config
  app.post('/api/telegram/config', async (req, res) => {
    const store = loadTelegramStore();
    const { bot_token, enabled } = req.body || {};

    if (enabled !== undefined) {
      store.enabled = Boolean(enabled);
    }

    if (bot_token !== undefined) {
      const newToken = String(bot_token).trim();
      store.bot_token = newToken;
      if (newToken) {
        try {
          const bot = new TelegramBotClient(newToken);
          const me = await bot.getMe();
          store.bot_username = me.username || '';
          store.bot_info = me;
          await bot.fetchUpdates();
        } catch (err) {
          saveTelegramStore(store);
          return res.status(400).json({ success: false, error: `Invalid Bot Token: ${err.message}` });
        }
      } else {
        store.bot_username = '';
        store.bot_info = null;
      }
    }

    saveTelegramStore(store);
    res.json({ success: true, data: store });
  });

  // GET /api/telegram/chats
  app.get('/api/telegram/chats', (req, res) => {
    const store = loadTelegramStore();
    res.json({ success: true, data: Object.values(store.cached_chats || {}) });
  });

  // POST /api/telegram/mappings
  app.post('/api/telegram/mappings', (req, res) => {
    const store = loadTelegramStore();
    const {
      id,
      wa_jid,
      wa_name,
      tg_chat_id,
      tg_chat_title,
      tg_chat_type,
      sync_mode,
      include_group_name,
      include_sender_name,
      enabled,
    } = req.body || {};

    if (!wa_jid || !tg_chat_id) {
      return res.status(400).json({ success: false, error: 'Missing wa_jid or tg_chat_id' });
    }

    const mappingId = id || `map_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newMapping = {
      id: mappingId,
      wa_jid: String(wa_jid),
      wa_name: wa_name || wa_jid,
      tg_chat_id: String(tg_chat_id),
      tg_chat_title: tg_chat_title || `Chat ${tg_chat_id}`,
      tg_chat_type: tg_chat_type || 'group',
      sync_mode: sync_mode || 'bidirectional',
      include_group_name: Boolean(include_group_name),
      include_sender_name: include_sender_name !== undefined ? Boolean(include_sender_name) : true,
      enabled: enabled !== undefined ? Boolean(enabled) : true,
    };

    const existingIdx = (store.mappings || []).findIndex((m) => m.id === mappingId);
    if (existingIdx >= 0) {
      store.mappings[existingIdx] = newMapping;
    } else {
      if (!store.mappings) store.mappings = [];
      store.mappings.push(newMapping);
    }

    saveTelegramStore(store);
    res.json({ success: true, data: store.mappings });
  });

  // DELETE /api/telegram/mappings/:id
  app.delete('/api/telegram/mappings/:id', (req, res) => {
    const store = loadTelegramStore();
    const { id } = req.params;
    store.mappings = (store.mappings || []).filter((m) => m.id !== id);
    saveTelegramStore(store);
    res.json({ success: true, data: store.mappings });
  });

  // POST /api/telegram/mappings/:id/toggle
  app.post('/api/telegram/mappings/:id/toggle', (req, res) => {
    const store = loadTelegramStore();
    const { id } = req.params;
    const mapping = (store.mappings || []).find((m) => m.id === id);
    if (!mapping) {
      return res.status(404).json({ success: false, error: 'Mapping not found' });
    }
    mapping.enabled = !mapping.enabled;
    saveTelegramStore(store);
    res.json({ success: true, data: mapping });
  });
}
