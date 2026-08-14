import fs from 'fs';
import { loadTelegramStore, saveTelegramStore, updateCachedChat } from './store.js';
import { getTelegramBotClient } from './bot.js';
import { recordMessageMap, resolveWaMsgFromTg, resolveTgMsgFromWa } from './message_map.js';
import { waToTelegramHtml, telegramToWaFormatting, anonymizePhoneNumber } from './format.js';
import { applyRegexReplacements } from './regex.js';
import { logger } from '../../logger.js';
import { getSession, sessions } from '../../session.js';
import { resolveCanonicalUserKey, resolveUserDisplayName } from '../../utils/security.js';
import { t } from '../../locales/loader.js';

let pollingTimer = null;

export function formatHeader(
  sourceGroup,
  senderName,
  includeGroup,
  includeSender,
  anonymizePhone = false
) {
  const parts = [];
  if (includeGroup && sourceGroup) {
    const cleanGroup = String(sourceGroup).endsWith('@g.us')
      ? `Group ${sourceGroup.split('@')[0]}`
      : sourceGroup;
    parts.push(cleanGroup);
  }
  if (includeSender && senderName) {
    const displayName = anonymizePhone ? anonymizePhoneNumber(senderName) : senderName;
    parts.push(displayName);
  }
  if (parts.length === 0) return '';
  return `<b>[${parts.join(' | ')}]</b>:\n`;
}

const recentTgSystemEvents = new Map();

export async function syncWhatsAppGroupEventToTelegram(
  waJid,
  groupName,
  action,
  participants = []
) {
  const store = loadTelegramStore();
  if (!store.enabled) return;

  let session = getSession('default');
  if (!session || !session.sock || !session.isConnected) {
    for (const s of sessions.values()) {
      if (s.sock && s.isConnected) {
        session = s;
        break;
      }
    }
  }

  const departureAction = action === 'remove' || action === 'leave' ? 'departure' : action;
  const canonicalParts = Array.from(
    new Set(
      participants.map((p) => {
        const rawUser = String(p).split('@')[0];
        return resolveCanonicalUserKey(p, session) || rawUser;
      })
    )
  ).sort();
  const partStr = canonicalParts.join(',');
  const eventKey = `tg_sys_evt:${waJid}:${departureAction}:${partStr}`;
  const now = Date.now();
  const lastTime = recentTgSystemEvents.get(eventKey) || 0;
  if (now - lastTime < 15000) {
    return; // Skip duplicate Telegram event within 15 seconds
  }
  recentTgSystemEvents.set(eventKey, now);
  if (recentTgSystemEvents.size > 100) {
    for (const [k, ts] of recentTgSystemEvents.entries()) {
      if (now - ts > 30000) recentTgSystemEvents.delete(k);
    }
  }

  const mappings = (store.mappings || []).filter(
    (m) =>
      m.enabled &&
      m.wa_jid === waJid &&
      m.sync_system_events !== false &&
      (m.sync_mode === 'bidirectional' || m.sync_mode === 'outbound')
  );

  // Resolve and deduplicate participants by canonical phone number to prevent duplicate LID/PN notices
  const seenUsers = new Set();
  const cleanNamesList = [];
  for (const p of participants) {
    const rawUser = String(p).split('@')[0];
    const canonical = resolveCanonicalUserKey(p, session) || rawUser;
    if (!seenUsers.has(canonical)) {
      seenUsers.add(canonical);
      const isLid =
        String(p).includes('@lid') || (canonical.length >= 14 && canonical.startsWith('1576'));
      const display = isLid
        ? session
          ? resolveUserDisplayName(p, session)
          : `@${canonical}`
        : canonical;
      cleanNamesList.push(display);
    }
  }

  if (cleanNamesList.length === 0) return;
  const partNames = cleanNamesList.join(', ');
  let eventText = '';
  if (action === 'add') {
    eventText = `👥 [System: ${partNames || 'Member'} joined WhatsApp group]`;
  } else if (action === 'leave' || action === 'remove') {
    eventText = `👥 [System: ${partNames || 'Member'} left WhatsApp group]`;
  } else if (action === 'promote') {
    eventText = `⭐ [System: ${partNames} was promoted to admin]`;
  } else if (action === 'demote') {
    eventText = `🔻 [System: ${partNames} was demoted from admin]`;
  }

  if (!eventText) return;

  for (const mapping of mappings) {
    const bot = getTelegramBotClient(mapping.bot_id);
    if (!bot) continue;
    try {
      const header = mapping.include_group_name && groupName ? `<b>[${groupName}]</b>:\n` : '';
      await bot.sendMessage(
        mapping.tg_chat_id,
        `${header}${eventText}`,
        null,
        mapping.tg_thread_id || null,
        Boolean(mapping.silent_delivery)
      );
    } catch (e) {
      logger.warn({ error: e.message }, '⚠️ Failed to sync WA group event to Telegram');
    }
  }
}

export async function syncWhatsAppDeleteToTelegram(waMsgId, waJid) {
  if (!waMsgId) return;
  const store = loadTelegramStore();
  if (!store.enabled) return;

  const mapped = resolveTgMsgFromWa(waMsgId);
  if (!mapped || !mapped.tgMsgId || !mapped.tgChatId) return;

  const mappings = (store.mappings || []).filter(
    (m) => m.enabled && (m.sync_mode === 'bidirectional' || m.sync_mode === 'outbound')
  );

  const targetMappings = mappings.filter(
    (m) =>
      (m.wa_jid && m.wa_jid.toLowerCase() === (waJid || '').toLowerCase()) ||
      String(m.tg_chat_id) === String(mapped.tgChatId)
  );

  const listToProcess =
    targetMappings.length > 0
      ? targetMappings
      : (store.mappings || []).filter(
          (m) => m.enabled && String(m.tg_chat_id) === String(mapped.tgChatId)
        );

  for (const mapping of listToProcess) {
    if (mapping.sync_deletions === false || mapping.sync_deletes === false) continue;
    const bot = getTelegramBotClient(mapping.bot_id);
    if (bot) {
      try {
        await bot.deleteMessage(mapped.tgChatId, mapped.tgMsgId);
        logger.info(
          { waMsgId, tgChatId: mapped.tgChatId, tgMsgId: mapped.tgMsgId },
          '🗑️ Successfully mirrored WhatsApp message deletion to Telegram'
        );
      } catch (err) {
        logger.debug(
          { error: err.message, waMsgId, tgChatId: mapped.tgChatId, tgMsgId: mapped.tgMsgId },
          'Failed to delete Telegram message for revoked WhatsApp message'
        );
      }
    }
  }
}

export async function syncWhatsAppPinToTelegram(waMsgId, waJid, isPinned = true) {
  if (!waMsgId) return;
  const store = loadTelegramStore();
  if (!store.enabled) return;

  const mapped = resolveTgMsgFromWa(waMsgId);
  if (!mapped || !mapped.tgMsgId || !mapped.tgChatId) return;

  const mappings = (store.mappings || []).filter(
    (m) =>
      m.enabled &&
      (m.sync_mode === 'bidirectional' || m.sync_mode === 'outbound') &&
      m.sync_pins !== false
  );

  const targetMappings = mappings.filter(
    (m) =>
      (m.wa_jid && m.wa_jid.toLowerCase() === (waJid || '').toLowerCase()) ||
      String(m.tg_chat_id) === String(mapped.tgChatId)
  );

  for (const mapping of targetMappings) {
    const bot = getTelegramBotClient(mapping.bot_id);
    if (!bot) continue;
    try {
      if (isPinned) {
        await bot.pinChatMessage(mapped.tgChatId, Number(mapped.tgMsgId), true);
        logger.info(
          { waMsgId, tgChatId: mapped.tgChatId, tgMsgId: mapped.tgMsgId },
          '📌 Successfully mirrored WhatsApp pin to Telegram'
        );
      } else {
        await bot.unpinChatMessage(mapped.tgChatId, Number(mapped.tgMsgId));
        logger.info(
          { waMsgId, tgChatId: mapped.tgChatId, tgMsgId: mapped.tgMsgId },
          '📌 Successfully mirrored WhatsApp unpin to Telegram'
        );
      }
    } catch (err) {
      logger.debug(
        { error: err.message, waMsgId, tgChatId: mapped.tgChatId, tgMsgId: mapped.tgMsgId },
        'Failed to pin/unpin Telegram message'
      );
    }
  }
}

export async function syncWhatsAppUnpinAllToTelegram(waJid) {
  if (!waJid) return;
  const store = loadTelegramStore();
  if (!store.enabled) return;

  const mappings = (store.mappings || []).filter(
    (m) =>
      m.enabled &&
      (m.sync_mode === 'bidirectional' || m.sync_mode === 'outbound') &&
      m.sync_pins !== false &&
      m.wa_jid &&
      m.wa_jid.toLowerCase() === waJid.toLowerCase()
  );

  for (const mapping of mappings) {
    const bot = getTelegramBotClient(mapping.bot_id);
    if (!bot) continue;
    try {
      await bot.unpinallChatMessage(mapping.tg_chat_id);
      logger.info(
        { waJid, tgChatId: mapping.tg_chat_id },
        '📌 Successfully mirrored WhatsApp unpinall to Telegram'
      );
    } catch (err) {
      logger.debug(
        { error: err.message, waJid, tgChatId: mapping.tg_chat_id },
        'Failed to unpin all messages in Telegram chat'
      );
    }
  }
}

export async function syncTelegramDeleteToWhatsApp(tgChatId, tgMsgId) {
  if (!tgChatId || !tgMsgId) return;
  const store = loadTelegramStore();
  if (!store.enabled) return;

  const mapped = resolveWaMsgFromTg(String(tgChatId), String(tgMsgId));
  if (!mapped || !mapped.waMsgId || !mapped.waJid) return;

  let session = getSession('default');
  if (!session || !session.sock || !session.isConnected) {
    for (const s of sessions.values()) {
      if (s.sock && s.isConnected) {
        session = s;
        break;
      }
    }
  }

  if (session && session.sock && session.isConnected) {
    try {
      await session.sock.sendMessage(mapped.waJid, {
        delete: {
          remoteJid: mapped.waJid,
          fromMe: mapped.fromMe !== undefined ? mapped.fromMe : true,
          id: mapped.waMsgId,
        },
      });
      logger.info(
        { tgChatId, tgMsgId, waMsgId: mapped.waMsgId },
        '🗑️ Successfully mirrored Telegram message deletion to WhatsApp'
      );
    } catch (err) {
      logger.debug(
        { error: err.message, tgChatId, tgMsgId, waMsgId: mapped.waMsgId },
        'Failed to delete WhatsApp message for Telegram delete request'
      );
    }
  }
}

const recentWaEditEvents = new Map();
const ignoreWaEditEchoes = new Set();
const ignoreTgEditEchoes = new Set();

export async function syncWhatsAppEditToTelegram(
  waMsgId,
  waJid,
  newText,
  groupName = '',
  senderName = ''
) {
  if (!waMsgId || !newText || !newText.trim()) return;
  if (ignoreWaEditEchoes.has(waMsgId)) {
    ignoreWaEditEchoes.delete(waMsgId);
    logger.debug({ waMsgId }, 'Ignoring WhatsApp edit event echo from Telegram bridge');
    return;
  }

  const dedupKey = `${waMsgId}:${newText}`;
  const now = Date.now();
  if (recentWaEditEvents.has(dedupKey) && now - recentWaEditEvents.get(dedupKey) < 10000) {
    logger.debug({ waMsgId }, 'Skipping duplicate WhatsApp edit event within 10s');
    return;
  }
  recentWaEditEvents.set(dedupKey, now);
  for (const [k, ts] of recentWaEditEvents.entries()) {
    if (now - ts > 30000) recentWaEditEvents.delete(k);
  }

  const store = loadTelegramStore();
  if (!store.enabled) return;

  const mapped = resolveTgMsgFromWa(waMsgId);
  const targetMappings = (store.mappings || []).filter((m) => {
    if (!m.enabled) return false;
    if (m.sync_mode !== 'bidirectional' && m.sync_mode !== 'outbound') return false;
    if (mapped?.tgChatId && String(m.tg_chat_id) === String(mapped.tgChatId)) return true;
    if (waJid && m.wa_jid && m.wa_jid.toLowerCase() === waJid.toLowerCase()) return true;
    return false;
  });

  for (const mapping of targetMappings) {
    if (mapping.sync_edits === false) continue;
    const bot = getTelegramBotClient(mapping.bot_id);
    if (!bot) continue;

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

    let processedText = applyRegexReplacements(newText, mapping.regex_replacements || []);
    const formattedBody =
      mapping.convert_formatting !== false ? waToTelegramHtml(processedText) : processedText;
    const fullText = `${header}${formattedBody}`;

    let editSucceeded = false;
    if (mapped && mapped.tgMsgId && mapped.tgChatId) {
      try {
        ignoreTgEditEchoes.add(String(mapped.tgMsgId));
        await bot.editMessageText(mapped.tgChatId, mapped.tgMsgId, fullText);
        editSucceeded = true;
        logger.info(
          { waMsgId, tgChatId: mapped.tgChatId, tgMsgId: mapped.tgMsgId },
          '✏️ Successfully mirrored WhatsApp message edit natively to Telegram'
        );
      } catch (err) {
        ignoreTgEditEchoes.delete(String(mapped.tgMsgId));
        logger.info(
          { error: err.message, waMsgId, tgChatId: mapped.tgChatId, tgMsgId: mapped.tgMsgId },
          'Native Telegram editMessageText failed (e.g. >48h old or media), attempting reply fallback'
        );
      }
    }

    if (!editSucceeded) {
      if (mapped && mapped.tgMsgId) {
        logger.info(
          { waMsgId, tgChatId: mapped.tgChatId, tgMsgId: mapped.tgMsgId },
          'ℹ️ Native Telegram edit not accepted (e.g. message too old or media), skipping fallback'
        );
      } else {
        const lang = store.language || 'de';
        const editIndicator = t(lang, 'bot_replies.edited_msg_indicator_html');
        const tgChatId = mapping.tg_chat_id;
        const effectiveSenderName = senderName || '';
        const fallbackHeader = isDirectMirror
          ? ''
          : formatHeader(
              groupName,
              effectiveSenderName,
              isGroupWa ? mapping.include_group_name : false,
              isGroupWa ? mapping.include_sender_name : false,
              mapping.anonymize_phone_numbers
            );
        const fallbackText = `${fallbackHeader}${editIndicator}:\n${formattedBody || '<i>[No text]</i>'}`;

        try {
          const sentTgMsg = await bot.sendMessage(tgChatId, fallbackText);
          if (sentTgMsg && sentTgMsg.message_id) {
            ignoreTgEditEchoes.add(String(sentTgMsg.message_id));
            recordMessageMap(waMsgId, tgChatId, sentTgMsg.message_id, waJid, false);
          }
          logger.info(
            { waMsgId, tgChatId, newTgMsgId: sentTgMsg?.message_id },
            '✏️ Sent contextual WhatsApp message edit notification to Telegram'
          );
        } catch (fallbackErr) {
          logger.warn(
            { error: fallbackErr.message, waMsgId, tgChatId },
            '⚠️ Failed to send Telegram edit fallback message'
          );
        }
      }
    }
  }
}

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

  if (mappings.length === 0) return;

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
        recordMessageMap(waMsgId, mapping.tg_chat_id, sentTgMsgId, waJid, isFromMe, senderName);
      }
    } catch (err) {
      logger.error(
        { error: err.message, waJid, tgChatId: mapping.tg_chat_id },
        '❌ Error syncing WA message to Telegram'
      );
    }
  }
}

const lastUpdateIds = new Map();

export async function processTelegramUpdates() {
  const store = loadTelegramStore();
  if (!store.enabled) return;

  const bots = (store.bots || []).filter((b) => b.enabled && b.token);
  if (bots.length === 0) return;

  for (const botConfig of bots) {
    const bot = getTelegramBotClient(botConfig.id);
    if (!bot) continue;

    let lastUpdateId = lastUpdateIds.get(botConfig.id) || 0;

    try {
      const updates = await bot.request('getUpdates', {
        offset: lastUpdateId + 1,
        limit: 50,
        timeout: 0,
        allowed_updates: [
          'message',
          'edited_message',
          'channel_post',
          'edited_channel_post',
          'message_reaction',
          'message_reaction_count',
          'poll',
          'poll_answer',
        ],
      });

      if (!Array.isArray(updates) || updates.length === 0) continue;

      for (const update of updates) {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);
        lastUpdateIds.set(botConfig.id, lastUpdateId);

        // Handle Telegram Poll Answers (when a user votes or changes vote in a poll)
        if (update.poll_answer) {
          const pa = update.poll_answer;
          const pollId = String(pa.poll_id);
          const voterName = pa.user
            ? `${pa.user.first_name || ''} ${pa.user.last_name || ''}`.trim() ||
              pa.user.username ||
              'Telegram User'
            : 'Telegram User';
          const selectedOptionIds = pa.option_ids || [];

          // Find stored poll details if cached
          const cachedPoll = store.cached_polls?.[pollId];
          const pollQuestion = cachedPoll?.question || 'Poll';
          const pollOptions = cachedPoll?.options || [];
          const selectedText = selectedOptionIds
            .map((idx) => pollOptions[idx] || `Option ${idx + 1}`)
            .join(', ');

          const voteText =
            selectedOptionIds.length > 0
              ? `📊 [Poll Vote Update: ${pollQuestion}]\n👤 Voter: ${voterName}\n🗳️ Vote: ${selectedText}`
              : `📊 [Poll Vote Update: ${pollQuestion}]\n👤 Voter: ${voterName}\n🗳️ Vote: Retracted (No options selected)`;

          const tgChatId = String(pa.voter_chat?.id || cachedPoll?.chat_id || '');
          const mappings = (store.mappings || []).filter(
            (m) =>
              m.enabled &&
              (!tgChatId || String(m.tg_chat_id) === tgChatId) &&
              (!m.bot_id || m.bot_id === botConfig.id) &&
              (m.sync_mode === 'bidirectional' || m.sync_mode === 'inbound')
          );

          for (const mapping of mappings) {
            const pollMode = mapping.poll_sync_mode || 'text_diagram';
            if (pollMode === 'once_no_update') continue;
            if (mapping.poll_send_update_message === false) continue;

            let session = getSession('default');
            if (!session || !session.sock || !session.isConnected) {
              for (const s of sessions.values()) {
                if (s.sock && s.isConnected) {
                  session = s;
                  break;
                }
              }
            }
            if (session && session.sock && session.isConnected) {
              try {
                // Delete previous poll vote update message if stored to avoid chat cluttering
                const oldWaVoteMsgKey = cachedPoll?.last_wa_vote_msg_key;
                if (oldWaVoteMsgKey && mapping.poll_delete_old_update !== false) {
                  try {
                    await session.sock.sendMessage(mapping.wa_jid, { delete: oldWaVoteMsgKey });
                  } catch (_delErr) {}
                }
                const sentWaMsg = await session.sock.sendMessage(mapping.wa_jid, {
                  text: voteText,
                });
                if (sentWaMsg?.key && pollId) {
                  if (!store.cached_polls) store.cached_polls = {};
                  if (!store.cached_polls[pollId]) store.cached_polls[pollId] = {};
                  store.cached_polls[pollId].last_wa_vote_msg_key = sentWaMsg.key;
                  saveTelegramStore(store);
                }
              } catch (e) {
                logger.error(
                  { error: e.message },
                  '❌ Failed to sync Telegram poll vote to WhatsApp'
                );
              }
            }
          }
          continue;
        }

        // Handle Telegram Poll Updates (when poll options or total voters change)
        if (update.poll) {
          const p = update.poll;
          const pollId = String(p.id);
          if (!store.cached_polls) store.cached_polls = {};
          const previousPoll = store.cached_polls[pollId];
          store.cached_polls[pollId] = {
            id: pollId,
            question: p.question,
            options: (p.options || []).map((o) => o.text),
            total_voter_count: p.total_voter_count,
            is_closed: p.is_closed,
            chat_id: previousPoll?.chat_id || '',
          };
          saveTelegramStore(store);

          // Build text diagram update and send to mapped WhatsApp chats
          const tgChatIdForPoll = String(previousPoll?.chat_id || '');
          const pollMappings = (store.mappings || []).filter(
            (m) =>
              m.enabled &&
              (!tgChatIdForPoll || String(m.tg_chat_id) === tgChatIdForPoll) &&
              (!m.bot_id || m.bot_id === botConfig.id) &&
              (m.sync_mode === 'bidirectional' || m.sync_mode === 'inbound')
          );

          for (const mapping of pollMappings) {
            const pollMode = mapping.poll_sync_mode || 'text_diagram';
            if (pollMode === 'once_no_update' || pollMode === 'native_no_vote') continue;

            const totalVotes = p.total_voter_count || 0;
            if (pollMode === 'native_sync') {
              // Auto-vote mode: find leading option with highest votes and relay winner update
              if (totalVotes > 0) {
                const sortedOpts = [...(p.options || [])].sort(
                  (a, b) => (b.voter_count || 0) - (a.voter_count || 0)
                );
                const winner = sortedOpts[0];
                if (winner && winner.voter_count > 0) {
                  const winnerText = `🗳️ [Poll Leader / Auto-Vote: ${p.question}]\n🏆 Leading Option: ${winner.text} (${winner.voter_count}/${totalVotes} votes)`;
                  let session = getSession('default');
                  if (!session || !session.sock || !session.isConnected) {
                    for (const s of sessions.values()) {
                      if (s.sock && s.isConnected) {
                        session = s;
                        break;
                      }
                    }
                  }
                  if (session && session.sock && session.isConnected) {
                    await session.sock
                      .sendMessage(mapping.wa_jid, { text: winnerText })
                      .catch(() => null);
                  }
                }
              }
              continue;
            }
            if (mapping.poll_send_update_message === false) continue;

            const optLines = (p.options || []).map((opt) => {
              const pct = totalVotes > 0 ? Math.round((opt.voter_count / totalVotes) * 100) : 0;
              const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
              return `  ${opt.text}\n  ${bar} ${opt.voter_count} (${pct}%)`;
            });
            const closedLabel = p.is_closed ? ' ✅ Closed' : '';
            const updateText = `📊 [Poll Update${closedLabel}: ${p.question}]\n${optLines.join('\n')}\n👥 Total voters: ${totalVotes}`;

            let session = getSession('default');
            if (!session || !session.sock || !session.isConnected) {
              for (const s of sessions.values()) {
                if (s.sock && s.isConnected) {
                  session = s;
                  break;
                }
              }
            }
            if (session && session.sock && session.isConnected) {
              try {
                await session.sock.sendMessage(mapping.wa_jid, { text: updateText });
              } catch (e) {
                logger.error(
                  { error: e.message },
                  '❌ Failed to send Telegram poll update to WhatsApp'
                );
              }
            }
          }
          continue;
        }

        // Handle Telegram Message Reactions (message_reaction updates)
        if (update.message_reaction) {
          const reactObj = update.message_reaction;
          const tgChatId = String(reactObj.chat.id);
          const tgMsgId = String(reactObj.message_id);
          const newReactions = reactObj.new_reaction || [];
          const latestEmoji =
            newReactions.length > 0 ? newReactions[newReactions.length - 1].emoji : '';

          const mappings = (store.mappings || []).filter(
            (m) =>
              m.enabled &&
              String(m.tg_chat_id) === tgChatId &&
              (!m.bot_id || m.bot_id === botConfig.id) &&
              (m.sync_mode === 'bidirectional' || m.sync_mode === 'inbound')
          );

          if (mappings.length > 0) {
            const mapped = resolveWaMsgFromTg(tgChatId, tgMsgId);
            if (mapped && mapped.waMsgId && mapped.waJid) {
              let session = getSession('default');
              if (!session || !session.sock || !session.isConnected) {
                for (const s of sessions.values()) {
                  if (s.sock && s.isConnected) {
                    session = s;
                    break;
                  }
                }
              }
              if (session && session.sock && session.isConnected) {
                try {
                  const reactionKey = {
                    remoteJid: mapped.waJid,
                    id: mapped.waMsgId,
                    fromMe: mapped.fromMe !== undefined ? mapped.fromMe : false,
                  };
                  await session.sock.sendMessage(mapped.waJid, {
                    react: {
                      text: latestEmoji || '', // Empty string removes reaction in Baileys
                      key: reactionKey,
                    },
                  });
                } catch (reactErr) {
                  logger.error(
                    { error: reactErr.message },
                    '❌ Failed to sync Telegram reaction to WhatsApp'
                  );
                }
              }
            }
          }
          continue;
        }

        const isEdit = Boolean(update.edited_message || update.edited_channel_post);
        const msg =
          update.message ||
          update.channel_post ||
          update.edited_message ||
          update.edited_channel_post;
        if (!msg || !msg.chat) continue;

        if (isEdit && ignoreTgEditEchoes.has(String(msg.message_id))) {
          ignoreTgEditEchoes.delete(String(msg.message_id));
          logger.debug(
            { tgMsgId: msg.message_id },
            'Ignoring Telegram edit event echo from WhatsApp bridge'
          );
          continue;
        }

        updateCachedChat(msg.chat, botConfig.id);

        const tgChatId = String(msg.chat.id);
        const mappings = (store.mappings || []).filter(
          (m) =>
            m.enabled &&
            String(m.tg_chat_id) === tgChatId &&
            (!m.bot_id || m.bot_id === botConfig.id) &&
            (m.sync_mode === 'bidirectional' || m.sync_mode === 'inbound')
        );

        if (mappings.length === 0) continue;

        const senderName = msg.from
          ? `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() ||
            msg.from.username ||
            'Telegram User'
          : msg.chat.title || 'Telegram';
        let tgText = msg.text || msg.caption || '';
        let mediaPayload = null; // { url, type, mimetype }

        try {
          if (msg.sticker) {
            const emoji = msg.sticker.emoji ? ` ${msg.sticker.emoji}` : '';
            tgText = tgText || `[🎨 Sticker${emoji}]`;
            const fileId = msg.sticker.file_id;
            const fileUrl = await bot.getFileUrl(fileId);
            if (fileUrl) {
              mediaPayload = {
                url: fileUrl,
                type: msg.sticker.is_animated || msg.sticker.is_video ? 'document' : 'sticker',
                mimetype: msg.sticker.is_video ? 'video/webm' : 'image/webp',
              };
            }
          } else if (msg.animation) {
            tgText = tgText || '[🎞️ GIF]';
            const fileId = msg.animation.file_id;
            const fileUrl = await bot.getFileUrl(fileId);
            if (fileUrl) {
              mediaPayload = {
                url: fileUrl,
                type: 'video',
                mimetype: msg.animation.mime_type || 'video/mp4',
              };
            }
          } else if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
            tgText = tgText || '[📷 Photo]';
            const bestPhoto = msg.photo[msg.photo.length - 1];
            const fileUrl = await bot.getFileUrl(bestPhoto.file_id);
            if (fileUrl) {
              mediaPayload = {
                url: fileUrl,
                type: 'image',
                mimetype: 'image/jpeg',
                mediaGroupId: msg.media_group_id || null,
              };
            }
          } else if (msg.video) {
            tgText = tgText || '[🎥 Video]';
            const fileUrl = await bot.getFileUrl(msg.video.file_id);
            if (fileUrl) {
              mediaPayload = {
                url: fileUrl,
                type: 'video',
                mimetype: msg.video.mime_type || 'video/mp4',
                mediaGroupId: msg.media_group_id || null,
              };
            }
          } else if (msg.video_note) {
            tgText = tgText || '[📹 Video Note]';
            const fileUrl = await bot.getFileUrl(msg.video_note.file_id);
            if (fileUrl) {
              mediaPayload = {
                url: fileUrl,
                type: 'video',
                mimetype: 'video/mp4',
                ptv: true,
              };
            }
          } else if (msg.voice) {
            tgText = tgText || '[🎤 Voice Note]';
            const fileUrl = await bot.getFileUrl(msg.voice.file_id);
            if (fileUrl) {
              let audioBuffer = null;
              try {
                const res = await fetch(fileUrl);
                if (res.ok) {
                  audioBuffer = Buffer.from(await res.arrayBuffer());
                }
              } catch (_dlErr) {}
              mediaPayload = {
                url: fileUrl,
                buffer: audioBuffer,
                type: 'audio',
                mimetype: msg.voice.mime_type || 'audio/ogg; codecs=opus',
                ptt: true,
              };
            }
          } else if (msg.audio) {
            tgText = tgText || '[🎵 Audio]';
            const fileUrl = await bot.getFileUrl(msg.audio.file_id);
            if (fileUrl) {
              let audioBuffer = null;
              try {
                const res = await fetch(fileUrl);
                if (res.ok) {
                  audioBuffer = Buffer.from(await res.arrayBuffer());
                }
              } catch (_dlErr) {}
              mediaPayload = {
                url: fileUrl,
                buffer: audioBuffer,
                type: 'audio',
                mimetype: msg.audio.mime_type || 'audio/mp3',
                ptt: false,
              };
            }
          } else if (msg.document) {
            tgText = tgText || `[📄 Document: ${msg.document.file_name || 'file'}]`;
            const fileUrl = await bot.getFileUrl(msg.document.file_id);
            if (fileUrl) {
              mediaPayload = {
                url: fileUrl,
                type: 'document',
                mimetype: msg.document.mime_type || 'application/octet-stream',
                fileName: msg.document.file_name,
              };
            }
          } else if (msg.contact) {
            const c = msg.contact;
            const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Contact';
            const phone = c.phone_number || '';
            const vcardStr = `BEGIN:VCARD\nVERSION:3.0\nN:${c.last_name || ''};${c.first_name || ''};;;\nFN:${fullName}\nTEL;type=CELL;type=VOICE;waid=${phone.replace(/\D/g, '')}:+${phone.replace(/\D/g, '')}\nEND:VCARD`;
            mediaPayload = {
              type: 'contact',
              displayName: fullName,
              vcard: vcardStr,
            };
            tgText = tgText || `👤 [Contact: ${fullName} (${phone})]`;
          } else if (msg.location) {
            const loc = msg.location;
            const isLive = Boolean(loc.live_period || msg.live_location);
            mediaPayload = {
              type: isLive ? 'live_location' : 'location',
              latitude: loc.latitude,
              longitude: loc.longitude,
            };
            tgText =
              tgText ||
              (isLive
                ? `📍 [Live Location Share: ${loc.latitude}, ${loc.longitude}]`
                : `📍 [Location Share: ${loc.latitude}, ${loc.longitude}]`);
          } else if (
            msg.new_chat_members &&
            Array.isArray(msg.new_chat_members) &&
            msg.new_chat_members.length > 0
          ) {
            const names = msg.new_chat_members
              .map(
                (m) => `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.username || 'User'
              )
              .join(', ');
            tgText = `👥 [System: ${names} joined the Telegram group]`;
          } else if (msg.left_chat_member) {
            const m = msg.left_chat_member;
            const name =
              `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.username || 'User';
            tgText = `👥 [System: ${name} left the Telegram group]`;
          } else if (msg.pinned_message) {
            const pinnedObj = msg.pinned_message;
            const pinnedSender = pinnedObj.from
              ? `${pinnedObj.from.first_name || ''} ${pinnedObj.from.last_name || ''}`.trim() ||
                pinnedObj.from.username ||
                'User'
              : 'User';
            const rawSnippet =
              pinnedObj.text ||
              pinnedObj.caption ||
              (pinnedObj.photo ? '[📷 Photo]' : '') ||
              (pinnedObj.video ? '[🎥 Video]' : '') ||
              (pinnedObj.document ? `[📄 ${pinnedObj.document.file_name || 'Document'}]` : '') ||
              'Message';
            const snippet = rawSnippet.length > 80 ? `${rawSnippet.slice(0, 80)}...` : rawSnippet;
            tgText = `📌 [Pinned Message by ${pinnedSender}]: ${snippet}`;
          } else if (msg.poll) {
            const p = msg.poll;
            const pollOptions = (p.options || []).map((o) => o.text);
            const optStr =
              pollOptions.length > 0
                ? `\nOptions:\n${pollOptions.map((o, i) => `  ${i + 1}️⃣ ${o}`).join('\n')}`
                : '';
            tgText = `📊 [Poll: ${p.question || 'Untitled'}]${optStr}`;
            // Store native poll payload so per-mapping handler can create a native WA poll
            mediaPayload = {
              type: 'poll',
              question: p.question || 'Poll',
              options: pollOptions,
              allows_multiple_answers: Boolean(p.allows_multiple_answers),
              is_anonymous: Boolean(p.is_anonymous),
            };
            const pollId = String(p.id);
            if (!store.cached_polls) store.cached_polls = {};
            store.cached_polls[pollId] = {
              id: pollId,
              question: p.question,
              options: pollOptions,
              chat_id: tgChatId,
            };
            saveTelegramStore(store);
          }
        } catch (mediaErr) {
          logger.warn({ error: mediaErr.message }, '⚠️ Failed to fetch Telegram file URL');
        }

        if (!tgText && !mediaPayload) continue;

        const replyToTgId = msg.reply_to_message?.message_id;
        let quotedWaMsgId = null;
        let tgQuoteSnippet = '';
        if (replyToTgId) {
          const mapped = resolveWaMsgFromTg(tgChatId, replyToTgId);
          if (mapped) {
            quotedWaMsgId = mapped.waMsgId;
          } else if (msg.reply_to_message) {
            const qMsg = msg.reply_to_message;
            const qSender =
              qMsg.from?.first_name || qMsg.from?.username || qMsg.author_signature || 'User';
            const qMediaTag = qMsg.animation
              ? '🎥 [GIF/Video]'
              : qMsg.sticker
                ? `🎨 [Sticker ${qMsg.sticker.emoji || ''}]`.trim()
                : qMsg.photo
                  ? '📷 [Photo]'
                  : qMsg.video
                    ? '🎥 [Video]'
                    : qMsg.audio || qMsg.voice
                      ? '🎵 [Audio]'
                      : qMsg.document
                        ? `📄 [Document: ${qMsg.document.file_name || ''}]`.trim()
                        : '';
            const qText = qMsg.text || qMsg.caption || qMediaTag;
            const snippet = qText
              ? qText.length > 80
                ? `${qText.substring(0, 80)}...`
                : qText
              : '';
            if (snippet || qSender) {
              tgQuoteSnippet = `> [${qSender}]: ${snippet}\n`;
            }
          }
        }

        for (const mapping of mappings) {
          const isSystemMsg = Boolean(msg.new_chat_members || msg.left_chat_member);
          const isPinMsg = Boolean(msg.pinned_message);
          if (isSystemMsg && mapping.sync_system_events === false) continue;
          if (isPinMsg && mapping.sync_pins === false) continue;

          const isGroupChat = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
          const isDirectMirror = Boolean(mapping.is_direct_chat_mirror);
          const rawHeader = isDirectMirror
            ? ''
            : formatHeader(
                isGroupChat ? msg.chat.title : null,
                senderName,
                mapping.include_group_name,
                isGroupChat ? mapping.include_sender_name : false
              );
          const cleanHeader = rawHeader.replace(/<\/?b>/g, '');
          const entities = msg.entities || msg.caption_entities || null;
          const formattedTgText =
            mapping.convert_formatting !== false
              ? telegramToWaFormatting(tgText, entities)
              : tgText;
          const outboundWaText = `${cleanHeader}${tgQuoteSnippet}${formattedTgText}`;

          let session = getSession('default');
          if (!session || !session.sock || !session.isConnected) {
            for (const s of sessions.values()) {
              if (s.sock && s.isConnected) {
                session = s;
                break;
              }
            }
          }
          if (session && session.sock && session.isConnected) {
            try {
              if (isPinMsg) {
                const pinnedTgMsg = msg.pinned_message;
                const pinnedTgMsgId = pinnedTgMsg?.message_id;
                const mappedWaMsg = pinnedTgMsgId
                  ? resolveWaMsgFromTg(tgChatId, String(pinnedTgMsgId))
                  : null;
                if (mappedWaMsg && mappedWaMsg.waMsgId) {
                  try {
                    await session.sock.sendMessage(mapping.wa_jid, {
                      pin: {
                        key: {
                          remoteJid: mapping.wa_jid,
                          fromMe: mappedWaMsg.fromMe !== undefined ? mappedWaMsg.fromMe : false,
                          id: mappedWaMsg.waMsgId,
                        },
                        type: 1,
                        time: 604800,
                      },
                    });
                    logger.info(
                      { tgChatId, tgPinnedId: pinnedTgMsgId, waMsgId: mappedWaMsg.waMsgId },
                      '📌 Mirrored Telegram message pin natively to WhatsApp'
                    );
                  } catch (pinErr) {
                    logger.debug({ error: pinErr.message }, 'Native WhatsApp pin failed');
                  }
                }
                // Always skip sending the raw notification text in WhatsApp
                continue;
              }

              if (isEdit) {
                let editSucceeded = false;
                const mapped = resolveWaMsgFromTg(tgChatId, String(msg.message_id));
                if (mapped && mapped.waMsgId && mapped.waJid) {
                  try {
                    ignoreWaEditEchoes.add(mapped.waMsgId);
                    await session.sock.sendMessage(mapping.wa_jid, {
                      text: outboundWaText,
                      edit: {
                        remoteJid: mapping.wa_jid,
                        fromMe: mapped.fromMe !== undefined ? mapped.fromMe : true,
                        id: mapped.waMsgId,
                      },
                    });
                    editSucceeded = true;
                    logger.info(
                      { tgChatId, tgMsgId: msg.message_id, waMsgId: mapped.waMsgId },
                      '✏️ Mirrored Telegram message edit natively to WhatsApp'
                    );
                  } catch (editErr) {
                    ignoreWaEditEchoes.delete(mapped.waMsgId);
                    logger.info(
                      { err: editErr?.message, waMsgId: mapped.waMsgId },
                      'Native WhatsApp edit failed (e.g. >15m old), falling back to contextual update message'
                    );
                  }
                }

                if (!editSucceeded) {
                  const lang = store.language || 'de';
                  const editIndicator = t(lang, 'bot_replies.edited_msg_indicator');
                  const editOldText = t(lang, 'bot_replies.edited_msg_old');
                  let fallbackWaText = `${cleanHeader}${editIndicator}\n${tgQuoteSnippet}${formattedTgText}`;
                  const sendOpts = { text: fallbackWaText };

                  if (mapped && mapped.waMsgId) {
                    sendOpts.quoted = {
                      key: {
                        remoteJid: mapping.wa_jid,
                        fromMe: mapped.fromMe !== undefined ? mapped.fromMe : true,
                        id: mapped.waMsgId,
                      },
                      message: { conversation: '...' },
                    };
                  } else {
                    fallbackWaText = `${cleanHeader}${editIndicator} ${editOldText}\n${tgQuoteSnippet}${formattedTgText}`;
                    sendOpts.text = fallbackWaText;
                  }

                  const sentMsg = await session.sock.sendMessage(mapping.wa_jid, sendOpts);
                  if (sentMsg?.key?.id) {
                    recordMessageMap(
                      sentMsg.key.id,
                      tgChatId,
                      msg.message_id,
                      mapping.wa_jid,
                      sentMsg.key.fromMe
                    );
                  }
                  logger.info(
                    { tgChatId, tgMsgId: msg.message_id, waMsgId: sentMsg?.key?.id },
                    '✏️ Sent contextual Telegram message edit fallback to WhatsApp'
                  );
                }
                continue;
              }

              const cleanCmd = tgText
                .trim()
                .toLowerCase()
                .replace(/^[!/#]+/, '');
              if (
                (cleanCmd === 'del' ||
                  cleanCmd === 'delete' ||
                  cleanCmd === 'revoke' ||
                  cleanCmd === 'rm' ||
                  cleanCmd === 'remove') &&
                replyToTgId
              ) {
                const mapped = resolveWaMsgFromTg(tgChatId, String(replyToTgId));
                if (mapped && mapped.waMsgId) {
                  await session.sock.sendMessage(mapping.wa_jid, {
                    delete: {
                      remoteJid: mapping.wa_jid,
                      fromMe: mapped.fromMe !== undefined ? mapped.fromMe : true,
                      id: mapped.waMsgId,
                    },
                  });
                  // Clean up both the target message and the !del command message in Telegram
                  await bot.deleteMessage(tgChatId, replyToTgId).catch(() => null);
                  await bot.deleteMessage(tgChatId, msg.message_id).catch(() => null);
                  logger.info(
                    { tgChatId, tgMsgId: replyToTgId, waMsgId: mapped.waMsgId },
                    '🗑️ Mirrored Telegram delete command to WhatsApp and cleaned up Telegram messages'
                  );
                  continue;
                }
              }

              const sendOptions = {};
              if (quotedWaMsgId) {
                sendOptions.quoted = { key: { remoteJid: mapping.wa_jid, id: quotedWaMsgId } };
              }

              let waContent = { text: outboundWaText };
              if (mediaPayload) {
                if (mediaPayload.type === 'location' || mediaPayload.type === 'liveLocation') {
                  waContent = {
                    location: {
                      degreesLatitude: mediaPayload.latitude,
                      degreesLongitude: mediaPayload.longitude,
                    },
                  };
                } else if (mediaPayload.type === 'live_location') {
                  waContent = {
                    liveLocation: {
                      degreesLatitude: mediaPayload.latitude,
                      degreesLongitude: mediaPayload.longitude,
                    },
                  };
                } else if (mediaPayload.type === 'contact') {
                  waContent = {
                    contacts: {
                      displayName: mediaPayload.displayName,
                      contacts: [{ vcard: mediaPayload.vcard }],
                    },
                  };
                } else if (mediaPayload.type === 'poll') {
                  const pollMode = mapping.poll_sync_mode || 'text_diagram';
                  if (
                    (pollMode === 'native_sync' || pollMode === 'native_no_vote') &&
                    mediaPayload.options?.length > 0
                  ) {
                    // Send native WhatsApp poll
                    waContent = {
                      poll: {
                        name: mediaPayload.question,
                        values: mediaPayload.options,
                        selectableCount: mediaPayload.allows_multiple_answers
                          ? mediaPayload.options.length
                          : 1,
                      },
                    };
                  } else if (pollMode === 'once_no_update') {
                    // Send short text once
                    waContent = {
                      text: `📊 [Poll: ${mediaPayload.question}]\nOptions: ${(mediaPayload.options || []).join(', ')}`,
                    };
                  } else {
                    // text_diagram: already in outboundWaText, use default text
                    waContent = { text: outboundWaText };
                  }
                } else if (mediaPayload.url) {
                  if (mediaPayload.type === 'image') {
                    waContent = { image: { url: mediaPayload.url }, caption: outboundWaText };
                  } else if (mediaPayload.type === 'video') {
                    waContent = {
                      video: { url: mediaPayload.url },
                      caption: outboundWaText,
                      gifPlayback: Boolean(msg.animation),
                      ptv: Boolean(mediaPayload.ptv),
                    };
                  } else if (mediaPayload.type === 'audio') {
                    waContent = {
                      audio: mediaPayload.buffer ? mediaPayload.buffer : { url: mediaPayload.url },
                      mimetype: mediaPayload.mimetype || 'audio/ogg; codecs=opus',
                      ptt: Boolean(mediaPayload.ptt || msg.voice),
                    };
                  } else if (mediaPayload.type === 'sticker') {
                    waContent = {
                      sticker: { url: mediaPayload.url },
                    };
                  } else if (mediaPayload.type === 'document') {
                    waContent = {
                      document: { url: mediaPayload.url },
                      mimetype: mediaPayload.mimetype,
                      fileName: mediaPayload.fileName || 'file',
                      caption: outboundWaText,
                    };
                  }
                }
              }

              const sentWaMsg = await session.sock.sendMessage(
                mapping.wa_jid,
                waContent,
                sendOptions
              );
              // For location/live_location: follow up with sender info as text (WA native pins carry no caption)
              if (
                sentWaMsg &&
                (mediaPayload?.type === 'location' || mediaPayload?.type === 'live_location') &&
                outboundWaText.trim()
              ) {
                await session.sock
                  .sendMessage(
                    mapping.wa_jid,
                    { text: outboundWaText.trim() },
                    sentWaMsg.key?.id
                      ? { quoted: { key: { remoteJid: mapping.wa_jid, id: sentWaMsg.key.id } } }
                      : {}
                  )
                  .catch(() => null);
              }
              if (mediaPayload && mediaPayload.type === 'sticker' && outboundWaText.trim()) {
                await session.sock
                  .sendMessage(
                    mapping.wa_jid,
                    { text: outboundWaText.trim() },
                    sentWaMsg && sentWaMsg.key?.id
                      ? { quoted: { key: { remoteJid: mapping.wa_jid, id: sentWaMsg.key.id } } }
                      : {}
                  )
                  .catch(() => null);
              }
              if (sentWaMsg && sentWaMsg.key && sentWaMsg.key.id) {
                recordMessageMap(
                  sentWaMsg.key.id,
                  tgChatId,
                  msg.message_id,
                  mapping.wa_jid,
                  true,
                  senderName
                );
              }
            } catch (waErr) {
              logger.error(
                { error: waErr.message, waJid: mapping.wa_jid },
                '❌ Error syncing Telegram message to WhatsApp'
              );
            }
          }
        }
      }
    } catch (err) {
      logger.warn({ error: err.message, botId: botConfig.id }, '⚠️ Error polling Telegram updates');
    }
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
