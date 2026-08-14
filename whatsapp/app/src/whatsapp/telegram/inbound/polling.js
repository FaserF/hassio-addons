import { processTelegramUpdates } from './processor.js';

let pollingTimer = null;

export function startTelegramPolling(intervalMs = 3000) {
  if (pollingTimer) clearInterval(pollingTimer);
  pollingTimer = setInterval(processTelegramUpdates, intervalMs);
}

export function stopTelegramPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}
