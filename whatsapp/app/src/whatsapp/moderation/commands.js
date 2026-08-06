import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from './store.js';
import { executePenalty, issueUserWarning, sendMissingAdminWarning } from './engine.js';
import { reply } from '../actions.js';
import { logger } from '../../logger.js';
import { processAiModeration } from './ai.js';
import { isSameUser, isAdmin, normalizeJid } from '../../utils/security.js';

class CommandRegistry {
  constructor() {
    this.commands = {};
  }

  register(cmd, handler, options = {}) {
    this.commands[cmd] = {
      handler,
      adminOnly: options.adminOnly || false,
      help: options.help || 'No description available.',
      aliases: options.aliases || [],
    };

    if (options.aliases) {
      options.aliases.forEach((alias) => {
        this.commands[alias] = this.commands[cmd];
      });
    }
  }

  getCommand(cmdStr) {
    return this.commands[cmdStr];
  }
}

export const registry = new CommandRegistry();

registry.register(
  'setrules',
  async (session, groupId, userId, args, config) => {
    const text = args.join(' ');
    if (!text) {
      await reply(session, groupId, {
        text: `⚠️ Usage: \`${config.commands.prefix}setrules <text>\``,
      });
      return;
    }
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.rules) c.rules = {};
    c.rules.text = text;
    saveModerationStore(store);
    await reply(session, groupId, { text: '✅ Group rules updated.' });
  },
  { adminOnly: true, help: 'Set the group rules' }
);

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
      await reply(session, groupId, {
        text: `⚠️ You must mention a user or reply to their message to promote them.`,
      });
      return;
    }
    try {
      await session.sock.groupParticipantsUpdate(groupId, targetMatches, 'promote');
      await reply(session, groupId, {
        text: `✅ Promoted ${targetMatches.length} user(s) to Admin.`,
        mentions: targetMatches,
      });
    } catch (e) {
      await sendMissingAdminWarning(session, groupId, 'Promote users');
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
      await reply(session, groupId, {
        text: `⚠️ You must mention a user or reply to their message to demote them.`,
      });
      return;
    }
    try {
      await session.sock.groupParticipantsUpdate(groupId, targetMatches, 'demote');
      await reply(session, groupId, {
        text: `✅ Demoted ${targetMatches.length} user(s) from Admin.`,
        mentions: targetMatches,
      });
    } catch (e) {
      await sendMissingAdminWarning(session, groupId, 'Demote users');
    }
  },
  { adminOnly: true, help: 'Demote an Admin to regular user' }
);

registry.register(
  'report',
  async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
    let groupMeta;
    try {
      groupMeta = await session.sock.groupMetadata(groupId);
    } catch (e) {
      logger.error(
        { error: e.message, groupId },
        'Failed to fetch group metadata for report command'
      );
    }

    const adminParticipants = (groupMeta?.participants || []).filter(
      (p) => p.admin === 'admin' || p.admin === 'superadmin'
    );
    const admins = adminParticipants.map((p) => p.id);

    // Identify target user if mentioned or replied
    const targetMatches = [
      ...(rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []),
    ];
    if (
      targetMatches.length === 0 &&
      rawMsg.message?.extendedTextMessage?.contextInfo?.participant
    ) {
      targetMatches.push(rawMsg.message.extendedTextMessage.contextInfo.participant);
    }

    const targetJid = targetMatches.length > 0 ? targetMatches[0] : null;
    const targetId = targetJid ? targetJid.split('@')[0].replace(/\D/g, '') : null;
    const cleanUserId = userId ? userId.split('@')[0].replace(/\D/g, '') : null;

    if (targetId && cleanUserId && targetId === cleanUserId) {
      await reply(session, groupId, {
        text: `⚠️ You cannot report yourself.`,
      });
      return;
    }

    if (targetJid && isSameUser(targetJid, session?.sock?.user?.id, session)) {
      await reply(session, groupId, {
        text: `⚠️ You cannot report the bot account.`,
      });
      return;
    }

    // Filter out args that are mention tokens (e.g. @4917647365403)
    const cleanedArgs = args.filter((a) => !a.startsWith('@'));
    const text = cleanedArgs.join(' ').trim();
    const reasonText = text ? text : 'No reason provided';

    // Store report in moderation store
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!Array.isArray(c.reports)) c.reports = [];

    const reportItem = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      reporter_id: userId,
      target_id: targetId || null,
      reason: reasonText,
      timestamp: Date.now(),
      status: 'open',
    };
    c.reports.push(reportItem);
    store.groups[groupId] = c;
    saveModerationStore(store);

    // 1. Group response
    let quotedMsg = undefined;
    if (rawMsg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
      quotedMsg = rawMsg;
    }

    const targetMentionStr = targetId ? ` against @${targetId}` : '';
    await reply(
      session,
      groupId,
      {
        text: `🚨 *Report from @${userId}*${targetMentionStr}\nAdmins requested.\nReason: ${reasonText}`,
        mentions: [userId + '@s.whatsapp.net', ...(targetJid ? [targetJid] : []), ...admins],
      },
      quotedMsg
    );

    // 2. Private direct message to admins
    const groupSubject = groupMeta?.subject || groupId.split('@')[0];
    const dmText =
      `🚨 *NEW REPORT IN GROUP: ${groupSubject}*\n\n` +
      `👤 *Reporter:* @${userId}\n` +
      `${targetId ? `🎯 *Target User:* @${targetId}\n` : ''}` +
      `📝 *Reason:* ${reasonText}\n` +
      `⏰ *Timestamp:* ${new Date(reportItem.timestamp).toLocaleString()}\n` +
      `👥 *Group ID:* \`${groupId}\``;

    for (const adminJid of admins) {
      // Don't DM the bot itself
      const selfPn = session.stats?.my_number || session.sock?.user?.id?.split(':')[0];
      const adminPn = adminJid.split('@')[0];
      if (selfPn && adminPn === selfPn) continue;

      try {
        await reply(session, adminJid, {
          text: dmText,
          mentions: [userId + '@s.whatsapp.net', ...(targetJid ? [targetJid] : [])],
        });
      } catch (err) {
        logger.warn(
          { error: err.message, adminJid },
          'Failed to send direct report message to admin'
        );
      }
    }
  },
  { adminOnly: false, help: 'Report a message or user to group admins' }
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
      await reply(session, groupId, { text: `⚠️ You must mention a user to approve them.` });
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
    await reply(session, groupId, {
      text: `✅ Approved ${targetMatches.length} user(s). They will bypass moderation locks.`,
      mentions: targetMatches,
    });
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
      await reply(session, groupId, { text: `⚠️ You must mention a user to unapprove them.` });
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
    await reply(session, groupId, {
      text: `✅ Removed approval for ${targetMatches.length} user(s).`,
      mentions: targetMatches,
    });
  },
  { adminOnly: true, help: 'Remove user from whitelist' }
);

registry.register(
  'setwelcome',
  async (session, groupId, userId, args, config) => {
    const text = args.join(' ');
    if (!text) {
      await reply(session, groupId, {
        text: `⚠️ Usage: \`${config.commands.prefix}setwelcome <text>\`\nPlaceholders: {mention}, {name}, {group}`,
      });
      return;
    }
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.greetings) c.greetings = {};
    c.greetings.welcome_text = text;
    c.greetings.welcome_message = text;
    c.greetings.welcome_enabled = true;
    saveModerationStore(store);
    await reply(session, groupId, { text: '✅ Welcome message updated and enabled.' });
  },
  { adminOnly: true, help: 'Set the welcome message' }
);

registry.register(
  'welcome',
  async (session, groupId, userId, args, config) => {
    const text =
      config.greetings?.welcome_text ||
      config.greetings?.welcome_message ||
      'Welcome {user} to {group}!';
    await reply(session, groupId, { text: `Current welcome message:\n\n${text}` });
  },
  { adminOnly: true, help: 'View the welcome message' }
);

registry.register(
  'setgoodbye',
  async (session, groupId, userId, args, config) => {
    const text = args.join(' ');
    if (!text) {
      await reply(session, groupId, {
        text: `⚠️ Usage: \`${config.commands.prefix}setgoodbye <text>\`\nPlaceholders: {mention}, {name}, {group}`,
      });
      return;
    }
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.greetings) c.greetings = {};
    c.greetings.goodbye_text = text;
    c.greetings.goodbye_message = text;
    c.greetings.goodbye_enabled = true;
    saveModerationStore(store);
    await reply(session, groupId, { text: '✅ Goodbye message updated and enabled.' });
  },
  { adminOnly: true, help: 'Set the goodbye message' }
);

registry.register(
  'goodbye',
  async (session, groupId, userId, args, config) => {
    const text =
      config.greetings?.goodbye_text || config.greetings?.goodbye_message || 'Goodbye {user}!';
    await reply(session, groupId, { text: `Current goodbye message:\n\n${text}` });
  },
  { adminOnly: true, help: 'View the goodbye message' }
);

registry.register(
  'save',
  async (session, groupId, userId, args, config) => {
    if (args.length < 2) {
      await reply(session, groupId, {
        text: `⚠️ Usage: \`${config.commands.prefix}save <notename> <content>\``,
      });
      return;
    }
    const name = args[0].toLowerCase();
    const content = args.slice(1).join(' ');

    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.notes) c.notes = {};
    c.notes[name] = content;
    saveModerationStore(store);
    await reply(session, groupId, {
      text: `✅ Saved note \`${name}\`\nRetrieve it with \`${config.commands.prefix}get ${name}\` or \`#${name}\``,
    });
  },
  { adminOnly: true, help: 'Save a text note' }
);

registry.register(
  'get',
  async (session, groupId, userId, args, config) => {
    if (args.length < 1) {
      await reply(session, groupId, {
        text: `⚠️ Usage: \`${config.commands.prefix}get <notename>\``,
      });
      return;
    }
    const name = args[0].toLowerCase();
    if (config.notes && config.notes[name]) {
      await reply(session, groupId, { text: config.notes[name] });
    } else {
      await reply(session, groupId, { text: `❌ Note \`${name}\` not found.` });
    }
  },
  { adminOnly: false, help: 'Retrieve a text note' }
);

registry.register(
  'notes',
  async (session, groupId, userId, args, config) => {
    if (!config.notes || Object.keys(config.notes).length === 0) {
      await reply(session, groupId, { text: `📝 No notes saved.` });
      return;
    }
    const list = Object.keys(config.notes)
      .map((n) => `• #${n}`)
      .join('\n');
    await reply(session, groupId, { text: `📝 *Saved Notes:*\n${list}` });
  },
  { adminOnly: false, help: 'List all saved notes' }
);

registry.register(
  'filter',
  async (session, groupId, userId, args, config) => {
    if (args.length < 2) {
      await reply(session, groupId, {
        text: `⚠️ Usage: \`${config.commands.prefix}filter <trigger> <reply>\``,
      });
      return;
    }
    const trigger = args[0].toLowerCase();
    const response = args.slice(1).join(' ');

    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.filters) c.filters = [];

    // Remove existing if same trigger
    c.filters = c.filters.filter((f) => f.trigger.toLowerCase() !== trigger);
    c.filters.push({ trigger, response, is_regex: false });

    saveModerationStore(store);
    await reply(session, groupId, { text: `✅ Added filter for \`${trigger}\`` });
  },
  { adminOnly: true, help: 'Add an auto-responder filter' }
);

registry.register(
  'stop',
  async (session, groupId, userId, args, config) => {
    if (args.length < 1) {
      await reply(session, groupId, {
        text: `⚠️ Usage: \`${config.commands.prefix}stop <trigger>\``,
      });
      return;
    }
    const trigger = args[0].toLowerCase();

    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.filters) c.filters = [];

    const initialLen = c.filters.length;
    c.filters = c.filters.filter((f) => f.trigger.toLowerCase() !== trigger);

    if (c.filters.length < initialLen) {
      saveModerationStore(store);
      await reply(session, groupId, { text: `✅ Stopped filter for \`${trigger}\`` });
    } else {
      await reply(session, groupId, { text: `❌ No filter found for \`${trigger}\`` });
    }
  },
  { adminOnly: true, help: 'Stop a specific filter' }
);

registry.register(
  'filters',
  async (session, groupId, userId, args, config) => {
    if (!config.filters || config.filters.length === 0) {
      await reply(session, groupId, { text: `No filters configured.` });
      return;
    }
    const list = config.filters
      .map((f) => `• \`${f.trigger}\` -> ${f.response}${f.is_regex ? ' _(Regex)_' : ''}`)
      .join('\n');
    await reply(session, groupId, { text: `🤖 *Active Filters:*\n${list}` });
  },
  { adminOnly: false, help: 'List active filters' }
);

// ---------------------------------------------------------
// Command Implementations
// ---------------------------------------------------------

registry.register(
  'help',
  async (session, groupId, userId, args, config, isAdminUser) => {
    let helpText = `📖 *Group Commands Help*\n_Prefix: ${config.commands.prefix}_\n\n*User Commands:*\n`;
    const userCmds = [];
    const adminCmds = [];

    // Deduplicate aliases for help
    const seen = new Set();
    for (const [cmd, details] of Object.entries(registry.commands)) {
      if (seen.has(details)) continue;
      seen.add(details);
      const line = `• \`${config.commands.prefix}${cmd}\`: ${details.help}`;
      if (details.adminOnly) {
        adminCmds.push(line);
      } else {
        userCmds.push(line);
      }
    }

    // Append Custom Group Commands if configured
    const customCmds = config.commands?.custom_commands || [];
    for (const c of customCmds) {
      const cleanCmdName = (c.command || '').replace(/^[!/#]+/, '');
      if (!cleanCmdName) continue;
      const desc = c.description ? c.description.trim() : c.response || 'Custom command';
      const line = `• \`${config.commands.prefix}${cleanCmdName}\`: ${desc}`;
      if (c.admin_only) {
        adminCmds.push(line);
      } else {
        userCmds.push(line);
      }
    }

    helpText += userCmds.join('\n') + '\n\n';

    if (isAdminUser && adminCmds.length > 0) {
      helpText += `*Admin Commands:*\n` + adminCmds.join('\n');
    } else {
      helpText += `_(Admin commands hidden for regular users)_`;
    }

    await reply(session, groupId, { text: helpText });
  },
  { help: 'Shows this help message' }
);

registry.register(
  'ping',
  async (session, groupId) => {
    await reply(session, groupId, { text: '🏓 Pong!' });
  },
  { help: 'Check if the bot is responsive' }
);

registry.register(
  'id',
  async (session, groupId, userId) => {
    const cleanGroupId = groupId.split('@')[0] + '@g.us';
    const cleanUserId = userId.split('@')[0];
    await reply(session, groupId, {
      text: `Group ID: \`${cleanGroupId}\`\nYour ID: \`${cleanUserId}\``,
    });
  },
  { help: 'Get the group and your user ID' }
);

registry.register(
  'rules',
  async (session, groupId, userId, args, config) => {
    const rulesText = config.rules?.text || 'No rules configured for this group.';
    await reply(session, groupId, { text: `📜 *Group Rules:*\n\n${rulesText}` });
  },
  { help: 'View the group rules' }
);

// Admin Commands
registry.register(
  'warn',
  async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
    const targetMatches = [
      ...(rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []),
    ];

    // Try to find replied message sender if no mentions
    if (
      targetMatches.length === 0 &&
      rawMsg.message?.extendedTextMessage?.contextInfo?.participant
    ) {
      targetMatches.push(rawMsg.message.extendedTextMessage.contextInfo.participant);
    }

    if (targetMatches.length === 0) {
      await reply(session, groupId, {
        text: `⚠️ You must mention a user or reply to their message to warn them.`,
      });
      return;
    }

    // Filter out mention tokens from args for the reason string (e.g., remove "@4917647365403")
    const cleanedArgs = args.filter((a) => !a.startsWith('@'));
    const reason = cleanedArgs.join(' ').trim() || 'No reason provided';

    for (const targetJid of targetMatches) {
      if (isSameUser(targetJid, userId, session)) {
        await reply(session, groupId, {
          text: `⚠️ You cannot issue a warning to yourself.`,
        });
        continue;
      }
      if (isAdmin(targetJid, session)) {
        await reply(session, groupId, {
          text: `⚠️ Cannot issue warnings to group administrators.`,
        });
        continue;
      }
      const targetId = targetJid.split('@')[0];
      await issueUserWarning(session, groupId, targetId, reason);
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
      await reply(session, groupId, {
        text: `⚠️ You must mention a user or reply to their message to unwarn them.`,
      });
      return;
    }

    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);

    for (const targetJid of targetMatches) {
      const targetId = targetJid.split('@')[0];
      if (c.warnings?.user_warns?.[targetId]) {
        c.warnings.user_warns[targetId] = [];
        await reply(session, groupId, {
          text: `✅ Cleared warnings for @${targetId}`,
          mentions: [targetJid],
        });
      } else {
        await reply(session, groupId, {
          text: `ℹ️ User @${targetId} has no warnings.`,
          mentions: [targetJid],
        });
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
      await reply(session, groupId, {
        text: `⚠️ You must mention a user or reply to their message to check their warnings.`,
      });
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
        await reply(session, groupId, {
          text: `⚠️ @${targetId} has ${warns.length} warning(s):\n${wList}`,
          mentions: [targetJid],
        });
      } else {
        await reply(session, groupId, {
          text: `✅ User @${targetId} has 0 warnings.`,
          mentions: [targetJid],
        });
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
      await reply(session, groupId, {
        text: `⚠️ You must mention a user or reply to their message to kick them.`,
      });
      return;
    }

    const reason = args.join(' ') || 'Admin requested kick';
    for (const targetJid of targetMatches) {
      if (isSameUser(targetJid, userId, session)) {
        await reply(session, groupId, {
          text: `⚠️ You cannot kick yourself.`,
        });
        continue;
      }
      if (isSameUser(targetJid, session?.sock?.user?.id, session)) {
        await reply(session, groupId, {
          text: `⚠️ You cannot kick the bot account.`,
        });
        continue;
      }
      const targetId = targetJid.split('@')[0];
      await executePenalty(session, groupId, targetId, 'kick', reason);
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
      await reply(session, groupId, {
        text: `⚠️ You must mention a user or reply to their message to ban them.`,
      });
      return;
    }

    const reason = args.join(' ') || 'Admin requested ban';
    for (const targetJid of targetMatches) {
      if (isSameUser(targetJid, userId, session)) {
        await reply(session, groupId, {
          text: `⚠️ You cannot ban yourself.`,
        });
        continue;
      }
      if (isSameUser(targetJid, session?.sock?.user?.id, session)) {
        await reply(session, groupId, {
          text: `⚠️ You cannot ban the bot account.`,
        });
        continue;
      }
      const targetId = targetJid.split('@')[0];
      await executePenalty(session, groupId, targetId, 'ban', reason);
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

    // Also support passing a plain phone number in args
    if (targetMatches.length === 0 && args.length > 0) {
      const clean = args[0].replace(/\D/g, '');
      if (clean) targetMatches.push(`${clean}@s.whatsapp.net`);
    }

    if (targetMatches.length === 0) {
      await reply(session, groupId, {
        text: `⚠️ You must mention a user, reply to their message, or specify their number (e.g. \`${config.commands.prefix}unban 49176...\`) to unban them.`,
      });
      return;
    }

    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);

    for (const targetJid of targetMatches) {
      const targetId = targetJid.split('@')[0];
      if (c.banned_users && c.banned_users[targetId]) {
        delete c.banned_users[targetId];
        await reply(session, groupId, {
          text: `✅ Unbanned @${targetId}. They may now rejoin the group.`,
          mentions: [targetJid],
        });
      } else {
        await reply(session, groupId, {
          text: `⚠️ User @${targetId} is not banned in this group.`,
          mentions: [targetJid],
        });
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
      await reply(session, groupId, {
        text: `⚠️ You must mention a user, reply to their message, or specify their number to clear kick log.`,
      });
      return;
    }

    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);

    for (const targetJid of targetMatches) {
      const targetId = targetJid.split('@')[0];
      if (Array.isArray(c.kick_log)) {
        c.kick_log = c.kick_log.filter((k) => k.userId !== targetId);
      }
      await reply(session, groupId, {
        text: `✅ Cleared kick log entries for @${targetId}.`,
        mentions: [targetJid],
      });
    }
    store.groups[groupId] = c;
    saveModerationStore(store);
  },
  { adminOnly: true, help: 'Clear kick history entries for a user' }
);

registry.register(
  'lock',
  async (session, groupId, userId, args, config) => {
    if (args.length === 0) {
      await reply(session, groupId, {
        text: `⚠️ Usage: \`${config.commands.prefix}lock <type>\`\nTypes: image, video, audio, document, sticker, url, invite, poll, rtl`,
      });
      return;
    }
    const type = args[0].toLowerCase();

    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (c.locks && typeof c.locks[type] !== 'undefined') {
      c.locks[type].enabled = true;
      saveModerationStore(store);
      await reply(session, groupId, { text: `🔒 Locked \`${type}\`` });
    } else {
      await reply(session, groupId, { text: `❌ Unknown lock type \`${type}\`` });
    }
  },
  { adminOnly: true, help: 'Lock a specific content type' }
);

registry.register(
  'unlock',
  async (session, groupId, userId, args, config) => {
    if (args.length === 0) {
      await reply(session, groupId, {
        text: `⚠️ Usage: \`${config.commands.prefix}unlock <type>\``,
      });
      return;
    }
    const type = args[0].toLowerCase();

    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (c.locks && typeof c.locks[type] !== 'undefined') {
      c.locks[type].enabled = false;
      saveModerationStore(store);
      await reply(session, groupId, { text: `🔓 Unlocked \`${type}\`` });
    } else {
      await reply(session, groupId, { text: `❌ Unknown lock type \`${type}\`` });
    }
  },
  { adminOnly: true, help: 'Unlock a specific content type' }
);

registry.register(
  'locks',
  async (session, groupId, userId, args, config) => {
    if (!config.locks) {
      await reply(session, groupId, { text: `No locks configured.` });
      return;
    }
    const activeLocks = Object.keys(config.locks).filter((k) => config.locks[k].enabled);
    if (activeLocks.length === 0) {
      await reply(session, groupId, { text: `🔓 All locks are currently disabled.` });
    } else {
      await reply(session, groupId, {
        text: `🔒 *Active Locks:*\n` + activeLocks.map((l) => `• ${l}`).join('\n'),
      });
    }
  },
  { adminOnly: true, help: 'List active content locks' }
);

// ---------------------------------------------------------
// Utility: Duration Parser (supports 1d, 12h, 30m, 10s)
// ---------------------------------------------------------

export function parseDuration(str) {
  const match = str.match(/^(\d+)([dhms])$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { d: 86400, h: 3600, m: 60, s: 1 };
  return value * (multipliers[unit] || 0) * 1000; // Return ms
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s >= 86400) return `${Math.floor(s / 86400)}d`;
  if (s >= 3600) return `${Math.floor(s / 3600)}h`;
  if (s >= 60) return `${Math.floor(s / 60)}m`;
  return `${s}s`;
}

// Pending temporary actions (auto-unban / auto-unmute)
const pendingTempActions = new Map();

// ---------------------------------------------------------
// Phase 3a Commands
// ---------------------------------------------------------

registry.register(
  'info',
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

    const targetJid = targetMatches.length > 0 ? targetMatches[0] : userId + '@s.whatsapp.net';
    const targetId = targetJid.split('@')[0];

    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    const warns = c.warnings?.user_warns?.[targetId] || [];
    const maxWarns = c.warnings?.max_warnings || 3;
    const isApproved = (c.approved || []).includes(targetId);
    const isMuted =
      c.muted_users?.[targetId] &&
      (!c.muted_users[targetId].until || c.muted_users[targetId].until > Date.now());

    let infoText = `📋 *User Info: @${targetId}*\n\n`;
    infoText += `🆔 ID: \`${targetId}\`\n`;
    infoText += `⚠️ Warnings: ${warns.length}/${maxWarns}\n`;
    infoText += `✅ Approved: ${isApproved ? 'Yes' : 'No'}\n`;
    infoText += `🔇 Muted: ${isMuted ? 'Yes' : 'No'}\n`;

    if (warns.length > 0) {
      infoText += `\n*Warning History:*\n`;
      warns.forEach((w, i) => {
        infoText += `${i + 1}. ${w.reason} (${new Date(w.timestamp).toLocaleString()})\n`;
      });
    }

    await reply(session, groupId, { text: infoText, mentions: [targetJid] });
  },
  { adminOnly: false, help: 'View user information and warning history' }
);

registry.register(
  'adminlist',
  async (session, groupId) => {
    try {
      const groupMeta = await session.sock.groupMetadata(groupId);
      const admins = groupMeta.participants.filter(
        (p) => p.admin === 'admin' || p.admin === 'superadmin'
      );

      if (admins.length === 0) {
        await reply(session, groupId, { text: '❌ No admins found.' });
        return;
      }

      const botUserJid = session.sock?.user?.id ? normalizeJid(session.sock.user.id) : null;
      const botPn = session.stats?.my_number || (botUserJid ? botUserJid.split('@')[0] : null);

      let text = `👮 *Group Admins (${admins.length}):*\n\n`;
      for (const admin of admins) {
        const fullJid = admin.id;
        const phoneNum = fullJid.split('@')[0];
        const isBot = (botUserJid && fullJid === botUserJid) || (botPn && phoneNum === botPn);
        const cachedName =
          session.contactCache?.get(fullJid)?.name ||
          session.contactCache?.get(`${phoneNum}@s.whatsapp.net`)?.name;

        let displayName = cachedName ? `${cachedName} (@${phoneNum})` : `@${phoneNum}`;
        if (isBot) {
          displayName += ' 🤖 (Bot)';
        }
        const icon = admin.admin === 'superadmin' ? '👑' : '👮';
        text += `${icon} ${displayName}\n`;
      }

      await reply(session, groupId, { text, mentions: admins.map((a) => a.id) });
    } catch (e) {
      await reply(session, groupId, { text: '❌ Failed to fetch admin list.' });
    }
  },
  { adminOnly: false, aliases: ['admins'], help: 'List all group administrators' }
);

const LOCK_TYPES = [
  'image',
  'video',
  'audio',
  'document',
  'sticker',
  'url',
  'invite',
  'poll',
  'contact',
  'location',
  'forwarded',
  'rtl',
];

registry.register(
  'locktypes',
  async (session, groupId) => {
    const list = LOCK_TYPES.map((t) => `• \`${t}\``).join('\n');
    await reply(session, groupId, { text: `🔒 *Available Lock Types:*\n${list}` });
  },
  { adminOnly: false, help: 'List all available content lock types' }
);

registry.register(
  'del',
  async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
    const quotedMsg = rawMsg.message?.extendedTextMessage?.contextInfo;
    if (!quotedMsg?.stanzaId) {
      await reply(session, groupId, { text: '⚠️ Reply to a message to delete it.' });
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
      // Also delete the command message itself
      if (rawMsg.key) {
        await session.sock.sendMessage(groupId, { delete: rawMsg.key });
      }
    } catch (e) {
      await sendMissingAdminWarning(session, groupId, 'Delete message');
    }
  },
  { adminOnly: true, aliases: ['delete'], help: 'Delete a replied-to message' }
);

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
      await reply(session, groupId, {
        text: '⚠️ You must mention a user or reply to their message to mute them.',
      });
      return;
    }

    const reason = args.join(' ') || 'No reason provided';
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.muted_users) c.muted_users = {};

    const validTargets = [];
    for (const jid of targetMatches) {
      if (isSameUser(jid, userId, session)) {
        await reply(session, groupId, { text: `⚠️ You cannot mute yourself.` });
        continue;
      }
      if (isSameUser(jid, session?.sock?.user?.id, session)) {
        await reply(session, groupId, { text: `⚠️ You cannot mute the bot account.` });
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

    await reply(session, groupId, {
      text: `🔇 Muted ${validTargets.length} user(s) indefinitely.\nReason: ${reason}\n\n_Their messages will be automatically deleted._`,
      mentions: validTargets,
    });
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
      await reply(session, groupId, {
        text: '⚠️ You must mention a user or reply to their message to unmute them.',
      });
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
      await reply(session, groupId, {
        text: `🔊 Unmuted ${unmutedCount} user(s).`,
        mentions: targetMatches,
      });
    } else {
      await reply(session, groupId, { text: '❌ None of those users are muted.' });
    }
  },
  { adminOnly: true, help: 'Unmute a muted user' }
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
      await reply(session, groupId, {
        text: `⚠️ Usage: \`${config.commands.prefix}tban <duration> [@user]\`\nExample: \`${config.commands.prefix}tban 1d @user\`\nDurations: 10s, 30m, 12h, 1d`,
      });
      return;
    }

    const durationMs = parseDuration(args[0]);
    if (!durationMs) {
      await reply(session, groupId, { text: '❌ Invalid duration. Use format: 10s, 30m, 12h, 1d' });
      return;
    }

    const reason = args.slice(1).join(' ') || 'Temporary ban';

    const validTargets = [];
    for (const targetJid of targetMatches) {
      if (isSameUser(targetJid, userId, session)) {
        await reply(session, groupId, { text: `⚠️ You cannot ban yourself.` });
        continue;
      }
      if (isSameUser(targetJid, session?.sock?.user?.id, session)) {
        await reply(session, groupId, { text: `⚠️ You cannot ban the bot account.` });
        continue;
      }
      validTargets.push(targetJid);
    }
    if (validTargets.length === 0) return;

    for (const targetJid of validTargets) {
      const targetId = targetJid.split('@')[0];

      // Kick the user
      await executePenalty(session, groupId, targetId, 'kick', reason);

      // Schedule auto-unban (re-add) — note: WhatsApp can't re-add automatically,
      // but we track the ban expiry so admins know when it expires
      const key = `tban:${groupId}:${targetId}`;
      if (pendingTempActions.has(key)) clearTimeout(pendingTempActions.get(key));

      const timeout = setTimeout(async () => {
        pendingTempActions.delete(key);
        await reply(session, groupId, {
          text: `⏰ Temporary ban for @${targetId} has expired (${formatDuration(durationMs)}). They may rejoin the group.`,
          mentions: [targetJid],
        });
      }, durationMs);
      pendingTempActions.set(key, timeout);
    }

    await reply(session, groupId, {
      text: `⏱️ Temporarily banned for ${formatDuration(durationMs)}.\nReason: ${reason}`,
      mentions: validTargets,
    });
  },
  { adminOnly: true, help: 'Temporarily ban a user for a specific duration' }
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
      await reply(session, groupId, {
        text: `⚠️ Usage: \`${config.commands.prefix}tmute <duration> [@user]\`\nExample: \`${config.commands.prefix}tmute 1h @user\``,
      });
      return;
    }

    const durationMs = parseDuration(args[0]);
    if (!durationMs) {
      await reply(session, groupId, { text: '❌ Invalid duration. Use format: 10s, 30m, 12h, 1d' });
      return;
    }

    const reason = args.slice(1).join(' ') || 'Temporary mute';
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.muted_users) c.muted_users = {};

    const validTargets = [];
    for (const targetJid of targetMatches) {
      if (isSameUser(targetJid, userId, session)) {
        await reply(session, groupId, { text: `⚠️ You cannot mute yourself.` });
        continue;
      }
      if (isSameUser(targetJid, session?.sock?.user?.id, session)) {
        await reply(session, groupId, { text: `⚠️ You cannot mute the bot account.` });
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

    // Schedule auto-unmute
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
        reply(session, groupId, {
          text: `🔊 Temporary mute for @${id} has expired.`,
          mentions: [jid],
        });
      }, durationMs);
      pendingTempActions.set(key, timeout);
    }

    await reply(session, groupId, {
      text: `🔇 Temporarily muted for ${formatDuration(durationMs)}.\nReason: ${reason}\n\n_Their messages will be automatically deleted until the mute expires._`,
      mentions: targetMatches,
    });
  },
  { adminOnly: true, help: 'Temporarily mute a user for a specific duration' }
);

// ---------------------------------------------------------
// Phase 3b: AI Rules Interpretation (enhanced !rules)
// ---------------------------------------------------------

// Override the original !rules to support AI queries
registry.register(
  'rules',
  async (session, groupId, userId, args, config) => {
    const rulesText = config.rules?.text || 'No rules configured for this group.';

    if (args.length > 0 && config.ai?.enabled) {
      // AI-powered rule interpretation
      const question = args.join(' ');
      const store = loadModerationStore();
      const apiKey = store.gemini_api_key || process.env.GEMINI_API_KEY;

      if (apiKey) {
        const aiConfig = {
          system_prompt: `You are a group rules interpreter. Here are the group rules:\n\n${rulesText}\n\nAnswer the following question about these rules concisely and accurately. If the rules don't cover the question, say so.`,
          faq_auto_reply: true,
        };
        const aiReply = await processAiModeration(question, aiConfig, apiKey);
        if (aiReply) {
          await reply(session, groupId, { text: `📜 *Rules Interpretation:*\n\n${aiReply}` });
          return;
        }
      }
      await reply(session, groupId, {
        text: `📜 *Group Rules:*\n\n${rulesText}\n\n_(AI interpretation not available)_`,
      });
    } else {
      await reply(session, groupId, { text: `📜 *Group Rules:*\n\n${rulesText}` });
    }
  },
  { help: 'View group rules or ask a question about them' }
);

// ---------------------------------------------------------
// Phase 3c: Translation Commands
// ---------------------------------------------------------

registry.register(
  'setlang',
  async (session, groupId, userId, args, config) => {
    if (args.length === 0) {
      await reply(session, groupId, {
        text: `⚠️ Usage: \`${config.commands.prefix}setlang <language_code>\`\nExamples: en, de, es, fr, ar, zh, ja`,
      });
      return;
    }
    const lang = args[0].toLowerCase();
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.translation) c.translation = {};
    c.translation.target_lang = lang;
    c.translation.enabled = true;
    saveModerationStore(store);
    await reply(session, groupId, {
      text: `🌐 Translation language set to \`${lang}\` and enabled.`,
    });
  },
  { adminOnly: true, help: 'Set the translation target language' }
);

registry.register(
  'translate',
  async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
    const store = loadModerationStore();
    const apiKey = store.gemini_api_key || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      await reply(session, groupId, {
        text: '❌ Gemini API key not configured. Set it in the Addon UI.',
      });
      return;
    }

    // Get text to translate: either from reply or from args
    let textToTranslate = '';
    if (rawMsg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation) {
      textToTranslate = rawMsg.message.extendedTextMessage.contextInfo.quotedMessage.conversation;
    } else if (
      rawMsg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text
    ) {
      textToTranslate =
        rawMsg.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage.text;
    } else if (args.length > 0) {
      textToTranslate = args.join(' ');
    }

    if (!textToTranslate) {
      await reply(session, groupId, {
        text: '⚠️ Reply to a message or provide text to translate.',
      });
      return;
    }

    const targetLang = config.translation?.target_lang || 'en';
    const aiConfig = {
      system_prompt: `You are a translator. Translate the following text to ${targetLang}. Reply ONLY with the translation, nothing else.`,
      faq_auto_reply: true,
    };

    const translated = await processAiModeration(textToTranslate, aiConfig, apiKey);
    if (translated) {
      await reply(session, groupId, { text: `🌐 *Translation (${targetLang}):*\n\n${translated}` });
    } else {
      await reply(session, groupId, { text: '❌ Translation failed.' });
    }
  },
  { adminOnly: false, help: 'Translate a message or text' }
);

// ---------------------------------------------------------
// Engine Hook
// ---------------------------------------------------------

export async function processCommand(session, msg, text, senderJid, isAdminUser, groupId) {
  const store = loadModerationStore();
  if (!store.global_enabled) return false;

  const config = getGroupModerationConfig(groupId);
  if (!config.enabled || !config.commands?.enabled) return false;

  const prefix = config.commands.prefix || '!';

  // Sanitize formatting wrappers e.g. `!locktypes`, '!locktypes', "`!help`", ```!rules```
  let cleanText = (text || '').trim();
  // Strip code block fence wrappers (e.g. ```!locktypes```)
  cleanText = cleanText
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
  // Strip leading and trailing inline formatting wrappers (`...`, '...', "...")
  cleanText = cleanText.replace(/^['"`\s]+|['"`\s]+$/g, '').trim();

  if (!cleanText.startsWith(prefix)) return false;

  const parts = cleanText.slice(prefix.length).trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return false;

  // Clean trailing inline code markers from command name (e.g. `locktypes` -> locktypes)
  const cmdStr = parts[0].replace(/[`'"]/g, '').toLowerCase();
  const args = parts.slice(1).map((a) => a.replace(/^[`'"]+|[`'"]+$/g, ''));

  const command = registry.getCommand(cmdStr);
  if (!command) {
    // Check custom mapped commands
    const customCmds = config.commands?.custom_commands || [];
    const customMatch = customCmds.find(
      (c) => c.command.toLowerCase().replace(/^[!/#]+/, '') === cmdStr
    );
    if (customMatch) {
      if (customMatch.admin_only && !isAdminUser) {
        await reply(session, groupId, {
          text: `⚠️ *Permission Denied:*\nYou must be a group admin to use \`${prefix}${cmdStr}\`.`,
        });
        return true;
      }
      await reply(session, groupId, { text: customMatch.response });
      return true;
    }
    return false;
  }

  // Check if built-in default command is disabled in this group
  const disabledCmds = config.commands?.disabled_commands || [];
  if (disabledCmds.includes(cmdStr)) {
    await reply(session, groupId, {
      text: `⚠️ *Command Disabled:*\nThe command \`${prefix}${cmdStr}\` is disabled in this group and will be ignored.`,
    });
    return true;
  }

  const userId = senderJid.split('@')[0];

  if (command.adminOnly && !isAdminUser) {
    await reply(session, groupId, {
      text: `⚠️ *Permission Denied:*\nYou must be a group admin to use \`${prefix}${cmdStr}\`.`,
    });
    return true; // We handled the command, stop propagation
  }

  try {
    logger.info(`⚡ Executing command: ${prefix}${cmdStr} by ${userId} in ${groupId}`);
    await command.handler(session, groupId, userId, args, config, isAdminUser, msg);
  } catch (err) {
    logger.error({ error: err.message }, `Error executing command ${cmdStr}`);
    await reply(session, groupId, { text: `❌ An error occurred while executing the command.` });
  }

  return true; // Command was processed
}
