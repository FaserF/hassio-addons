export function registerAckListener(session) {
  session.sock.ev.on('messages.update', (updates) => {
    for (const update of updates) {
      if (!update.key?.id) continue;
      const stored = session.messageStore.get(update.key.id);
      if (stored && update.update?.status != null) {
        stored._ack = update.update.status;
      }
    }
  });
}
