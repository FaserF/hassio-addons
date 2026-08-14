import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../../store.js';
import { executePenalty, issueUserWarning } from '../../engine/penalties.js';
import { reply } from '../../../actions.js';
import { isSameUser } from '../../../../utils/security.js';
import { gt } from '../../engine/translations.js';

export function registerPunishmentCommands(registry) {
  registry.register(
    'warn',
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
          { text: gt(config, 'bot_replies.warn_mention_required') },
          rawMsg
        );
        return;
      }
      const cleanedArgs = args.filter((a) => !a.startsWith('@'));
      const reason = cleanedArgs.join(' ').trim() || 'No reason provided';

      for (const targetJid of targetMatches) {
        if (isSameUser(targetJid, userId, session)) {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.cannot_warn_self') },
            rawMsg
          );
          continue;
        }
        let isTargetGroupAdmin = false;
        if (session?.sock?.groupMetadata) {
          try {
            const meta = await session.sock.groupMetadata(groupId);
            const tDigits = targetJid.split('@')[0].replace(/\D/g, '');
            const p = meta?.participants?.find((part) => {
              const pid = part.id ? part.id.split('@')[0].replace(/\D/g, '') : '';
              return pid === tDigits || part.id === targetJid;
            });
            if (p && (p.admin === 'admin' || p.admin === 'superadmin')) {
              isTargetGroupAdmin = true;
            }
          } catch (_e) {}
        }
        if (isTargetGroupAdmin) {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.cannot_warn_admin') },
            rawMsg
          );
          continue;
        }
        const targetId = targetJid.split('@')[0];
        await issueUserWarning(session, groupId, targetId, reason, rawMsg);
      }
    },
    { adminOnly: true, help: 'Issue a warning to a user (mention or reply)' }
  );

  registry.register(
    'unwarn',
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
          { text: gt(config, 'bot_replies.unwarn_mention_required') },
          rawMsg
        );
        return;
      }
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);

      for (const targetJid of targetMatches) {
        const targetId = targetJid.split('@')[0];
        if (c.warnings?.user_warns?.[targetId]) {
          c.warnings.user_warns[targetId] = [];
          await reply(
            session,
            groupId,
            {
              text: gt(config, 'bot_replies.warnings_cleared', { user: targetId }),
              mentions: [targetJid],
            },
            rawMsg
          );
        } else {
          await reply(
            session,
            groupId,
            {
              text: gt(config, 'bot_replies.user_no_warnings', { user: targetId }),
              mentions: [targetJid],
            },
            rawMsg
          );
        }
      }
      saveModerationStore(store);
    },
    { adminOnly: true, help: 'Clear all warnings for a user' }
  );

  registry.register(
    'warns',
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
          { text: gt(config, 'bot_replies.warns_mention_required') },
          rawMsg
        );
        return;
      }
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);

      for (const targetJid of targetMatches) {
        const targetId = targetJid.split('@')[0];
        const warns = c.warnings?.user_warns?.[targetId] || [];
        if (warns.length > 0) {
          const wList = warns
            .map((w, i) => `${i + 1}. ${w.reason} (${new Date(w.timestamp).toLocaleString()})`)
            .join('\n');
          await reply(
            session,
            groupId,
            {
              text: gt(config, 'bot_replies.user_warnings_list', {
                user: targetId,
                count: warns.length,
                list: wList,
              }),
              mentions: [targetJid],
            },
            rawMsg
          );
        } else {
          await reply(
            session,
            groupId,
            {
              text: gt(config, 'bot_replies.user_zero_warnings', { user: targetId }),
              mentions: [targetJid],
            },
            rawMsg
          );
        }
      }
    },
    { adminOnly: true, help: 'Check warnings for a user' }
  );

  registry.register(
    'kick',
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
          { text: gt(config, 'bot_replies.kick_mention_required') },
          rawMsg
        );
        return;
      }
      const reason = args.join(' ') || 'Admin requested kick';
      for (const targetJid of targetMatches) {
        if (isSameUser(targetJid, userId, session)) {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.cannot_kick_self') },
            rawMsg
          );
          continue;
        }
        if (isSameUser(targetJid, session?.sock?.user?.id, session)) {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.cannot_kick_bot') },
            rawMsg
          );
          continue;
        }
        const targetId = targetJid.split('@')[0];
        await executePenalty(session, groupId, targetId, 'kick', reason, rawMsg);
      }
    },
    { adminOnly: true, help: 'Kick a user from the group (they can rejoin via invite link)' }
  );

  registry.register(
    'ban',
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
          { text: gt(config, 'bot_replies.ban_mention_required') },
          rawMsg
        );
        return;
      }
      const reason = args.join(' ') || 'Admin requested ban';
      for (const targetJid of targetMatches) {
        if (isSameUser(targetJid, userId, session)) {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.cannot_ban_self') },
            rawMsg
          );
          continue;
        }
        if (isSameUser(targetJid, session?.sock?.user?.id, session)) {
          await reply(session, groupId, { text: gt(config, 'bot_replies.cannot_ban_bot') }, rawMsg);
          continue;
        }
        const targetId = targetJid.split('@')[0];
        await executePenalty(session, groupId, targetId, 'ban', reason, rawMsg);
      }
    },
    { adminOnly: true, help: 'Permanently ban a user (they will be auto-kicked if they rejoin)' }
  );

  registry.register(
    'unban',
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
      if (targetMatches.length === 0 && args.length > 0) {
        const clean = args[0].replace(/\D/g, '');
        if (clean) targetMatches.push(`${clean}@s.whatsapp.net`);
      }
      if (targetMatches.length === 0) {
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.unban_mention_required', {
              prefix: config.commands.prefix,
            }),
          },
          rawMsg
        );
        return;
      }
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);

      for (const targetJid of targetMatches) {
        const targetId = targetJid.split('@')[0];
        if (c.banned_users && c.banned_users[targetId]) {
          delete c.banned_users[targetId];
          await reply(
            session,
            groupId,
            {
              text: gt(config, 'bot_replies.unbanned_user', { user: targetId }),
              mentions: [targetJid],
            },
            rawMsg
          );
        } else {
          await reply(
            session,
            groupId,
            {
              text: gt(config, 'bot_replies.user_not_banned', { user: targetId }),
              mentions: [targetJid],
            },
            rawMsg
          );
        }
      }
      store.groups[groupId] = c;
      saveModerationStore(store);
    },
    { adminOnly: true, help: 'Unban a user so they can rejoin' }
  );

  registry.register(
    'unkick',
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
      if (targetMatches.length === 0 && args.length > 0) {
        const clean = args[0].replace(/\D/g, '');
        if (clean) targetMatches.push(`${clean}@s.whatsapp.net`);
      }
      if (targetMatches.length === 0) {
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.unkick_mention_required'),
          },
          rawMsg
        );
        return;
      }
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);

      for (const targetJid of targetMatches) {
        const targetId = targetJid.split('@')[0];
        if (Array.isArray(c.kick_log)) {
          c.kick_log = c.kick_log.filter((k) => k.userId !== targetId);
        }
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.kick_log_cleared', { user: targetId }),
            mentions: [targetJid],
          },
          rawMsg
        );
      }
      store.groups[groupId] = c;
      saveModerationStore(store);
    },
    { adminOnly: true, help: 'Clear kick history entries for a user' }
  );
}
