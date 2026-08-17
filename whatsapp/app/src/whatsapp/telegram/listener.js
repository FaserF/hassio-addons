// Facade re-exporter for modularized Telegram bridge
export { formatHeader } from './headers.js';
export { syncWhatsAppGroupEventToTelegram } from './outbound/events.js';
export {
  syncWhatsAppDeleteToTelegram,
  syncWhatsAppPinToTelegram,
  syncWhatsAppUnpinAllToTelegram,
  syncTelegramDeleteToWhatsApp,
  syncWhatsAppEditToTelegram,
  syncWhatsAppReactionToTelegram,
  recentWaEditEvents,
  ignoreWaEditEchoes,
  ignoreTgEditEchoes,
} from './outbound/mutations.js';
export { syncWhatsAppToTelegram } from './outbound/messages.js';
export { processTelegramUpdates } from './inbound/processor.js';
export { startTelegramPolling, stopTelegramPolling } from './inbound/polling.js';
