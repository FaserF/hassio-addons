import { loadTelegramStore } from '../store.js';
import { getTelegramBotClient } from '../bot.js';
import { recordMessageMap, resolveWaMsgFromTg, resolveTgMsgFromWa } from '../message_map.js';
import { waToTelegramHtml } from '../format.js';
import { applyRegexReplacements } from '../regex.js';
import { formatHeader } from '../headers.js';
import { getSession, sessions } from '../../../session.js';
import { logger } from '../../../logger.js';
import { t } from '../../../locales/loader.js';
import { getGroupModerationConfig } from '../../moderation/store.js';
import { translateTextGatewayWithReason } from '../../../utils/gatewayTranslator.js';
import { registry } from '../../moderation/commands.js';

export const recentWaEditEvents = new Map();
export const ignoreWaEditEchoes = new Set();
export const ignoreTgEditEchoes = new Set();

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

export async function syncWhatsAppPinToTelegram(
  waMsgId,
  waJid,
  isPinned = true,
  rawText = '',
  senderName = '',
  groupName = ''
) {
  if (!waMsgId) return;
  const store = loadTelegramStore();
  if (!store.enabled) return;

  const mapped = resolveTgMsgFromWa(waMsgId);
  const mappings = (store.mappings || []).filter(
    (m) =>
      m.enabled &&
      (m.sync_mode === 'bidirectional' || m.sync_mode === 'outbound') &&
      m.sync_pins !== false
  );

  const targetMappings = mappings.filter(
    (m) =>
      (m.wa_jid && m.wa_jid.toLowerCase() === (waJid || '').toLowerCase()) ||
      (mapped?.tgChatId && String(m.tg_chat_id) === String(mapped.tgChatId))
  );

  for (const mapping of targetMappings) {
    const bot = getTelegramBotClient(mapping.bot_id);
    if (!bot) continue;

    let targetTgMsgId = mapped?.tgMsgId ? Number(mapped.tgMsgId) : null;
    let targetTgChatId = mapped?.tgChatId || mapping.tg_chat_id;

    // Fallback: If message was never sent to Telegram (e.g. was a command that was ignored by bridge prefix filter),
    // and is now being pinned, send a representation to Telegram and pin it!
    if (!targetTgMsgId && isPinned) {
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
        let bodyText = rawText;
        if (!bodyText) {
          const tracked = getGroupModerationConfig(waJid)?.pinned_messages?.[waMsgId];
          if (tracked?.text) bodyText = tracked.text;
        }

        let body = '';
        const lang = store.language || 'en';
        if (bodyText && bodyText.trim()) {
          const cleanText = bodyText.trim();
          const cmdMatch = cleanText.match(/^[!/#]\s*([a-zA-Z0-9_]+)/i);
          const cmdName = cmdMatch ? cmdMatch[1].toLowerCase() : null;
          const regCmd = cmdName ? registry.getCommand(cmdName) : null;

          if (regCmd && regCmd.help) {
            body = t(lang, 'bot_replies.pinned_command_detail', {
              cmd: cleanText,
              help: regCmd.help,
            });
          } else {
            body = waToTelegramHtml(cleanText);
          }
        } else {
          body = t(lang, 'bot_replies.pinned_command_fallback');
        }
        const fullMsg = `${header}${body}`;
        const sent = await bot.sendMessage(
          targetTgChatId,
          fullMsg,
          null,
          mapping.tg_thread_id || null,
          Boolean(mapping.silent_delivery)
        );
        if (sent && sent.message_id) {
          targetTgMsgId = sent.message_id;
          recordMessageMap(
            waMsgId,
            targetTgChatId,
            sent.message_id,
            waJid,
            false,
            senderName,
            '',
            bodyText || fullMsg
          );
        }
      } catch (sendErr) {
        logger.debug(
          { error: sendErr.message },
          'Failed to send unmapped pinned message to Telegram'
        );
      }
    }

    if (!targetTgMsgId) continue;

    try {
      if (isPinned) {
        await bot.pinChatMessage(targetTgChatId, targetTgMsgId, true);
        logger.info(
          { waMsgId, tgChatId: targetTgChatId, tgMsgId: targetTgMsgId },
          '📌 Successfully mirrored WhatsApp pin to Telegram'
        );
      } else {
        await bot.unpinChatMessage(targetTgChatId, targetTgMsgId);
        logger.info(
          { waMsgId, tgChatId: targetTgChatId, tgMsgId: targetTgMsgId },
          '📌 Successfully mirrored WhatsApp unpin to Telegram'
        );
      }
    } catch (err) {
      logger.debug(
        { error: err.message, waMsgId, tgChatId: targetTgChatId, tgMsgId: targetTgMsgId },
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
      await bot.unpinAllChatMessages(mapping.tg_chat_id);
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

export async function syncWhatsAppEditToTelegram(
  waMsgId,
  waJid,
  newText,
  groupName = '',
  senderName = '',
  rawMsgKeyId = null
) {
  if (!waMsgId || !newText || !newText.trim()) return;
  if (ignoreWaEditEchoes.has(waMsgId) || (rawMsgKeyId && ignoreWaEditEchoes.has(rawMsgKeyId))) {
    ignoreWaEditEchoes.delete(waMsgId);
    if (rawMsgKeyId) ignoreWaEditEchoes.delete(rawMsgKeyId);
    logger.debug(
      { waMsgId, rawMsgKeyId },
      'Ignoring WhatsApp edit event echo from Telegram bridge'
    );
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

  const mapped =
    resolveTgMsgFromWa(waMsgId) || (rawMsgKeyId ? resolveTgMsgFromWa(rawMsgKeyId) : null);
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

    const effectiveSenderName = senderName || mapped?.senderName || '';
    const isGroupWa = waJid.endsWith('@g.us');
    const isDirectMirror = Boolean(mapping.is_direct_chat_mirror);
    const header = isDirectMirror
      ? ''
      : formatHeader(
          groupName,
          effectiveSenderName,
          isGroupWa ? mapping.include_group_name : false,
          isGroupWa ? mapping.include_sender_name : false,
          mapping.anonymize_phone_numbers
        );

    let effectiveText = newText;
    const groupModCfg = getGroupModerationConfig(waJid);
    const isTranslateActive =
      Boolean(mapping.translate_wa_to_tg) ||
      (groupModCfg?.translation?.enabled !== false &&
        (groupModCfg?.translation?.mode === 'auto' ||
          groupModCfg?.translation?.mode === 'forwards'));

    if (isTranslateActive && newText && newText.trim()) {
      try {
        const targetLang = groupModCfg?.translation?.target_lang || groupModCfg?.language || 'en';
        const provider = groupModCfg?.translation?.provider || 'auto';
        const transRes = await translateTextGatewayWithReason(newText, targetLang, provider);
        if (
          transRes?.translation &&
          transRes.translation.trim() &&
          transRes.translation.trim().toLowerCase() !== newText.trim().toLowerCase()
        ) {
          const note = `🌐 <i>[Auto-translated -> ${targetLang.toUpperCase()}]</i>\n`;
          effectiveText = `${note}${transRes.translation}`;
        }
      } catch (transErr) {
        logger.debug({ err: transErr.message }, 'Failed to translate WA->TG edit');
      }
    }

    let processedText = applyRegexReplacements(effectiveText, mapping.regex_replacements || []);
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

    if (!editSucceeded && mapped && (mapped.tgMsgId || mapped.tgChatId)) {
      const lang = store.language || 'de';
      const editIndicator = t(lang, 'bot_replies.edited_msg_indicator_html');
      const tgChatId = mapped?.tgChatId || mapping.tg_chat_id;
      const fallbackHeader = isDirectMirror
        ? ''
        : formatHeader(
            groupName,
            effectiveSenderName,
            isGroupWa ? mapping.include_group_name : false,
            isGroupWa ? mapping.include_sender_name : false,
            mapping.anonymize_phone_numbers
          );
      const fallbackText = fallbackHeader
        ? `${fallbackHeader}${editIndicator}\n${formattedBody || '<i>[No text]</i>'}`
        : `${editIndicator}\n${formattedBody || '<i>[No text]</i>'}`;
      const replyToId = mapped?.tgMsgId ? mapped.tgMsgId : null;

      try {
        const sentTgMsg = await bot.sendMessage(
          tgChatId,
          fallbackText,
          replyToId,
          mapping.tg_thread_id || null,
          Boolean(mapping.silent_delivery)
        );
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
