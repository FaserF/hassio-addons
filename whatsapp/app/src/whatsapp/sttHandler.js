import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { logger } from '../logger.js';
import { getGroupModerationConfig } from '../whatsapp/moderation/store.js';
import { reply } from '../whatsapp/actions.js';

// STT Diagnostics & Error Tracking
const recentSttErrors = [];
let lastSttEvent = null;

function recordSttError(engine, errorMsg, groupId = null) {
  const errEntry = {
    timestamp: Date.now(),
    engine: engine || 'unknown',
    error: String(errorMsg),
    group_id: groupId,
  };
  recentSttErrors.unshift(errEntry);
  if (recentSttErrors.length > 20) {
    recentSttErrors.pop();
  }
}

/**
 * Returns real-time diagnostics on STT engine status, active provider, reasons, and errors.
 */
export function getSTTDiagnostics(groupConfig = {}, store = {}) {
  const isEnabled = Boolean(groupConfig?.stt_enabled);
  const sttEngine = groupConfig?.stt_engine || 'auto';
  const hasGeminiKey = Boolean(
    store?.gemini_api_key || groupConfig?.ai?.api_key || process.env.GEMINI_API_KEY
  );
  const hasOpenAIKey = Boolean(groupConfig?.ai?.openai_api_key || process.env.OPENAI_API_KEY);
  const hasAnyKey = hasGeminiKey || hasOpenAIKey;

  let activeEngine;
  let activeEngineName;
  let selectionReason;
  let status = isEnabled ? 'healthy' : 'disabled';

  if (!isEnabled) {
    activeEngine = 'disabled';
    activeEngineName = 'Disabled';
    selectionReason =
      'STT is toggled off in group settings. Incoming voice notes are not transcribed.';
    status = 'disabled';
  } else if (!hasAnyKey) {
    activeEngine = 'none';
    activeEngineName = 'No API Key Configured';
    selectionReason =
      'STT is enabled, but no Gemini or OpenAI API Key was found in settings or environment. Transcription will fail until a key is added.';
    status = 'no_key';
  } else {
    if (sttEngine === 'gemini') {
      activeEngine = 'gemini';
      activeEngineName = 'Gemini 1.5 Multimodal Audio';
      selectionReason = hasGeminiKey
        ? 'Manual Selection: Using Google Gemini 1.5 Multimodal Audio with configured API key.'
        : 'Gemini Engine Selected: Warning — Gemini API key is missing in settings.';
      if (!hasGeminiKey) status = 'no_key';
    } else if (sttEngine === 'openai') {
      activeEngine = 'openai';
      activeEngineName = 'OpenAI Whisper API';
      selectionReason = hasOpenAIKey
        ? 'Manual Selection: Using OpenAI Whisper API with configured API key.'
        : 'OpenAI Whisper Selected: Warning — OpenAI API key is missing in settings.';
      if (!hasOpenAIKey) status = 'no_key';
    } else {
      // auto
      if (hasGeminiKey) {
        activeEngine = 'gemini';
        activeEngineName = '⚡ Auto: Gemini 1.5 Flash';
        selectionReason =
          'Auto STT: Gemini 1.5 Multimodal Audio selected (Gemini API key is active).';
      } else if (hasOpenAIKey) {
        activeEngine = 'openai';
        activeEngineName = '⚡ Auto: OpenAI Whisper';
        selectionReason = 'Auto STT: OpenAI Whisper selected (OpenAI API key is active).';
      } else {
        activeEngine = 'none';
        activeEngineName = 'Auto STT (No Key)';
        selectionReason =
          'Auto STT requires either a Gemini or OpenAI API key to process voice messages.';
        status = 'no_key';
      }
    }
  }

  return {
    is_enabled: isEnabled,
    configured_engine: sttEngine,
    active_engine: activeEngine,
    active_engine_name: activeEngineName,
    selection_reason: selectionReason,
    status,
    has_api_key: hasAnyKey,
    health: {
      gemini: {
        name: 'Gemini 1.5 Multimodal Audio',
        status: hasGeminiKey ? 'ready' : 'no_key',
      },
      openai: {
        name: 'OpenAI Whisper API',
        status: hasOpenAIKey ? 'ready' : 'no_key',
      },
    },
    last_event: lastSttEvent,
    recent_errors: recentSttErrors.slice(0, 10),
  };
}

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

  // Check configuration toggle (stt_enabled, default false) for all chats (groups & private chats alike)
  const config = groupId ? getGroupModerationConfig(groupId) : null;
  if (!config || !config.stt_enabled) {
    return false;
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
      recordSttError(
        'whatsapp_media',
        'Failed to download voice note audio stream from WhatsApp servers',
        groupId
      );
      lastSttEvent = {
        timestamp: Date.now(),
        engine: 'whatsapp_media',
        engineName: 'WhatsApp Media Downloader',
        status: 'failed',
        error: 'Media download failed (empty stream)',
        group_id: groupId,
      };
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
    let usedEngine = 'unknown';

    if (!apiKey) {
      if (sttEngine === 'auto') {
        failureReason =
          'No API key configured. Please configure a Gemini API key in settings to enable Speech-to-Text.';
      } else {
        failureReason = `No API key configured for STT engine "${sttEngine}". Please configure an API key in settings.`;
      }
      recordSttError(sttEngine, failureReason, groupId);
    } else {
      // 1. Try Gemini 1.5 Multimodal Audio API
      if (
        sttEngine === 'gemini' ||
        (sttEngine === 'auto' &&
          (store.gemini_api_key || config.ai?.api_key || process.env.GEMINI_API_KEY))
      ) {
        usedEngine = 'gemini';
        try {
          const gKey =
            store.gemini_api_key || config.ai?.api_key || process.env.GEMINI_API_KEY || apiKey;
          const base64Audio = stream.toString('base64');
          const promptText = gt('bot_replies.stt_prompt_text');
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
              const errMsg = gt('bot_replies.stt_err_gemini_empty');
              errorsCaptured.push(errMsg);
              recordSttError('gemini', errMsg, groupId);
            }
          } else if (res.status === 429) {
            const errMsg = gt('bot_replies.stt_err_gemini_rate_limit');
            errorsCaptured.push(errMsg);
            recordSttError('gemini', 'Rate limit exceeded (HTTP 429)', groupId);
          } else if (res.status === 401 || res.status === 403) {
            const errMsg = gt('bot_replies.stt_err_gemini_auth');
            errorsCaptured.push(errMsg);
            recordSttError('gemini', `Authentication error (HTTP ${res.status})`, groupId);
          } else {
            const errMsg = gt('bot_replies.stt_err_gemini_http_error', { status: res.status });
            errorsCaptured.push(errMsg);
            recordSttError('gemini', `HTTP error ${res.status}`, groupId);
          }
        } catch (e) {
          logger.debug({ error: e.message }, 'Gemini STT failed');
          const errMsg = gt('bot_replies.stt_err_gemini_network', { error: e.message });
          errorsCaptured.push(errMsg);
          recordSttError('gemini', `Network error: ${e.message}`, groupId);
        }
      }

      // 2. Try OpenAI Whisper API
      if (
        !transcribedText &&
        (sttEngine === 'openai' ||
          (sttEngine === 'auto' && (config.ai?.openai_api_key || process.env.OPENAI_API_KEY)) ||
          process.env.OPENAI_API_KEY)
      ) {
        usedEngine = 'openai';
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
              const errMsg = gt('bot_replies.stt_err_whisper_empty');
              errorsCaptured.push(errMsg);
              recordSttError('openai', errMsg, groupId);
            }
          } else if (res.status === 429) {
            const errMsg = gt('bot_replies.stt_err_whisper_rate_limit');
            errorsCaptured.push(errMsg);
            recordSttError('openai', 'Rate limit exceeded (HTTP 429)', groupId);
          } else if (res.status === 401) {
            const errMsg = gt('bot_replies.stt_err_whisper_auth');
            errorsCaptured.push(errMsg);
            recordSttError('openai', 'Invalid API key (HTTP 401)', groupId);
          } else {
            const errMsg = gt('bot_replies.stt_err_whisper_http_error', { status: res.status });
            errorsCaptured.push(errMsg);
            recordSttError('openai', `HTTP error ${res.status}`, groupId);
          }
        } catch (e) {
          logger.debug({ error: e.message }, 'Whisper STT failed');
          const errMsg = gt('bot_replies.stt_err_whisper_network', { error: e.message });
          errorsCaptured.push(errMsg);
          recordSttError('openai', `Network error: ${e.message}`, groupId);
        }
      }
    }

    if (!transcribedText && !failureReason) {
      failureReason =
        errorsCaptured.length > 0
          ? errorsCaptured.join('\n• ')
          : gt('bot_replies.stt_transcription_failed');
    }

    if (transcribedText) {
      lastSttEvent = {
        timestamp: Date.now(),
        engine: usedEngine,
        engineName: usedEngine === 'gemini' ? 'Gemini 1.5 Flash' : 'OpenAI Whisper',
        status: 'success',
        transcribed_snippet: transcribedText.slice(0, 60),
        group_id: groupId,
      };

      const header = gt('bot_replies.stt_header');
      const disclaimer = gt('bot_replies.stt_disclaimer');
      const replyText = `${header}:\n\n"${transcribedText}"${disclaimer}`;

      await reply(session, groupId, { text: replyText }, rawMsg);
      return true;
    } else {
      lastSttEvent = {
        timestamp: Date.now(),
        engine: usedEngine,
        engineName: usedEngine === 'gemini' ? 'Gemini 1.5 Flash' : 'OpenAI Whisper',
        status: 'failed',
        error: failureReason,
        group_id: groupId,
      };

      const header = gt('bot_replies.stt_error_header');
      const detailsHeader = gt('bot_replies.stt_error_details_header');
      const detail = failureReason || gt('bot_replies.stt_no_speech_recognized');
      const errText = `${header}\n\n${detailsHeader}\n• ${detail}`;

      await reply(session, groupId, { text: errText }, rawMsg);
      return true;
    }
  } catch (err) {
    logger.error({ error: err.message, groupId }, 'Error processing WhatsApp Voice STT');
    recordSttError('unhandled_exception', err.message, groupId);
    lastSttEvent = {
      timestamp: Date.now(),
      engine: 'exception',
      engineName: 'STT Handler Exception',
      status: 'failed',
      error: err.message,
      group_id: groupId,
    };
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
