import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../../store.js';
import { executePenalty, issueUserWarning } from '../../engine/penalties.js';
import { reply } from '../../../actions.js';
import { isSameUser } from '../../../../utils/security.js';

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
          { text: `⚠️ You must mention a user or reply to their message to warn them.` },
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
            { text: `⚠️ You cannot issue a warning to yourself.` },
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
            { text: `⚠️ Cannot issue warnings to WhatsApp group administrators.` },
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
          { text: `⚠️ You must mention a user or reply to their message to unwarn them.` },
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
            { text: `✅ Cleared warnings for @${targetId}`, mentions: [targetJid] },
            rawMsg
          );
        } else {
          await reply(
            session,
            groupId,
            { text: `ℹ️ User @${targetId} has no warnings.`, mentions: [targetJid] },
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
          { text: `⚠️ You must mention a user or reply to their message to check their warnings.` },
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
              text: `⚠️ @${targetId} has ${warns.length} warning(s):\n${wList}`,
              mentions: [targetJid],
            },
            rawMsg
          );
        } else {
          await reply(
            session,
            groupId,
            { text: `✅ User @${targetId} has 0 warnings.`, mentions: [targetJid] },
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
          { text: `⚠️ You must mention a user or reply to their message to kick them.` },
          rawMsg
        );
        return;
      }
      const reason = args.join(' ') || 'Admin requested kick';
      for (const targetJid of targetMatches) {
        if (isSameUser(targetJid, userId, session)) {
          await reply(session, groupId, { text: `⚠️ You cannot kick yourself.` }, rawMsg);
          continue;
        }
        if (isSameUser(targetJid, session?.sock?.user?.id, session)) {
          await reply(session, groupId, { text: `⚠️ You cannot kick the bot account.` }, rawMsg);
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
          { text: `⚠️ You must mention a user or reply to their message to ban them.` },
          rawMsg
        );
        return;
      }
      const reason = args.join(' ') || 'Admin requested ban';
      for (const targetJid of targetMatches) {
        if (isSameUser(targetJid, userId, session)) {
          await reply(session, groupId, { text: `⚠️ You cannot ban yourself.` }, rawMsg);
          continue;
        }
        if (isSameUser(targetJid, session?.sock?.user?.id, session)) {
          await reply(session, groupId, { text: `⚠️ You cannot ban the bot account.` }, rawMsg);
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
            text: `⚠️ You must mention a user, reply to their message, or specify their number (e.g. \`${config.commands.prefix}unban 49176...\`) to unban them.`,
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
              text: `✅ Unbanned @${targetId}. They may now rejoin the group.`,
              mentions: [targetJid],
            },
            rawMsg
          );
        } else {
          await reply(
            session,
            groupId,
            { text: `⚠️ User @${targetId} is not banned in this group.`, mentions: [targetJid] },
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
            text: `⚠️ You must mention a user, reply to their message, or specify their number to clear kick log.`,
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
          { text: `✅ Cleared kick log entries for @${targetId}.`, mentions: [targetJid] },
          rawMsg
        );
      }
      store.groups[groupId] = c;
      saveModerationStore(store);
    },
    { adminOnly: true, help: 'Clear kick history entries for a user' }
  );
}
