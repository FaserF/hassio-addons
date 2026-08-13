import { logger } from '../../logger.js';
import { translateTextFreeWithReason } from '../../utils/freeTranslator.js';

export async function processAiModeration(
  text,
  groupAiConfig,
  storeGeminiKey,
  mode = 'reply',
  extraContext = {}
) {
  const provider = groupAiConfig.provider || process.env.AI_PROVIDER || 'gemini';
  const apiKey =
    storeGeminiKey ||
    groupAiConfig.api_key ||
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (mode === 'translate') {
    const targetLang = extraContext.targetLang || 'en';
    let aiErrorReason = null;
    if (apiKey) {
      try {
        const prompt = `Translate the following text into target language code "${targetLang}". Respond ONLY with valid JSON in this exact structure: {"translation": "...", "sourceLang": "..."} (where sourceLang is the 2-letter ISO code of the input text, e.g. "de", "en", "es").\nText: "${text}"`;
        if (provider === 'openai' || groupAiConfig.openai_api_key) {
          const oaKey = groupAiConfig.openai_api_key || process.env.OPENAI_API_KEY || apiKey;
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${oaKey}`,
            },
            body: JSON.stringify({
              model: groupAiConfig.model || 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              response_format: { type: 'json_object' },
              max_tokens: 500,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const rawContent = data.choices?.[0]?.message?.content?.trim();
            if (rawContent) {
              try {
                const parsed = JSON.parse(rawContent);
                if (parsed.translation) {
                  return {
                    translation: parsed.translation,
                    sourceLang: parsed.sourceLang || null,
                    reason: null,
                  };
                }
              } catch (e) {
                return { translation: rawContent, sourceLang: null, reason: null };
              }
            }
          } else {
            aiErrorReason = `OpenAI API returned status ${res.status}.`;
          }
        } else {
          const geminiModel = groupAiConfig.model || 'gemini-1.5-flash';
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            }
          );
          if (res.ok) {
            const data = await res.json();
            const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (rawContent) {
              const cleanJson = rawContent.replace(/```json\n?|\n?```/g, '').trim();
              try {
                const parsed = JSON.parse(cleanJson);
                if (parsed.translation) {
                  return {
                    translation: parsed.translation,
                    sourceLang: parsed.sourceLang || null,
                    reason: null,
                  };
                }
              } catch (e) {
                return { translation: rawContent, sourceLang: null, reason: null };
              }
            }
          } else {
            aiErrorReason = `Gemini API returned status ${res.status}.`;
          }
        }
      } catch (err) {
        aiErrorReason = `AI Provider error: ${err.message}`;
        logger.debug(
          { error: err.message },
          'AI translation failed, switching to free translator fallback'
        );
      }
    }

    // Fallback for translation mode: Free multi-provider engine (Google -> Lingva -> MyMemory)
    const freeRes = await translateTextFreeWithReason(text, targetLang);
    if (freeRes.translation) return { translation: freeRes.translation, reason: null };

    const finalReason =
      freeRes.reason || aiErrorReason || 'Unknown error occurred during translation.';
    return { translation: null, reason: finalReason };
  }

  if (!apiKey || (!groupAiConfig.enabled && mode !== 'rules_question')) {
    return null;
  }

  let prompt;
  if (mode === 'intent_scan') {
    prompt = `Analyze the following message for scam, phishing, fraudulent crypto/airdrop claims, or malicious spam intent.\nMessage: "${text}"\nRespond ONLY with "SPAM" if it is malicious/scam, or "CLEAN" if it is safe.`;
  } else if (mode === 'rules_question') {
    const rulesText = extraContext.rules || 'No rules configured.';
    prompt = `You are a helpful group moderator assistant.\nGroup Rules:\n"${rulesText}"\n\nUser Question: "${text}"\nAnswer the user's question concisely based on the group rules.`;
  } else {
    prompt = `${groupAiConfig.system_prompt || 'You are an intelligent group moderator assistant.'}\n\nUser message: "${text}"\nProvide a concise auto-reply if relevant, otherwise reply "NO_REPLY".`;
  }

  try {
    if (provider === 'openai' || groupAiConfig.openai_api_key) {
      const oaKey = groupAiConfig.openai_api_key || process.env.OPENAI_API_KEY || apiKey;
      const model = groupAiConfig.model || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${oaKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: mode === 'intent_scan' ? 10 : 300,
        }),
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, 'OpenAI API call failed');
        return null;
      }
      const data = await response.json();
      const replyText = data.choices?.[0]?.message?.content?.trim();
      if (!replyText || (mode === 'reply' && replyText.includes('NO_REPLY'))) return null;
      return replyText;
    } else {
      // Default: Gemini API
      const geminiModel = groupAiConfig.model || 'gemini-1.5-flash';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (!response.ok) {
        logger.warn({ status: response.status }, 'Gemini API call failed');
        return null;
      }

      const data = await response.json();
      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!replyText || (mode === 'reply' && replyText.includes('NO_REPLY'))) return null;
      return replyText;
    }
  } catch (err) {
    logger.error({ error: err.message }, 'Error calling AI moderation provider');
    return null;
  }
}
