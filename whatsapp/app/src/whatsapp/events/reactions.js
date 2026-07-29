export function registerReactionListener(session) {
  session.sock.ev.on('messages.reaction', (reactions) => {
    for (const { key, reaction } of reactions) {
      const parentId = key.id;
      const stored = session.messageStore.get(parentId);
      if (!stored) continue;
      if (!stored._reactions) stored._reactions = [];
      const senderJid = key.participant || key.remoteJid || '';
      stored._reactions = stored._reactions.filter((r) => r.sender !== senderJid);
      if (reaction?.text) {
        stored._reactions.push({ emoji: reaction.text, sender: senderJid });
      }
    }
  });
}
