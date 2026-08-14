/**
 * Convert WhatsApp formatting syntax to Telegram HTML syntax.
 * *bold* -> <b>bold</b>
 * _italic_ -> <i>italic</i>
 * ~strike~ -> <s>strike</s>
 * ```code``` -> <code>code</code>
 */
export function waToTelegramHtml(text) {
  if (!text) return '';
  let out = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Markdown links [Text](URL) -> <a href="URL">Text</a>
  out = out.replace(
    /\[([^\]\r\n]{1,500})\]\((https?:\/\/[^\s)\r\n]{1,2000})\)/gi,
    '<a href="$2">$1</a>'
  );
  // Code blocks ```text```
  out = out.replace(/```([\s\S]*?)```/g, '<code>$1</code>');
  // Monospace `text`
  out = out.replace(/(^|\s|\W)`([^`\n]+)`(?=\W|\s|$)/g, '$1<code>$2</code>');
  // Bold *text*
  out = out.replace(/(^|\s|\W)\*([^*\n]+)\*(?=\W|\s|$)/g, '$1<b>$2</b>');
  // Italic _text_
  out = out.replace(/(^|\s|\W)_([^_\n]+)_(?=\W|\s|$)/g, '$1<i>$2</i>');
  // Strikethrough ~text~
  out = out.replace(/(^|\s|\W)~([^~\n]+)~(?=\W|\s|$)/g, '$1<s>$2</s>');

  return out;
}

/**
 * Safely strip all HTML tags from a string without regex backtracking or incomplete sanitization.
 */
export function stripHtmlTags(str) {
  if (typeof str !== 'string' && typeof str !== 'number') return '';
  let out = '';
  let insideTag = false;
  const val = String(str);
  for (const char of val) {
    if (char === '<') {
      insideTag = true;
    } else if (char === '>') {
      insideTag = false;
    } else if (!insideTag) {
      out += char;
    }
  }
  return out;
}

/**
 * Convert Telegram MarkdownV2 / HTML formatting and Telegram entities to WhatsApp syntax.
 * <b>bold</b> or *bold* -> *bold*
 * <i>italic</i> or _italic_ -> _italic_
 * <s>strike</s> or ~strike~ -> ~strike~
 * <code>code</code> -> ```code```
 * text_link / <a href="URL">Text</a> -> Text (URL)
 */
export function telegramToWaFormatting(text, entities = null) {
  if (!text) return '';
  let out = String(text);

  // If Telegram entities (text_link, url, bold, italic, code) are provided, process them first
  if (Array.isArray(entities) && entities.length > 0) {
    // Sort entities backwards by offset so string modifications do not invalidate earlier offsets
    const sorted = [...entities].sort((a, b) => (b.offset || 0) - (a.offset || 0));
    for (const ent of sorted) {
      const offset = ent.offset || 0;
      const length = ent.length || 0;
      if (offset < 0 || length <= 0 || offset + length > out.length) continue;
      const sub = out.slice(offset, offset + length);
      let formattedSub = sub;

      if (ent.type === 'text_link' && ent.url) {
        formattedSub = `${sub} (${ent.url})`;
      } else if (ent.type === 'bold') {
        formattedSub = `*${sub}*`;
      } else if (ent.type === 'italic') {
        formattedSub = `_${sub}_`;
      } else if (ent.type === 'strikethrough') {
        formattedSub = `~${sub}~`;
      } else if (ent.type === 'code' || ent.type === 'pre') {
        formattedSub = `\`\`\`${sub}\`\`\``;
      }
      out = out.slice(0, offset) + formattedSub + out.slice(offset + length);
    }
  }

  // Convert Telegram HTML tags
  out = out.replace(/<a\s+href="([^"]+)">([\s\S]*?)<\/a>/gi, '$2 ($1)');
  out = out.replace(/<b>([\s\S]*?)<\/b>/gi, '*$1*');
  out = out.replace(/<strong>([\s\S]*?)<\/strong>/gi, '*$1*');
  out = out.replace(/<i>([\s\S]*?)<\/i>/gi, '_$1_');
  out = out.replace(/<em>([\s\S]*?)<\/em>/gi, '_$1_');
  out = out.replace(/<s>([\s\S]*?)<\/s>/gi, '~$1~');
  out = out.replace(/<strike>([\s\S]*?)<\/strike>/gi, '~$1~');
  out = out.replace(/<del>([\s\S]*?)<\/del>/gi, '~$1~');
  out = out.replace(/<code>([\s\S]*?)<\/code>/gi, '```$1```');
  out = out.replace(/<pre>([\s\S]*?)<\/pre>/gi, '```$1```');

  // Strip remaining HTML tags safely
  return stripHtmlTags(out);
}

/**
 * Anonymize phone numbers in headers if enabled.
 * e.g., +491761234567 -> +49 176 *** 567
 */
export function anonymizePhoneNumber(phoneStr) {
  if (!phoneStr) return phoneStr;
  const digits = String(phoneStr).replace(/\D/g, '');
  if (digits.length < 7) return phoneStr;
  const start = digits.slice(0, 5);
  const end = digits.slice(-3);
  return `+${start}***${end}`;
}
