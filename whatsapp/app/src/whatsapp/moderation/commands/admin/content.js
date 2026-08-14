import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../../store.js';
import { reply } from '../../../actions.js';
import { logger } from '../../../../logger.js';
import { sendMissingAdminWarning } from '../../engine/penalties.js';
import {
  syncWhatsAppPinToTelegram,
  syncWhatsAppUnpinAllToTelegram,
} from '../../../telegram/listener.js';
import { gt } from '../../engine/translations.js';

export const pinnedMessagesTracker = new Map(); // groupId -> Map of msgId -> { id, participant, fromMe }

export function trackPinnedMessage(groupId, waMsgId, participant = null, fromMe = false) {
  if (!groupId || !waMsgId) return;
  if (!pinnedMessagesTracker.has(groupId)) {
    pinnedMessagesTracker.set(groupId, new Map());
  }
  pinnedMessagesTracker.get(groupId).set(waMsgId, { id: waMsgId, participant, fromMe });
}

export function untrackPinnedMessage(groupId, waMsgId) {
  if (!groupId || !waMsgId) return;
  if (pinnedMessagesTracker.has(groupId)) {
    pinnedMessagesTracker.get(groupId).delete(waMsgId);
  }
}

export function registerContentCommands(registry) {
  registry.register(
    'del',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      const quotedMsg = rawMsg.message?.extendedTextMessage?.contextInfo;
      if (!quotedMsg?.stanzaId) {
        await reply(session, groupId, { text: gt(config, 'bot_replies.delete_reply_required') }, rawMsg);
        return;
      }
      try {
        await session.sock.sendMessage(groupId, {
          delete: {
            remoteJid: groupId,
            fromMe: false,
            id: quotedMsg.stanzaId,
            participant: quotedMsg.participant,
          },
        });
        if (rawMsg.key) {
          await session.sock.sendMessage(groupId, { delete: rawMsg.key });
        }
      } catch (e) {
        const em = (e.message || '').toLowerCase();
        logger.warn({ error: e.message, groupId }, 'Failed to delete message');
        if (
          em.includes('not-authorized') ||
          em.includes('forbidden') ||
          em.includes('admin') ||
          em.includes('permission')
        ) {
          await sendMissingAdminWarning(session, groupId, 'Delete message', rawMsg);
        } else {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.delete_failed', { error: e.message }) },
            rawMsg
          );
        }
      }
    },
    { adminOnly: true, aliases: ['delete'], help: 'Delete a replied-to message' }
  );

  registry.register(
    'lock',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      if (args.length === 0) {
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.usage_lock', { prefix: config.commands.prefix }),
          },
          rawMsg
        );
        return;
      }
      const type = args[0].toLowerCase();
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.locks) c.locks = {};
      if (!c.locks[type]) c.locks[type] = { enabled: true, action: 'delete' };
      c.locks[type].enabled = true;
      saveModerationStore(store);
      await reply(session, groupId, { text: gt(config, 'bot_replies.type_locked', { type }) }, rawMsg);
    },
    { adminOnly: true, help: 'Lock a content type (e.g. url, image, sticker, invite, poll)' }
  );

  registry.register(
    'unlock',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      if (args.length === 0) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.usage_unlock', { prefix: config.commands.prefix }) },
          rawMsg
        );
        return;
      }
      const type = args[0].toLowerCase();
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (c.locks && c.locks[type]) {
        c.locks[type].enabled = false;
        saveModerationStore(store);
      }
      await reply(session, groupId, { text: gt(config, 'bot_replies.type_unlocked', { type }) }, rawMsg);
    },
    { adminOnly: true, help: 'Unlock a content type' }
  );

  registry.register(
    'pin',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      const quoted = rawMsg.message?.extendedTextMessage?.contextInfo;
      if (!quoted?.stanzaId) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.pin_reply_required') },
          rawMsg
        );
        return;
      }
      try {
        const pinKey = {
          remoteJid: groupId,
          id: quoted.stanzaId,
          fromMe: quoted.participant ? false : true,
          participant: quoted.participant,
        };
        await session.sock.sendMessage(groupId, {
          pin: pinKey,
          type: 1,
          time: 604800,
        });
        trackPinnedMessage(groupId, quoted.stanzaId, quoted.participant, quoted.participant ? false : true);
        syncWhatsAppPinToTelegram(quoted.stanzaId, groupId, true);
        await reply(session, groupId, { text: gt(config, 'bot_replies.pin_success') }, rawMsg);
      } catch (e) {
        try {
          await session.sock.sendMessage(groupId, {
            pin: {
              key: {
                remoteJid: groupId,
                id: quoted.stanzaId,
                fromMe: quoted.participant ? false : true,
                participant: quoted.participant,
              },
              type: 1,
              time: 604800,
            },
          });
          trackPinnedMessage(groupId, quoted.stanzaId, quoted.participant, quoted.participant ? false : true);
          syncWhatsAppPinToTelegram(quoted.stanzaId, groupId, true);
          await reply(session, groupId, { text: gt(config, 'bot_replies.pin_success') }, rawMsg);
        } catch (e2) {
          logger.warn({ error: e2.message, groupId }, 'Failed to pin message');
          await reply(session, groupId, { text: gt(config, 'bot_replies.pin_failed', { error: e2.message }) }, rawMsg);
        }
      }
    },
    { adminOnly: true, help: 'Pin the replied-to message' }
  );

  registry.register(
    'unpin',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      const quoted = rawMsg.message?.extendedTextMessage?.contextInfo;
      if (!quoted?.stanzaId) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.unpin_reply_required') },
          rawMsg
        );
        return;
      }
      try {
        const pinKey = {
          remoteJid: groupId,
          id: quoted.stanzaId,
          fromMe: quoted.participant ? false : true,
          participant: quoted.participant,
        };
        await session.sock.sendMessage(groupId, {
          pin: pinKey,
          type: 0,
          time: 0,
        });
        untrackPinnedMessage(groupId, quoted.stanzaId);
        syncWhatsAppPinToTelegram(quoted.stanzaId, groupId, false);
        await reply(session, groupId, { text: gt(config, 'bot_replies.unpin_success') }, rawMsg);
      } catch (e) {
        try {
          await session.sock.sendMessage(groupId, {
            pin: {
              key: {
                remoteJid: groupId,
                id: quoted.stanzaId,
                fromMe: quoted.participant ? false : true,
                participant: quoted.participant,
              },
              type: 0,
              time: 0,
            },
          });
          untrackPinnedMessage(groupId, quoted.stanzaId);
          syncWhatsAppPinToTelegram(quoted.stanzaId, groupId, false);
          await reply(session, groupId, { text: gt(config, 'bot_replies.unpin_success') }, rawMsg);
        } catch (e2) {
          logger.warn({ error: e2.message, groupId }, 'Failed to unpin message');
          await reply(session, groupId, { text: gt(config, 'bot_replies.unpin_failed', { error: e2.message }) }, rawMsg);
        }
      }
    },
    { adminOnly: true, help: 'Unpin the replied-to message' }
  );

  registry.register(
    'unpinall',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      try {
        let unpinnedCount = 0;
        const tracked = pinnedMessagesTracker.get(groupId);
        if (tracked && tracked.size > 0) {
          for (const [msgId, item] of Array.from(tracked.entries())) {
            try {
              const pinKey = {
                remoteJid: groupId,
                id: item.id || msgId,
                fromMe: Boolean(item.fromMe),
                ...(item.participant ? { participant: item.participant } : {}),
              };
              await session.sock.sendMessage(groupId, {
                pin: pinKey,
                type: 0,
                time: 0,
              });
              unpinnedCount++;
            } catch (err) {
              try {
                await session.sock.sendMessage(groupId, {
                  pin: {
                    key: {
                      remoteJid: groupId,
                      id: item.id || msgId,
                      fromMe: Boolean(item.fromMe),
                      ...(item.participant ? { participant: item.participant } : {}),
                    },
                    type: 0,
                    time: 0,
                  },
                });
                unpinnedCount++;
              } catch (_e) {}
            }
          }
          tracked.clear();
        }

        // Also attempt chatModify pin: false and groupSettingUpdate
        try {
          await session.sock.chatModify({ pin: false }, groupId);
        } catch (_waErr) {
          try {
            if (typeof session.sock.groupSettingUpdate === 'function') {
              await session.sock.groupSettingUpdate(groupId, 'not_announcement');
            }
          } catch (_fallbackErr) {}
        }

        // Sync unpin-all to Telegram
        syncWhatsAppUnpinAllToTelegram(groupId);
        await reply(
          session,
          groupId,
          {
            text:
              unpinnedCount > 0
                ? gt(config, 'bot_replies.unpinall_success_count', { count: unpinnedCount })
                : gt(config, 'bot_replies.unpinall_success'),
          },
          rawMsg
        );
      } catch (e) {
        logger.warn({ error: e.message, groupId }, 'Failed to unpin all messages');
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.unpinall_failed', { error: e.message }) },
          rawMsg
        );
      }
    },
    { adminOnly: true, help: 'Unpin all pinned messages in the group' }
  );
}
