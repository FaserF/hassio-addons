export function registerPresenceListener(session) {
  session.sock.ev.on('presence.update', ({ id, presences }) => {
    if (!session._presenceStore) session._presenceStore = new Map();
    for (const [jid, presence] of Object.entries(presences)) {
      session._presenceStore.set(id, {
        jid,
        status: presence.lastKnownPresence,
        lastSeen: Date.now(),
      });
    }
  });
}
