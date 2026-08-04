import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from './store.js';
import { executePenalty, issueUserWarning } from './engine.js';
import { reply } from '../actions.js';
import { logger } from '../../logger.js';

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
      await reply(session, groupId, { text: `❌ Failed to promote users.` });
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
      await reply(session, groupId, { text: `❌ Failed to demote users.` });
    }
  },
  { adminOnly: true, help: 'Demote an Admin to regular user' }
);

registry.register(
  'report',
  async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
    const groupMeta = await session.sock.groupMetadata(groupId);
    const admins = groupMeta.participants
      .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
      .map((p) => p.id);

    if (admins.length === 0) {
      await reply(session, groupId, { text: `⚠️ No admins found in this group to report to.` });
      return;
    }

    const text = args.join(' ');
    const reasonText = text ? `\nReason: ${text}` : '';

    let quotedMsg = undefined;
    if (rawMsg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
      quotedMsg = rawMsg; // Provide the message context to quote it
    }

    await reply(
      session,
      groupId,
      {
        text: `🚨 *Report from @${userId}*\nAdmins requested.${reasonText}`,
        mentions: [userId + '@s.whatsapp.net', ...admins],
      },
      quotedMsg
    );
  },
  { adminOnly: false, help: 'Report a message to group admins' }
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
    c.greetings.welcome_enabled = true;
    saveModerationStore(store);
    await reply(session, groupId, { text: '✅ Welcome message updated and enabled.' });
  },
  { adminOnly: true, help: 'Set the welcome message' }
);

registry.register(
  'welcome',
  async (session, groupId, userId, args, config) => {
    const text = config.greetings?.welcome_text || 'No welcome message configured.';
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
    c.greetings.goodbye_enabled = true;
    saveModerationStore(store);
    await reply(session, groupId, { text: '✅ Goodbye message updated and enabled.' });
  },
  { adminOnly: true, help: 'Set the goodbye message' }
);

registry.register(
  'goodbye',
  async (session, groupId, userId, args, config) => {
    const text = config.greetings?.goodbye_text || 'No goodbye message configured.';
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
      .map((f) => `• \`${f.trigger}\` -> ${f.is_regex ? '(Regex)' : ''}`)
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
    await reply(session, groupId, { text: `Group ID: \`${groupId}\`\nYour ID: \`${userId}\`` });
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

    const reason = args.join(' ') || 'No reason provided';
    for (const targetJid of targetMatches) {
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
      const targetId = targetJid.split('@')[0];
      await executePenalty(session, groupId, targetId, 'kick', reason);
    }
  },
  { adminOnly: true, aliases: ['ban'], help: 'Remove a user from the group' }
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
// Engine Hook
// ---------------------------------------------------------

export async function processCommand(session, msg, text, senderJid, isAdminUser, groupId) {
  const store = loadModerationStore();
  if (!store.global_enabled) return false;

  const config = getGroupModerationConfig(groupId);
  if (!config.enabled || !config.commands?.enabled) return false;

  const prefix = config.commands.prefix || '!';

  if (!text.startsWith(prefix)) return false;

  const parts = text.slice(prefix.length).trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return false;

  const cmdStr = parts[0].toLowerCase();
  const args = parts.slice(1);

  const command = registry.getCommand(cmdStr);
  if (!command) return false; // Not a registered command

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
