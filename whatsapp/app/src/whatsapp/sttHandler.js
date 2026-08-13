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

  // Skip outgoing/bridged audio messages sent by the bot/gateway
  if (rawMsg.key?.fromMe) {
    return false;
  }

  // Check group configuration toggle (stt_enabled, default false)
  if (groupId && groupId.endsWith('@g.us')) {
    const config = getGroupModerationConfig(groupId);
    if (!config || !config.stt_enabled) {
      return false;
    }
  }

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

    const store = (await import('./moderation/store.js')).loadModerationStore();
    const config = getGroupModerationConfig(groupId) || {};
    const { t: translate } = await import('../locales/loader.js');
    const groupLang = config.language || 'en';
    const gt = (key, params = {}) => translate(groupLang, key, params);

    if (!stream || stream.length === 0) {
      const errText = `${gt('bot_replies.stt_error_header')}\n\n*Reason:* ${gt('bot_replies.stt_download_failed')}`;
      await reply(session, groupId, { text: errText }, rawMsg);
      return true;
    }

    // 2. Perform STT transcription using Gemini Multimodal Audio API or OpenAI Whisper API
    const apiKey =
      store.gemini_api_key ||
      config.ai?.api_key ||
      process.env.GEMINI_API_KEY ||
      process.env.OPENAI_API_KEY;

    let transcribedText = null;
    let failureReason = null;
    const sttEngine = config.stt_engine || 'auto';

    if (sttEngine === 'auto' || !apiKey) {
      // 1. Try Free Web Speech Recognition Endpoint
      try {
        const targetLang = groupLang === 'de' ? 'de-DE' : 'en-US';
        const url = `https://www.google.com/speech-api/v1/recognize?xjerr=1&client=chromium&lang=${targetLang}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'audio/ogg; codecs=opus' },
          body: stream,
        });
        if (res.ok) {
          const data = await res.json();
          const hyp = data.hypotheses?.[0]?.utterance;
          if (hyp) transcribedText = hyp;
        }
      } catch (e) {
        logger.debug({ error: e.message }, 'Free Web STT API call failed');
      }
    }

    if (!transcribedText && apiKey) {
      // 2. Try Gemini 1.5 Multimodal Audio API
      if (
        sttEngine === 'gemini' ||
        (sttEngine === 'auto' && (store.gemini_api_key || process.env.GEMINI_API_KEY))
      ) {
        try {
          const gKey = store.gemini_api_key || process.env.GEMINI_API_KEY || apiKey;
          const base64Audio = stream.toString('base64');
          const promptText =
            groupLang === 'de'
              ? 'Transkribiere dieses Audiosignal exakt in Text. Gib NUR den transkribierten Text ohne Erklärung zurück.'
              : 'Transcribe this audio message exactly into text. Return ONLY the transcribed text without commentary.';
          const geminiModel = config.ai?.model || 'gemini-1.5-flash';
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${gKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { inline_data: { mime_type: 'audio/ogg', data: base64Audio } },
                      { text: promptText },
                    ],
                  },
                ],
              }),
            }
          );
          if (res.ok) {
            const data = await res.json();
            transcribedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          }
        } catch (e) {
          logger.debug({ error: e.message }, 'Gemini STT failed');
        }
      }

      // 3. Try OpenAI Whisper API
      if (!transcribedText && (sttEngine === 'openai' || process.env.OPENAI_API_KEY)) {
        try {
          const oaKey = config.ai?.openai_api_key || process.env.OPENAI_API_KEY || apiKey;
          const formData = new Blob([stream], { type: 'audio/ogg' });
          const body = new FormData();
          body.append('file', formData, 'audio.ogg');
          body.append('model', 'whisper-1');
          if (groupLang === 'de') body.append('language', 'de');

          const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${oaKey}` },
            body,
          });
          if (res.ok) {
            const data = await res.json();
            transcribedText = data.text?.trim();
          }
        } catch (e) {
          logger.debug({ error: e.message }, 'Whisper STT failed');
        }
      }
    }

    if (!transcribedText) {
      failureReason = gt('bot_replies.stt_transcription_failed');
    }

    if (transcribedText) {
      const header = gt('bot_replies.stt_header');
      const disclaimer = gt('bot_replies.stt_disclaimer');
      const replyText = `${header}:\n\n"${transcribedText}"${disclaimer}`;

      await reply(session, groupId, { text: replyText }, rawMsg);
      return true;
    } else {
      const header = gt('bot_replies.stt_error_header');
      const detail = failureReason || gt('bot_replies.stt_no_speech_recognized');
      const errText = `${header}\n\n*Reason:* ${detail}`;

      await reply(session, groupId, { text: errText }, rawMsg);
      return true;
    }
  } catch (err) {
    logger.error({ error: err.message, groupId }, 'Error processing WhatsApp Voice STT');
    const { t: translate } = await import('../locales/loader.js');
    const config = getGroupModerationConfig(groupId) || {};
    const groupLang = config.language || 'en';
    const header = translate(groupLang, 'bot_replies.stt_error_header');
    const errText = `${header}\n\n*Reason:* ${err.message || 'Processing failed'}`;
    try {
      await reply(session, groupId, { text: errText }, rawMsg);
    } catch (e) {}
    return true;
  }
}
