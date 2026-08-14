import { loadTelegramStore, saveTelegramStore } from './store.js';

export function recordMessageMap(
  waMsgId,
  tgChatId,
  tgMsgId,
  waJid,
  fromMe = false,
  senderName = '',
  senderJid = '',
  text = '',
  origin = 'wa'
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
    origin: origin || 'wa',
    senderName: senderName || '',
    senderJid: senderJid || senderName || '',
    text: text || '',
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
  if (!tgChatId || !tgMsgId) return null;
  const store = loadTelegramStore();
  if (!store.message_maps) return null;

  const directKey = `tg:${tgChatId}:${tgMsgId}`;
  if (store.message_maps[directKey]) return store.message_maps[directKey];

  const cleanId = String(tgChatId).replace(/^-100/, '').replace(/^-/, '');
  for (const [k, v] of Object.entries(store.message_maps)) {
    if (!k.startsWith('tg:')) continue;
    const parts = k.split(':');
    if (parts.length >= 3) {
      const storedChatId = parts[1];
      const storedMsgId = parts[2];
      const cleanStoredChatId = storedChatId.replace(/^-100/, '').replace(/^-/, '');
      if (
        (storedChatId === String(tgChatId) || cleanStoredChatId === cleanId) &&
        storedMsgId === String(tgMsgId)
      ) {
        return v;
      }
    }
  }
  return null;
}

export function resolveTgMsgFromWa(waMsgId) {
  if (!waMsgId) return null;
  const store = loadTelegramStore();
  if (!store.message_maps) return null;

  const cleanId = String(waMsgId).trim();
  const directKey = `wa:${cleanId}`;
  if (store.message_maps[directKey]) return store.message_maps[directKey];

  for (const [k, v] of Object.entries(store.message_maps)) {
    if (!v) continue;
    if (
      v.waMsgId === cleanId ||
      k === `wa:${cleanId}` ||
      (v.waMsgId && (v.waMsgId.includes(cleanId) || cleanId.includes(v.waMsgId)))
    ) {
      return v;
    }
  }
  return null;
}
