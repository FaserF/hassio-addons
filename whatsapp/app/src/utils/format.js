/**
 * Formats a duration in ms to a human readable string (e.g. 1d 2h 3m 4s)
 */
export function formatDuration(ms) {
  if (!ms) return 'unknown';
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

/**
 * Formats a date into HA-friendly string (consistent across environments)
 * Format: YYYY-MM-DD, HH:mm:ss
 */
export function formatHATime(date) {
  if (!date) return 'Unknown';
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');

  const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timePart = `${pad(d.getHours())}:${pad(pad(d.getMinutes()))}:${pad(d.getSeconds())}`;

  return `${datePart}, ${timePart}`;
}
