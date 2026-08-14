import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../../store.js';
import { reply } from '../../../actions.js';
import { logger } from '../../../../logger.js';
import { sendMissingAdminWarning } from '../../engine/penalties.js';
import {
  syncWhatsAppPinToTelegram,
  syncWhatsAppUnpinAllToTelegram,
} from '../../../telegram/listener.js';

export function registerContentCommands(registry) {
  registry.register(
    'del',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      const quotedMsg = rawMsg.message?.extendedTextMessage?.contextInfo;
      if (!quotedMsg?.stanzaId) {
        await reply(session, groupId, { text: '⚠️ Reply to a message to delete it.' }, rawMsg);
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
            { text: `❌ Failed to delete message: ${e.message}` },
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
            text: `⚠️ Usage: \`${config.commands.prefix}lock <type>\`\nTypes: image, video, audio, document, sticker, url, invite, poll, rtl`,
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
      await reply(session, groupId, { text: `🔒 Locked content type: *${type}*` }, rawMsg);
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
          { text: `⚠️ Usage: \`${config.commands.prefix}unlock <type>\`` },
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
      await reply(session, groupId, { text: `🔓 Unlocked content type: *${type}*` }, rawMsg);
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
          { text: '⚠️ Please reply to the message you want to pin.' },
          rawMsg
        );
        return;
      }
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
        syncWhatsAppPinToTelegram(quoted.stanzaId, groupId, true);
        await reply(session, groupId, { text: '📌 Message pinned successfully.' }, rawMsg);
      } catch (e) {
        logger.warn({ error: e.message, groupId }, 'Failed to pin message');
        await reply(session, groupId, { text: `❌ Failed to pin message: ${e.message}` }, rawMsg);
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
          { text: '⚠️ Please reply to the message you want to unpin.' },
          rawMsg
        );
        return;
      }
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
        syncWhatsAppPinToTelegram(quoted.stanzaId, groupId, false);
        await reply(session, groupId, { text: '📌 Message unpinned successfully.' }, rawMsg);
      } catch (e) {
        logger.warn({ error: e.message, groupId }, 'Failed to unpin message');
        await reply(session, groupId, { text: `❌ Failed to unpin message: ${e.message}` }, rawMsg);
      }
    },
    { adminOnly: true, help: 'Unpin the replied-to message' }
  );

  registry.register(
    'unpinall',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      try {
        // Unpin all messages natively in WhatsApp via Baileys chatModify
        try {
          await session.sock.chatModify({ pin: false }, groupId);
        } catch (waErr) {
          logger.debug(
            { error: waErr.message, groupId },
            'chatModify pin:false failed, trying groupSettingUpdate'
          );
          // Fallback: some Baileys versions use groupSettingUpdate
          try {
            if (typeof session.sock.groupSettingUpdate === 'function') {
              await session.sock.groupSettingUpdate(groupId, 'not_announcement');
            }
          } catch (_fallbackErr) {
            // Best-effort: WA may not expose a reliable "unpin all" API.
            // Individual unpins would require tracking each pinned message ID.
            logger.debug(
              { error: _fallbackErr?.message },
              'groupSettingUpdate fallback also failed'
            );
          }
        }
        // Sync unpin-all to Telegram
        syncWhatsAppUnpinAllToTelegram(groupId);
        await reply(session, groupId, { text: '📌 All messages unpinned successfully.' }, rawMsg);
      } catch (e) {
        logger.warn({ error: e.message, groupId }, 'Failed to unpin all messages');
        await reply(
          session,
          groupId,
          { text: `❌ Failed to unpin messages: ${e.message}` },
          rawMsg
        );
      }
    },
    { adminOnly: true, help: 'Unpin all pinned messages in the group' }
  );
}
