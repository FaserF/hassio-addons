import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../../store.js';
import { reply } from '../../../actions.js';
import { logger } from '../../../../logger.js';
import { isSameUser } from '../../../../utils/security.js';
import { sendMissingAdminWarning } from '../../engine/penalties.js';
import { gt } from '../../engine/translations.js';

export function registerRoleCommands(registry) {
  registry.register(
    'promote',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      const targetMatches = [
        ...(rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []),
      ];
      if (
        targetMatches.length === 0 &&
        rawMsg.message?.extendedTextMessage?.contextInfo?.participant
      ) {
        targetMatches.push(rawMsg.message.extendedTextMessage.contextInfo.participant);
      }
      if (targetMatches.length === 0) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.promote_mention_required') },
          rawMsg
        );
        return;
      }
      const validTargets = [];
      for (const targetJid of targetMatches) {
        if (isSameUser(targetJid, userId, session)) {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.cannot_promote_self') },
            rawMsg
          );
          continue;
        }
        if (isSameUser(targetJid, session?.sock?.user?.id, session)) {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.cannot_promote_bot') },
            rawMsg
          );
          continue;
        }
        validTargets.push(targetJid);
      }

      if (validTargets.length === 0) return;

      try {
        await session.sock.groupParticipantsUpdate(groupId, validTargets, 'promote');
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.promote_success', { count: validTargets.length }),
            mentions: validTargets,
          },
          rawMsg
        );
      } catch (e) {
        const em = (e.message || '').toLowerCase();
        logger.warn({ error: e.message, groupId }, 'Failed to promote users');
        if (
          em.includes('not-authorized') ||
          em.includes('forbidden') ||
          em.includes('admin') ||
          em.includes('permission') ||
          em.includes('500') ||
          em.includes('internal-server-error')
        ) {
          await sendMissingAdminWarning(session, groupId, 'Promote users', rawMsg);
        } else {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.promote_failed', { error: e.message }) },
            rawMsg
          );
        }
      }
    },
    { adminOnly: true, help: 'Promote a user to Admin' }
  );

  registry.register(
    'demote',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      const targetMatches = [
        ...(rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []),
      ];
      if (
        targetMatches.length === 0 &&
        rawMsg.message?.extendedTextMessage?.contextInfo?.participant
      ) {
        targetMatches.push(rawMsg.message.extendedTextMessage.contextInfo.participant);
      }
      if (targetMatches.length === 0) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.demote_mention_required') },
          rawMsg
        );
        return;
      }

      const validTargets = [];
      for (const targetJid of targetMatches) {
        if (isSameUser(targetJid, userId, session)) {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.cannot_demote_self') },
            rawMsg
          );
          continue;
        }
        if (isSameUser(targetJid, session?.sock?.user?.id, session)) {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.cannot_demote_bot') },
            rawMsg
          );
          continue;
        }
        validTargets.push(targetJid);
      }

      if (validTargets.length === 0) return;

      try {
        await session.sock.groupParticipantsUpdate(groupId, validTargets, 'demote');
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.demote_success', { count: validTargets.length }),
            mentions: validTargets,
          },
          rawMsg
        );
      } catch (e) {
        const em = (e.message || '').toLowerCase();
        logger.warn({ error: e.message, groupId }, 'Failed to demote users');
        if (
          em.includes('not-authorized') ||
          em.includes('forbidden') ||
          em.includes('admin') ||
          em.includes('permission') ||
          em.includes('500') ||
          em.includes('internal-server-error')
        ) {
          await sendMissingAdminWarning(session, groupId, 'Demote users', rawMsg);
        } else {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.demote_failed', { error: e.message }) },
            rawMsg
          );
        }
      }
    },
    { adminOnly: true, help: 'Demote an Admin to regular user' }
  );

  registry.register(
    'approve',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      const targetMatches = [
        ...(rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []),
      ];
      if (
        targetMatches.length === 0 &&
        rawMsg.message?.extendedTextMessage?.contextInfo?.participant
      ) {
        targetMatches.push(rawMsg.message.extendedTextMessage.contextInfo.participant);
      }
      if (targetMatches.length === 0) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.approve_mention_required') },
          rawMsg
        );
        return;
      }
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.approved) c.approved = [];

      for (const jid of targetMatches) {
        const id = jid.split('@')[0];
        if (!c.approved.includes(id)) c.approved.push(id);
      }
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        {
          text: gt(config, 'bot_replies.approve_success', { count: targetMatches.length }),
          mentions: targetMatches,
        },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Whitelist a user from moderation locks' }
  );

  registry.register(
    'unapprove',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      const targetMatches = [
        ...(rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []),
      ];
      if (
        targetMatches.length === 0 &&
        rawMsg.message?.extendedTextMessage?.contextInfo?.participant
      ) {
        targetMatches.push(rawMsg.message.extendedTextMessage.contextInfo.participant);
      }
      if (targetMatches.length === 0) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.unapprove_mention_required') },
          rawMsg
        );
        return;
      }
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.approved) c.approved = [];

      for (const jid of targetMatches) {
        const id = jid.split('@')[0];
        c.approved = c.approved.filter((a) => a !== id);
      }
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        {
          text: gt(config, 'bot_replies.unapprove_success', { count: targetMatches.length }),
          mentions: targetMatches,
        },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Remove user from whitelist' }
  );
}
