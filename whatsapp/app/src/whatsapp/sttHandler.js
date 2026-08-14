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
    const errorsCaptured = [];

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
          else errorsCaptured.push(groupLang === 'de' ? 'Kostenlose Web-Erkennung: Keine deutliche Sprache im Audiosignal erkannt.' : 'Free Web Engine: No clear speech recognized in audio signal.');
        } else if (res.status === 429) {
          errorsCaptured.push(groupLang === 'de' ? 'Kostenlose Web-Erkennung: Rate-Limit erreicht (HTTP 429).' : 'Free Web Engine: Rate limit exceeded (HTTP 429).');
        } else {
          errorsCaptured.push(groupLang === 'de' ? `Kostenlose Web-Erkennung antwortete mit HTTP ${res.status}` : `Free Web Engine responded with HTTP ${res.status}`);
        }
      } catch (e) {
        logger.debug({ error: e.message }, 'Free Web STT API call failed');
        errorsCaptured.push(groupLang === 'de' ? `Kostenlose Web-Erkennung Netzwerkfehler: ${e.message}` : `Free Web Engine network error: ${e.message}`);
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
            if (!transcribedText) {
              errorsCaptured.push(groupLang === 'de' ? 'Gemini AI: Antwort enthielt keinen transkribierten Text.' : 'Gemini AI: Response contained no transcribed text.');
            }
          } else if (res.status === 429) {
            errorsCaptured.push(groupLang === 'de' ? 'Gemini AI API: Rate-Limit / Quota überschritten (HTTP 429).' : 'Gemini AI API: Rate limit / quota exceeded (HTTP 429).');
          } else if (res.status === 401 || res.status === 403) {
            errorsCaptured.push(groupLang === 'de' ? 'Gemini AI API: Ungültiger oder abgelaufener API-Schlüssel (HTTP 401/403).' : 'Gemini AI API: Invalid or expired API key (HTTP 401/403).');
          } else {
            errorsCaptured.push(groupLang === 'de' ? `Gemini AI API Fehler (HTTP ${res.status}).` : `Gemini AI API error (HTTP ${res.status}).`);
          }
        } catch (e) {
          logger.debug({ error: e.message }, 'Gemini STT failed');
          errorsCaptured.push(groupLang === 'de' ? `Gemini AI Verbindungsfehler: ${e.message}` : `Gemini AI connection error: ${e.message}`);
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
            if (!transcribedText) {
              errorsCaptured.push(groupLang === 'de' ? 'OpenAI Whisper: Keinen Text transkribiert.' : 'OpenAI Whisper: Transcribed no text.');
            }
          } else if (res.status === 429) {
            errorsCaptured.push(groupLang === 'de' ? 'OpenAI Whisper API: Rate-Limit / Quota überschritten (HTTP 429).' : 'OpenAI Whisper API: Rate limit / quota exceeded (HTTP 429).');
          } else if (res.status === 401) {
            errorsCaptured.push(groupLang === 'de' ? 'OpenAI Whisper API: Ungültiger API-Schlüssel (HTTP 401).' : 'OpenAI Whisper API: Invalid API key (HTTP 401).');
          } else {
            errorsCaptured.push(groupLang === 'de' ? `OpenAI Whisper API Fehler (HTTP ${res.status}).` : `OpenAI Whisper API error (HTTP ${res.status}).`);
          }
        } catch (e) {
          logger.debug({ error: e.message }, 'Whisper STT failed');
          errorsCaptured.push(groupLang === 'de' ? `OpenAI Whisper Verbindungsfehler: ${e.message}` : `OpenAI Whisper connection error: ${e.message}`);
        }
      }
    }

    if (!transcribedText) {
      failureReason = errorsCaptured.length > 0
        ? errorsCaptured.join('\n• ')
        : gt('bot_replies.stt_transcription_failed');
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
      const errText = `${header}\n\n*Details / Ursache:*\n• ${detail}`;

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
