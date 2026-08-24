import { logger } from '../logger.js';
import { loadModerationStore } from '../whatsapp/moderation/store.js';

const cache = new Map();
const cooldowns = new Map();

// Diagnostics & Error Tracking
const recentErrors = [];
let lastTranslationEvent = null;

function recordError(provider, errorMsg, targetLang = null) {
  const errEntry = {
    timestamp: Date.now(),
    provider: provider || 'unknown',
    error: String(errorMsg),
    target_lang: targetLang,
  };
  recentErrors.unshift(errEntry);
  if (recentErrors.length > 20) {
    recentErrors.pop();
  }
}

/**
 * WhatsApp Gateway Multi-Provider Translation Helper (Node.js)
 * Failover chain: Google Translate -> Lingva -> MyMemory -> Gemini / OpenAI AI
 * Features: Rate-limit (429) cooldowns (5 min), 5s AbortSignal timeout, 1000 char truncation, in-memory caching.
 */
export async function translateTextGatewayWithReason(
  text,
  targetLang = 'en',
  preferredProvider = 'auto',
  groupConfig = null
) {
  if (!text || !text.trim()) {
    return { translation: null, reason: 'Empty or blank text provided for translation.' };
  }

  const cleanText = text.trim().slice(0, 1000);
  const cacheKey = `${preferredProvider}:${targetLang}:${cleanText}`;

  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    const cachedTrans = typeof cached === 'object' ? cached.translation : cached;
    const cachedSrc = typeof cached === 'object' ? cached.sourceLang : null;
    const cachedProv =
      typeof cached === 'object'
        ? cached.provider
        : preferredProvider === 'auto'
          ? 'cache'
          : preferredProvider;
    const cachedProvName = typeof cached === 'object' ? cached.providerName : 'Cache';
    lastTranslationEvent = {
      timestamp: Date.now(),
      provider: cachedProv,
      providerName: cachedProvName,
      status: 'success',
      sourceLang: cachedSrc,
      targetLang,
      reason: 'Served from in-memory cache',
    };
    return {
      translation: cachedTrans,
      sourceLang: cachedSrc,
      detectedSource: cachedSrc,
      provider: cachedProv,
      providerName: cachedProvName,
      reason: null,
    };
  }

  const now = Date.now();
  const saveCache = (res, detected, provider = 'unknown', providerName = 'Unknown') => {
    if (cache.size > 500) cache.clear();
    cache.set(cacheKey, { translation: res, sourceLang: detected, provider, providerName });
  };

  const store = loadModerationStore ? loadModerationStore() : {};
  const hasAiKey = Boolean(
    store?.gemini_api_key || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
  );
  const hasAegisBot = Boolean(
    store?.aegisbot_url || process.env.AEGISBOT_URL || groupConfig?.stt_aegisbot_url
  );

  const customPriority =
    groupConfig?.translation?.engine_priority || store?.translation_engine_priority;

  const providersToTry = [];
  if (Array.isArray(customPriority) && customPriority.length > 0) {
    for (const p of customPriority) {
      if (p && !providersToTry.includes(p)) {
        providersToTry.push(p);
      }
    }
  } else if (preferredProvider && preferredProvider !== 'auto' && preferredProvider !== 'custom') {
    providersToTry.push(preferredProvider);
  } else {
    // Default smart failover chain: AegisBot (if configured) -> Google -> Lingva -> MyMemory -> AI
    if (hasAegisBot) {
      providersToTry.push('aegisbot');
    }
    providersToTry.push('google', 'lingva', 'mymemory');
    if (hasAiKey) {
      providersToTry.push('ai');
    }
  }

  const attemptedReasons = [];

  for (const provider of providersToTry) {
    if (provider === 'aegisbot') {
      const aegisUrl =
        groupConfig?.stt_aegisbot_url || store?.aegisbot_url || process.env.AEGISBOT_URL;
      const aegisKey =
        groupConfig?.stt_aegisbot_key || store?.aegisbot_api_key || process.env.AEGISBOT_API_KEY;

      if (!aegisUrl) {
        attemptedReasons.push('AegisBot Server: No Server URL configured');
        continue;
      }

      try {
        let cleanUrl = String(aegisUrl).trim();
        while (cleanUrl.endsWith('/')) {
          cleanUrl = cleanUrl.slice(0, -1);
        }
        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'AegisBot-WhatsApp-Gateway/1.0',
        };
        if (aegisKey) {
          headers['Authorization'] = `Bearer ${String(aegisKey).trim()}`;
        }

        const res = await fetch(`${cleanUrl}/api/v1/ai/translate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            text: cleanText,
            target_lang: targetLang,
            source_lang: 'auto',
            provider: 'auto',
          }),
          signal: AbortSignal.timeout(7000),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.translation) {
            const translated = data.translation.trim();
            const detected = data.source_lang || '?';
            saveCache(translated, detected, 'aegisbot', 'AegisBot Server');
            lastTranslationEvent = {
              timestamp: Date.now(),
              provider: 'aegisbot',
              providerName: 'AegisBot Server (Local)',
              status: 'success',
              sourceLang: detected,
              targetLang,
              reason: 'Translated via AegisBot Server',
            };
            return {
              translation: translated,
              sourceLang: detected,
              detectedSource: detected,
              provider: 'aegisbot',
              providerName: 'AegisBot Server',
              reason: null,
            };
          } else {
            attemptedReasons.push(`AegisBot Server: ${data.error || 'Empty translation'}`);
          }
        } else {
          attemptedReasons.push(`AegisBot Server: HTTP ${res.status}`);
        }
      } catch (err) {
        logger.debug({ error: err.message }, 'AegisBot translation request failed');
        attemptedReasons.push(`AegisBot Server: Error (${err.message})`);
      }
    }
    if (provider === 'google') {
      const cd = cooldowns.get('google') || 0;
      if (cd > now) {
        attemptedReasons.push(
          `Google Translate: in cooldown (${Math.ceil((cd - now) / 1000)}s left)`
        );
        continue;
      }

      const googleEndpoints = [
        `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${encodeURIComponent(targetLang)}&q=${encodeURIComponent(cleanText)}`,
        `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(cleanText)}`,
        `https://translate.google.com/translate_a/single?client=at&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(cleanText)}`,
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(cleanText)}`,
      ];

      let googleSuccess = false;
      let hit429 = false;

      for (const url of googleEndpoints) {
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
              Accept: '*/*',
            },
            signal: AbortSignal.timeout(5000),
          });

          if (res.status === 429) {
            hit429 = true;
            continue;
          }

          if (res.ok) {
            const data = await res.json();
            let translated = '';
            let detected = '?';

            if (Array.isArray(data) && typeof data[0] === 'string') {
              // Format: ["Translated text", "de"]
              translated = data[0].trim();
              detected = data[1] || '?';
            } else if (Array.isArray(data) && Array.isArray(data[0])) {
              if (Array.isArray(data[0][0]) && typeof data[0][0][0] === 'string') {
                // Format: [[["Translated text", "source", ...]], ...]
                translated = data[0].map((item) => (Array.isArray(item) ? item[0] : '')).join('').trim();
                detected = data[2] || '?';
              } else if (typeof data[0][0] === 'string') {
                // Format: [["Translated text", "de"]]
                translated = data[0][0].trim();
                detected = data[0][1] || data[2] || '?';
              }
            }

            if (translated) {
              saveCache(translated, detected, 'google', 'Google Translate');
              lastTranslationEvent = {
                timestamp: Date.now(),
                provider: 'google',
                providerName: 'Google Translate',
                status: 'success',
                sourceLang: detected,
                targetLang,
                reason: 'Translated via Google Translate API',
              };
              googleSuccess = true;
              return {
                translation: translated,
                sourceLang: detected,
                detectedSource: detected,
                provider: 'google',
                providerName: 'Google Translate',
                reason: null,
              };
            }
          }
        } catch (err) {
          logger.debug({ err: err.message, url }, 'Google Translate endpoint failed, trying alternate endpoint');
        }
      }

      if (!googleSuccess) {
        if (hit429) {
          cooldowns.set('google', Date.now() + 5 * 60 * 1000);
          logger.warn('All Google Translate endpoints rate limited, initiating 5 min cooldown');
          recordError('google', 'Rate limit (429) reached - 5 min cooldown active', targetLang);
          attemptedReasons.push('Google Translate: Rate limited (429)');
        } else {
          recordError('google', 'All Google Translate endpoints unreachable or returned invalid response', targetLang);
          attemptedReasons.push('Google Translate: All endpoints failed');
        }
      }
    }

    if (provider === 'lingva') {
      const instances = [
        'https://lingva.ml',
        'https://translate.plausibility.cloud',
        'https://lingva.lunar.icu',
      ];
      let lingvaSuccess = false;
      for (const instance of instances) {
        try {
          const url = `${instance}/api/v1/auto/${encodeURIComponent(targetLang)}/${encodeURIComponent(cleanText)}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            const data = await res.json();
            if (data?.translation && data.translation.trim()) {
              const translated = data.translation.trim();
              const detected = data.info?.detectedSource || '?';
              saveCache(translated, detected, 'lingva', 'Lingva');
              lastTranslationEvent = {
                timestamp: Date.now(),
                provider: 'lingva',
                providerName: 'Lingva Translate',
                status: 'success',
                sourceLang: detected,
                targetLang,
                reason: `Translated via Lingva instance (${instance})`,
              };
              lingvaSuccess = true;
              return {
                translation: translated,
                sourceLang: detected,
                detectedSource: detected,
                provider: 'lingva',
                providerName: 'Lingva',
                reason: null,
              };
            }
          }
        } catch (err) {
          logger.debug(
            { instance, err: err.message },
            'Lingva Translate instance failed, trying next instance'
          );
        }
      }
      if (!lingvaSuccess) {
        recordError('lingva', 'All public Lingva instances unreachable or timed out', targetLang);
        attemptedReasons.push('Lingva Translate: All public instances unreachable');
      }
    }

    if (provider === 'mymemory') {
      const cd = cooldowns.get('mymemory') || 0;
      if (cd > now) {
        attemptedReasons.push(`MyMemory: in cooldown (${Math.ceil((cd - now) / 1000)}s left)`);
        continue;
      }
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=autodetect|${encodeURIComponent(targetLang)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.status === 429) {
          cooldowns.set('mymemory', Date.now() + 5 * 60 * 1000);
          logger.warn('MyMemory rate limit (429) reached, initiating 5 min cooldown');
          recordError('mymemory', 'Rate limit (429) reached - 5 min cooldown active', targetLang);
          attemptedReasons.push('MyMemory: Rate limited (429)');
          continue;
        }
        if (res.ok) {
          const data = await res.json();
          if (data?.responseData?.translatedText) {
            const translated = data.responseData.translatedText.trim();
            if (
              translated &&
              !translated.toUpperCase().includes('MYMEMORY WARNING') &&
              !translated.toUpperCase().includes('QUERY LENGTH LIMIT EXCEEDED')
            ) {
              const detected =
                data.responseData?.detectedLanguage ||
                data.matches?.[0]?.source ||
                data.matches?.[0]?.['source-language'] ||
                '?';
              saveCache(translated, detected, 'mymemory', 'MyMemory');
              lastTranslationEvent = {
                timestamp: Date.now(),
                provider: 'mymemory',
                providerName: 'MyMemory Translate',
                status: 'success',
                sourceLang: detected,
                targetLang,
                reason: 'Translated via MyMemory free API',
              };
              return {
                translation: translated,
                sourceLang: detected,
                detectedSource: detected,
                provider: 'mymemory',
                providerName: 'MyMemory',
                reason: null,
              };
            }
          }
          recordError('mymemory', 'MyMemory quota exceeded or invalid response', targetLang);
          attemptedReasons.push('MyMemory: Quota limit or invalid response');
        } else {
          recordError('mymemory', `HTTP ${res.status}: ${res.statusText}`, targetLang);
          attemptedReasons.push(`MyMemory: HTTP ${res.status}`);
        }
      } catch (err) {
        logger.debug({ err: err.message }, 'MyMemory translation failed');
        recordError('mymemory', `Network error: ${err.message}`, targetLang);
        attemptedReasons.push(`MyMemory: Network/Timeout (${err.message})`);
      }
    }

    if (provider === 'ai') {
      try {
        const apiKey =
          store?.gemini_api_key || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
        if (apiKey) {
          const prompt = `Translate the following text into target language code "${targetLang}". Respond ONLY with valid JSON in this exact structure: {"translation": "...", "sourceLang": "..."} (where sourceLang is the 2-letter ISO code of the input text, e.g. "de", "en", "es").\nText: "${cleanText}"`;
          const isOpenAi = Boolean(process.env.OPENAI_API_KEY && !store?.gemini_api_key);
          if (isOpenAi) {
            const oaKey = process.env.OPENAI_API_KEY || apiKey;
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${oaKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                max_tokens: 500,
              }),
              signal: AbortSignal.timeout(6000),
            });
            if (res.ok) {
              const data = await res.json();
              const raw = data.choices?.[0]?.message?.content?.trim();
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.translation) {
                  const translated = parsed.translation.trim();
                  const detected = parsed.sourceLang || '?';
                  saveCache(translated, detected, 'openai', 'OpenAI (GPT-4o-mini)');
                  lastTranslationEvent = {
                    timestamp: Date.now(),
                    provider: 'openai',
                    providerName: 'OpenAI AI Model',
                    status: 'success',
                    sourceLang: detected,
                    targetLang,
                    reason: 'Translated via OpenAI GPT model',
                  };
                  return {
                    translation: translated,
                    sourceLang: detected,
                    detectedSource: detected,
                    provider: 'openai',
                    providerName: 'OpenAI (GPT-4o-mini)',
                    reason: null,
                  };
                }
              }
            }
          } else {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                signal: AbortSignal.timeout(6000),
              }
            );
            if (res.ok) {
              const data = await res.json();
              const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (raw) {
                const cleanJson = raw.replace(/```json\n?|\n?```/g, '').trim();
                let parsed;
                try {
                  parsed = JSON.parse(cleanJson);
                } catch {
                  parsed = { translation: raw };
                }
                if (parsed.translation) {
                  const translated = parsed.translation.trim();
                  const detected = parsed.sourceLang || '?';
                  saveCache(translated, detected, 'gemini', 'Gemini 1.5 Flash');
                  lastTranslationEvent = {
                    timestamp: Date.now(),
                    provider: 'gemini',
                    providerName: 'Gemini AI Model',
                    status: 'success',
                    sourceLang: detected,
                    targetLang,
                    reason: 'Translated via Google Gemini model',
                  };
                  return {
                    translation: translated,
                    sourceLang: detected,
                    detectedSource: detected,
                    provider: 'gemini',
                    providerName: 'Gemini 1.5 Flash',
                    reason: null,
                  };
                }
              }
            }
          }
        }
      } catch (err) {
        logger.debug({ err: err.message }, 'AI translation failed');
        recordError('ai', `AI Error: ${err.message}`, targetLang);
        attemptedReasons.push(`AI: Error (${err.message})`);
      }
    }
  }

  const failReason =
    'All translation providers (Google, Lingva, MyMemory, AI) failed or are currently rate-limited. Solution: Wait for cooldowns to expire or configure GEMINI_API_KEY in settings.';

  lastTranslationEvent = {
    timestamp: Date.now(),
    provider: 'none',
    providerName: 'None (All providers failed)',
    status: 'failed',
    sourceLang: null,
    targetLang,
    reason: failReason,
    attempted: attemptedReasons,
  };

  return {
    translation: null,
    reason: failReason,
  };
}

export async function translateTextGateway(text, targetLang = 'en', groupConfig = null) {
  const { translation } = await translateTextGatewayWithReason(
    text,
    targetLang,
    'auto',
    groupConfig
  );
  return translation;
}

// Backward compatibility alias
export const translateTextFreeWithReason = translateTextGatewayWithReason;
export const translateTextFree = translateTextGateway;

/**
 * Returns real-time diagnostics on translation providers, health, active engine, and reasons.
 */
export function getTranslationDiagnostics(groupConfig = {}, store = {}) {
  const now = Date.now();
  const configuredProvider = groupConfig?.translation?.provider || 'auto';
  const hasAiKey = Boolean(
    store?.gemini_api_key ||
    groupConfig?.ai?.api_key ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY
  );

  const googleCooldown = cooldowns.get('google') || 0;
  const mymemoryCooldown = cooldowns.get('mymemory') || 0;

  const hasAegisUrl = Boolean(
    groupConfig?.stt_aegisbot_url || store?.aegisbot_url || process.env.AEGISBOT_URL
  );

  const health = {
    aegisbot: {
      name: 'AegisBot Server (Local)',
      status: hasAegisUrl ? 'healthy' : 'no_url',
    },
    google: {
      name: 'Google Translate',
      status: googleCooldown > now ? 'cooldown' : 'healthy',
      cooldown_remaining_sec: googleCooldown > now ? Math.ceil((googleCooldown - now) / 1000) : 0,
    },
    lingva: {
      name: 'Lingva Translate',
      status: 'healthy',
    },
    mymemory: {
      name: 'MyMemory',
      status: mymemoryCooldown > now ? 'cooldown' : 'healthy',
      cooldown_remaining_sec:
        mymemoryCooldown > now ? Math.ceil((mymemoryCooldown - now) / 1000) : 0,
    },
    ai: {
      name: 'Gemini / OpenAI AI Model',
      status: hasAiKey ? 'healthy' : 'no_key',
    },
  };

  let activeProvider;
  let activeProviderName;
  let selectionReason;

  const isTranslationEnabled = groupConfig?.translation?.enabled !== false;
  if (!isTranslationEnabled) {
    return {
      status: 'disabled',
      configured_provider: configuredProvider,
      active_provider: 'disabled',
      active_provider_name: 'Disabled',
      selection_reason: 'Translation Disabled: Translation feature is switched off for this group.',
      health,
      last_activity_sec_ago: null,
      recent_errors: [],
    };
  }

  const customPriority =
    groupConfig?.translation?.engine_priority || store?.translation_engine_priority;

  const providersToTry = [];
  if (Array.isArray(customPriority) && customPriority.length > 0) {
    for (const p of customPriority) {
      if (p && !providersToTry.includes(p)) {
        providersToTry.push(p);
      }
    }
  } else if (
    configuredProvider &&
    configuredProvider !== 'auto' &&
    configuredProvider !== 'custom'
  ) {
    providersToTry.push(configuredProvider);
  } else {
    if (hasAegisUrl) providersToTry.push('aegisbot');
    providersToTry.push('google', 'lingva', 'mymemory');
    if (hasAiKey) providersToTry.push('ai');
  }

  // Find first available provider according to configured priority chain
  activeProvider = 'google';
  activeProviderName = 'Google Translate';
  selectionReason = 'Auto-Failover: Primary engine is active and healthy.';

  for (const p of providersToTry) {
    if (p === 'aegisbot') {
      if (hasAegisUrl) {
        activeProvider = 'aegisbot';
        activeProviderName = 'AegisBot Server (Local)';
        selectionReason =
          configuredProvider === 'custom'
            ? 'Custom Priority: AegisBot Server is top priority and available.'
            : configuredProvider === 'aegisbot'
              ? 'Manual Selection: Explicitly set to AegisBot Server.'
              : 'Auto-Failover: Local AegisBot Server is active.';
        break;
      }
    } else if (p === 'google') {
      if (googleCooldown <= now) {
        activeProvider = 'google';
        activeProviderName = 'Google Translate';
        selectionReason =
          configuredProvider === 'custom'
            ? 'Custom Priority: Google Translate is active and healthy.'
            : 'Auto-Failover: Primary engine (Google Translate) is active and healthy.';
        break;
      }
    } else if (p === 'lingva') {
      activeProvider = 'lingva';
      activeProviderName = 'Lingva Translate';
      selectionReason =
        configuredProvider === 'custom'
          ? 'Custom Priority: Switched to Lingva Translate.'
          : `Auto-Failover: Higher-priority engines unavailable. Switched to Lingva Translate.`;
      break;
    } else if (p === 'mymemory') {
      if (mymemoryCooldown <= now) {
        activeProvider = 'mymemory';
        activeProviderName = 'MyMemory';
        selectionReason =
          configuredProvider === 'custom'
            ? 'Custom Priority: Switched to MyMemory.'
            : 'Auto-Failover: Higher-priority engines unavailable. Switched to MyMemory.';
        break;
      }
    } else if (p === 'ai') {
      if (hasAiKey) {
        activeProvider = 'ai';
        activeProviderName = 'Gemini / OpenAI AI Model';
        selectionReason = 'Custom Priority: Using multimodal AI model with verified API key.';
        break;
      }
    }
  }

  let status = 'healthy';
  if (configuredProvider === 'ai' && !hasAiKey) {
    status = 'error';
  } else if (googleCooldown > now && configuredProvider === 'google') {
    status = 'degraded';
  } else if (googleCooldown > now && activeProvider !== 'google') {
    status = 'degraded';
  }

  return {
    active_provider: activeProvider,
    active_provider_name: activeProviderName,
    configured_provider: configuredProvider,
    selection_reason: selectionReason,
    status,
    health,
    last_event: lastTranslationEvent,
    recent_errors: recentErrors.slice(0, 10),
  };
}

/**
 * Checks if the text begins with or contains automated translation banners/headers.
 * @param {string} text
 * @returns {boolean}
 */
export function isTranslationHeaderText(text) {
  if (!text || typeof text !== 'string') return false;
  return (
    /🌐\s*\*[^*→\->]*[→\->][^*]*\*\s*:?/i.test(text) ||
    /_\s*🌐\s*\[[^\]]*\]\s*_/i.test(text) ||
    text.includes('🌐 [')
  );
}

/**
 * Strips existing translation banners/headers from text before re-translating.
 * @param {string} text
 * @returns {string}
 */
export function stripTranslationHeaders(text) {
  if (!text || typeof text !== 'string') return '';
  let clean = text
    .replace(/^🌐\s*\*[^*→\->]*[→\->][^*]*\*\s*:?\s*/i, '')
    .replace(/^_\s*🌐\s*\[[^\]]*\]\s*_\s*/i, '')
    .replace(/^🌐\s*\[[^\]]*\]\s*/i, '')
    .trim();

  if (clean.startsWith('"') && clean.endsWith('"') && clean.length > 2) {
    clean = clean.slice(1, -1).trim();
  }
  return clean;
}
