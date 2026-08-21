import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { logger } from '../logger.js';
import { getGroupModerationConfig } from '../whatsapp/moderation/store.js';
import { reply } from '../whatsapp/actions.js';
import { resolveEffectiveGeminiKey, resolveEffectiveOpenAIKey } from '../ha.js';

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
  const effectiveGemini = resolveEffectiveGeminiKey(
    store?.gemini_api_key || groupConfig?.ai?.api_key
  );
  const effectiveOpenAI = resolveEffectiveOpenAIKey(groupConfig?.ai?.openai_api_key);
  const hasGeminiKey = Boolean(effectiveGemini?.key);
  const hasOpenAIKey = Boolean(effectiveOpenAI?.key);
  const hasAegisBotUrl = Boolean(
    groupConfig?.stt_aegisbot_url || store?.aegisbot_url || process.env.AEGISBOT_URL
  );
  const hasAegisBotKey = Boolean(
    groupConfig?.stt_aegisbot_key || store?.aegisbot_api_key || process.env.AEGISBOT_API_KEY
  );
  const hasAnyKey = hasGeminiKey || hasOpenAIKey || hasAegisBotUrl;

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
    activeEngineName = 'No Engine Configured';
    selectionReason =
      'STT is enabled, but no Gemini/OpenAI API key or AegisBot Server URL was found (and no Google Generative AI integration in Home Assistant). Transcription will fail until configured.';
    status = 'no_key';
  } else {
    if (sttEngine === 'aegisbot') {
      activeEngine = 'aegisbot';
      activeEngineName = '🛡️ AegisBot Server (Local Whisper)';
      selectionReason = hasAegisBotUrl
        ? 'Manual Selection: Using self-hosted AegisBot Server for local Speech-to-Text.'
        : 'AegisBot Engine Selected: Warning — AegisBot Base URL is missing in settings.';
      if (!hasAegisBotUrl) status = 'no_key';
    } else if (sttEngine === 'gemini') {
      activeEngine = 'gemini';
      activeEngineName = 'Gemini 1.5 Multimodal Audio';
      selectionReason = hasGeminiKey
        ? `Manual Selection: Using Google Gemini 1.5 Multimodal Audio (${effectiveGemini?.sourceLabel || 'Configured API key'}).`
        : 'Gemini Engine Selected: Warning — Gemini API key is missing in settings and Home Assistant.';
      if (!hasGeminiKey) status = 'no_key';
    } else if (sttEngine === 'openai') {
      activeEngine = 'openai';
      activeEngineName = 'OpenAI Whisper API';
      selectionReason = hasOpenAIKey
        ? `Manual Selection: Using OpenAI Whisper API (${effectiveOpenAI?.sourceLabel || 'Configured API key'}).`
        : 'OpenAI Whisper Selected: Warning — OpenAI API key is missing in settings and Home Assistant.';
      if (!hasOpenAIKey) status = 'no_key';
    } else {
      // auto
      if (hasAegisBotUrl) {
        activeEngine = 'aegisbot';
        activeEngineName = '⚡ Auto: AegisBot Server';
        selectionReason =
          'Auto STT: AegisBot Server selected (Local Whisper active, zero cloud cost).';
      } else if (hasGeminiKey) {
        activeEngine = 'gemini';
        activeEngineName = '⚡ Auto: Gemini 1.5 Flash';
        selectionReason = `Auto STT: Gemini 1.5 Multimodal Audio selected (${effectiveGemini?.sourceLabel || 'Gemini API key active'}).`;
      } else if (hasOpenAIKey) {
        activeEngine = 'openai';
        activeEngineName = '⚡ Auto: OpenAI Whisper';
        selectionReason = `Auto STT: OpenAI Whisper selected (${effectiveOpenAI?.sourceLabel || 'OpenAI API key active'}).`;
      } else {
        activeEngine = 'none';
        activeEngineName = 'Auto STT (No Provider)';
        selectionReason =
          'Auto STT requires either AegisBot Server URL, Gemini, or OpenAI API key to process voice messages.';
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
      aegisbot: {
        name: 'AegisBot Server',
        status: hasAegisBotUrl ? (hasAegisBotKey ? 'ready' : 'ready_no_key') : 'not_configured',
      },
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

  // Verification guard: unverified users in groups with Captcha enabled cannot trigger Speech-to-Text
  const isGroup = groupId && groupId.endsWith('@g.us');
  if (isGroup && config.greetings?.captcha_enabled) {
    const rawParticipant = rawMsg.key?.participant || rawMsg.participant;
    const rawUserId = rawParticipant ? rawParticipant.split('@')[0].replace(/\D/g, '') : '';
    const { isUserVerified } = await import('./moderation/engine/captcha.js');
    const { isAdmin } = await import('../utils/security.js');
    const userIsAdmin = isAdmin(rawParticipant, session) || rawMsg.key?.fromMe;
    if (!userIsAdmin && (!rawUserId || !isUserVerified(groupId, rawUserId, session, rawMsg))) {
      logger.debug({ groupId, rawUserId }, 'STT skipped: sender is not verified by captcha');
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

    // 2. Perform STT transcription using AegisBot Server, Gemini Multimodal Audio API, or OpenAI Whisper API
    const effectiveGemini = resolveEffectiveGeminiKey(store.gemini_api_key || config.ai?.api_key);
    const effectiveOpenAI = resolveEffectiveOpenAIKey(config.ai?.openai_api_key);
    const geminiKey = effectiveGemini?.key || null;
    const openAiKey = effectiveOpenAI?.key || null;
    const aegisbotUrl = config.stt_aegisbot_url || store.aegisbot_url || process.env.AEGISBOT_URL;
    const aegisbotKey =
      config.stt_aegisbot_key || store.aegisbot_api_key || process.env.AEGISBOT_API_KEY || '';

    let transcribedText = null;
    let detectedLang = null;
    let usedSubEngine = null;
    let failureReason = null;
    const sttEngine = config.stt_engine || 'auto';
    const errorsCaptured = [];
    let usedEngine = 'unknown';

    const hasAnyConfig = geminiKey || openAiKey || aegisbotUrl;

    if (!hasAnyConfig) {
      if (sttEngine === 'auto') {
        failureReason =
          'No STT engine configured. Please configure an AegisBot Server URL, or configure a Gemini/OpenAI API key (or enable the Google Generative AI integration in Home Assistant).';
      } else {
        failureReason = `Configuration missing for STT engine "${sttEngine}". Please configure in settings or Home Assistant.`;
      }
      recordSttError(sttEngine, failureReason, groupId);
    } else {
      // 1. Try AegisBot Server (Local Self-Hosted Faster-Whisper)
      if (sttEngine === 'aegisbot' || (sttEngine === 'auto' && aegisbotUrl)) {
        usedEngine = 'aegisbot';
        try {
          let targetBaseUrl = String(aegisbotUrl || 'http://localhost:8000').trim();
          while (targetBaseUrl.endsWith('/')) {
            targetBaseUrl = targetBaseUrl.slice(0, -1);
          }
          const endpoint = `${targetBaseUrl}/api/v1/ai/transcribe`;

          const formData = new Blob([stream], { type: 'audio/ogg' });
          const body = new FormData();
          body.append('file', formData, 'voice.ogg');
          if (groupLang && groupLang !== 'auto') {
            body.append('language', groupLang);
          }

          const headers = {};
          if (aegisbotKey) {
            headers['Authorization'] = `Bearer ${aegisbotKey}`;
            headers['X-API-Key'] = aegisbotKey;
          }

          // Allow up to 10 minutes (600s) timeout for long audio messages (>10 min)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 600000);

          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            if (data.success && data.text) {
              transcribedText = data.text.trim();
              if (data.language) detectedLang = data.language;
              if (data.engine) usedSubEngine = data.engine;
            } else if (data.text) {
              transcribedText = data.text.trim();
              if (data.language) detectedLang = data.language;
              if (data.engine) usedSubEngine = data.engine;
            } else {
              // Build rich diagnostic message from structured AegisBot error response
              let errMsg = data.error || gt('bot_replies.stt_err_aegisbot_empty');
              if (data.details && typeof data.details === 'object') {
                const engineLines = Object.entries(data.details)
                  .map(([eng, reason]) => `  • ${eng}: ${reason}`)
                  .join('\n');
                errMsg = `${errMsg}\n\n*Engine diagnostics:*\n${engineLines}`;
              }
              if (data.recommendation) {
                errMsg += `\n\n*Recommendation:* ${data.recommendation}`;
              }
              if (data.status) {
                errMsg = `[${data.status}] ${errMsg}`;
              }
              errorsCaptured.push(errMsg);
              recordSttError('aegisbot', data.error || 'transcription_failed', groupId);
            }
          } else if (res.status === 401 || res.status === 403) {
            const errMsg = gt('bot_replies.stt_err_aegisbot_auth');
            errorsCaptured.push(errMsg);
            recordSttError('aegisbot', `Authentication error (HTTP ${res.status})`, groupId);
          } else {
            const errMsg = gt('bot_replies.stt_err_aegisbot_http_error', { status: res.status });
            errorsCaptured.push(errMsg);
            recordSttError('aegisbot', `HTTP error ${res.status}`, groupId);
          }
        } catch (e) {
          logger.debug({ error: e.message }, 'AegisBot STT failed');
          const errMsg = gt('bot_replies.stt_err_aegisbot_network', { error: e.message });
          errorsCaptured.push(errMsg);
          recordSttError('aegisbot', `Network error: ${e.message}`, groupId);
        }
      }

      // 2. Try Gemini 1.5 Multimodal Audio API
      if (!transcribedText && (sttEngine === 'gemini' || (sttEngine === 'auto' && geminiKey))) {
        usedEngine = 'gemini';
        try {
          const gKey = geminiKey;
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
            if (transcribedText) {
              usedSubEngine = geminiModel;
              if (groupLang && groupLang !== 'auto') detectedLang = groupLang;
            } else {
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

      // 3. Try OpenAI Whisper API
      if (!transcribedText && (sttEngine === 'openai' || (sttEngine === 'auto' && openAiKey))) {
        usedEngine = 'openai';
        try {
          const oaKey = openAiKey;
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
            if (transcribedText) {
              usedSubEngine = 'whisper-1';
              if (data.language) detectedLang = data.language;
            } else {
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

    function getEngineDisplayName(eng, subEng) {
      if (eng === 'aegisbot') {
        if (subEng === 'faster-whisper') return 'AegisBot Whisper';
        if (subEng === 'speech-recognition-google') return 'AegisBot Google STT';
        if (subEng === 'openai-whisper') return 'AegisBot Whisper';
        if (subEng === 'gemini-audio') return 'AegisBot Gemini';
        return 'AegisBot Server';
      }
      if (eng === 'gemini') return 'Gemini 1.5 Flash';
      if (eng === 'openai') return 'OpenAI Whisper';
      return eng || 'STT Engine';
    }

    if (transcribedText) {
      const resolvedEngineName = getEngineDisplayName(usedEngine, usedSubEngine);
      lastSttEvent = {
        timestamp: Date.now(),
        engine: usedEngine,
        engineName: resolvedEngineName,
        status: 'success',
        transcribed_snippet: transcribedText.slice(0, 60),
        group_id: groupId,
      };

      const langStr =
        detectedLang && detectedLang !== 'auto' && detectedLang !== '?'
          ? detectedLang.toUpperCase()
          : '';
      const header = gt('bot_replies.stt_header', {
        lang: langStr,
        engine: resolvedEngineName,
      }).replace(/\s+/g, ' ');
      const disclaimer = gt('bot_replies.stt_disclaimer');
      const replyText = `${header}\n${disclaimer}\n\n"${transcribedText}"`;

      await reply(session, groupId, { text: replyText }, rawMsg);
      return true;
    } else {
      lastSttEvent = {
        timestamp: Date.now(),
        engine: usedEngine,
        engineName: getEngineDisplayName(usedEngine, usedSubEngine),
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
