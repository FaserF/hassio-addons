import { logger } from '../../logger.js';

export async function processAiModeration(text, groupAiConfig, storeGeminiKey) {
  const apiKey = storeGeminiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || !groupAiConfig.enabled) {
    return null;
  }

  try {
    const prompt = `${groupAiConfig.system_prompt || 'You are a helpful group moderator assistant.'}\n\nUser message: "${text}"\nProvide a concise auto-reply if relevant, otherwise reply "NO_REPLY".`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Gemini API call failed for moderation AI');
      return null;
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!replyText || replyText.includes('NO_REPLY')) {
      return null;
    }

    return replyText;
  } catch (err) {
    logger.error({ error: err.message }, 'Error calling Gemini AI moderation provider');
    return null;
  }
}
