/**
 * Convert WhatsApp formatting syntax to Telegram HTML syntax.
 * *bold* -> <b>bold</b>
 * _italic_ -> <i>italic</i>
 * ~strike~ -> <s>strike</s>
 * ```code``` -> <code>code</code>
 */
export function waToTelegramHtml(text) {
  if (!text) return '';
  let out = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks ```text```
  out = out.replace(/```([\s\S]*?)```/g, '<code>$1</code>');
  // Bold *text*
  out = out.replace(/(^|\s|\W)\*([^\*\n]+)\*(\W|\s|$)/g, '$1<b>$2</b>$3');
  // Italic _text_
  out = out.replace(/(^|\s|\W)_([^_\n]+)_(\W|\s|$)/g, '$1<i>$2</i>$3');
  // Strikethrough ~text~
  out = out.replace(/(^|\s|\W)~([^~\n]+)~(\W|\s|$)/g, '$1<s>$2</s>$3');

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
