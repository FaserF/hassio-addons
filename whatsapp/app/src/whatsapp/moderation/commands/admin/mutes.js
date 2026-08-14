import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../../store.js';
import { reply } from '../../../actions.js';
import { isSameUser } from '../../../../utils/security.js';

export function parseDuration(str) {
  const match = str.match(/^(\d+)([dhms])$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { d: 86400, h: 3600, m: 60, s: 1 };
  return value * (multipliers[unit] || 0) * 1000;
}

export function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s >= 86400) return `${Math.floor(s / 86400)}d`;
  if (s >= 3600) return `${Math.floor(s / 3600)}h`;
  if (s >= 60) return `${Math.floor(s / 60)}m`;
  return `${s}s`;
}

export const pendingTempActions = new Map();

export function registerMuteCommands(registry) {
  registry.register(
    'mute',
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
        await reply(session, groupId, { text: '⚠️ You must mention a user or reply to their message to mute them.' }, rawMsg);
        return;
      }

      const reason = args.join(' ') || 'No reason provided';
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.muted_users) c.muted_users = {};

      const validTargets = [];
      for (const jid of targetMatches) {
        if (isSameUser(jid, userId, session)) {
          await reply(session, groupId, { text: `⚠️ You cannot mute yourself.` }, rawMsg);
          continue;
        }
        if (isSameUser(jid, session?.sock?.user?.id, session)) {
          await reply(session, groupId, { text: `⚠️ You cannot mute the bot account.` }, rawMsg);
          continue;
        }
        validTargets.push(jid);
      }
      if (validTargets.length === 0) return;

      for (const jid of validTargets) {
        const id = jid.split('@')[0];
        c.muted_users[id] = { until: null, reason, created: Date.now() };
      }
      saveModerationStore(store);

      await reply(
        session,
        groupId,
        {
          text: `🔇 Muted ${validTargets.length} user(s) indefinitely.\nReason: ${reason}\n\n_Their messages will be automatically deleted._`,
          mentions: validTargets,
        },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Mute a user (their messages will be deleted)' }
  );

  registry.register(
    'unmute',
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
        await reply(session, groupId, { text: '⚠️ You must mention a user or reply to their message to unmute them.' }, rawMsg);
        return;
      }

      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.muted_users) c.muted_users = {};

      let unmutedCount = 0;
      for (const jid of targetMatches) {
        const id = jid.split('@')[0];
        if (c.muted_users[id]) {
          delete c.muted_users[id];
          unmutedCount++;
        }
      }
      saveModerationStore(store);

      if (unmutedCount > 0) {
        await reply(session, groupId, { text: `🔊 Unmuted ${unmutedCount} user(s).`, mentions: targetMatches }, rawMsg);
      } else {
        await reply(session, groupId, { text: '❌ None of those users are muted.' }, rawMsg);
      }
    },
    { adminOnly: true, help: 'Unmute a muted user' }
  );

  registry.register(
    'tmute',
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
      if (targetMatches.length === 0 || args.length === 0) {
        await reply(
          session,
          groupId,
          { text: `⚠️ Usage: \`${config.commands.prefix}tmute <duration> [@user]\`\nExample: \`${config.commands.prefix}tmute 1h @user\`` },
          rawMsg
        );
        return;
      }

      const durationMs = parseDuration(args[0]);
      if (!durationMs) {
        await reply(session, groupId, { text: '❌ Invalid duration. Use format: 10s, 30m, 12h, 1d' }, rawMsg);
        return;
      }

      const reason = args.slice(1).join(' ') || 'Temporary mute';
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.muted_users) c.muted_users = {};

      const validTargets = [];
      for (const targetJid of targetMatches) {
        if (isSameUser(targetJid, userId, session)) {
          await reply(session, groupId, { text: `⚠️ You cannot mute yourself.` }, rawMsg);
          continue;
        }
        if (isSameUser(targetJid, session?.sock?.user?.id, session)) {
          await reply(session, groupId, { text: `⚠️ You cannot mute the bot account.` }, rawMsg);
          continue;
        }
        validTargets.push(targetJid);
      }
      if (validTargets.length === 0) return;

      const until = Date.now() + durationMs;
      for (const jid of validTargets) {
        const id = jid.split('@')[0];
        c.muted_users[id] = { until, reason, created: Date.now() };
      }
      saveModerationStore(store);

      for (const jid of validTargets) {
        const id = jid.split('@')[0];
        const key = `tmute:${groupId}:${id}`;
        if (pendingTempActions.has(key)) clearTimeout(pendingTempActions.get(key));

        const timeout = setTimeout(() => {
          pendingTempActions.delete(key);
          const st = loadModerationStore();
          const gc = st.groups[groupId];
          if (gc?.muted_users?.[id]) {
            delete gc.muted_users[id];
            saveModerationStore(st);
          }
          reply(session, groupId, { text: `🔊 Temporary mute for @${id} has expired.`, mentions: [jid] }, rawMsg);
        }, durationMs);
        if (timeout.unref) timeout.unref();
        pendingTempActions.set(key, timeout);
      }

      await reply(
        session,
        groupId,
        {
          text: `🔇 Temporarily muted for ${formatDuration(durationMs)}.\nReason: ${reason}\n\n_Their messages will be automatically deleted until the mute expires._`,
          mentions: targetMatches,
        },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Temporarily mute a user for a specific duration' }
  );

  registry.register(
    'tban',
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
      if (targetMatches.length === 0 || args.length === 0) {
        await reply(
          session,
          groupId,
          { text: `⚠️ Usage: \`${config.commands.prefix}tban <duration> [@user]\`\nExample: \`${config.commands.prefix}tban 1d @user\`\nDurations: 10s, 30m, 12h, 1d` },
          rawMsg
        );
        return;
      }

      const durationMs = parseDuration(args[0]);
      if (!durationMs) {
        await reply(session, groupId, { text: '❌ Invalid duration. Use format: 10s, 30m, 12h, 1d' }, rawMsg);
        return;
      }

      const reason = args.slice(1).join(' ') || 'Temporary ban';
      const validTargets = [];
      for (const targetJid of targetMatches) {
        if (isSameUser(targetJid, userId, session)) {
          await reply(session, groupId, { text: `⚠️ You cannot ban yourself.` }, rawMsg);
          continue;
        }
        if (isSameUser(targetJid, session?.sock?.user?.id, session)) {
          await reply(session, groupId, { text: `⚠️ You cannot ban the bot account.` }, rawMsg);
          continue;
        }
        validTargets.push(targetJid);
      }
      if (validTargets.length === 0) return;

      for (const targetJid of validTargets) {
        const targetId = targetJid.split('@')[0];
        const key = `tban:${groupId}:${targetId}`;
        if (pendingTempActions.has(key)) clearTimeout(pendingTempActions.get(key));

        const timeout = setTimeout(async () => {
          pendingTempActions.delete(key);
          await reply(
            session,
            groupId,
            {
              text: `⏰ Temporary ban for @${targetId} has expired (${formatDuration(durationMs)}). They may rejoin the group.`,
              mentions: [targetJid],
            },
            rawMsg
          );
        }, durationMs);
        if (timeout.unref) timeout.unref();
        pendingTempActions.set(key, timeout);
      }

      await reply(
        session,
        groupId,
        {
          text: `⏱️ Temporarily banned for ${formatDuration(durationMs)}.\nReason: ${reason}`,
          mentions: validTargets,
        },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Temporarily ban a user for a specific duration' }
  );
}
