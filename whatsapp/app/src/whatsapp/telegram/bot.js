import fs from 'fs';
import path from 'path';
import { loadTelegramStore, updateCachedChat } from './store.js';
import { stripHtmlTags } from './format.js';

const TELEGRAM_TOKEN_REGEX = /^[0-9]{6,}:[A-Za-z0-9_-]{20,}$/;

export function sanitizeTelegramToken(token) {
  const cleanToken = String(token || '').trim();
  if (!TELEGRAM_TOKEN_REGEX.test(cleanToken)) {
    throw new Error('Invalid Telegram bot token format');
  }
  return cleanToken;
}

const ALLOWED_METHODS = new Map([
  ['getMe', 'getMe'],
  ['getUpdates', 'getUpdates'],
  ['getFile', 'getFile'],
  ['sendMessage', 'sendMessage'],
  ['sendPhoto', 'sendPhoto'],
  ['sendVoice', 'sendVoice'],
  ['sendDocument', 'sendDocument'],
  ['setMessageReaction', 'setMessageReaction'],
  ['editMessageText', 'editMessageText'],
  ['editMessageCaption', 'editMessageCaption'],
  ['deleteMessage', 'deleteMessage'],
  ['sendVideo', 'sendVideo'],
  ['sendAudio', 'sendAudio'],
  ['sendSticker', 'sendSticker'],
  ['sendLocation', 'sendLocation'],
  ['sendPoll', 'sendPoll'],
  ['sendContact', 'sendContact'],
  ['editMessageLiveLocation', 'editMessageLiveLocation'],
  ['stopMessageLiveLocation', 'stopMessageLiveLocation'],
  ['pinChatMessage', 'pinChatMessage'],
  ['unpinChatMessage', 'unpinChatMessage'],
  ['getMyCommands', 'getMyCommands'],
  ['setMyCommands', 'setMyCommands'],
  ['getChatMenuButton', 'getChatMenuButton'],
  ['setChatMenuButton', 'setChatMenuButton'],
  ['getMyDescription', 'getMyDescription'],
  ['setMyDescription', 'setMyDescription'],
  ['getMyShortDescription', 'getMyShortDescription'],
  ['setMyShortDescription', 'setMyShortDescription'],
  ['getUserProfilePhotos', 'getUserProfilePhotos'],
]);

export class TelegramBotClient {
  constructor(token) {
    this.token = sanitizeTelegramToken(token);
  }

  async request(method, payload = {}) {
    const sanitizedMethod = ALLOWED_METHODS.get(method);
    if (!sanitizedMethod) {
      throw new Error(`Invalid or unsupported Telegram API method: ${method}`);
    }
    const safeToken = encodeURIComponent(this.token);
    const safeMethod = encodeURIComponent(sanitizedMethod);
    const url = `https://api.telegram.org/bot${safeToken}/${safeMethod}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || `Telegram API error on ${sanitizedMethod}`);
    }
    return data.result;
  }

  async getMe() {
    return await this.request('getMe');
  }

  async getFile(fileId) {
    return await this.request('getFile', { file_id: fileId });
  }

  async getFileUrl(fileId) {
    const file = await this.getFile(fileId);
    if (file && file.file_path) {
      const safeToken = encodeURIComponent(this.token);
      return `https://api.telegram.org/file/bot${safeToken}/${file.file_path}`;
    }
    return null;
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
    try {
      return await this.request('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'HTML',
      });
    } catch (err) {
      if (
        err.message &&
        (err.message.includes('no text in the message') ||
          err.message.includes('message text is empty'))
      ) {
        try {
          return await this.request('editMessageCaption', {
            chat_id: chatId,
            message_id: messageId,
            caption: text,
            parse_mode: 'HTML',
          });
        } catch (_capErr) {
          const plainText = stripHtmlTags(text);
          return await this.request('editMessageCaption', {
            chat_id: chatId,
            message_id: messageId,
            caption: plainText,
          });
        }
      }
      const plainText = stripHtmlTags(text);
      return await this.request('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: plainText,
      });
    }
  }

  async sendMediaFile(
    method,
    chatId,
    filePathOrUrl,
    mediaField,
    caption = '',
    replyToMessageId = null,
    threadId = null,
    disableNotification = false
  ) {
    if (
      Buffer.isBuffer(filePathOrUrl) ||
      (typeof filePathOrUrl === 'string' && fs.existsSync(filePathOrUrl))
    ) {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
      }
      if (replyToMessageId) formData.append('reply_to_message_id', String(replyToMessageId));
      if (threadId) formData.append('message_thread_id', String(threadId));
      if (disableNotification) formData.append('disable_notification', 'true');

      let blob;
      let filename = 'file.bin';
      if (Buffer.isBuffer(filePathOrUrl)) {
        blob = new Blob([filePathOrUrl]);
        if (mediaField === 'photo') filename = 'photo.png';
        else if (mediaField === 'sticker') filename = 'sticker.webp';
        else if (mediaField === 'voice') filename = 'voice.ogg';
      } else {
        const fileBuffer = fs.readFileSync(filePathOrUrl);
        filename = path.basename(filePathOrUrl);
        blob = new Blob([fileBuffer]);
      }
      formData.append(mediaField, blob, filename);

      const sanitizedMethod = ALLOWED_METHODS.get(method);
      if (!sanitizedMethod) {
        throw new Error(`Invalid or unsupported Telegram API method: ${method}`);
      }
      const safeToken = encodeURIComponent(this.token);
      const safeMethod = encodeURIComponent(sanitizedMethod);
      const url = `https://api.telegram.org/bot${safeToken}/${safeMethod}`;
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.description || `Telegram API error on ${sanitizedMethod}`);
      }
      return data.result;
    } else {
      const payload = {
        chat_id: chatId,
        [mediaField]: filePathOrUrl,
        caption: caption,
        parse_mode: 'HTML',
        disable_notification: Boolean(disableNotification),
      };
      if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
      if (threadId) payload.message_thread_id = threadId;
      return await this.request(method, payload);
    }
  }

  async sendPoll(
    chatId,
    question,
    options = [],
    replyToMessageId = null,
    threadId = null,
    disableNotification = false,
    isAnonymous = false,
    allowsMultipleAnswers = false
  ) {
    const payload = {
      chat_id: chatId,
      question: question,
      options: JSON.stringify(options),
      is_anonymous: Boolean(isAnonymous),
      allows_multiple_answers: Boolean(allowsMultipleAnswers),
      disable_notification: Boolean(disableNotification),
    };
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
    if (threadId) payload.message_thread_id = threadId;
    return await this.request('sendPoll', payload);
  }

  async sendSticker(
    chatId,
    stickerUrlOrBuffer,
    replyToMessageId = null,
    threadId = null,
    disableNotification = false
  ) {
    return await this.sendMediaFile(
      'sendSticker',
      chatId,
      stickerUrlOrBuffer,
      'sticker',
      '',
      replyToMessageId,
      threadId,
      disableNotification
    );
  }

  async deleteMessage(chatId, messageId) {
    return await this.request('deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  async pinChatMessage(chatId, messageId, disableNotification = true) {
    return await this.request('pinChatMessage', {
      chat_id: chatId,
      message_id: messageId,
      disable_notification: Boolean(disableNotification),
    });
  }

  async unpinChatMessage(chatId, messageId = null) {
    const payload = { chat_id: chatId };
    if (messageId) payload.message_id = messageId;
    return await this.request('unpinChatMessage', payload);
  }

  async unpinallChatMessage(chatId) {
    return await this.request('unpinChatMessage', { chat_id: chatId });
  }
}

const botClientsMap = new Map();

export function getTelegramBotClient(botId = null) {
  const store = loadTelegramStore();
  const bots = store.bots || [];
  if (bots.length === 0) return null;

  const targetBot = botId
    ? bots.find((b) => b.id === botId && b.enabled)
    : bots.find((b) => b.enabled);

  if (!targetBot || !targetBot.token) return null;

  const existing = botClientsMap.get(targetBot.id);
  if (existing && existing.token === targetBot.token) {
    return existing;
  }

  const client = new TelegramBotClient(targetBot.token);
  botClientsMap.set(targetBot.id, client);
  return client;
}
