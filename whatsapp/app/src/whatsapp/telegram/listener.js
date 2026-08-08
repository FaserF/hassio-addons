import { loadTelegramStore, saveTelegramStore, updateCachedChat } from './store.js';
import { TelegramBotClient, getTelegramBotClient } from './bot.js';
import { recordMessageMap, resolveWaMsgFromTg, resolveTgMsgFromWa } from './message_map.js';
import { logger } from '../../logger.js';
import { getSession } from '../../session.js';

let pollingTimer = null;
let lastUpdateId = 0;

export function formatHeader(sourceGroup, senderName, includeGroup, includeSender) {
  const parts = [];
  if (includeGroup && sourceGroup) {
    parts.push(sourceGroup);
  }
  if (includeSender && senderName) {
    parts.push(senderName);
  }
  if (parts.length === 0) return '';
  return `[${parts.join(' | ')}]: `;
}

export async function syncWhatsAppToTelegram(msg, waJid, groupName, senderName, textContent, mediaUrl = null) {
  const store = loadTelegramStore();
  if (!store.enabled || !store.bot_token) return;

  // Find active mappings for this WhatsApp JID
  const mappings = (store.mappings || []).filter(
    (m) => m.enabled && m.wa_jid === waJid && (m.sync_mode === 'bidirectional' || m.sync_mode === 'outbound')
  );

  if (mappings.length === 0) return;

  const bot = getTelegramBotClient();
  if (!bot) return;

  const waMsgId = msg.key?.id;
  const quotedWaId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
  let replyToTgMsgId = null;
  if (quotedWaId) {
    const mapRecord = resolveTgMsgFromWa(quotedWaId);
    if (mapRecord) replyToTgMsgId = mapRecord.tgMsgId;
  }

  for (const mapping of mappings) {
    try {
      const header = formatHeader(
        groupName,
        senderName,
        mapping.include_group_name,
        mapping.include_sender_name
      );
      const fullText = `${header}${textContent || ''}`;

      let tgResult = null;
      if (mediaUrl) {
        tgResult = await bot.sendPhoto(mapping.tg_chat_id, mediaUrl, fullText, replyToTgMsgId).catch(() => {
          return bot.sendDocument(mapping.tg_chat_id, mediaUrl, fullText, replyToTgMsgId);
        });
      } else {
        tgResult = await bot.sendMessage(mapping.tg_chat_id, fullText, replyToTgMsgId);
      }

      if (tgResult && tgResult.message_id && waMsgId) {
        recordMessageMap(waMsgId, mapping.tg_chat_id, tgResult.message_id, waJid);
      }
    } catch (err) {
      logger.error({ error: err.message, waJid, tgChatId: mapping.tg_chat_id }, '❌ Error syncing WA message to Telegram');
    }
  }
}

export async function processTelegramUpdates() {
  const store = loadTelegramStore();
  if (!store.enabled || !store.bot_token) return;

  const bot = getTelegramBotClient();
  if (!bot) return;

  try {
    const updates = await bot.request('getUpdates', {
      offset: lastUpdateId + 1,
      limit: 50,
      timeout: 0,
    });

    if (!Array.isArray(updates) || updates.length === 0) return;

    for (const update of updates) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id);
      const msg = update.message || update.channel_post;
      if (!msg || !msg.chat) continue;

      updateCachedChat(msg.chat);

      const tgChatId = String(msg.chat.id);
      const mappings = (store.mappings || []).filter(
        (m) => m.enabled && String(m.tg_chat_id) === tgChatId && (m.sync_mode === 'bidirectional' || m.sync_mode === 'inbound')
      );

      if (mappings.length === 0) continue;

      const senderName = msg.from
        ? `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() || msg.from.username || 'Telegram User'
        : msg.chat.title || 'Telegram';
      const tgText = msg.text || msg.caption || '';
      if (!tgText) continue; // Skip non-text for basic sync

      const replyToTgId = msg.reply_to_message?.message_id;
      let quotedWaMsgId = null;
      if (replyToTgId) {
        const mapped = resolveWaMsgFromTg(tgChatId, replyToTgId);
        if (mapped) quotedWaMsgId = mapped.waMsgId;
      }

      for (const mapping of mappings) {
        const header = formatHeader(
          msg.chat.title,
          senderName,
          mapping.include_group_name,
          mapping.include_sender_name
        );
        const outboundWaText = `${header}${tgText}`;

        const session = getSession('default');
        if (session && session.client && session.isConnected) {
          try {
            const sendOptions = {};
            if (quotedWaMsgId) {
              sendOptions.quoted = { key: { remoteJid: mapping.wa_jid, id: quotedWaMsgId } };
            }
            const sentWaMsg = await session.client.sendMessage(mapping.wa_jid, { text: outboundWaText }, sendOptions);
            if (sentWaMsg && sentWaMsg.key && sentWaMsg.key.id) {
              recordMessageMap(sentWaMsg.key.id, tgChatId, msg.message_id, mapping.wa_jid);
            }
          } catch (waErr) {
            logger.error({ error: waErr.message, waJid: mapping.wa_jid }, '❌ Error syncing Telegram message to WhatsApp');
          }
        }
      }
    }
  } catch (err) {
    // Ignore routine polling timeouts/errors
  }
}

export function startTelegramPolling(intervalMs = 3000) {
  if (pollingTimer) clearInterval(pollingTimer);
  pollingTimer = setInterval(processTelegramUpdates, intervalMs);
}

export function stopTelegramPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}
