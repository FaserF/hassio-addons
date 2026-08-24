import { loadModerationStore, getGroupModerationConfig } from '../store.js';
import {
  translateTextGatewayWithReason,
  stripTranslationHeaders,
} from '../../../utils/gatewayTranslator.js';
import { logger } from '../../../logger.js';
import { t } from '../../../locales/loader.js';
import { reply } from '../../actions.js';
import { loadTranslationCache, saveTranslationCache } from './translation_cache.js';

export function gt(config, key, params = {}) {
  const lang = config?.language || 'en';
  return t(lang, key, params);
}

export const _TRANSLATION_MAP = new Map(); // key: groupId:sourceWaId -> { botWaId, botKey, ts }
export const _RECENT_TRANSLATIONS = new Map(); // key: groupId:normalizedText:targetLang -> timestamp

// Restore translation map from disk on module load (survives addon restarts)
try {
  const cached = loadTranslationCache();
  for (const [k, v] of Object.entries(cached)) {
    _TRANSLATION_MAP.set(k, v);
  }
  if (_TRANSLATION_MAP.size > 0) {
    logger.info({ count: _TRANSLATION_MAP.size }, '🗺️ Restored translation map from disk cache');
  }
} catch (_) {}

function _persistTranslationMap() {
  const cacheObj = {};
  for (const [k, v] of _TRANSLATION_MAP.entries()) {
    cacheObj[k] = { ...v, ts: v.ts || Date.now() };
  }
  saveTranslationCache(cacheObj);
}

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
  return false;
}

export function recordRecentTranslation(groupId, text, targetLang = 'en', ttlMs = 120000) {
  if (!groupId || !text) return;
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return;
  const key = `${groupId}:${targetLang}:${normalized}`;
  const now = Date.now();
  _RECENT_TRANSLATIONS.set(key, now);
  if (_RECENT_TRANSLATIONS.size > 2000) {
    for (const [k, ts] of _RECENT_TRANSLATIONS.entries()) {
      if (now - ts > ttlMs) _RECENT_TRANSLATIONS.delete(k);
    }
  }
}

export function recordTranslationMap(groupId, sourceWaId, botWaId, botKey) {
  if (!sourceWaId || !botWaId) return;
  const cleanSourceId = String(sourceWaId).trim();
  const entry = { botWaId, botKey, groupId: groupId || null, ts: Date.now() };
  if (groupId) {
    _TRANSLATION_MAP.set(`${groupId}:${cleanSourceId}`, entry);
  }
  _TRANSLATION_MAP.set(cleanSourceId, entry);
  if (_TRANSLATION_MAP.size > 10000) {
    const firstKey = _TRANSLATION_MAP.keys().next().value;
    _TRANSLATION_MAP.delete(firstKey);
  }
  _persistTranslationMap();
}

export async function deleteTranslationIfExists(session, groupId, sourceWaId) {
  if (!sourceWaId) return;
  const cleanSourceId = String(sourceWaId).trim();
  const key = groupId ? `${groupId}:${cleanSourceId}` : cleanSourceId;
  const record = _TRANSLATION_MAP.get(key) || _TRANSLATION_MAP.get(cleanSourceId);
  if (record) {
    if (groupId) _TRANSLATION_MAP.delete(`${groupId}:${cleanSourceId}`);
    _TRANSLATION_MAP.delete(cleanSourceId);
    _persistTranslationMap();
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
    /^(📍\s*\[|👤\s*\[|📊\s*\[|🔘\s*\[|📋\s*\[|🗳️\s*|📅\s*\*?\[|🧪\s*\*?\[?Diagnostic|🤖\s*\*?WhatsApp|🏁\s*\*?Diagnostic|⚠️\s*\*?Bot|🛡️|📜\s*\*?Rules|⏳|🌴\s*\*?Automated|🌐\s*\*?Auto)/i.test(
      newText
    ) ||
    /^[!/#.?$]\w+/i.test(newText) ||
    /^https?:\/\/\S+$/i.test(newText.trim()) ||
    /^[\d\s+\-().]+$/.test(newText.trim())
  ) {
    return;
  }

  // Strip existing translation headers if text contains them
  let cleanText = stripTranslationHeaders(newText);
  if (!cleanText || cleanText.length < 2) return;

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
  let targetLang = config.translation?.target_lang;
  let provider = config.translation?.provider || 'auto';
  let isTranslationActive =
    config.translation?.enabled !== false &&
    Boolean(config.translation?.enabled || config.translation?.mode);

  if (!isTranslationActive || !targetLang) {
    try {
      const { loadTelegramStore } = await import('../../telegram/store.js');
      const tgStore = loadTelegramStore();
      const matchingMapping = (tgStore.mappings || []).find(
        (m) => m.enabled && m.wa_jid && m.wa_jid.toLowerCase() === groupId.toLowerCase()
      );
      if (matchingMapping) {
        if (!isTranslationActive) {
          isTranslationActive = Boolean(
            matchingMapping.translate_wa_to_tg || matchingMapping.translate_tg_to_wa
          );
        }
        if (!targetLang) {
          targetLang =
            matchingMapping.translate_wa_to_tg_lang ||
            matchingMapping.translate_tg_to_wa_lang ||
            config.language ||
            'en';
        }
      }
    } catch (_e) {}
  }
  if (!targetLang) targetLang = config.language || 'en';

  if (!record && !isTranslationActive) return;

  try {
    const transResult =
      provider === 'ai'
        ? await (async () => {
            const { processAiModeration } = await import('../ai.js');
            return processAiModeration(
              cleanText,
              config.ai || {},
              store.gemini_api_key,
              'translate',
              {
                targetLang,
              }
            );
          })()
        : await translateTextGatewayWithReason(cleanText, targetLang, provider, config);

    if (
      transResult?.translation &&
      transResult.translation.trim().toLowerCase() !== cleanText.trim().toLowerCase()
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
          await reply(session, groupId, { text: updatedText, edit: editKey }, null, {
            skipSpamGuard: true,
          });
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
            { key: editKey, message: { conversation: '...' } },
            { skipSpamGuard: true }
          );
          if (sentNew?.key?.id) {
            record.botWaId = sentNew.key.id;
            record.botKey = sentNew.key;
            _persistTranslationMap();
          }
        }
      } else if (isTranslationActive) {
        // If no prior translation existed, send a new translation reply for the edited text
        const sentTransMsg = await reply(
          session,
          groupId,
          { text: `${header}\n\n"${transResult.translation}"${provBadge}` },
          { key: { id: cleanSourceId, remoteJid: groupId }, message: { conversation: cleanText } },
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
