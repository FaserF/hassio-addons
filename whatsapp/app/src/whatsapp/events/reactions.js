import { syncWhatsAppReactionToTelegram } from '../telegram/listener.js';

export function registerReactionListener(session) {
  session.sock.ev.on('messages.reaction', (reactions) => {
    for (const { key, reaction } of reactions) {
      const parentId = key.id;
      const remoteJid = key.remoteJid || '';

      // Sync reaction to Telegram bridge
      syncWhatsAppReactionToTelegram(parentId, remoteJid, reaction?.text || '').catch(() => null);

      const stored = session.messageStore.get(parentId);
      if (!stored) continue;
      if (!stored._reactions) stored._reactions = [];

      let rawSender =
        key.participant || key.participantAlt || key.remoteJidAlt || key.remoteJid || '';
      if (key.fromMe) {
        const selfUser = session.sock?.user?.id;
        const selfPn = selfUser ? selfUser.split(':')[0] : session.stats?.my_number;
        if (selfPn) rawSender = `${selfPn}@s.whatsapp.net`;
      }
      const senderJid = rawSender.split(':')[0].replace(/@lid$/, '@s.whatsapp.net');

      stored._reactions = stored._reactions.filter((r) => {
        const existingSender = String(r.sender).split(':')[0].replace(/@lid$/, '@s.whatsapp.net');
        return existingSender !== senderJid && r.sender !== 'me';
      });

      if (reaction?.text) {
        stored._reactions.push({ emoji: reaction.text, sender: senderJid });
      }
    }
  });
}
