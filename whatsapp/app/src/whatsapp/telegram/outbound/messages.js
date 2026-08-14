import fs from 'fs';
import { loadTelegramStore, saveTelegramStore } from '../store.js';
import { getTelegramBotClient } from '../bot.js';
import { recordMessageMap, resolveTgMsgFromWa } from '../message_map.js';
import { waToTelegramHtml } from '../format.js';
import { applyRegexReplacements } from '../regex.js';
import { formatHeader } from '../headers.js';
import { logger } from '../../../logger.js';

export async function syncWhatsAppToTelegram(
  msg,
  waJid,
  groupName,
  senderName,
  textContent,
  mediaUrl = null,
  mediaPath = null,
  mediaType = null
) {
  const store = loadTelegramStore();
  if (!store.enabled) return;

  // Find active mappings for this WhatsApp JID
  const mappings = (store.mappings || []).filter(
    (m) =>
      m.enabled &&
      m.wa_jid &&
      m.wa_jid.toLowerCase() === waJid.toLowerCase() &&
      (m.sync_mode === 'bidirectional' || m.sync_mode === 'outbound')
  );

  // Guard against blank/empty messages without media (e.g. unhandled protocol nodes)
  const hasMedia = Boolean(mediaUrl || mediaPath || mediaType);
  if (!hasMedia && (!textContent || !textContent.trim())) {
    return;
  }

  const waMsgId = msg.key?.id;
  if (waMsgId) {
    const isBotEcho = resolveTgMsgFromWa(waMsgId);
    if (isBotEcho && isBotEcho.fromMe === true && msg.key?.fromMe) return; // Prevent echo loop only if bot itself sent it
  }

  const contextInfo =
    msg.message?.extendedTextMessage?.contextInfo ||
    msg.message?.imageMessage?.contextInfo ||
    msg.message?.videoMessage?.contextInfo ||
    msg.message?.documentMessage?.contextInfo ||
    msg.message?.audioMessage?.contextInfo;
  const quotedWaId = contextInfo?.stanzaId;
  let replyToTgMsgId = null;
  let quotedTextFallback = '';
  if (quotedWaId) {
    const mapRecord = resolveTgMsgFromWa(quotedWaId);
    if (mapRecord) {
      replyToTgMsgId = mapRecord.tgMsgId;
    } else {
      // Fallback: If original WA message is missing from mapping cache, extract quote snippet
      const qText =
        contextInfo?.quotedMessage?.conversation ||
        contextInfo?.quotedMessage?.extendedTextMessage?.text ||
        contextInfo?.quotedMessage?.imageMessage?.caption ||
        '';
      const qParticipant = contextInfo?.participant ? contextInfo.participant.split('@')[0] : '';
      if (qText || qParticipant) {
        const qSender = qParticipant ? `<b>${qParticipant}</b>: ` : '';
        const snippet = qText ? (qText.length > 80 ? `${qText.substring(0, 80)}...` : qText) : '';
        quotedTextFallback = `<blockquote>${qSender}${waToTelegramHtml(snippet)}</blockquote>\n`;
      }
    }
  }

  const reactionObj = msg.message?.reactionMessage;
  if (reactionObj) {
    const targetWaMsgId = reactionObj.key?.id;
    const emoji = reactionObj.text || '';
    if (targetWaMsgId) {
      const mappedRecord = resolveTgMsgFromWa(targetWaMsgId);
      if (mappedRecord && mappedRecord.tgMsgId) {
        for (const mapping of mappings) {
          if (mapping.sync_reactions !== false) {
            const bot = getTelegramBotClient(mapping.bot_id);
            if (bot) {
              bot
                .setMessageReaction(mapping.tg_chat_id, mappedRecord.tgMsgId, emoji)
                .catch((err) => {
                  logger.warn({ error: err.message }, '⚠️ Failed to sync reaction to Telegram');
                });
            }
          }
        }
      }
    }
    return; // Reactions handled, do not send as a text message
  }

  const isFromMe = Boolean(msg.key?.fromMe);

  for (const mapping of mappings) {
    if (isFromMe && !mapping.sync_self_messages) {
      continue;
    }
    const bot = getTelegramBotClient(mapping.bot_id);
    if (!bot) continue;
    if (mapping.ignore_command_prefixes && textContent) {
      const cleanText = textContent.trim();
      const prefixes = String(mapping.ignore_command_prefixes)
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (prefixes.some((p) => cleanText.startsWith(p))) {
        continue;
      }
    }
    try {
      const isGroupWa = waJid.endsWith('@g.us');
      const isDirectMirror = Boolean(mapping.is_direct_chat_mirror);
      const header = isDirectMirror
        ? ''
        : formatHeader(
            groupName,
            senderName,
            isGroupWa ? mapping.include_group_name : false,
            isGroupWa ? mapping.include_sender_name : false,
            mapping.anonymize_phone_numbers
          );

      let processedText = applyRegexReplacements(textContent, mapping.regex_replacements || []);
      const formattedBody =
        mapping.convert_formatting !== false
          ? waToTelegramHtml(processedText)
          : processedText || '';
      const fullText = `${header}${quotedTextFallback}${formattedBody}`;

      const silent = Boolean(mapping.silent_delivery);
      const threadId = mapping.tg_thread_id || null;

      let tgResult = null;
      if (mediaType === 'event') {
        // WA eventMessage → Telegram: send as rich HTML card (Telegram has no native event type)
        const evData = msg.message?.eventMessage;
        if (evData) {
          const evName = evData.name || 'Untitled Event';
          const evDesc = evData.description || '';
          const evStart = evData.startTime
            ? new Date(Number(evData.startTime) * 1000).toLocaleString('de-DE', {
                dateStyle: 'full',
                timeStyle: 'short',
                timeZone: 'Europe/Berlin',
              })
            : null;
          const evLoc = evData.location?.name || '';
          const evLink = evData.joinLink || '';
          const evCanceled = evData.isCanceled ? ' ❌ ABGESAGT' : '';
          const htmlLines = [`${header}<b>📅 [Event${evCanceled}]: ${evName}</b>`];
          if (evStart) htmlLines.push(`🕐 ${evStart}`);
          if (evDesc) htmlLines.push(`📝 ${evDesc}`);
          if (evLoc) htmlLines.push(`📍 ${evLoc}`);
          if (evLink) htmlLines.push(`🔗 <a href="${evLink}">Join Link</a>`);
          const eventHtml = htmlLines.join('\n');
          tgResult = await bot
            .request('sendMessage', {
              chat_id: mapping.tg_chat_id,
              text: eventHtml,
              parse_mode: 'HTML',
              reply_to_message_id: replyToTgMsgId || undefined,
              message_thread_id: threadId || undefined,
              disable_notification: silent,
            })
            .catch(() => null);
        }
      } else if (mediaType === 'location' && msg.message?.locationMessage) {
        const loc = msg.message.locationMessage;
        tgResult = await bot
          .request('sendLocation', {
            chat_id: mapping.tg_chat_id,
            latitude: loc.degreesLatitude,
            longitude: loc.degreesLongitude,
            reply_to_message_id: replyToTgMsgId || undefined,
            message_thread_id: threadId || undefined,
            disable_notification: silent,
          })
          .catch(() => null);
        // Always send sender info + location label after the pin (Telegram location pins carry no caption)
        const locLabel =
          loc.name || loc.address || `${loc.degreesLatitude}, ${loc.degreesLongitude}`;
        const locCaption = `${header}📍 ${locLabel}`;
        if (tgResult) {
          await bot
            .sendMessage(mapping.tg_chat_id, locCaption, tgResult.message_id, threadId, silent)
            .catch(() => null);
        }
      } else if (mediaType === 'contact') {
        const contactObj =
          msg.message?.contactMessage || msg.message?.contactsArrayMessage?.contacts?.[0];
        const vcard = contactObj?.vcard || '';
        const displayName =
          contactObj?.displayName ||
          (vcard ? vcard.match(/FN:(.*)/)?.[1]?.trim() : null) ||
          'Contact';
        const phoneMatch = vcard ? vcard.match(/TEL.*:(.*)/)?.[1]?.trim() : '';

        if (phoneMatch || displayName) {
          tgResult = await bot
            .request('sendContact', {
              chat_id: mapping.tg_chat_id,
              phone_number: phoneMatch || '0000000',
              first_name: displayName,
              vcard: vcard || undefined,
              reply_to_message_id: replyToTgMsgId || undefined,
              message_thread_id: threadId || undefined,
              disable_notification: silent,
            })
            .catch(() => null);
        }
        if (!tgResult) {
          tgResult = await bot.sendMessage(
            mapping.tg_chat_id,
            fullText,
            replyToTgMsgId,
            threadId,
            silent
          );
        }
      } else if (mediaType === 'poll') {
        const pollMode = mapping.poll_sync_mode || 'text_diagram';
        const pollObj =
          msg.message?.pollCreationMessage ||
          msg.message?.pollCreationMessageV2 ||
          msg.message?.pollCreationMessageV3;
        const question = pollObj?.name || 'Poll';
        const options = (pollObj?.options || []).map((o) => o.optionName).filter(Boolean);

        if (pollMode === 'native_sync' || pollMode === 'native_no_vote') {
          // Native mode: send as real Telegram poll, skip all text messages
          if (question && options.length > 0) {
            const isAnon = Boolean(mapping.poll_is_anonymous ?? false);
            const isMulti = Boolean((pollObj?.selectableCount || 1) > 1);
            tgResult = await bot
              .sendPoll(
                mapping.tg_chat_id,
                question,
                options,
                replyToTgMsgId,
                threadId,
                silent,
                isAnon,
                isMulti
              )
              .catch(() => null);
          }
          // Also send header so sender is known (polls have no caption in Telegram)
          if (tgResult && header.trim()) {
            await bot
              .sendMessage(mapping.tg_chat_id, header.trim(), tgResult.message_id, threadId, silent)
              .catch(() => null);
          }
          if (!tgResult) {
            // Fallback to text if sendPoll failed
            tgResult = await bot
              .sendMessage(mapping.tg_chat_id, fullText, replyToTgMsgId, threadId, silent)
              .catch(() => null);
          }
        } else if (pollMode === 'once_no_update') {
          const shortPollText = `${header}📊 [Poll: ${question}]\nOptions: ${options.join(', ')}`;
          tgResult = await bot
            .sendMessage(mapping.tg_chat_id, shortPollText, replyToTgMsgId, threadId, silent)
            .catch(() => null);
        } else {
          // text_diagram mode (default)
          if (mapping.poll_send_text_diagram !== false) {
            tgResult = await bot
              .sendMessage(mapping.tg_chat_id, fullText, replyToTgMsgId, threadId, silent)
              .catch(() => null);
          }
        }
      } else if (mediaType === 'poll_update') {
        const pollMode = mapping.poll_sync_mode || 'text_diagram';
        if (
          pollMode === 'once_no_update' ||
          pollMode === 'native_sync' ||
          pollMode === 'native_no_vote'
        ) {
          // In native mode: Telegram manages the poll natively, no extra text updates needed
          continue;
        }
        // text_diagram mode: send update text (and optionally delete old diagram)
        if (mapping.poll_send_update_message !== false) {
          const pollKey = msg.message?.pollUpdateMessage?.pollCreationMessageKey?.id;
          if (
            pollKey &&
            store.cached_polls?.[pollKey]?.last_diagram_tg_msg_id &&
            mapping.poll_delete_old_diagram !== false
          ) {
            const oldId = store.cached_polls[pollKey].last_diagram_tg_msg_id;
            await bot.deleteMessage(mapping.tg_chat_id, oldId).catch(() => null);
          }
          const sentDiag = await bot
            .sendMessage(mapping.tg_chat_id, fullText, replyToTgMsgId, threadId, silent)
            .catch(() => null);
          if (pollKey && sentDiag?.message_id) {
            if (!store.cached_polls) store.cached_polls = {};
            if (!store.cached_polls[pollKey]) store.cached_polls[pollKey] = {};
            store.cached_polls[pollKey].last_diagram_tg_msg_id = sentDiag.message_id;
            saveTelegramStore(store);
          }
        }
        continue;
      }

      const mediaSource = mediaPath && fs.existsSync(mediaPath) ? mediaPath : mediaUrl;
      if (!tgResult && mediaSource) {
        if (mediaType === 'sticker') {
          tgResult = await bot
            .sendMediaFile(
              'sendSticker',
              mapping.tg_chat_id,
              mediaSource,
              'sticker',
              '',
              replyToTgMsgId,
              threadId,
              silent
            )
            .catch(() => null);
          if (tgResult && fullText.trim()) {
            await bot
              .sendMessage(
                mapping.tg_chat_id,
                fullText.trim(),
                tgResult.message_id,
                threadId,
                silent
              )
              .catch(() => null);
          }
        } else if (mediaType === 'image') {
          tgResult = await bot
            .sendMediaFile(
              'sendPhoto',
              mapping.tg_chat_id,
              mediaSource,
              'photo',
              fullText,
              replyToTgMsgId,
              threadId,
              silent
            )
            .catch(() => null);
        } else if (mediaType === 'video') {
          tgResult = await bot
            .sendMediaFile(
              'sendVideo',
              mapping.tg_chat_id,
              mediaSource,
              'video',
              fullText,
              replyToTgMsgId,
              threadId,
              silent
            )
            .catch(() => null);
        } else if (mediaType === 'audio') {
          tgResult = await bot
            .sendMediaFile(
              'sendVoice',
              mapping.tg_chat_id,
              mediaSource,
              'voice',
              fullText,
              replyToTgMsgId,
              threadId,
              silent
            )
            .catch(() => null);
        } else if (mediaType === 'document') {
          tgResult = await bot
            .sendMediaFile(
              'sendDocument',
              mapping.tg_chat_id,
              mediaSource,
              'document',
              fullText,
              replyToTgMsgId,
              threadId,
              silent
            )
            .catch(() => null);
        }

        if (!tgResult) {
          tgResult = await bot
            .sendMediaFile(
              'sendPhoto',
              mapping.tg_chat_id,
              mediaSource,
              'photo',
              fullText,
              replyToTgMsgId,
              threadId,
              silent
            )
            .catch(() =>
              bot.sendMediaFile(
                'sendDocument',
                mapping.tg_chat_id,
                mediaSource,
                'document',
                fullText,
                replyToTgMsgId,
                threadId,
                silent
              )
            )
            .catch(() => {
              const mediaFallbackText = `${fullText}\n<i>[Media File Attached]</i>`;
              return bot.sendMessage(
                mapping.tg_chat_id,
                mediaFallbackText,
                replyToTgMsgId,
                threadId,
                silent
              );
            });
        }
      } else {
        tgResult = await bot.sendMessage(
          mapping.tg_chat_id,
          fullText,
          replyToTgMsgId,
          threadId,
          silent
        );
      }

      const sentTgMsgId = tgResult?.message_id || tgResult?.result?.message_id;
      if (sentTgMsgId && waMsgId) {
        const senderJid = msg.key?.participant || (isFromMe ? '' : waJid);
        recordMessageMap(
          waMsgId,
          mapping.tg_chat_id,
          sentTgMsgId,
          waJid,
          isFromMe,
          senderName,
          senderJid
        );
      }
    } catch (err) {
      logger.error(
        { error: err.message, waJid, tgChatId: mapping.tg_chat_id },
        '❌ Error syncing WA message to Telegram'
      );
    }
  }
}
