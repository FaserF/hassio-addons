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

export const TELEGRAM_MAX_TEXT_LENGTH = 4096;
export const TELEGRAM_MAX_CAPTION_LENGTH = 1024;
export const WHATSAPP_MAX_TEXT_LENGTH = 4096;
export const MAX_MESSAGE_CHUNKS = 50;

/**
 * Intelligently split text into chunks within maxLength.
 * Splits on paragraphs (\n\n), newlines (\n), or spaces where possible.
 */
export function splitMessageText(text, maxLength = 4096, maxChunks = MAX_MESSAGE_CHUNKS) {
  if (!text || typeof text !== 'string') return [];
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let remaining = text;
  const bound = Math.min(Math.max(1, maxChunks), 100);

  while (remaining.length > 0 && chunks.length < bound) {
    if (remaining.length <= maxLength || chunks.length === bound - 1) {
      chunks.push(remaining);
      break;
    }

    let splitIndex;
    const window = remaining.slice(0, maxLength);

    // 1. Try paragraph break
    const lastParagraph = window.lastIndexOf('\n\n');
    if (lastParagraph >= Math.floor(maxLength * 0.4)) {
      splitIndex = lastParagraph + 2;
    } else {
      // 2. Try single newline break
      const lastNewline = window.lastIndexOf('\n');
      if (lastNewline >= Math.floor(maxLength * 0.4)) {
        splitIndex = lastNewline + 1;
      } else {
        // 3. Try space break
        const lastSpace = window.lastIndexOf(' ');
        if (lastSpace >= Math.floor(maxLength * 0.5)) {
          splitIndex = lastSpace + 1;
        } else {
          // 4. Hard boundary
          splitIndex = maxLength;
        }
      }
    }

    const chunk = remaining.slice(0, splitIndex).trimEnd();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}

/**
 * Split Telegram HTML text into balanced chunks, preserving opened formatting tags across splits.
 */
export function splitTelegramHtml(htmlText, maxLength = 4096, maxChunks = MAX_MESSAGE_CHUNKS) {
  if (!htmlText || htmlText.length <= maxLength) return [htmlText];

  const rawChunks = splitMessageText(htmlText, maxLength - 60, maxChunks);
  const balancedChunks = [];
  let openTags = [];
  const totalRaw = Math.min(rawChunks.length, Math.max(1, maxChunks));

  for (let i = 0; i < totalRaw; i++) {
    let chunk = rawChunks[i];

    // Prepend open tags from previous chunk
    if (openTags.length > 0) {
      const prefix = openTags.map((t) => `<${t}>`).join('');
      chunk = prefix + chunk;
    }

    // Linear character scanning to parse HTML tags without regular expressions (eliminating any ReDoS risk)
    const currentOpenTags = [...openTags];
    let tagStart = -1;

    for (let c = 0; c < chunk.length; c++) {
      if (chunk[c] === '<') {
        tagStart = c;
      } else if (chunk[c] === '>' && tagStart !== -1) {
        const rawInside = chunk.slice(tagStart + 1, c).trim();
        tagStart = -1;
        if (!rawInside) continue;

        const isClosing = rawInside.startsWith('/');
        const namePart = (isClosing ? rawInside.slice(1) : rawInside).split(/[\s/]/)[0];
        const tagName = namePart ? namePart.toLowerCase() : '';

        if (
          [
            'b',
            'strong',
            'i',
            'em',
            'code',
            'pre',
            's',
            'strike',
            'del',
            'blockquote',
            'a',
          ].includes(tagName)
        ) {
          if (isClosing) {
            const lastIdx = currentOpenTags.lastIndexOf(tagName);
            if (lastIdx !== -1) {
              currentOpenTags.splice(lastIdx, 1);
            }
          } else {
            currentOpenTags.push(tagName);
          }
        }
      }
    }

    // Close any tags still open at end of this chunk (in reverse order)
    if (currentOpenTags.length > 0 && i < totalRaw - 1) {
      const suffix = [...currentOpenTags]
        .reverse()
        .map((t) => `</${t}>`)
        .join('');
      chunk = chunk + suffix;
    }

    openTags = currentOpenTags;
    balancedChunks.push(chunk);
  }

  return balancedChunks;
}
