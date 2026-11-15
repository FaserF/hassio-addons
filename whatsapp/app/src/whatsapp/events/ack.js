import { trackFailure } from '../actions.js';
import { logger } from '../../logger.js';

export function registerAckListener(session) {
  session.sock.ev.on('messages.update', (updates) => {
    for (const update of updates) {
      if (!update.key?.id) continue;
      const stored = session.messageStore?.get(update.key.id);
      if (stored && update.update?.status != null) {
        stored._ack = update.update.status;
      }
      if (update.update?.status === 0 || update.update?.status === 'ERROR') {
        const errCode = update.update?.messageStubParameters?.[0] || 'Unknown';
        logger.error(
          { msgId: update.key.id, jid: update.key.remoteJid, error: errCode },
          `❌ WhatsApp server rejected message with error: ${errCode}`
        );
        trackFailure(
          session,
          update.key.remoteJid || 'Unknown',
          `Message ${update.key.id}`,
          `Server rejection (${errCode})`
        );
      }
    }
  });
}
