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

    // 2. Perform STT transcription using Gemini Multimodal Audio API or OpenAI Whisper API
    const config = getGroupModerationConfig(groupId) || {};
    const store = (await import('./moderation/store.js')).loadModerationStore();
    const apiKey = store.gemini_api_key || config.ai?.api_key || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    let transcribedText = null;
    let failureReason = null;

    if (apiKey) {
      try {
        const isGemini = apiKey.startsWith('AIza') || store.gemini_api_key || process.env.GEMINI_API_KEY;
        if (isGemini) {
          // Gemini 1.5 Flash Audio Inline Transcribe
          const base64Audio = stream.toString('base64');
          const mimeType = audioMsg.mimetype || 'audio/ogg; codecs=opus';
          const prompt = isDe
            ? 'Transkribiere diese Audionachricht/Sprachnachricht exakt ins Deutsche. Gib NUR den transkribierten Text zurück, ohne Kommentare.'
            : 'Transcribe this audio message accurately. Return ONLY the transcribed text without commentary.';

          const model = config.ai?.model || 'gemini-1.5-flash';
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { inline_data: { mime_type: mimeType.split(';')[0], data: base64Audio } },
                      { text: prompt },
                    ],
                  },
                ],
              }),
            }
          );
          if (res.ok) {
            const data = await res.json();
            transcribedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          } else {
            failureReason = `Gemini Audio API status ${res.status}`;
          }
        } else {
          // OpenAI Whisper STT API
          const FormData = (await import('form-data')).default;
          const formData = new FormData();
          formData.append('file', stream, { filename: 'voice.ogg', contentType: audioMsg.mimetype || 'audio/ogg' });
          formData.append('model', 'whisper-1');
          if (isDe) formData.append('language', 'de');

          const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              ...formData.getHeaders(),
            },
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            transcribedText = data.text?.trim();
          } else {
            failureReason = `OpenAI Whisper API status ${res.status}`;
          }
        }
      } catch (err) {
        failureReason = err.message;
      }
    } else {
      failureReason = isDe
        ? 'Kein Gemini/OpenAI API key konfiguriert. Bitte trage einen API-Schlüssel in den Moderations-Einstellungen ein.'
        : 'No Gemini or OpenAI API key configured for Speech-to-Text transcription. Please set an API key in Moderation settings.';
    }

    if (transcribedText) {
      const header = isDe
        ? '🎙️ *Sprachnachricht zu Text (STT)*'
        : '🎙️ *Voice Message to Text (STT)*';
      const disclaimer = isDe
        ? '\n\n_⚠️ Hinweis: Automatische Transkription – kann Fehler enthalten._'
        : '\n\n_⚠️ Note: Automated transcription – may contain errors._';
      const replyText = `${header}:\n\n"${transcribedText}"${disclaimer}`;

      await reply(session, groupId, { text: replyText }, rawMsg);
      return true;
    } else {
      const header = isDe ? '❌ *Speech-to-Text Fehler*' : '❌ *Speech-to-Text Error*';
      const reasonLabel = isDe ? '*Grund:*' : '*Reason:*';
      const detail = failureReason || (isDe ? 'Keine Sprache erkannt.' : 'Could not transcribe speech from audio.');
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
