import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../../store.js';
import { reply } from '../../../actions.js';
import { logger } from '../../../../logger.js';
import { isSameUser } from '../../../../utils/security.js';
import { sendMissingAdminWarning } from '../../engine/penalties.js';

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
          { text: `⚠️ You must mention a user or reply to their message to promote them.` },
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
            {
              text: `⚠️ *Security Restriction:* You cannot promote yourself. Only existing Group Admins can promote other members.`,
            },
            rawMsg
          );
          continue;
        }
        if (isSameUser(targetJid, session?.sock?.user?.id, session)) {
          await reply(
            session,
            groupId,
            {
              text: `⚠️ *Security Restriction:* The bot account cannot be promoted or demoted via chat commands. Please use WhatsApp Group Info settings to change bot admin permissions.`,
            },
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
            text: `✅ Promoted ${validTargets.length} user(s) to Admin.`,
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
            { text: `❌ Failed to promote user(s): ${e.message}` },
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
          { text: `⚠️ You must mention a user or reply to their message to demote them.` },
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
            { text: `⚠️ *Security Restriction:* You cannot demote yourself.` },
            rawMsg
          );
          continue;
        }
        if (isSameUser(targetJid, session?.sock?.user?.id, session)) {
          await reply(
            session,
            groupId,
            {
              text: `⚠️ *Security Restriction:* The bot account cannot be demoted via chat commands. Please use WhatsApp Group Info settings to change bot admin permissions.`,
            },
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
            text: `✅ Demoted ${validTargets.length} user(s) from Admin.`,
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
            { text: `❌ Failed to demote user(s): ${e.message}` },
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
          { text: `⚠️ You must mention a user to approve them.` },
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
          text: `✅ Approved ${targetMatches.length} user(s). They will bypass moderation locks.`,
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
          { text: `⚠️ You must mention a user to unapprove them.` },
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
          text: `✅ Removed approval for ${targetMatches.length} user(s).`,
          mentions: targetMatches,
        },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Remove user from whitelist' }
  );
}
