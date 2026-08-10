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
 * Convert Telegram MarkdownV2 / HTML formatting to WhatsApp syntax for incoming Telegram messages.
 * <b>bold</b> or *bold* -> *bold*
 * <i>italic</i> or _italic_ -> _italic_
 * <s>strike</s> or ~strike~ -> ~strike~
 * <code>code</code> -> ```code```
 */
export function telegramToWaFormatting(text) {
  if (!text) return '';
  let out = String(text);

  // Convert Telegram HTML tags
  out = out.replace(/<b>([\s\S]*?)<\/b>/gi, '*$1*');
  out = out.replace(/<strong>([\s\S]*?)<\/strong>/gi, '*$1*');
  out = out.replace(/<i>([\s\S]*?)<\/i>/gi, '_$1_');
  out = out.replace(/<em>([\s\S]*?)<\/em>/gi, '_$1_');
  out = out.replace(/<s>([\s\S]*?)<\/s>/gi, '~$1~');
  out = out.replace(/<strike>([\s\S]*?)<\/strike>/gi, '~$1~');
  out = out.replace(/<del>([\s\S]*?)<\/del>/gi, '~$1~');
  out = out.replace(/<code>([\s\S]*?)<\/code>/gi, '```$1```');
  out = out.replace(/<pre>([\s\S]*?)<\/pre>/gi, '```$1```');

  // Strip remaining HTML tags iteratively until no more tags remain
  let prev;
  do {
    prev = out;
    out = out.replace(/<[^>]+>/g, '');
  } while (out !== prev);

  return out;
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
