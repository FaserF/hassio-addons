import { anonymizePhoneNumber } from './format.js';

export function formatHeader(
  sourceGroup,
  senderName,
  includeGroup,
  includeSender,
  anonymizePhone = false
) {
  const parts = [];
  if (includeGroup && sourceGroup) {
    const cleanGroup = String(sourceGroup).endsWith('@g.us')
      ? `Group ${sourceGroup.split('@')[0]}`
      : sourceGroup;
    parts.push(cleanGroup);
  }
  if (includeSender && senderName) {
    const displayName = anonymizePhone ? anonymizePhoneNumber(senderName) : senderName;
    parts.push(displayName);
  }
  if (parts.length === 0) return '';
  return `<b>[${parts.join(' | ')}]</b>:\n`;
}
