import { loadTelegramStore, updateCachedChat } from './store.js';
import { logger } from '../../logger.js';

const ALLOWED_METHODS = new Set([
  'getMe',
  'getUpdates',
  'sendMessage',
  'sendPhoto',
  'sendVoice',
  'sendDocument',
  'setMessageReaction',
  'editMessageText',
  'deleteMessage',
  'sendVideo',
  'sendAudio',
  'sendSticker',
  'sendLocation',
]);

export class TelegramBotClient {
  constructor(token) {
    this.token = token || '';
  }

  async request(method, payload = {}) {
    if (!this.token) {
      throw new Error('Telegram Bot Token is not configured');
    }
    if (typeof method !== 'string' || !ALLOWED_METHODS.has(method)) {
      throw new Error(`Invalid or unsupported Telegram API method: ${method}`);
    }
    const url = `https://api.telegram.org/bot${this.token}/${encodeURIComponent(method)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || `Telegram API error on ${method}`);
    }
    return data.result;
  }

  async getMe() {
    return await this.request('getMe');
  }

  async fetchUpdates(botId = '') {
    try {
      const updates = await this.request('getUpdates', { limit: 100, timeout: 0 });
      if (Array.isArray(updates)) {
        for (const update of updates) {
          const msg = update.message || update.channel_post || update.edited_message;
          if (msg && msg.chat) {
            updateCachedChat(msg.chat, botId);
          }
        }
      }
      return updates;
    } catch (e) {
      return [];
    }
  }

  async sendMessage(
    chatId,
    text,
    replyToMessageId = null,
    threadId = null,
    disableNotification = false
  ) {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      disable_notification: Boolean(disableNotification),
    };
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
    if (threadId) payload.message_thread_id = threadId;
    return await this.request('sendMessage', payload);
  }

  async sendPhoto(
    chatId,
    photoUrlOrBuffer,
    caption = '',
    replyToMessageId = null,
    threadId = null,
    disableNotification = false
  ) {
    const payload = {
      chat_id: chatId,
      photo: photoUrlOrBuffer,
      caption: caption,
      parse_mode: 'HTML',
      disable_notification: Boolean(disableNotification),
    };
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
    if (threadId) payload.message_thread_id = threadId;
    return await this.request('sendPhoto', payload);
  }

  async sendVoice(
    chatId,
    voiceUrlOrBuffer,
    caption = '',
    replyToMessageId = null,
    threadId = null,
    disableNotification = false
  ) {
    const payload = {
      chat_id: chatId,
      voice: voiceUrlOrBuffer,
      caption: caption,
      parse_mode: 'HTML',
      disable_notification: Boolean(disableNotification),
    };
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
    if (threadId) payload.message_thread_id = threadId;
    return await this.request('sendVoice', payload);
  }

  async sendDocument(
    chatId,
    documentUrlOrBuffer,
    caption = '',
    replyToMessageId = null,
    threadId = null,
    disableNotification = false
  ) {
    const payload = {
      chat_id: chatId,
      document: documentUrlOrBuffer,
      caption: caption,
      parse_mode: 'HTML',
      disable_notification: Boolean(disableNotification),
    };
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
    if (threadId) payload.message_thread_id = threadId;
    return await this.request('sendDocument', payload);
  }

  async setMessageReaction(chatId, messageId, emoji) {
    return await this.request('setMessageReaction', {
      chat_id: chatId,
      message_id: messageId,
      reaction: emoji ? [{ type: 'emoji', emoji }] : [],
    });
  }

  async editMessageText(chatId, messageId, text) {
    return await this.request('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML',
    });
  }

  async deleteMessage(chatId, messageId) {
    return await this.request('deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    });
  }
}

const botClientsMap = new Map();

export function getTelegramBotClient(botId = null) {
  const store = loadTelegramStore();
  const bots = store.bots || [];
  if (bots.length === 0) return null;

  let targetBot = null;
  if (botId) {
    targetBot = bots.find((b) => b.id === botId && b.enabled);
  } else {
    targetBot = bots.find((b) => b.enabled);
  }

  if (!targetBot || !targetBot.token) return null;

  const existing = botClientsMap.get(targetBot.id);
  if (existing && existing.token === targetBot.token) {
    return existing;
  }

  const client = new TelegramBotClient(targetBot.token);
  botClientsMap.set(targetBot.id, client);
  return client;
}
