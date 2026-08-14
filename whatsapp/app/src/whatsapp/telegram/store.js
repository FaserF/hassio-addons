import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../../config.js';
import { logger } from '../../logger.js';

export function getTelegramFilePath() {
  const dir = process.env.DATA_DIR || DATA_DIR;
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, 'telegram_config.json');
  } catch (e) {
    const fallbackDir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(fallbackDir)) {
      try {
        fs.mkdirSync(fallbackDir, { recursive: true });
      } catch (err) {}
    }
    return path.join(fallbackDir, 'telegram_config.json');
  }
}

let telegramStoreMemory = null;

export function getDefaultTelegramStore() {
  return {
    enabled: true,
    offline_catchup: {
      enabled: true,
      max_age_minutes: 2,
    },
    bots: [], // [{ id, name, token, username, info, enabled }]
    cached_chats: {}, // chatId -> { id, title, type, username, bot_id, last_seen }
    mappings: [], // [{ id, bot_id, wa_jid, wa_name, tg_chat_id, tg_chat_title, tg_chat_type, sync_mode, include_group_name, include_sender_name, sync_self_messages, is_direct_chat_mirror, enabled }]
    message_maps: {}, // waMsgId -> { tgChatId, tgMsgId, waJid, timestamp }, tgMsgKey -> { waJid, waMsgId }
  };
}

export function loadTelegramStore() {
  if (telegramStoreMemory) {
    return telegramStoreMemory;
  }
  const file = getTelegramFilePath();
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = JSON.parse(raw);
      telegramStoreMemory = { ...getDefaultTelegramStore(), ...parsed };

      // Migration: convert single legacy bot_token to bots array if present
      if (
        parsed.bot_token &&
        (!telegramStoreMemory.bots || telegramStoreMemory.bots.length === 0)
      ) {
        const botId = `bot_${Date.now()}`;
        const legacyBot = {
          id: botId,
          name: parsed.bot_username ? `@${parsed.bot_username}` : 'Default Bot',
          token: parsed.bot_token,
          username: parsed.bot_username || '',
          info: parsed.bot_info || null,
          enabled: true,
        };
        telegramStoreMemory.bots = [legacyBot];
        // Assign legacy mappings to this botId
        if (Array.isArray(telegramStoreMemory.mappings)) {
          telegramStoreMemory.mappings.forEach((m) => {
            if (!m.bot_id) m.bot_id = botId;
          });
        }
      }

      return telegramStoreMemory;
    }
  } catch (err) {
    logger.error({ error: err.message }, '⚠️ Failed to read telegram_config.json, using defaults.');
  }
  telegramStoreMemory = getDefaultTelegramStore();
  saveTelegramStore(telegramStoreMemory);
  return telegramStoreMemory;
}

export function saveTelegramStore(data) {
  try {
    telegramStoreMemory = data;
    const file = getTelegramFilePath();
    const parentDir = path.dirname(file);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    logger.error({ error: err.message }, '❌ Failed to save telegram_config.json.');
    return false;
  }
}

export function updateCachedChat(chatInfo, botId = '') {
  if (!chatInfo || !chatInfo.id) return;
  const store = loadTelegramStore();
  const idStr = String(chatInfo.id);
  store.cached_chats[idStr] = {
    id: idStr,
    bot_id: botId || store.cached_chats[idStr]?.bot_id || '',
    title: chatInfo.title || chatInfo.username || chatInfo.first_name || `Chat ${idStr}`,
    type: chatInfo.type || 'private',
    username: chatInfo.username || '',
    last_seen: Date.now(),
  };
  saveTelegramStore(store);
}
