import { syncWhatsAppReactionToTelegram } from '../telegram/listener.js';
import { triggerWebhook } from '../../webhook.js';

export function registerReactionListener(session) {
  session.sock.ev.on('messages.reaction', (reactions) => {
    for (const { key, reaction } of reactions) {
      const parentId = key.id;
      const remoteJid = key.remoteJid || '';

      // Sync reaction to Telegram bridge
      syncWhatsAppReactionToTelegram(parentId, remoteJid, reaction?.text || '').catch(() => null);

      let rawSender =
        key.participant || key.participantAlt || key.remoteJidAlt || key.remoteJid || '';
      if (key.fromMe) {
        const selfUser = session.sock?.user?.id;
        const selfPn = selfUser ? selfUser.split(':')[0] : session.stats?.my_number;
        if (selfPn) rawSender = `${selfPn}@s.whatsapp.net`;
      }
      const senderJid = rawSender.split(':')[0].replace(/@lid$/, '@s.whatsapp.net');

      // Forward to Home Assistant. `key` is the reacted message; the reaction itself
      // (and the reactor) is identified by `reaction.key`. `id` is the reaction's own
      // ID, not the reacted message's, otherwise the integration's loop guard would
      // drop reactions to messages that HA itself sent.
      const rKey = reaction?.key || {};
      const dedupeKey = rKey.id ? `reaction:${rKey.id}` : null;
      const isDuplicate = dedupeKey ? session.processedMessageIds?.has(dedupeKey) : false;
      if (dedupeKey) session.processedMessageIds?.set(dedupeKey, Date.now());
      if (remoteJid !== 'status@broadcast' && !isDuplicate) {
        const reactorFromMe = Boolean(rKey.fromMe);
        let reactorRaw =
          rKey.participant || rKey.participantAlt || rKey.remoteJidAlt || rKey.remoteJid || '';
        if (reactorFromMe) {
          const selfUser = session.sock?.user?.id;
          const selfPn = selfUser ? selfUser.split(':')[0] : session.stats?.my_number;
          if (selfPn) reactorRaw = `${selfPn}@s.whatsapp.net`;
        }
        const reactorJid = reactorRaw.split(':')[0].replace(/@lid$/, '@s.whatsapp.net');
        const event = {
          id: rKey.id,
          type: 'reaction',
          content: reaction?.text || '', // empty = reaction removed
          reaction: reaction?.text || '',
          reacted_message_id: parentId,
          sender: reactorJid,
          sender_number: reactorJid.split('@')[0],
          from: remoteJid,
          is_group: remoteJid.endsWith('@g.us'),
          from_me: reactorFromMe,
          raw: { key: { remoteJid, fromMe: reactorFromMe, participant: rKey.participant } },
          session_id: session.id,
        };
        session.eventQueue.push(event);
        triggerWebhook(event);
      }

      const stored = session.messageStore.get(parentId);
      if (!stored) continue;
      if (!stored._reactions) stored._reactions = [];

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
