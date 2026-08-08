import { loadTelegramStore, updateCachedChat } from './store.js';
import { logger } from '../../logger.js';

export class TelegramBotClient {
  constructor(token) {
    this.token = token || '';
  }

  async request(method, payload = {}) {
    if (!this.token) {
      throw new Error('Telegram Bot Token is not configured');
    }
    const url = `https://api.telegram.org/bot${this.token}/${method}`;
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
    const info = await this.request('getMe');
    return info;
  }

  async fetchUpdates() {
    try {
      const updates = await this.request('getUpdates', { limit: 100, timeout: 0 });
      if (Array.isArray(updates)) {
        for (const update of updates) {
          const msg = update.message || update.channel_post || update.edited_message;
          if (msg && msg.chat) {
            updateCachedChat(msg.chat);
          }
        }
      }
      return updates;
    } catch (err) {
      logger.warn({ error: err.message }, '⚠️ Telegram fetchUpdates failed');
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

let botClientInstance = null;

export function getTelegramBotClient() {
  const store = loadTelegramStore();
  if (!store.bot_token) return null;
  if (!botClientInstance || botClientInstance.token !== store.bot_token) {
    botClientInstance = new TelegramBotClient(store.bot_token);
  }
  return botClientInstance;
}
