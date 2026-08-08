/**
 * Applies configured RegEx replacements to text messages.
 * replacements: [{ search, replace, is_regex }]
 */
export function applyRegexReplacements(text, replacements = []) {
  if (!text || !Array.isArray(replacements) || replacements.length === 0) {
    return text || '';
  }
  let result = String(text);
  for (const item of replacements) {
    if (!item || !item.search) continue;
    try {
      if (item.is_regex) {
        const re = new RegExp(item.search, 'gi');
        result = result.replace(re, item.replace || '');
      } else {
        result = result.split(item.search).join(item.replace || '');
      }
    } catch (e) {
      // Ignore invalid regex patterns
    }
  }
  return result;
}
