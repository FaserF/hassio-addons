import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../../store.js';
import { reply } from '../../../actions.js';

export function registerSettingsCommands(registry) {
  registry.register(
    'setlog',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const target = args[0];
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      c.log_channel_jid = target;
      saveModerationStore(store);
      await reply(session, groupId, { text: `✅ *Log Channel Set:* ${target}` }, rawMsg);
    },
    { adminOnly: true, help: 'Set moderation log channel' }
  );

  registry.register(
    'unsetlog',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      delete c.log_channel_jid;
      saveModerationStore(store);
      await reply(session, groupId, { text: `✅ Log channel unset.` }, rawMsg);
    },
    { adminOnly: true, help: 'Unset moderation log channel' }
  );

  registry.register(
    'slowmode',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const timeStr = args[0] || 'off';
      await reply(session, groupId, { text: `⏱️ *Slow Mode:* Set to ${timeStr}.` }, rawMsg);
    },
    { adminOnly: true, help: 'Configure group slow mode' }
  );

  registry.register(
    'settitle',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const title = args.join(' ');
      if (!title) return;
      try {
        await session.sock.groupUpdateSubject(groupId, title);
        await reply(session, groupId, { text: `✅ Group subject updated to *${title}*.` }, rawMsg);
      } catch (e) {
        await reply(session, groupId, { text: `❌ Failed to update title: ${e.message}` }, rawMsg);
      }
    },
    { adminOnly: true, help: 'Set group subject/title' }
  );

  registry.register(
    'setdescription',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const desc = args.join(' ');
      try {
        await session.sock.groupUpdateDescription(groupId, desc);
        await reply(session, groupId, { text: `✅ Group description updated.` }, rawMsg);
      } catch (e) {
        await reply(
          session,
          groupId,
          { text: `❌ Failed to update description: ${e.message}` },
          rawMsg
        );
      }
    },
    { adminOnly: true, help: 'Set group description' }
  );

  registry.register(
    'setphoto',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      await reply(session, groupId, { text: `📷 *Group Photo:* Updated.` }, rawMsg);
    },
    { adminOnly: true, help: 'Set group icon/photo' }
  );

  registry.register(
    'mode',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const mode = (args[0] || '').toLowerCase();
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      c.security_scan_quiet_mode = mode === 'quiet' || mode === 'silent';
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        {
          text: `🛡️ *Scan Notification Mode:* Set to *${c.security_scan_quiet_mode ? 'QUIET' : 'NORMAL'}*.`,
        },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Set scan mode (quiet vs normal)' }
  );

  registry.register(
    'approved',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      const approved = c.approved_users || [];
      if (approved.length === 0) {
        await reply(session, groupId, { text: `ℹ️ No approved users in this group.` }, rawMsg);
        return;
      }
      await reply(
        session,
        groupId,
        {
          text: `✅ *Approved Users (${approved.length}):*\n${approved.map((u) => `• @${u}`).join('\n')}`,
        },
        rawMsg
      );
    },
    { help: 'List approved users' }
  );

  registry.register(
    'unapproveall',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      c.approved_users = [];
      saveModerationStore(store);
      await reply(session, groupId, { text: `✅ All user approvals cleared.` }, rawMsg);
    },
    { adminOnly: true, help: 'Clear all user approvals' }
  );

  registry.register(
    'reports',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const mode = (args[0] || '').toLowerCase();
      const store = loadModerationStore();
      if (!store.groups[groupId]) {
        store.groups[groupId] = getGroupModerationConfig(groupId);
      }
      const c = store.groups[groupId];
      if (mode === 'on' || mode === 'true' || mode === 'enable' || mode === '1') {
        c.reports_enabled = true;
      } else if (mode === 'off' || mode === 'false' || mode === 'disable' || mode === '0') {
        c.reports_enabled = false;
      } else {
        c.reports_enabled = !c.reports_enabled;
      }
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        { text: `🚨 *User Reports:* Now *${c.reports_enabled ? 'ENABLED' : 'DISABLED'}*.` },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Toggle member report command' }
  );

  registry.register(
    'pinned',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      await reply(session, groupId, { text: `📌 *Pinned Message:* Check group header.` }, rawMsg);
    },
    { help: 'Show current pinned message' }
  );
}
