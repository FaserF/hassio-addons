/**
 * Converts a number or group ID to a full WhatsApp JID.
 */
export function getJid(number) {
  if (!number) return '';
  if (typeof number !== 'string') number = String(number);

  // 1. If it already has a domain, return it as is.
  if (number.includes('@')) return number;

  // 2. If it has a dash, it's an old-style group ID (creator-timestamp)
  if (number.includes('-')) {
    const cleanGroup = number.replace(/[^\d-]/g, '');
    return `${cleanGroup}@g.us`;
  }

  // 3. Clean all non-numeric characters (e.g. + for phone numbers)
  const cleanNumber = number.replace(/\D/g, '');

  // 4. Heuristic for Group IDs vs Personal Numbers
  if (cleanNumber.length >= 16) {
    return `${cleanNumber}@g.us`;
  }

  // 5. Default to the standard WhatsApp user domain
  return number.endsWith('@s.whatsapp.net') || number.endsWith('@g.us')
    ? number
    : `${number}@s.whatsapp.net`;
}

/**
 * Normalizes a phone number for comparison.
 * Handles +49, 49, 0... formats.
 */
export function normalizeNumber(number) {
  if (!number) return '';
  // Remove all non-digits
  let digits = number.replace(/\D/g, '');

  // Handle local vs international formats by stripping leading zeros
  if (digits.startsWith('0') && !digits.startsWith('00')) {
    digits = digits.substring(1);
  }

  // Strip leading 00
  if (digits.startsWith('00')) {
    digits = digits.substring(2);
  }

  return digits;
}
