import { loadTelegramStore, saveTelegramStore } from './store.js';

export function recordMessageMap(
  waMsgId,
  tgChatId,
  tgMsgId,
  waJid,
  fromMe = false,
  senderName = ''
) {
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
    fromMe: Boolean(fromMe),
    senderName: senderName || '',
    senderJid: senderName || '',
    timestamp: Date.now(),
  };

  store.message_maps[waKey] = record;
  store.message_maps[tgKey] = record;

  // LRU Pruning: Keep max 10,000 mapping pairs (20,000 keys) & remove entries older than 14 days
  const keys = Object.keys(store.message_maps);
  if (keys.length > 20000) {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const entries = [];
    for (const k of keys) {
      const item = store.message_maps[k];
      if (item.timestamp < cutoff) {
        delete store.message_maps[k];
      } else {
        entries.push({ key: k, ts: item.timestamp });
      }
    }
    // If still exceeds 20,000 keys after age cutoff, sort by oldest timestamp and prune excess
    if (entries.length > 20000) {
      entries.sort((a, b) => a.ts - b.ts);
      const toRemove = entries.slice(0, entries.length - 20000);
      for (const item of toRemove) {
        delete store.message_maps[item.key];
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
