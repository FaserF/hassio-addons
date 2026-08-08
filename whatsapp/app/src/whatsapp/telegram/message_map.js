import { loadTelegramStore, saveTelegramStore } from './store.js';

export function recordMessageMap(waMsgId, tgChatId, tgMsgId, waJid) {
  if (!waMsgId || !tgMsgId) return;
  const store = loadTelegramStore();
  if (!store.message_maps) store.message_maps = {};

  const waKey = `wa:${waMsgId}`;
  const tgKey = `tg:${tgChatId}:${tgMsgId}`;

  const record = {
    waMsgId,
    tgChatId: String(tgChatId),
    tgMsgId: String(tgMsgId),
    waJid,
    timestamp: Date.now(),
  };

  store.message_maps[waKey] = record;
  store.message_maps[tgKey] = record;

  // Prune message maps older than 30 days to avoid unbounded growth
  const keys = Object.keys(store.message_maps);
  if (keys.length > 5000) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const k of keys) {
      if (store.message_maps[k].timestamp < cutoff) {
        delete store.message_maps[k];
      }
    }
  }

  saveTelegramStore(store);
}

export function resolveWaMsgFromTg(tgChatId, tgMsgId) {
  const store = loadTelegramStore();
  const tgKey = `tg:${tgChatId}:${tgMsgId}`;
  return store.message_maps?.[tgKey] || null;
}

export function resolveTgMsgFromWa(waMsgId) {
  const store = loadTelegramStore();
  const waKey = `wa:${waMsgId}`;
  return store.message_maps?.[waKey] || null;
}
