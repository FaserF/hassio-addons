import { loadModerationStore, getGroupModerationConfig } from '../store.js';
import { translateTextGatewayWithReason } from '../../../utils/gatewayTranslator.js';
import { logger } from '../../../logger.js';
import { t } from '../../../locales/loader.js';
import { reply } from '../../actions.js';

export function gt(config, key, params = {}) {
  const lang = config?.language || 'en';
  return t(lang, key, params);
}

export const _TRANSLATION_MAP = new Map(); // key: groupId:sourceWaId -> { botWaId, botKey }
export const _RECENT_TRANSLATIONS = new Map(); // key: groupId:normalizedText:targetLang -> timestamp

export function shouldSkipDuplicateTranslation(groupId, text, targetLang = 'en', ttlMs = 120000) {
  if (!groupId || !text) return false;
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return false;
  const key = `${groupId}:${targetLang}:${normalized}`;
  const now = Date.now();
  const lastTime = _RECENT_TRANSLATIONS.get(key);
  if (lastTime && now - lastTime < ttlMs) {
    return true;
  }
  _RECENT_TRANSLATIONS.set(key, now);
  if (_RECENT_TRANSLATIONS.size > 2000) {
    for (const [k, ts] of _RECENT_TRANSLATIONS.entries()) {
      if (now - ts > ttlMs) _RECENT_TRANSLATIONS.delete(k);
    }
  }
  return false;
}

export function recordTranslationMap(groupId, sourceWaId, botWaId, botKey) {
  if (!sourceWaId || !botWaId) return;
  const cleanSourceId = String(sourceWaId).trim();
  const entry = { botWaId, botKey, groupId: groupId || null };
  if (groupId) {
    _TRANSLATION_MAP.set(`${groupId}:${cleanSourceId}`, entry);
  }
  _TRANSLATION_MAP.set(cleanSourceId, entry);
  if (_TRANSLATION_MAP.size > 10000) {
    const firstKey = _TRANSLATION_MAP.keys().next().value;
    _TRANSLATION_MAP.delete(firstKey);
  }
}

export async function deleteTranslationIfExists(session, groupId, sourceWaId) {
  if (!sourceWaId) return;
  const cleanSourceId = String(sourceWaId).trim();
  const key = groupId ? `${groupId}:${cleanSourceId}` : cleanSourceId;
  const record = _TRANSLATION_MAP.get(key) || _TRANSLATION_MAP.get(cleanSourceId);
  if (record) {
    if (groupId) _TRANSLATION_MAP.delete(`${groupId}:${cleanSourceId}`);
    _TRANSLATION_MAP.delete(cleanSourceId);
    try {
      if (session?.sock?.sendMessage && record.botKey) {
        const targetGroup = groupId || record.groupId || record.botKey.remoteJid;
        await session.sock.sendMessage(targetGroup, { delete: record.botKey });
        logger.info(
          { groupId: targetGroup, sourceWaId: cleanSourceId, botWaId: record.botWaId },
          '🗑️ Deleted translated WhatsApp bot message for revoked source message'
        );
      }
    } catch (e) {
      logger.debug({ error: e.message }, 'Failed to delete translated WhatsApp bot message');
    }
  }
}

export async function updateTranslationIfExists(session, groupId, sourceWaId, newText) {
  if (!groupId || !sourceWaId || !newText || newText.trim().length < 2) return;
  if (
    /^(📍\s*\[(Location|Live Location) Share|👤\s*\[Contact:|📊\s*\[Poll:|🔘\s*\[|📋\s*\[List:|🗳️\s*Vote:|📅\s*\*?\[Event)/i.test(
      newText
    ) ||
    /^[!/#.?]\w+/i.test(newText)
  ) {
    return;
  }

  const cleanSourceId = String(sourceWaId).trim();
  const exactKey = `${groupId}:${cleanSourceId}`;

  let record = _TRANSLATION_MAP.get(exactKey);
  if (!record) {
    for (const [k, v] of _TRANSLATION_MAP.entries()) {
      if (k === cleanSourceId || k.endsWith(`:${cleanSourceId}`)) {
        record = v;
        break;
      }
    }
  }

  const store = loadModerationStore();
  const config = getGroupModerationConfig(groupId) || {};
  const isTranslationActive =
    config.translation?.enabled !== false &&
    (config.translation?.mode === 'auto' ||
      config.translation?.mode === 'inbound' ||
      config.translation?.mode === 'both');

  const targetLang = config.translation?.target_lang || 'en';
  const provider = config.translation?.provider || 'auto';

  try {
    const transResult =
      provider === 'ai'
        ? await (async () => {
            const { processAiModeration } = await import('../ai.js');
            return processAiModeration(
              newText,
              config.ai || {},
              store.gemini_api_key,
              'translate',
              {
                targetLang,
              }
            );
          })()
        : await translateTextGatewayWithReason(newText, targetLang, provider, config);

    if (
      transResult?.translation &&
      transResult.translation.trim().toLowerCase() !== newText.trim().toLowerCase()
    ) {
      const srcCode = (transResult.sourceLang || transResult.detectedSource || '?').toLowerCase();
      const dstCode = targetLang.toLowerCase();

      if (srcCode !== '?' && srcCode === dstCode) return;

      const header = gt(config, 'bot_replies.auto_translation_header', {
        src: srcCode.toUpperCase(),
        dst: dstCode.toUpperCase(),
      });
      const provBadge = transResult.providerName
        ? `\n\n_🌐 [${transResult.providerName}]_`
        : transResult.provider
          ? `\n\n_🌐 [${transResult.provider}]_`
          : '';

      if (record && record.botKey) {
        const updatedText = `${header} *(edited)*\n\n"${transResult.translation}"${provBadge}`;
        const editKey = {
          remoteJid: groupId,
          id: record.botKey.id || record.botWaId,
          fromMe: true,
        };
        try {
          await reply(
            session,
            groupId,
            { text: updatedText, edit: editKey },
            null,
            { skipSpamGuard: true }
          );
          logger.info(
            { groupId, sourceWaId: cleanSourceId, botWaId: record.botWaId },
            '✏️ Successfully synchronized edited WhatsApp auto-translation'
          );
        } catch (editErr) {
          logger.debug(
            { error: editErr.message },
            'Native WhatsApp translation edit rejected, sending update reply'
          );
          const sentNew = await reply(
            session,
            groupId,
            { text: updatedText },
            { key: editKey },
            { skipSpamGuard: true }
          );
          if (sentNew?.key?.id) {
            record.botWaId = sentNew.key.id;
            record.botKey = sentNew.key;
          }
        }
      } else if (isTranslationActive) {
        // If no prior translation existed, send a new translation reply for the edited text
        const sentTransMsg = await reply(
          session,
          groupId,
          { text: `${header}\n\n"${transResult.translation}"${provBadge}` },
          { key: { id: cleanSourceId, remoteJid: groupId } },
          { skipSpamGuard: true }
        );
        if (sentTransMsg?.key?.id) {
          recordTranslationMap(groupId, cleanSourceId, sentTransMsg.key.id, sentTransMsg.key);
          logger.info(
            { groupId, sourceWaId: cleanSourceId, botWaId: sentTransMsg.key.id },
            '✅ Sent new WhatsApp auto-translation for edited message'
          );
        }
      }
    }
  } catch (err) {
    logger.warn(
      { error: err.message, groupId, sourceWaId: cleanSourceId },
      '⚠️ Failed to process translated WhatsApp bot message edit'
    );
  }
}
