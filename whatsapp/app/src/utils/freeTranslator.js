import { logger } from '../logger.js';

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
 * Free Multi-Provider Translation Helper (Node.js)
 * Failover chain: Google Translate -> Lingva -> MyMemory
 * Features: Rate-limit (429) cooldowns (5 min), 5s AbortSignal timeout, 1000 char truncation, in-memory caching.
 */
export async function translateTextFreeWithReason(
  text,
  targetLang = 'en',
  preferredProvider = 'auto'
) {
  if (!text || !text.trim()) {
    return { translation: null, reason: 'Empty or blank text provided for translation.' };
  }

  const cleanText = text.trim().slice(0, 1000);
  const cacheKey = `${preferredProvider}:${targetLang}:${cleanText}`;

  if (cache.has(cacheKey)) {
    lastTranslationEvent = {
      timestamp: Date.now(),
      provider: preferredProvider === 'auto' ? 'cache' : preferredProvider,
      providerName: 'Cache (In-Memory)',
      status: 'success',
      sourceLang: null,
      targetLang,
      reason: 'Served from in-memory cache',
    };
    return { translation: cache.get(cacheKey), reason: null };
  }

  const now = Date.now();
  const saveCache = (res) => {
    if (cache.size > 500) cache.clear();
    cache.set(cacheKey, res);
  };

  const providersToTry = [];
  if (preferredProvider && preferredProvider !== 'auto') {
    providersToTry.push(preferredProvider);
  }
  ['google', 'lingva', 'mymemory'].forEach((p) => {
    if (!providersToTry.includes(p)) providersToTry.push(p);
  });

  const attemptedReasons = [];

  for (const prov of providersToTry) {
    if ((cooldowns.get(prov) || 0) >= now) {
      const remainingSec = Math.ceil(((cooldowns.get(prov) || 0) - now) / 1000);
      attemptedReasons.push(`${prov} (rate-limited, cooldown active: ${remainingSec}s remaining)`);
      continue;
    }

    if (prov === 'google') {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
          targetLang
        )}&dt=t&q=${encodeURIComponent(cleanText)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data[0]) {
            const translated = data[0].map((part) => part[0] || '').join('');
            const detectedSource = data[2] || null;
            if (translated) {
              saveCache(translated);
              const reason =
                preferredProvider === 'auto'
                  ? 'Auto-Failover: Primary engine Google Translate responded successfully.'
                  : 'Manual Selection: Google Translate responded successfully.';
              lastTranslationEvent = {
                timestamp: Date.now(),
                provider: 'google',
                providerName: 'Google Translate (Free)',
                status: 'success',
                sourceLang: detectedSource,
                targetLang,
                reason,
              };
              return { translation: translated, sourceLang: detectedSource, reason: null };
            }
          }
        } else if (res.status === 429) {
          logger.warn('Google Translate API rate-limited (429). Cooldown 2 minutes.');
          cooldowns.set('google', now + 120000);
          recordError(
            'google',
            'Rate limit exceeded (HTTP 429). 2-minute cooldown activated.',
            targetLang
          );
          attemptedReasons.push('Google Translate: Rate limited (HTTP 429)');
        } else {
          recordError('google', `HTTP Error ${res.status}: ${res.statusText}`, targetLang);
          attemptedReasons.push(`Google Translate: HTTP Error ${res.status}`);
        }
      } catch (err) {
        logger.debug({ error: err.message }, 'Google Translate fallback failed');
        recordError('google', `Network error: ${err.message}`, targetLang);
        attemptedReasons.push(`Google Translate: Network/Timeout (${err.message})`);
      }
    }

    if (prov === 'lingva') {
      const lingvaMirrors = [
        'https://lingva.ml',
        'https://translate.plausibility.cloud',
        'https://lingva.lunar.icu',
      ];
      let lingvaSuccess = false;
      for (const mirror of lingvaMirrors) {
        try {
          const url = `${mirror}/api/v1/auto/${encodeURIComponent(targetLang)}/${encodeURIComponent(
            cleanText
          )}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            if (data && data.translation) {
              const detectedSource = data.info?.detectedSource || null;
              saveCache(data.translation);
              const reason =
                preferredProvider === 'auto'
                  ? 'Auto-Failover: Failed over to Lingva Translate (Free Privacy API).'
                  : 'Manual Selection: Lingva Translate responded successfully.';
              lastTranslationEvent = {
                timestamp: Date.now(),
                provider: 'lingva',
                providerName: 'Lingva Translate (Free Privacy API)',
                status: 'success',
                sourceLang: detectedSource,
                targetLang,
                reason,
              };
              lingvaSuccess = true;
              return { translation: data.translation, sourceLang: detectedSource, reason: null };
            }
          }
        } catch (err) {
          logger.debug({ error: err.message, mirror }, 'Lingva mirror request failed');
          recordError('lingva', `Mirror ${mirror} failed: ${err.message}`, targetLang);
        }
      }
      if (!lingvaSuccess) {
        attemptedReasons.push('Lingva Translate: All mirrors timed out or failed');
      }
    }

    if (prov === 'mymemory') {
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
          cleanText
        )}&langpair=autodetect|${encodeURIComponent(targetLang)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const translated = data?.responseData?.translatedText;
          const detectedSource = data?.responseData?.detectedLanguage || null;
          if (translated && !translated.toUpperCase().includes('MYMEMORY WARNING')) {
            saveCache(translated);
            const reason =
              preferredProvider === 'auto'
                ? 'Auto-Failover: Failed over to MyMemory Translation API.'
                : 'Manual Selection: MyMemory responded successfully.';
            lastTranslationEvent = {
              timestamp: Date.now(),
              provider: 'mymemory',
              providerName: 'MyMemory (Free)',
              status: 'success',
              sourceLang: detectedSource,
              targetLang,
              reason,
            };
            return { translation: translated, sourceLang: detectedSource, reason: null };
          }
        } else if (res.status === 429) {
          logger.warn('MyMemory API rate-limited (429). Cooldown 5 minutes.');
          cooldowns.set('mymemory', now + 300000);
          recordError(
            'mymemory',
            'Rate limit exceeded (HTTP 429). 5-minute cooldown activated.',
            targetLang
          );
          attemptedReasons.push('MyMemory: Rate limited (HTTP 429)');
        } else {
          recordError('mymemory', `HTTP Error ${res.status}: ${res.statusText}`, targetLang);
          attemptedReasons.push(`MyMemory: HTTP Error ${res.status}`);
        }
      } catch (err) {
        logger.debug({ error: err.message }, 'MyMemory fallback failed');
        recordError('mymemory', `Network error: ${err.message}`, targetLang);
        attemptedReasons.push(`MyMemory: Network/Timeout (${err.message})`);
      }
    }
  }

  const failReason =
    'All free translation providers (Google, Lingva, MyMemory) failed or are currently rate-limited. Solution: Wait for cooldowns to expire or configure GEMINI_API_KEY in settings.';

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

export async function translateTextFree(text, targetLang = 'en') {
  const { translation } = await translateTextFreeWithReason(text, targetLang);
  return translation;
}

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

  const health = {
    google: {
      name: 'Google Translate (Free)',
      status: googleCooldown > now ? 'cooldown' : 'healthy',
      cooldown_remaining_sec: googleCooldown > now ? Math.ceil((googleCooldown - now) / 1000) : 0,
    },
    lingva: {
      name: 'Lingva Translate (Free Privacy API)',
      status: 'healthy',
    },
    mymemory: {
      name: 'MyMemory (Free)',
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

  if (configuredProvider === 'ai') {
    activeProvider = 'ai';
    activeProviderName = 'Gemini / OpenAI AI Model';
    selectionReason = hasAiKey
      ? 'Configured AI Provider: Using multimodal AI model with verified API key.'
      : 'AI Provider Selected: Warning — No API key configured. Translation will fail until API key is set.';
  } else if (configuredProvider === 'google') {
    activeProvider = 'google';
    activeProviderName = 'Google Translate (Free)';
    selectionReason =
      googleCooldown > now
        ? `Manual Selection: Google Translate is selected, but currently in cooldown (${Math.ceil((googleCooldown - now) / 1000)}s remaining) due to rate-limiting (429).`
        : 'Manual Selection: Group is explicitly set to Google Translate.';
  } else if (configuredProvider === 'lingva') {
    activeProvider = 'lingva';
    activeProviderName = 'Lingva Translate (Free Privacy API)';
    selectionReason = 'Manual Selection: Group is explicitly set to Lingva Translate.';
  } else if (configuredProvider === 'mymemory') {
    activeProvider = 'mymemory';
    activeProviderName = 'MyMemory (Free)';
    selectionReason =
      mymemoryCooldown > now
        ? `Manual Selection: MyMemory is selected, but currently in cooldown (${Math.ceil((mymemoryCooldown - now) / 1000)}s remaining) due to rate-limiting (429).`
        : 'Manual Selection: Group is explicitly set to MyMemory.';
  } else {
    // auto
    if (googleCooldown <= now) {
      activeProvider = 'google';
      activeProviderName = 'Google Translate (Free)';
      selectionReason = 'Auto-Failover: Primary engine (Google Translate) is active and healthy.';
    } else if (mymemoryCooldown <= now) {
      activeProvider = 'lingva';
      activeProviderName = 'Lingva Translate (Free Privacy API)';
      selectionReason = `Auto-Failover: Google Translate is rate-limited (cooldown: ${Math.ceil((googleCooldown - now) / 1000)}s remaining). Switched to Lingva Translate.`;
    } else {
      activeProvider = 'mymemory';
      activeProviderName = 'MyMemory (Free)';
      selectionReason =
        'Auto-Failover: Primary & secondary engines unavailable. Switched to MyMemory.';
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
