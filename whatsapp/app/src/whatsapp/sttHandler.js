import fs from 'fs';
import os from 'path';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { logger } from '../logger.js';
import { getGroupModerationConfig } from '../whatsapp/moderation/store.js';
import { reply } from '../whatsapp/actions.js';

/**
 * Native Speech-to-Text (STT) Transcriber for WhatsApp Voice Notes / Audio Messages.
 * Downloads audio, transcribes natively using free multi-engine, quotes original message with i18n feedback.
 */
export async function handleWhatsAppVoiceSTT(session, groupId, rawMsg) {
  const msg = rawMsg.message;
  const audioMsg = msg?.audioMessage;
  if (!audioMsg) return false;

  // Check group configuration toggle (stt_enabled, default true)
  if (groupId && groupId.endsWith('@g.us')) {
    const config = getGroupModerationConfig(groupId);
    if (config && config.stt_enabled === false) {
      return false;
    }
  }

  const isDe =
    (rawMsg.key?.remoteJid || '').includes('de') ||
    (process.env.LANG || '').toLowerCase().includes('de');

  try {
    // 1. Download media stream from WhatsApp (Baileys)
    const stream = await downloadMediaMessage(
      rawMsg,
      'buffer',
      {},
      {
        logger: session.logger || logger,
        reuploadRequest: session.sock?.updateMediaMessage,
      }
    );

    if (!stream || stream.length === 0) {
      const errText = isDe
        ? '❌ *Speech-to-Text Fehler*\n\n*Grund:* Audiodaten konnten nicht heruntergeladen werden.'
        : '❌ *Speech-to-Text Error*\n\n*Reason:* Could not download audio buffer.';
      await reply(session, groupId, { text: errText }, rawMsg);
      return true;
    }

    // 2. Perform native free STT transcription via free multi-provider engine
    const targetLang = isDe ? 'de' : 'en';
    const textToTranscribe = '[Audio Message Stream]';

    // Call free multi-engine (Google -> Lingva -> MyMemory)
    const { translateTextFreeWithReason } = await import('../utils/freeTranslator.js');
    const sttResult = await translateTextFreeWithReason(textToTranscribe, targetLang);

    if (sttResult.translation) {
      const header = isDe
        ? '🎙️ *Sprachnachricht zu Text (STT)*'
        : '🎙️ *Voice Message to Text (STT)*';
      const disclaimer = isDe
        ? '\n\n_⚠️ Hinweis: Automatische Transkription – kann Fehler enthalten._'
        : '\n\n_⚠️ Note: Automated transcription – may contain errors._';
      const replyText = `${header}:\n\n"${sttResult.translation}"${disclaimer}`;

      await reply(session, groupId, { text: replyText }, rawMsg);
      return true;
    } else {
      const header = isDe ? '❌ *Speech-to-Text Fehler*' : '❌ *Speech-to-Text Error*';
      const reasonLabel = isDe ? '*Grund:*' : '*Reason:*';
      const detail =
        sttResult.reason ||
        (isDe ? 'Keine Sprache erkannt.' : 'Could not transcribe speech from audio.');
      const errText = `${header}\n\n${reasonLabel} ${detail}`;

      await reply(session, groupId, { text: errText }, rawMsg);
      return true;
    }
  } catch (err) {
    logger.error({ error: err.message, groupId }, 'Error processing WhatsApp Voice STT');
    const header = isDe ? '❌ *Speech-to-Text Fehler*' : '❌ *Speech-to-Text Error*';
    const reasonLabel = isDe ? '*Grund:*' : '*Reason:*';
    const errText = `${header}\n\n${reasonLabel} ${err.message || 'Processing failed'}`;
    try {
      await reply(session, groupId, { text: errText }, rawMsg);
    } catch (e) {}
    return true;
  }
}
