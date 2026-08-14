import { logger } from '../logger.js';

const cache = new Map();
const cooldowns = new Map();

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

  for (const prov of providersToTry) {
    if ((cooldowns.get(prov) || 0) >= now) continue;

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
              return { translation: translated, sourceLang: detectedSource, reason: null };
            }
          }
        } else if (res.status === 429) {
          logger.warn('Google Translate API rate-limited (429). Cooldown 2 minutes.');
          cooldowns.set('google', now + 120000);
        }
      } catch (err) {
        logger.debug({ error: err.message }, 'Google Translate fallback failed');
      }
    }

    if (prov === 'lingva') {
      const lingvaMirrors = [
        'https://lingva.ml',
        'https://translate.plausibility.cloud',
        'https://lingva.lunar.icu',
      ];
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
              return { translation: data.translation, sourceLang: detectedSource, reason: null };
            }
          }
        } catch (err) {
          logger.debug({ error: err.message, mirror }, 'Lingva mirror request failed');
        }
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
            return { translation: translated, sourceLang: detectedSource, reason: null };
          }
        } else if (res.status === 429) {
          logger.warn('MyMemory API rate-limited (429). Cooldown 5 minutes.');
          cooldowns.set('mymemory', now + 300000);
        }
      } catch (err) {
        logger.debug({ error: err.message }, 'MyMemory fallback failed');
      }
    }
  }

  return {
    translation: null,
    reason:
      'All free translation providers (Google, Lingva, MyMemory) failed or are currently rate-limited. Solution: Wait 5 minutes for cooldown to expire, or set GEMINI_API_KEY / OPENAI_API_KEY in configuration.',
  };
}

export async function translateTextFree(text, targetLang = 'en') {
  const { translation } = await translateTextFreeWithReason(text, targetLang);
  return translation;
}
