import { loadTelegramStore } from '../store.js';
import { getTelegramBotClient } from '../bot.js';
import { getSession, sessions } from '../../../session.js';
import { resolveCanonicalUserKey, resolveUserDisplayName } from '../../../utils/security.js';
import { logger } from '../../../logger.js';

const recentTgSystemEvents = new Map();

export async function syncWhatsAppGroupEventToTelegram(
  waJid,
  groupName,
  action,
  participants = []
) {
  const store = loadTelegramStore();
  if (!store.enabled) return;

  let session = getSession('default');
  if (!session || !session.sock || !session.isConnected) {
    for (const s of sessions.values()) {
      if (s.sock && s.isConnected) {
        session = s;
        break;
      }
    }
  }

  const departureAction = action === 'remove' || action === 'leave' ? 'departure' : action;
  const canonicalParts = Array.from(
    new Set(
      participants.map((p) => {
        const rawUser = String(p).split('@')[0];
        return resolveCanonicalUserKey(p, session) || rawUser;
      })
    )
  ).sort();
  const partStr = canonicalParts.join(',');
  const eventKey = `tg_sys_evt:${waJid}:${departureAction}:${partStr}`;
  const now = Date.now();
  const lastTime = recentTgSystemEvents.get(eventKey) || 0;
  if (now - lastTime < 15000) {
    return; // Skip duplicate Telegram event within 15 seconds
  }
  recentTgSystemEvents.set(eventKey, now);
  if (recentTgSystemEvents.size > 100) {
    for (const [k, ts] of recentTgSystemEvents.entries()) {
      if (now - ts > 30000) recentTgSystemEvents.delete(k);
    }
  }

  const mappings = (store.mappings || []).filter(
    (m) =>
      m.enabled &&
      m.wa_jid === waJid &&
      m.sync_system_events !== false &&
      (m.sync_mode === 'bidirectional' || m.sync_mode === 'outbound')
  );

  // Resolve and deduplicate participants by canonical phone number to prevent duplicate LID/PN notices
  const seenUsers = new Set();
  const cleanNamesList = [];
  for (const p of participants) {
    const rawUser = String(p).split('@')[0];
    const canonical = resolveCanonicalUserKey(p, session) || rawUser;
    if (!seenUsers.has(canonical)) {
      seenUsers.add(canonical);
      const isLid =
        String(p).includes('@lid') || (canonical.length >= 14 && canonical.startsWith('1576'));
      const display = isLid
        ? session
          ? resolveUserDisplayName(p, session)
          : `@${canonical}`
        : canonical;
      cleanNamesList.push(display);
    }
  }

  if (cleanNamesList.length === 0) return;
  const partNames = cleanNamesList.join(', ');
  let eventText = '';
  if (action === 'add') {
    eventText = `👥 [System: ${partNames || 'Member'} joined WhatsApp group]`;
  } else if (action === 'leave' || action === 'remove') {
    eventText = `👥 [System: ${partNames || 'Member'} left WhatsApp group]`;
  } else if (action === 'promote') {
    eventText = `⭐ [System: ${partNames} was promoted to admin]`;
  } else if (action === 'demote') {
    eventText = `🔻 [System: ${partNames} was demoted from admin]`;
  }

  if (!eventText) return;

  for (const mapping of mappings) {
    const bot = getTelegramBotClient(mapping.bot_id);
    if (!bot) continue;
    try {
      const header = mapping.include_group_name && groupName ? `<b>[${groupName}]</b>:\n` : '';
      await bot.sendMessage(
        mapping.tg_chat_id,
        `${header}${eventText}`,
        null,
        mapping.tg_thread_id || null,
        Boolean(mapping.silent_delivery)
      );
    } catch (e) {
      logger.warn({ error: e.message }, '⚠️ Failed to sync WA group event to Telegram');
    }
  }
}
