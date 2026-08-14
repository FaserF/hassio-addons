import { loadModerationStore, getGroupModerationConfig } from '../store.js';
import { translateTextGatewayWithReason } from '../../../utils/gatewayTranslator.js';
import { logger } from '../../../logger.js';
import { t } from '../../../locales/loader.js';

export function gt(config, key, params = {}) {
  const lang = config?.language || 'en';
  return t(lang, key, params);
}

export const _TRANSLATION_MAP = new Map(); // key: groupId:sourceWaId -> { botWaId, botKey }

export function recordTranslationMap(groupId, sourceWaId, botWaId, botKey) {
  if (!groupId || !sourceWaId || !botWaId) return;
  const key = `${groupId}:${sourceWaId}`;
  _TRANSLATION_MAP.set(key, { botWaId, botKey });
  if (_TRANSLATION_MAP.size > 5000) {
    const firstKey = _TRANSLATION_MAP.keys().next().value;
    _TRANSLATION_MAP.delete(firstKey);
  }
}

export async function deleteTranslationIfExists(session, groupId, sourceWaId) {
  if (!groupId || !sourceWaId) return;
  const key = `${groupId}:${sourceWaId}`;
  const record = _TRANSLATION_MAP.get(key);
  if (record) {
    _TRANSLATION_MAP.delete(key);
    try {
      if (session?.sock?.sendMessage && record.botKey) {
        await session.sock.sendMessage(groupId, { delete: record.botKey });
        logger.info(
          { groupId, sourceWaId, botWaId: record.botWaId },
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

  if (!record || !record.botKey) {
    logger.debug(
      { groupId, sourceWaId: cleanSourceId },
      'No translation map record found for edited WhatsApp message'
    );
    return;
  }

  const store = loadModerationStore();
  const config = getGroupModerationConfig(groupId) || {};
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
        : await translateTextGatewayWithReason(newText, targetLang, provider);

    if (
      transResult?.translation &&
      transResult.translation.trim().toLowerCase() !== newText.trim().toLowerCase()
    ) {
      const srcCode = (
        transResult.sourceLang ||
        transResult.detectedSource ||
        '?'
      ).toLowerCase();
      const dstCode = targetLang.toLowerCase();

      if (srcCode !== '?' && srcCode === dstCode) return;

      const header = gt(config, 'bot_replies.auto_translation_header', {
        src: srcCode.toUpperCase(),
        dst: dstCode.toUpperCase(),
      });
      const updatedText = `${header} *(edited)*\n\n"${transResult.translation}"`;

      if (session?.sock?.sendMessage) {
        const editKey = {
          remoteJid: groupId,
          id: record.botKey.id || record.botWaId,
          fromMe: true,
        };
        try {
          await session.sock.sendMessage(groupId, {
            text: updatedText,
            edit: editKey,
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
          const sentNew = await session.sock.sendMessage(
            groupId,
            { text: updatedText },
            { quoted: { key: editKey } }
          );
          if (sentNew?.key?.id) {
            record.botWaId = sentNew.key.id;
            record.botKey = sentNew.key;
          }
        }
      }
    }
  } catch (err) {
    logger.warn(
      { error: err.message, groupId, sourceWaId: cleanSourceId },
      '⚠️ Failed to edit translated WhatsApp bot message'
    );
  }
}
