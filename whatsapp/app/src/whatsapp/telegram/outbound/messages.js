import fs from 'fs';
import { loadTelegramStore, saveTelegramStore } from '../store.js';
import { getTelegramBotClient } from '../bot.js';
import { recordMessageMap, resolveTgMsgFromWa } from '../message_map.js';
import { waToTelegramHtml, stripHtmlTags } from '../format.js';
import { applyRegexReplacements } from '../regex.js';
import { formatHeader } from '../headers.js';
import { logger } from '../../../logger.js';
import { getGroupModerationConfig } from '../../moderation/store.js';
import { translateTextGatewayWithReason } from '../../../utils/gatewayTranslator.js';
import { activeDiagnosticChats } from '../../actions.js';

const recentWaSyncMessages = new Map(); // key: waMsgId -> timestamp

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

  const waMsgId = msg.key?.id;
  if (waMsgId) {
    const now = Date.now();
    if (recentWaSyncMessages.has(waMsgId) && now - recentWaSyncMessages.get(waMsgId) < 10000) {
      logger.debug(
        { waMsgId },
        'Skipping duplicate WhatsApp to Telegram sync for identical waMsgId'
      );
      return;
    }
    recentWaSyncMessages.set(waMsgId, now);
    if (recentWaSyncMessages.size > 2000) {
      for (const [k, ts] of recentWaSyncMessages.entries()) {
        if (now - ts > 30000) recentWaSyncMessages.delete(k);
      }
    }
  }

  // Check offline catchup message age filter
  const catchupCfg = store.offline_catchup || { enabled: true, max_age_minutes: 2 };
  if (catchupCfg.enabled !== false && msg.messageTimestamp) {
    const rawTs = Number(msg.messageTimestamp?.low || msg.messageTimestamp);
    if (rawTs && !isNaN(rawTs)) {
      const msgTimeMs = rawTs > 1e11 ? rawTs : rawTs * 1000;
      const maxAgeMs = Math.max(1, Number(catchupCfg.max_age_minutes || 2)) * 60 * 1000;
      const ageMs = Date.now() - msgTimeMs;
      if (ageMs > maxAgeMs) {
        logger.info(
          {
            waMsgId,
            ageSeconds: Math.round(ageMs / 1000),
            maxAgeSeconds: Math.round(maxAgeMs / 1000),
          },
          '⏳ Skipping outdated offline WhatsApp message beyond catchup window'
        );
        return;
      }
    }
  }

  // Find active mappings for this WhatsApp JID
  const mappings = (store.mappings || []).filter(
    (m) =>
      m.enabled &&
      m.wa_jid &&
      m.wa_jid.toLowerCase() === waJid.toLowerCase() &&
      (m.sync_mode === 'bidirectional' || m.sync_mode === 'outbound')
  );

  if (waMsgId) {
    const isBotEcho = resolveTgMsgFromWa(waMsgId);
    if (isBotEcho && isBotEcho.fromMe === true && msg.key?.fromMe) return; // Prevent echo loop only if bot itself sent it
  }

  // Handle WhatsApp Reactions immediately before text / media guards
  const reactionObj =
    msg.message?.reactionMessage ||
    msg.message?.ephemeralMessage?.message?.reactionMessage ||
    msg.message?.viewOnceMessage?.message?.reactionMessage;
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

  // Guard against blank/empty messages without media (e.g. unhandled protocol nodes)
  const hasMedia = Boolean(mediaUrl || mediaPath || mediaType);
  if (!hasMedia && (!textContent || !textContent.trim())) {
    return;
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

  const isFromMe = Boolean(msg.key?.fromMe);
  const isDiag = activeDiagnosticChats.has(waJid);

  for (const mapping of mappings) {
    if (isFromMe && !mapping.sync_self_messages && !isDiag) {
      continue;
    }
    const bot = getTelegramBotClient(mapping.bot_id);
    if (!bot) continue;
    if (mapping.ignore_command_prefixes && textContent && !isDiag) {
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

      let effectiveText = textContent;
      const groupModCfg = getGroupModerationConfig(waJid);
      const isTranslateActive =
        Boolean(mapping.translate_wa_to_tg) ||
        (groupModCfg?.translation?.enabled !== false &&
          (groupModCfg?.translation?.mode === 'auto' ||
            groupModCfg?.translation?.mode === 'forwards'));

      let translationBanner = '';
      if (isTranslateActive && textContent && textContent.trim()) {
        try {
          const targetLang =
            mapping.translate_wa_to_tg_lang ||
            groupModCfg?.translation?.target_lang ||
            groupModCfg?.language ||
            'en';
          const provider = groupModCfg?.translation?.provider || 'auto';
          const transRes = await translateTextGatewayWithReason(
            textContent,
            targetLang,
            provider,
            groupModCfg
          );
          if (
            transRes?.translation &&
            transRes.translation.trim() &&
            transRes.translation.trim().toLowerCase() !== textContent.trim().toLowerCase()
          ) {
            const srcBadge =
              transRes.sourceLang && transRes.sourceLang !== '?' && transRes.sourceLang !== 'auto'
                ? `${transRes.sourceLang.toUpperCase()} → `
                : '';
            const provBadge = transRes.providerName
              ? ` • ${transRes.providerName}`
              : transRes.provider
                ? ` • ${transRes.provider}`
                : '';
            translationBanner = `🌐 <i>[${srcBadge}${targetLang.toUpperCase()}${provBadge}]</i>\n`;
            effectiveText = transRes.translation;
          }
        } catch (transErr) {
          logger.debug({ err: transErr.message }, 'Failed to translate WA->TG message');
        }
      }

      let processedText = applyRegexReplacements(effectiveText, mapping.regex_replacements || []);
      const formattedBody =
        mapping.convert_formatting !== false
          ? waToTelegramHtml(processedText)
          : processedText || '';
      const fullText = `${header}${quotedTextFallback}${translationBanner}${formattedBody}`;

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
      } else if (mediaType === 'buttons') {
        const btnObj =
          msg.message?.buttonsMessage || msg.message?.templateMessage?.hydratedTemplate;
        const bodyText = btnObj?.contentText || btnObj?.hydratedContentText || fullText;
        const footer = btnObj?.footerText || btnObj?.hydratedFooterText || '';
        const rawBtns = btnObj?.buttons || btnObj?.hydratedButtons || [];
        const inlineKeyboard = rawBtns.map((b, i) => {
          const label =
            b.buttonText?.displayText ||
            b.quickReplyButton?.displayText ||
            b.displayText ||
            `Option ${i + 1}`;
          const id = b.buttonId || b.quickReplyButton?.id || b.id || `btn_${i + 1}`;
          return [{ text: label, callback_data: `btn:${id}` }];
        });
        const btnCaption = `${header}🔘 <b>${bodyText}</b>${footer ? `\n<i>${footer}</i>` : ''}`;
        tgResult = await bot
          .sendMessage(
            mapping.tg_chat_id,
            btnCaption,
            replyToTgMsgId,
            threadId,
            silent,
            inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : null
          )
          .catch(() => null);
      } else if (mediaType === 'list') {
        const listObj = msg.message?.listMessage;
        const title = listObj?.title || 'Menu';
        const description = listObj?.description || '';
        const sections = listObj?.sections || [];
        const inlineKeyboard = [];
        for (const s of sections) {
          for (const r of s.rows || []) {
            inlineKeyboard.push([
              { text: r.title || 'Option', callback_data: `list:${r.rowId || r.id || r.title}` },
            ]);
          }
        }
        const listCaption = `${header}📋 <b>${title}</b>${description ? `\n${description}` : ''}`;
        tgResult = await bot
          .sendMessage(
            mapping.tg_chat_id,
            listCaption,
            replyToTgMsgId,
            threadId,
            silent,
            inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : null
          )
          .catch(() => null);
      } else if (mediaType === 'interactive') {
        const intObj = msg.message?.interactiveMessage;
        const body = intObj?.body?.text || intObj?.header?.title || fullText;
        const footer = intObj?.footer?.text || '';
        const rawBtns =
          intObj?.nativeFlowMessage?.buttons ||
          intObj?.carouselMessage?.cards ||
          [];
        const inlineKeyboard = [];
        for (const [i, b] of rawBtns.entries()) {
          let label = `Option ${i + 1}`;
          let id = `btn_${i + 1}`;
          if (b.buttonParamsJson) {
            try {
              const params = JSON.parse(b.buttonParamsJson);
              label = params.display_text || params.title || label;
              id = params.id || id;
            } catch {}
          } else if (b.name) {
            label = b.name;
          }
          inlineKeyboard.push([{ text: label, callback_data: `btn:${id}` }]);
        }
        const intCaption = `${header}🔘 <b>${body}</b>${footer ? `\n<i>${footer}</i>` : ''}`;
        tgResult = await bot
          .sendMessage(
            mapping.tg_chat_id,
            intCaption,
            replyToTgMsgId,
            threadId,
            silent,
            inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : null
          )
          .catch(() => null);
      } else if (mediaType === 'poll') {
        const pollMode = mapping.poll_sync_mode || 'native_sync';
        const pollObj =
          msg.message?.pollCreationMessage ||
          msg.message?.pollCreationMessageV2 ||
          msg.message?.pollCreationMessageV3;
        const question = pollObj?.name || 'Poll';
        const options = (pollObj?.options || []).map((o) => o.optionName).filter(Boolean);

        if (pollMode === 'native_sync' || pollMode === 'native_no_vote') {
          // Native mode: send as real Telegram poll, integrate sender header directly into question
          if (question && options.length > 0) {
            const isAnon = Boolean(mapping.poll_is_anonymous ?? false);
            const isMulti = Boolean((pollObj?.selectableCount || 1) > 1);
            const plainHeader =
              !isDirectMirror && header ? stripHtmlTags(header).trim().replace(/:$/, '') : '';
            const pollQuestion = plainHeader
              ? `${plainHeader}: ${question}`.slice(0, 300)
              : question.slice(0, 300);

            tgResult = await bot
              .sendPoll(
                mapping.tg_chat_id,
                pollQuestion,
                options,
                replyToTgMsgId,
                threadId,
                silent,
                isAnon,
                isMulti
              )
              .catch((err) => {
                logger.warn({ error: err.message }, '⚠️ Failed to send Telegram native poll');
                return null;
              });
          }
          if (tgResult?.poll?.id) {
            const tgPollId = String(tgResult.poll.id);
            if (!store.cached_polls) store.cached_polls = {};
            store.cached_polls[tgPollId] = {
              id: tgPollId,
              question,
              options,
              chat_id: mapping.tg_chat_id,
              wa_jid: mapping.wa_jid,
              wa_msg_id: msg.key?.id,
            };
            if (msg.key?.id) {
              store.cached_polls[String(msg.key.id)] = {
                id: String(msg.key.id),
                tg_poll_id: tgPollId,
                question,
                options,
                chat_id: mapping.tg_chat_id,
                wa_jid: mapping.wa_jid,
              };
            }
            saveTelegramStore(store);
          }
          if (!tgResult && options.length > 0) {
            // Fallback 1: Send as Inline Keyboard Buttons before falling back to plain text
            const inlineKeyboard = options.map((opt, i) => [
              { text: opt, callback_data: `poll_vote:${i}` },
            ]);
            const pollText = `${header}📊 <b>[Poll: ${question}]</b>\nSelect an option below:`;
            tgResult = await bot
              .sendMessage(mapping.tg_chat_id, pollText, replyToTgMsgId, threadId, silent, {
                inline_keyboard: inlineKeyboard,
              })
              .catch(() => null);
          }
          if (!tgResult) {
            // Fallback 2: Plain text as last resort
            tgResult = await bot
              .sendMessage(mapping.tg_chat_id, fullText, replyToTgMsgId, threadId, silent)
              .catch(() => null);
          }
        } else if (pollMode === 'buttons') {
          const inlineKeyboard = options.map((opt, i) => [
            { text: opt, callback_data: `poll_vote:${i}` },
          ]);
          const pollText = `${header}📊 <b>[Poll: ${question}]</b>\nSelect an option below:`;
          tgResult = await bot
            .sendMessage(mapping.tg_chat_id, pollText, replyToTgMsgId, threadId, silent, {
              inline_keyboard: inlineKeyboard,
            })
            .catch(() => null);
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
        const pollMode = mapping.poll_sync_mode || 'native_sync';
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

      if (!tgResult) {
        const mediaSource = mediaPath && fs.existsSync(mediaPath) ? mediaPath : mediaUrl;
        if (mediaSource) {
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
          senderJid,
          textContent,
          'wa'
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
