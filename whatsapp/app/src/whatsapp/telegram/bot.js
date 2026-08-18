import fs from 'fs';
import path from 'path';
import { loadTelegramStore, updateCachedChat } from './store.js';
import {
  stripHtmlTags,
  splitTelegramHtml,
  TELEGRAM_MAX_TEXT_LENGTH,
  TELEGRAM_MAX_CAPTION_LENGTH,
} from './format.js';

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
  ['answerCallbackQuery', 'answerCallbackQuery'],
  ['editMessageLiveLocation', 'editMessageLiveLocation'],
  ['stopMessageLiveLocation', 'stopMessageLiveLocation'],
  ['pinChatMessage', 'pinChatMessage'],
  ['unpinChatMessage', 'unpinChatMessage'],
  ['unpinAllChatMessages', 'unpinAllChatMessages'],
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
    disableNotification = false,
    replyMarkup = null
  ) {
    const strText = String(text || '');

    // Split messages exceeding Telegram's 4096 character limit into balanced chunks
    if (strText.length > TELEGRAM_MAX_TEXT_LENGTH) {
      const chunks = splitTelegramHtml(strText, TELEGRAM_MAX_TEXT_LENGTH);
      let firstResult = null;
      let lastMsgId = replyToMessageId;

      for (let i = 0; i < chunks.length; i++) {
        const isFirst = i === 0;
        const isLast = i === chunks.length - 1;
        const payload = {
          chat_id: chatId,
          text: chunks[i],
          parse_mode: 'HTML',
          disable_web_page_preview: false,
          disable_notification: Boolean(disableNotification),
        };
        if (isFirst && replyToMessageId) payload.reply_to_message_id = replyToMessageId;
        if (!isFirst && lastMsgId) payload.reply_to_message_id = lastMsgId;
        if (threadId) payload.message_thread_id = threadId;
        if (isLast && replyMarkup) payload.reply_markup = replyMarkup;

        try {
          const res = await this.request('sendMessage', payload);
          if (isFirst) firstResult = res;
          if (res?.message_id) lastMsgId = res.message_id;
        } catch (_htmlErr) {
          // If HTML entity parsing fails on chunk, fallback to plain text
          payload.parse_mode = undefined;
          payload.text = stripHtmlTags(chunks[i]);
          const res = await this.request('sendMessage', payload);
          if (isFirst) firstResult = res;
          if (res?.message_id) lastMsgId = res.message_id;
        }
      }
      return firstResult;
    }

    const payload = {
      chat_id: chatId,
      text: strText,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      disable_notification: Boolean(disableNotification),
    };
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
    if (threadId) payload.message_thread_id = threadId;
    if (replyMarkup) payload.reply_markup = replyMarkup;

    try {
      return await this.request('sendMessage', payload);
    } catch (err) {
      if (
        err.message &&
        (err.message.includes("can't parse entities") || err.message.includes('entity'))
      ) {
        payload.parse_mode = undefined;
        payload.text = stripHtmlTags(strText);
        return await this.request('sendMessage', payload);
      }
      throw err;
    }
  }

  async answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
    return await this.request('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: text || undefined,
      show_alert: Boolean(showAlert),
    });
  }

  async editMessageText(chatId, messageId, text, replyMarkup = null) {
    try {
      const payload = {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'HTML',
      };
      if (replyMarkup) payload.reply_markup = replyMarkup;
      return await this.request('editMessageText', payload);
    } catch (err) {
      if (err.message && err.message.includes('message is not modified')) {
        return { ok: true, result: true };
      }
      if (
        err.message &&
        (err.message.includes('no text in the message') ||
          err.message.includes('message text is empty'))
      ) {
        try {
          const capPayload = {
            chat_id: chatId,
            message_id: messageId,
            caption: text,
            parse_mode: 'HTML',
          };
          if (replyMarkup) capPayload.reply_markup = replyMarkup;
          return await this.request('editMessageCaption', capPayload);
        } catch (_capErr) {
          if (_capErr.message && _capErr.message.includes('message is not modified')) {
            return { ok: true, result: true };
          }
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
    let mainCaption = caption || '';
    let followupText = null;

    if (mainCaption && mainCaption.length > TELEGRAM_MAX_CAPTION_LENGTH) {
      const chunks = splitTelegramHtml(mainCaption, TELEGRAM_MAX_CAPTION_LENGTH);
      mainCaption = chunks[0] || '';
      followupText = chunks.slice(1).join('\n\n');
    }

    if (
      Buffer.isBuffer(filePathOrUrl) ||
      (typeof filePathOrUrl === 'string' && fs.existsSync(filePathOrUrl))
    ) {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      if (mainCaption) {
        formData.append('caption', mainCaption);
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
      const result = data.result;
      if (result?.message_id && followupText && followupText.trim()) {
        await this.sendMessage(
          chatId,
          followupText.trim(),
          result.message_id,
          threadId,
          disableNotification
        ).catch(() => null);
      }
      return result;
    } else {
      const payload = {
        chat_id: chatId,
        [mediaField]: filePathOrUrl,
        caption: mainCaption,
        parse_mode: 'HTML',
        disable_notification: Boolean(disableNotification),
      };
      if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
      if (threadId) payload.message_thread_id = threadId;
      const res = await this.request(method, payload);
      if (res?.message_id && followupText && followupText.trim()) {
        await this.sendMessage(
          chatId,
          followupText.trim(),
          res.message_id,
          threadId,
          disableNotification
        ).catch(() => null);
      }
      return res;
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
      options: Array.isArray(options) ? options : [],
      is_anonymous: Boolean(isAnonymous),
      allows_multiple_answers: Boolean(allowsMultipleAnswers),
      disable_notification: Boolean(disableNotification),
    };
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
    if (threadId) payload.message_thread_id = threadId;
    return await this.request('sendPoll', payload);
  }

  async sendLocation(
    chatId,
    latitude,
    longitude,
    replyToMessageId = null,
    threadId = null,
    disableNotification = false
  ) {
    const payload = {
      chat_id: chatId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      disable_notification: Boolean(disableNotification),
    };
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
    if (threadId) payload.message_thread_id = threadId;
    return await this.request('sendLocation', payload);
  }

  async sendContact(
    chatId,
    phoneNumber,
    firstName,
    lastName = '',
    vcard = '',
    replyToMessageId = null,
    threadId = null,
    disableNotification = false
  ) {
    const payload = {
      chat_id: chatId,
      phone_number: String(phoneNumber),
      first_name: String(firstName),
      disable_notification: Boolean(disableNotification),
    };
    if (lastName) payload.last_name = String(lastName);
    if (vcard) payload.vcard = String(vcard);
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
    if (threadId) payload.message_thread_id = threadId;
    return await this.request('sendContact', payload);
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

  async unpinAllChatMessages(chatId) {
    return await this.request('unpinAllChatMessages', { chat_id: chatId });
  }

  async setMessageReaction(chatId, messageId, emoji = '', isBig = false) {
    const reactionArray = emoji ? [{ type: 'emoji', emoji: String(emoji) }] : [];
    return await this.request('setMessageReaction', {
      chat_id: chatId,
      message_id: messageId,
      reaction: reactionArray,
      is_big: Boolean(isBig),
    });
  }

  async unpinallChatMessage(chatId) {
    return await this.unpinAllChatMessages(chatId);
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
