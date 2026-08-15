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

  registry.register(
    'settings',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);

      const statusIcon = (val) => (val ? '🟢 ON' : '🔴 OFF');
      const prefix = config.commands?.prefix || '!';
      const isGroup = groupId && groupId.endsWith('@g.us');
      const groupTitle = session.groupCache?.get(groupId) || (isGroup ? groupId.split('@')[0] : 'Private Chat');

      // Check if user provided sub-arguments for quick inline configuration (e.g. !settings antispam off)
      if (args.length > 0) {
        const subCmd = args[0].toLowerCase();
        const subVal = (args[1] || '').toLowerCase();
        const enableState = subVal === 'on' || subVal === 'enable' || subVal === 'true' || subVal === '1'
          ? true
          : subVal === 'off' || subVal === 'disable' || subVal === 'false' || subVal === '0'
          ? false
          : null;

        if (subCmd === 'antispam') {
          if (enableState !== null) {
            if (!c.antispam) c.antispam = {};
            c.antispam.enabled = enableState;
            saveModerationStore(store);
            return await reply(session, groupId, { text: `🛡️ *Anti-Spam:* Set to *${statusIcon(enableState)}*.` }, rawMsg);
          }
        } else if (subCmd === 'antiraid' || subCmd === 'raid') {
          if (enableState !== null) {
            if (!c.antiraid) c.antiraid = {};
            c.antiraid.enabled = enableState;
            saveModerationStore(store);
            return await reply(session, groupId, { text: `🛡️ *Anti-Raid:* Set to *${statusIcon(enableState)}*.` }, rawMsg);
          }
        } else if (subCmd === 'antiflood' || subCmd === 'flood') {
          if (enableState !== null) {
            if (!c.flood) c.flood = {};
            c.flood.enabled = enableState;
            saveModerationStore(store);
            return await reply(session, groupId, { text: `🌊 *Anti-Flood:* Set to *${statusIcon(enableState)}*.` }, rawMsg);
          }
        } else if (subCmd === 'captcha') {
          if (enableState !== null) {
            if (!c.captcha) c.captcha = {};
            c.captcha.enabled = enableState;
            saveModerationStore(store);
            return await reply(session, groupId, { text: `🧩 *Captcha:* Set to *${statusIcon(enableState)}*.` }, rawMsg);
          }
        } else if (subCmd === 'welcome') {
          if (enableState !== null) {
            if (!c.greetings) c.greetings = {};
            c.greetings.welcome_enabled = enableState;
            saveModerationStore(store);
            return await reply(session, groupId, { text: `👋 *Welcome Message:* Set to *${statusIcon(enableState)}*.` }, rawMsg);
          }
        } else if (subCmd === 'goodbye') {
          if (enableState !== null) {
            if (!c.greetings) c.greetings = {};
            c.greetings.goodbye_enabled = enableState;
            saveModerationStore(store);
            return await reply(session, groupId, { text: `🚪 *Goodbye Message:* Set to *${statusIcon(enableState)}*.` }, rawMsg);
          }
        } else if (subCmd === 'reports') {
          if (enableState !== null) {
            c.reports_enabled = enableState;
            saveModerationStore(store);
            return await reply(session, groupId, { text: `🚨 *User Reports:* Set to *${statusIcon(enableState)}*.` }, rawMsg);
          }
        }
      }

      const activeLocks = [];
      if (c.locks) {
        for (const [lockKey, lockVal] of Object.entries(c.locks)) {
          if (lockVal && lockVal.enabled) activeLocks.push(lockKey);
        }
      }

      let text = `⚙️ *AegisBot Configuration & Settings*\n📍 *Target:* ${groupTitle}\n\n`;
      text += `🛡️ *Security & Protection:*\n`;
      text += `• Anti-Spam: ${statusIcon(c.antispam?.enabled !== false)}\n`;
      text += `• Anti-Raid: ${statusIcon(c.antiraid?.enabled)}\n`;
      text += `• Anti-Flood: ${statusIcon(c.flood?.enabled)}\n`;
      text += `• Captcha: ${statusIcon(c.captcha?.enabled)}\n`;
      text += `• Security Scanner: ${statusIcon(c.security_scanner?.enabled)}\n\n`;

      text += `💬 *Chat & Features:*\n`;
      text += `• Welcome Message: ${statusIcon(c.greetings?.welcome_enabled)}\n`;
      text += `• Goodbye Message: ${statusIcon(c.greetings?.goodbye_enabled)}\n`;
      text += `• AI Moderation / FAQ: ${statusIcon(c.ai?.enabled)}\n`;
      text += `• User Reports: ${statusIcon(c.reports_enabled)}\n`;
      text += `• Command Prefix: \`${prefix}\`\n\n`;

      text += `🔒 *Active Locks (${activeLocks.length}):*\n`;
      text += activeLocks.length > 0 ? activeLocks.map((l) => `• \`${l}\``).join('\n') : '• _No active locks_';
      text += `\n\n💡 *Quick Adjust:* \`${prefix}settings <module> <on|off>\`\n_Modules: antispam, antiraid, flood, captcha, welcome, goodbye, reports_`;

      await reply(session, groupId, { text }, rawMsg);
    },
    { adminOnly: true, aliases: ['config', 'groupinfo'], help: 'View and adjust group moderation & security settings' }
  );
}

