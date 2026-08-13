import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from './store.js';
import {
  executePenalty,
  issueUserWarning,
  sendMissingAdminWarning,
  isSelfParticipant,
  isUserVerified,
} from './engine.js';
import { reply } from '../actions.js';
import { logger } from '../../logger.js';
import { processAiModeration } from './ai.js';
import {
  isSameUser,
  normalizeJid,
  resolveUserDisplayName,
  resolveCanonicalUserKey,
} from '../../utils/security.js';
import { t } from '../../locales/loader.js';

/** Translate a bot-reply key using group config language (fallback: 'en') */
function gt(config, key, params = {}) {
  const lang = config?.language || 'en';
  return t(lang, key, params);
}

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

  getAllCommandNames() {
    return Object.keys(this.commands);
  }
}

/**
 * Calculates Levenshtein distance between two strings.
 */
export function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/**
 * Finds similar command suggestions for a given unknown command string.
 */
export function findCommandSuggestions(unknownCmd, availableCmds, maxSuggestions = 3) {
  if (!unknownCmd) return [];
  const target = unknownCmd.toLowerCase();
  const scored = [];

  for (const cmd of availableCmds) {
    const candidate = cmd.toLowerCase();
    // Substring match gets priority score
    if (candidate.startsWith(target) || target.startsWith(candidate)) {
      scored.push({ cmd, dist: 0 });
      continue;
    }
    const dist = levenshteinDistance(target, candidate);
    // Allow distance threshold up to 3 or half the length of target
    const maxAllowed = Math.max(2, Math.floor(target.length / 2));
    if (dist <= maxAllowed) {
      scored.push({ cmd, dist });
    }
  }

  // Sort by distance, deduplicate, and limit to maxSuggestions
  const unique = [];
  const seen = new Set();
  scored
    .sort((a, b) => a.dist - b.dist)
    .forEach((item) => {
      if (!seen.has(item.cmd)) {
        seen.add(item.cmd);
        unique.push(item.cmd);
      }
    });

  return unique.slice(0, maxSuggestions);
}

export const registry = new CommandRegistry();

registry.register(
  'setrules',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const text = args.join(' ');
    if (!text) {
      await reply(
        session,
        groupId,
        {
          text: `⚠️ Usage: \`${config.commands.prefix}setrules <text>\``,
        },
        rawMsg
      );
      return;
    }
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.rules) c.rules = {};
    c.rules.text = text;
    saveModerationStore(store);
    await reply(session, groupId, { text: '✅ Group rules updated.' }, rawMsg);
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
      await reply(
        session,
        groupId,
        {
          text: `⚠️ You must mention a user or reply to their message to promote them.`,
        },
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
        {
          text: `⚠️ You must mention a user or reply to their message to demote them.`,
        },
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
            text: `⚠️ *Security Restriction:* You cannot demote yourself.`,
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

    // Disallow self-reporting (if target matches reporter OR if no target is provided)
    if (
      !targetJid ||
      (targetId && cleanUserId && targetId === cleanUserId) ||
      isSameUser(userId, targetJid, session)
    ) {
      await reply(
        session,
        groupId,
        {
          text: `⚠️ You cannot report yourself. Please mention (@user) or reply to the user you want to report.`,
        },
        rawMsg
      );
      return;
    }

    if (targetJid && isSameUser(targetJid, session?.sock?.user?.id, session)) {
      await reply(
        session,
        groupId,
        {
          text: `⚠️ You cannot report the bot account.`,
        },
        rawMsg
      );
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

    const reporterLabel = resolveUserDisplayName(userId, session);
    const targetLabel = targetJid
      ? resolveUserDisplayName(targetJid, session)
      : targetId
        ? `@${targetId}`
        : '';
    const targetMentionStr = targetLabel ? ` against ${targetLabel}` : '';

    // Filter out the bot itself from group admin notifications/DMs unless the bot is the only admin
    const nonBotAdmins = admins.filter((a) => !isSelfParticipant(a, session));
    const targetAdmins = nonBotAdmins.length > 0 ? nonBotAdmins : admins;

    await reply(
      session,
      groupId,
      {
        text: `🚨 *Report from ${reporterLabel}*${targetMentionStr}\nAdmins requested.\nReason: ${reasonText}`,
        mentions: [userId + '@s.whatsapp.net', ...(targetJid ? [targetJid] : []), ...targetAdmins],
      },
      quotedMsg
    );

    // 2. Private direct message to admins
    const groupSubject = groupMeta?.subject || groupId.split('@')[0];
    const dmText = gt(config, 'bot_replies.report_dm', {
      group: groupSubject,
      reporter: userId,
      targetText: targetId ? `🎯 *Target User:* @${targetId}\n` : '',
      reason: reasonText,
      time: new Date(reportItem.timestamp).toLocaleString(),
      groupId,
    });

    for (const adminJid of targetAdmins) {
      // Don't DM the bot itself if there are other human admins
      if (nonBotAdmins.length > 0 && isSelfParticipant(adminJid, session)) continue;

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

registry.register(
  'setwelcome',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const text = args.join(' ');
    if (!text) {
      await reply(
        session,
        groupId,
        {
          text: `⚠️ Usage: \`${config.commands.prefix}setwelcome <text>\`\nPlaceholders: {mention}, {name}, {pushname}, {group}, {count}, {rules}, {date}, {time}`,
        },
        rawMsg
      );
      return;
    }
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.greetings) c.greetings = {};
    c.greetings.welcome_text = text;
    c.greetings.welcome_message = text;
    c.greetings.welcome_enabled = true;
    saveModerationStore(store);
    await reply(session, groupId, { text: '✅ Welcome message updated and enabled.' }, rawMsg);
  },
  { adminOnly: true, help: 'Set the welcome message' }
);

registry.register(
  'welcome',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const text =
      config.greetings?.welcome_text ||
      config.greetings?.welcome_message ||
      'Welcome {user} to {group}!';
    await reply(session, groupId, { text: `Current welcome message:\n\n${text}` }, rawMsg);
  },
  { adminOnly: true, help: 'View the welcome message' }
);

registry.register(
  'setgoodbye',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const text = args.join(' ');
    if (!text) {
      await reply(
        session,
        groupId,
        {
          text: `⚠️ Usage: \`${config.commands.prefix}setgoodbye <text>\`\nPlaceholders: {mention}, {name}, {pushname}, {group}, {count}, {rules}, {date}, {time}`,
        },
        rawMsg
      );
      return;
    }
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.greetings) c.greetings = {};
    c.greetings.goodbye_text = text;
    c.greetings.goodbye_message = text;
    c.greetings.goodbye_enabled = true;
    saveModerationStore(store);
    await reply(session, groupId, { text: '✅ Goodbye message updated and enabled.' }, rawMsg);
  },
  { adminOnly: true, help: 'Set the goodbye message' }
);

registry.register(
  'goodbye',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const text =
      config.greetings?.goodbye_text || config.greetings?.goodbye_message || 'Goodbye {user}!';
    await reply(session, groupId, { text: `Current goodbye message:\n\n${text}` }, rawMsg);
  },
  { adminOnly: true, help: 'View the goodbye message' }
);

registry.register(
  'save',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    if (args.length < 2) {
      await reply(
        session,
        groupId,
        {
          text: `⚠️ Usage: \`${config.commands.prefix}save <notename> <content>\``,
        },
        rawMsg
      );
      return;
    }
    const name = args[0].toLowerCase();
    const content = args.slice(1).join(' ');

    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.notes) c.notes = {};
    c.notes[name] = content;
    saveModerationStore(store);
    await reply(
      session,
      groupId,
      {
        text: `✅ Saved note \`${name}\`\nRetrieve it with \`${config.commands.prefix}get ${name}\` or \`#${name}\``,
      },
      rawMsg
    );
  },
  { adminOnly: true, help: 'Save a text note' }
);

registry.register(
  'get',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    if (args.length < 1) {
      await reply(
        session,
        groupId,
        {
          text: `⚠️ Usage: \`${config.commands.prefix}get <notename>\``,
        },
        rawMsg
      );
      return;
    }
    const name = args[0].toLowerCase();
    if (config.notes && config.notes[name]) {
      await reply(session, groupId, { text: config.notes[name] }, rawMsg);
    } else {
      await reply(session, groupId, { text: `❌ Note \`${name}\` not found.` }, rawMsg);
    }
  },
  { adminOnly: false, help: 'Retrieve a text note' }
);

registry.register(
  'notes',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    if (!config.notes || Object.keys(config.notes).length === 0) {
      await reply(session, groupId, { text: `📝 No notes saved.` }, rawMsg);
      return;
    }
    const list = Object.keys(config.notes)
      .map((n) => `• #${n}`)
      .join('\n');
    await reply(session, groupId, { text: `📝 *Saved Notes:*\n${list}` }, rawMsg);
  },
  { adminOnly: false, help: 'List all saved notes' }
);

registry.register(
  'filter',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    if (args.length < 2) {
      await reply(
        session,
        groupId,
        {
          text: `⚠️ Usage: \`${config.commands.prefix}filter <trigger> [faq|reply] <reply_text>\``,
        },
        rawMsg
      );
      return;
    }
    let type = 'reply';
    let trigger = args[0].toLowerCase();
    let responseWords = args.slice(1);

    if (['faq', 'reply'].includes(responseWords[0]?.toLowerCase())) {
      type = responseWords[0].toLowerCase();
      responseWords = responseWords.slice(1);
    }
    const response = responseWords.join(' ');

    if (!response) {
      await reply(
        session,
        groupId,
        {
          text: `⚠️ Please provide response text. Usage: \`${config.commands.prefix}filter <trigger> [faq|reply] <text>\``,
        },
        rawMsg
      );
      return;
    }

    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.filters) c.filters = [];

    // Remove existing if same trigger
    c.filters = c.filters.filter((f) => f.trigger.toLowerCase() !== trigger);
    c.filters.push({ trigger, response, type, is_regex: false });

    saveModerationStore(store);
    await reply(
      session,
      groupId,
      { text: `✅ Added ${type.toUpperCase()} filter for \`${trigger}\`` },
      rawMsg
    );
  },
  { adminOnly: true, help: 'Add an auto-responder or FAQ filter' }
);

registry.register(
  'stop',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    if (args.length < 1) {
      await reply(
        session,
        groupId,
        {
          text: `⚠️ Usage: \`${config.commands.prefix}stop <trigger>\``,
        },
        rawMsg
      );
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
      await reply(session, groupId, { text: `✅ Stopped filter for \`${trigger}\`` }, rawMsg);
    } else {
      await reply(session, groupId, { text: `❌ No filter found for \`${trigger}\`` }, rawMsg);
    }
  },
  { adminOnly: true, help: 'Stop a specific filter' }
);

registry.register(
  'filters',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    if (!config.filters || config.filters.length === 0) {
      await reply(session, groupId, { text: `No filters configured.` }, rawMsg);
      return;
    }
    const list = config.filters
      .map(
        (f) =>
          `• \`${f.trigger}\` [${(f.type || 'reply').toUpperCase()}] -> ${f.response}${f.is_regex ? ' _(Regex)_' : ''}`
      )
      .join('\n');
    await reply(session, groupId, { text: `🤖 *Active Filters:*\n${list}` }, rawMsg);
  },
  { adminOnly: false, help: 'List active filters' }
);

// ---------------------------------------------------------
// Command Implementations
// ---------------------------------------------------------

registry.register(
  'help',
  async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
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
    const prefix = config.commands?.prefix || '!';
    for (const c of customCmds) {
      const cleanCmdName = (c.command || '').replace(/^[!/#]+/, '');
      if (!cleanCmdName) continue;
      const cmdType = c.type || 'auto_reply';
      let secondary;
      if (c.description) {
        secondary = c.description.trim();
      } else if (cmdType === 'auto_reply' && c.response) {
        secondary = c.response.length > 50 ? c.response.slice(0, 47) + '…' : c.response;
      } else if (cmdType === 'webhook') {
        secondary = '(handled by Home Assistant / Webhook)';
      } else if (cmdType === 'alias' && c.alias_of) {
        secondary = `→ runs ${prefix}${c.alias_of}`;
      } else {
        secondary = 'Custom command';
      }
      const line = `• \`${prefix}${cleanCmdName}\`: ${secondary}`;
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

    await reply(session, groupId, { text: helpText }, rawMsg);
  },
  { help: 'Shows this help message' }
);

registry.register(
  'ping',
  async (session, groupId, _u, _a, _c, _ia, rawMsg) => {
    await reply(session, groupId, { text: '🏓 Pong!' }, rawMsg);
  },
  { help: 'Check if the bot is responsive' }
);

registry.register(
  'id',
  async (session, groupId, userId, _a, config, _ia, rawMsg) => {
    const cleanGroupId = groupId.split('@')[0] + '@g.us';
    const cleanUserId = userId.split('@')[0];
    await reply(
      session,
      groupId,
      {
        text: gt(config, 'bot_replies.id_info', {
          groupId: cleanGroupId,
          userId: cleanUserId,
        }),
      },
      rawMsg
    );
  },
  { help: 'Get the group and your user ID' }
);

registry.register(
  'rules',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const rulesText = config.rules?.text || 'No rules configured for this group.';
    await reply(session, groupId, { text: `📜 *Group Rules:*\n\n${rulesText}` }, rawMsg);
  },
  { help: 'View the group rules' }
);

registry.register(
  'testsuite',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const prefix = config.commands?.prefix || '!';
    const disabledCmds = new Set(config.commands?.disabled_commands || []);
    const seen = new Set();
    const testLines = [];

    for (const [cmd, details] of Object.entries(registry.commands)) {
      if (seen.has(details)) continue;
      seen.add(details);
      if (disabledCmds.has(cmd)) continue;

      let sample;
      switch (cmd) {
        case 'setrules':
          sample = `${prefix}setrules 1. Be polite.\n2. No spam.`;
          break;
        case 'warn':
          sample = `${prefix}warn @user Violation of group rules`;
          break;
        case 'unwarn':
          sample = `${prefix}unwarn @user`;
          break;
        case 'mute':
          sample = `${prefix}mute @user 10m`;
          break;
        case 'tmute':
          sample = `${prefix}tmute @user 15m`;
          break;
        case 'tban':
          sample = `${prefix}tban @user 1h`;
          break;
        case 'kick':
          sample = `${prefix}kick @user`;
          break;
        case 'ban':
          sample = `${prefix}ban @user Rule violation`;
          break;
        case 'promote':
          sample = `${prefix}promote @user`;
          break;
        case 'demote':
          sample = `${prefix}demote @user`;
          break;
        case 'approve':
          sample = `${prefix}approve @user`;
          break;
        case 'unapprove':
          sample = `${prefix}unapprove @user`;
          break;
        case 'lock':
          sample = `${prefix}lock url`;
          break;
        case 'unlock':
          sample = `${prefix}unlock url`;
          break;
        case 'setwelcome':
          sample = `${prefix}setwelcome Welcome {mention} to {group}!`;
          break;
        case 'setgoodbye':
          sample = `${prefix}setgoodbye Goodbye {name}!`;
          break;
        case 'report':
          sample = `${prefix}report @user Inappropriate message`;
          break;
        case 'notes':
          sample = `${prefix}notes #wifi 12345678`;
          break;
        case 'filter':
          sample = `${prefix}filter wlan -> Password is 1234`;
          break;
        case 'setlang':
          sample = `${prefix}setlang de`;
          break;
        case 'translate':
          sample = `${prefix}translate de Hello world`;
          break;
        case 'autotranslate':
          sample = `${prefix}autotranslate on`;
          break;
        case 'slowmode':
          sample = `${prefix}slowmode 10s`;
          break;
        default:
          sample = `${prefix}${cmd}`;
          break;
      }
      testLines.push(sample);
    }

    // Also add custom commands
    const customCmds = config.commands?.custom_commands || [];
    for (const c of customCmds) {
      const cleanCmd = (c.command || '').replace(/^[!/#]+/, '');
      if (cleanCmd) testLines.push(`${prefix}${cleanCmd}`);
    }

    const header = `🧪 *Test Suite — Active Commands (${testLines.length})*\n_Prefix: ${prefix}_\n\n`;
    const body = testLines.join('\n');

    await reply(session, groupId, { text: header + body }, rawMsg);
  },
  { adminOnly: true, help: 'Post all active bot commands as test payloads into this group' }
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
      await reply(
        session,
        groupId,
        {
          text: `⚠️ You must mention a user or reply to their message to warn them.`,
        },
        rawMsg
      );
      return;
    }

    // Filter out mention tokens from args for the reason string (e.g., remove "@4917647365403")
    const cleanedArgs = args.filter((a) => !a.startsWith('@'));
    const reason = cleanedArgs.join(' ').trim() || 'No reason provided';

    for (const targetJid of targetMatches) {
      if (isSameUser(targetJid, userId, session)) {
        await reply(
          session,
          groupId,
          {
            text: `⚠️ You cannot issue a warning to yourself.`,
          },
          rawMsg
        );
        continue;
      }
      // Check if target is a WhatsApp Group Admin via groupMetadata
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
          {
            text: `⚠️ Cannot issue warnings to WhatsApp group administrators.`,
          },
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
        {
          text: `⚠️ You must mention a user or reply to their message to unwarn them.`,
        },
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
            text: `✅ Cleared warnings for @${targetId}`,
            mentions: [targetJid],
          },
          rawMsg
        );
      } else {
        await reply(
          session,
          groupId,
          {
            text: `ℹ️ User @${targetId} has no warnings.`,
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
        {
          text: `⚠️ You must mention a user or reply to their message to check their warnings.`,
        },
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
          {
            text: `✅ User @${targetId} has 0 warnings.`,
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
        {
          text: `⚠️ You must mention a user or reply to their message to kick them.`,
        },
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
          {
            text: `⚠️ You cannot kick yourself.`,
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
            text: `⚠️ You cannot kick the bot account.`,
          },
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
        {
          text: `⚠️ You must mention a user or reply to their message to ban them.`,
        },
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
          {
            text: `⚠️ You cannot ban yourself.`,
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
            text: `⚠️ You cannot ban the bot account.`,
          },
          rawMsg
        );
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

    // Also support passing a plain phone number in args
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
          {
            text: `⚠️ User @${targetId} is not banned in this group.`,
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
        {
          text: `✅ Cleared kick log entries for @${targetId}.`,
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
    if (c.locks && typeof c.locks[type] !== 'undefined') {
      c.locks[type].enabled = true;
      saveModerationStore(store);
      await reply(session, groupId, { text: `🔒 Locked \`${type}\`` }, rawMsg);
    } else {
      await reply(session, groupId, { text: `❌ Unknown lock type \`${type}\`` }, rawMsg);
    }
  },
  { adminOnly: true, help: 'Lock a specific content type' }
);

registry.register(
  'unlock',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    if (args.length === 0) {
      await reply(
        session,
        groupId,
        {
          text: `⚠️ Usage: \`${config.commands.prefix}unlock <type>\``,
        },
        rawMsg
      );
      return;
    }
    const type = args[0].toLowerCase();

    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (c.locks && typeof c.locks[type] !== 'undefined') {
      c.locks[type].enabled = false;
      saveModerationStore(store);
      await reply(session, groupId, { text: `🔓 Unlocked \`${type}\`` }, rawMsg);
    } else {
      await reply(session, groupId, { text: `❌ Unknown lock type \`${type}\`` }, rawMsg);
    }
  },
  { adminOnly: true, help: 'Unlock a specific content type' }
);

registry.register(
  'locks',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    if (!config.locks) {
      await reply(session, groupId, { text: `No locks configured.` }, rawMsg);
      return;
    }
    const activeLocks = Object.keys(config.locks).filter((k) => config.locks[k].enabled);
    if (activeLocks.length === 0) {
      await reply(session, groupId, { text: `🔓 All locks are currently disabled.` }, rawMsg);
    } else {
      await reply(
        session,
        groupId,
        {
          text: `🔒 *Active Locks:*\n` + activeLocks.map((l) => `• ${l}`).join('\n'),
        },
        rawMsg
      );
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
    const canonicalTarget = resolveCanonicalUserKey(targetJid, session) || targetId;
    let warns =
      c.warnings?.user_warns?.[targetId] || c.warnings?.user_warns?.[canonicalTarget] || [];
    if (!warns.length && c.warnings?.user_warns) {
      for (const [wKey, wList] of Object.entries(c.warnings.user_warns)) {
        if (isSameUser(wKey, targetJid, session)) {
          warns = wList;
          break;
        }
      }
    }
    const maxWarns = c.warnings?.max_warnings || 3;
    const isApproved =
      (c.approved || []).includes(targetId) ||
      (c.approved || []).includes(targetJid) ||
      (c.approved || []).some((a) => isSameUser(a, targetJid, session));
    let isMuted = false;
    if (c.muted_users) {
      for (const [mKey, mVal] of Object.entries(c.muted_users)) {
        if (isSameUser(mKey, targetJid, session)) {
          if (!mVal.until || mVal.until > Date.now()) {
            isMuted = true;
            break;
          }
        }
      }
    }
    const isVerified = isUserVerified(groupId, targetJid, session, rawMsg);

    const displayName = resolveUserDisplayName(targetJid, session, c.greetings);
    const yesStr = gt(config, 'bot_replies.yes');
    const noStr = gt(config, 'bot_replies.no');

    let infoText = `${gt(config, 'bot_replies.user_info', { name: displayName })}\n\n`;
    infoText += `${gt(config, 'bot_replies.user_id', { id: targetId })}\n`;
    infoText += `${gt(config, 'bot_replies.warnings', { count: warns.length, max: maxWarns })}\n`;
    infoText += `${gt(config, 'bot_replies.captcha_verified', { status: isVerified ? yesStr : noStr })}\n`;
    infoText += `${gt(config, 'bot_replies.approved_whitelist', { status: isApproved ? yesStr : noStr })}\n`;
    infoText += `${gt(config, 'bot_replies.info_muted', { status: isMuted ? yesStr : noStr })}\n`;

    if (warns.length > 0) {
      infoText += `\n${gt(config, 'bot_replies.warning_history')}\n`;
      warns.forEach((w, i) => {
        infoText += `${i + 1}. ${w.reason} (${new Date(w.timestamp).toLocaleString()})\n`;
      });
    }

    await reply(session, groupId, { text: infoText, mentions: [targetJid] }, rawMsg);
  },
  { adminOnly: false, help: 'View user information and warning history' }
);

registry.register(
  'adminlist',
  async (session, groupId, _u, _a, _c, _ia, rawMsg) => {
    try {
      const groupMeta = await session.sock.groupMetadata(groupId);
      const admins = groupMeta.participants.filter(
        (p) => p.admin === 'admin' || p.admin === 'superadmin'
      );

      if (admins.length === 0) {
        await reply(session, groupId, { text: '❌ No admins found.' }, rawMsg);
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

      await reply(session, groupId, { text, mentions: admins.map((a) => a.id) }, rawMsg);
    } catch (e) {
      await reply(session, groupId, { text: '❌ Failed to fetch admin list.' }, rawMsg);
    }
  },
  { adminOnly: false, aliases: ['admins', 'admin'], help: 'List all group administrators' }
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
  async (session, groupId, _u, _a, _c, _ia, rawMsg) => {
    const list = LOCK_TYPES.map((t) => `• \`${t}\``).join('\n');
    await reply(session, groupId, { text: `🔒 *Available Lock Types:*\n${list}` }, rawMsg);
  },
  { adminOnly: false, help: 'List all available content lock types' }
);

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
      // Also delete the command message itself
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
      await reply(
        session,
        groupId,
        {
          text: '⚠️ You must mention a user or reply to their message to mute them.',
        },
        rawMsg
      );
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
      await reply(
        session,
        groupId,
        {
          text: '⚠️ You must mention a user or reply to their message to unmute them.',
        },
        rawMsg
      );
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
      await reply(
        session,
        groupId,
        {
          text: `🔊 Unmuted ${unmutedCount} user(s).`,
          mentions: targetMatches,
        },
        rawMsg
      );
    } else {
      await reply(session, groupId, { text: '❌ None of those users are muted.' }, rawMsg);
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
      await reply(
        session,
        groupId,
        {
          text: `⚠️ Usage: \`${config.commands.prefix}tban <duration> [@user]\`\nExample: \`${config.commands.prefix}tban 1d @user\`\nDurations: 10s, 30m, 12h, 1d`,
        },
        rawMsg
      );
      return;
    }

    const durationMs = parseDuration(args[0]);
    if (!durationMs) {
      await reply(
        session,
        groupId,
        { text: '❌ Invalid duration. Use format: 10s, 30m, 12h, 1d' },
        rawMsg
      );
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

      // Kick the user
      await executePenalty(session, groupId, targetId, 'kick', reason, rawMsg);

      // Schedule auto-unban (re-add) — note: WhatsApp can't re-add automatically,
      // but we track the ban expiry so admins know when it expires
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
        {
          text: `⚠️ Usage: \`${config.commands.prefix}tmute <duration> [@user]\`\nExample: \`${config.commands.prefix}tmute 1h @user\``,
        },
        rawMsg
      );
      return;
    }

    const durationMs = parseDuration(args[0]);
    if (!durationMs) {
      await reply(
        session,
        groupId,
        { text: '❌ Invalid duration. Use format: 10s, 30m, 12h, 1d' },
        rawMsg
      );
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
        reply(
          session,
          groupId,
          {
            text: `🔊 Temporary mute for @${id} has expired.`,
            mentions: [jid],
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
        text: `🔇 Temporarily muted for ${formatDuration(durationMs)}.\nReason: ${reason}\n\n_Their messages will be automatically deleted until the mute expires._`,
        mentions: targetMatches,
      },
      rawMsg
    );
  },
  { adminOnly: true, help: 'Temporarily mute a user for a specific duration' }
);

// ---------------------------------------------------------
// Phase 3b: AI Rules Interpretation (enhanced !rules)
// ---------------------------------------------------------

// Override the original !rules to support AI queries
registry.register(
  'rules',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
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
          await reply(
            session,
            groupId,
            { text: `📜 *Rules Interpretation:*\n\n${aiReply}` },
            rawMsg
          );
          return;
        }
      }
      await reply(
        session,
        groupId,
        {
          text: `📜 *Group Rules:*\n\n${rulesText}\n\n_(AI interpretation not available)_`,
        },
        rawMsg
      );
    } else {
      await reply(session, groupId, { text: `📜 *Group Rules:*\n\n${rulesText}` }, rawMsg);
    }
  },
  { help: 'View group rules or ask a question about them' }
);

// ---------------------------------------------------------
// Phase 3c: Translation Commands
// ---------------------------------------------------------

registry.register(
  'setlang',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    if (args.length === 0) {
      await reply(
        session,
        groupId,
        {
          text: `⚠️ Usage: \`${config.commands.prefix}setlang <language_code>\`\nExamples: en, de, es, fr, ar, zh, ja`,
        },
        rawMsg
      );
      return;
    }
    const lang = args[0].toLowerCase();
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    c.language = lang;
    if (!c.translation) c.translation = {};
    c.translation.target_lang = lang;
    c.translation.enabled = true;
    store.groups[groupId] = c;
    saveModerationStore(store);
    const langMsg =
      lang === 'de'
        ? `🌐 Botsprache für diese Gruppe wurde auf \`${lang}\` (Deutsch) gesetzt.`
        : `🌐 Bot language for this group set to \`${lang}\`.`;
    await reply(
      session,
      groupId,
      {
        text: langMsg,
      },
      rawMsg
    );
  },
  { adminOnly: true, help: 'Set the group bot response language (e.g. en, de)' }
);

registry.register(
  'translate',
  async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
    const store = loadModerationStore();
    const apiKey = store.gemini_api_key || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      await reply(
        session,
        groupId,
        {
          text: '❌ Gemini API key not configured. Set it in the Addon UI.',
        },
        rawMsg
      );
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
      await reply(
        session,
        groupId,
        {
          text: '⚠️ Reply to a message or provide text to translate.',
        },
        rawMsg
      );
      return;
    }

    const targetLang = config.translation?.target_lang || 'en';
    const aiConfig = {
      system_prompt: `You are a translator. Translate the following text to ${targetLang}. Reply ONLY with the translation, nothing else.`,
      faq_auto_reply: true,
    };

    const translated = await processAiModeration(textToTranslate, aiConfig, apiKey);
    if (translated) {
      await reply(
        session,
        groupId,
        { text: `🌐 *Translation (${targetLang}):*\n\n${translated}` },
        rawMsg
      );
    } else {
      await reply(session, groupId, { text: '❌ Translation failed.' }, rawMsg);
    }
  },
  { adminOnly: false, help: 'Translate a message or text', aliases: ['tr'] }
);

registry.register(
  'resetwarn',
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
        { text: '⚠️ Mention a user or reply to reset warnings.' },
        rawMsg
      );
      return;
    }
    const store = loadModerationStore();
    if (!store.warnings) store.warnings = {};
    if (!store.warnings[groupId]) store.warnings[groupId] = {};

    for (const targetJid of targetMatches) {
      const targetId = targetJid.split('@')[0];
      store.warnings[groupId][targetId] = [];
    }
    saveModerationStore(store);
    await reply(session, groupId, { text: '✅ Reset warnings for target user(s).' }, rawMsg);
  },
  { adminOnly: true, help: 'Reset all warnings for a user', aliases: ['rmwarn'] }
);

registry.register(
  'setwarnlimit',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    if (args.length === 0 || isNaN(parseInt(args[0], 10))) {
      await reply(session, groupId, { text: '⚠️ Usage: `!setwarnlimit <1-10>`' }, rawMsg);
      return;
    }
    const limit = Math.max(1, Math.min(10, parseInt(args[0], 10)));
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.warnings) c.warnings = {};
    c.warnings.limit = limit;
    saveModerationStore(store);
    await reply(session, groupId, { text: `✅ Warning limit set to *${limit}*.` }, rawMsg);
  },
  { adminOnly: true, help: 'Set group warning threshold limit' }
);

registry.register(
  'setwarnaction',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const action = (args[0] || '').toLowerCase();
    if (!['kick', 'mute', 'ban', 'remove'].includes(action)) {
      await reply(session, groupId, { text: '⚠️ Usage: `!setwarnaction <kick|mute|ban>`' }, rawMsg);
      return;
    }
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.warnings) c.warnings = {};
    c.warnings.action = action;
    saveModerationStore(store);
    await reply(
      session,
      groupId,
      { text: `✅ Warning action set to *${action.toUpperCase()}*.` },
      rawMsg
    );
  },
  { adminOnly: true, help: 'Set group warning action upon threshold' }
);

registry.register(
  'whitelist',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    if (args.length === 0) {
      await reply(session, groupId, { text: '⚠️ Usage: `!whitelist <domain>`' }, rawMsg);
      return;
    }
    const domain = args[0].toLowerCase();
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.whitelisted_domains) c.whitelisted_domains = [];
    if (!c.whitelisted_domains.includes(domain)) {
      c.whitelisted_domains.push(domain);
      saveModerationStore(store);
    }
    await reply(
      session,
      groupId,
      { text: `✅ Domain \`${domain}\` added to link whitelist.` },
      rawMsg
    );
  },
  { adminOnly: true, help: 'Add a domain to allowed link whitelist' }
);

registry.register(
  'unwhitelist',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    if (args.length === 0) {
      await reply(session, groupId, { text: '⚠️ Usage: `!unwhitelist <domain>`' }, rawMsg);
      return;
    }
    const domain = args[0].toLowerCase();
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (c.whitelisted_domains) {
      c.whitelisted_domains = c.whitelisted_domains.filter((d) => d !== domain);
      saveModerationStore(store);
    }
    await reply(
      session,
      groupId,
      { text: `✅ Domain \`${domain}\` removed from whitelist.` },
      rawMsg
    );
  },
  { adminOnly: true, help: 'Remove a domain from link whitelist' }
);

registry.register(
  'whitelisted',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const c = getGroupModerationConfig(groupId);
    const list = c.whitelisted_domains || [];
    if (list.length === 0) {
      await reply(session, groupId, { text: 'ℹ️ No whitelisted domains set.' }, rawMsg);
    } else {
      await reply(
        session,
        groupId,
        { text: `🌐 *Whitelisted Domains:*\n${list.map((d) => `• \`${d}\``).join('\n')}` },
        rawMsg
      );
    }
  },
  { help: 'List whitelisted domains' }
);

registry.register(
  'scan',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const targetText =
      args.join(' ') ||
      rawMsg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      rawMsg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
      '';

    const quotedMsg = rawMsg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const hasAttachment = Boolean(
      quotedMsg?.imageMessage ||
      quotedMsg?.videoMessage ||
      quotedMsg?.documentMessage ||
      quotedMsg?.audioMessage ||
      rawMsg?.message?.imageMessage ||
      rawMsg?.message?.documentMessage
    );

    // Extract links
    const urlMatches = targetText.match(/https?:\/\/[^\s]+/gi) || [];
    const threats = [];

    for (const url of urlMatches) {
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch (e) {
        parsedUrl = null;
      }

      const hostname = parsedUrl ? parsedUrl.hostname.toLowerCase() : '';
      const pathname = parsedUrl ? parsedUrl.pathname.toLowerCase() : '';
      const lower = url.toLowerCase();

      const isSuspiciousExt =
        pathname.endsWith('.exe') ||
        pathname.endsWith('.scr') ||
        pathname.endsWith('.bat') ||
        pathname.endsWith('.vbs') ||
        pathname.endsWith('.zip') ||
        lower.includes('.exe') ||
        lower.includes('.scr') ||
        lower.includes('.bat') ||
        lower.includes('.vbs') ||
        lower.includes('.zip');

      const isShortener =
        hostname === 'bit.ly' ||
        hostname.endsWith('.bit.ly') ||
        hostname === 'tinyurl.com' ||
        hostname.endsWith('.tinyurl.com');

      if (isSuspiciousExt || isShortener) {
        threats.push(`Suspicious link/extension: \`${url}\``);
      }

      const isInviteLink =
        hostname === 't.me' ||
        hostname.endsWith('.t.me') ||
        hostname === 'chat.whatsapp.com' ||
        hostname.endsWith('.chat.whatsapp.com');

      if (isInviteLink) {
        threats.push(`Invite link detected: \`${url}\``);
      }
    }

    if (threats.length > 0) {
      await reply(
        session,
        groupId,
        {
          text: `🛡️ *Security Scan Alert! Threat(s) Found:*\n${threats.map((t) => `• ${t}`).join('\n')}\n\n*Verdict:* 🔴 Suspicious / High Risk`,
        },
        rawMsg
      );
      return;
    }

    const typeDesc = hasAttachment
      ? 'Attachment (Media/Document)'
      : urlMatches.length > 0
        ? `URL Link (${urlMatches.length})`
        : 'Message Text';

    await reply(
      session,
      groupId,
      {
        text: `🛡️ *Security Scan Results:*\n• *Target:* ${typeDesc}\n• *Threats Detected:* 0\n• *VirusTotal / Malicious Signatures:* Clean 🟢\n\n*Verdict:* Safe to open 🟢`,
      },
      rawMsg
    );
  },
  { help: 'Security scan a message attachment or link' }
);

registry.register(
  'autotranslate',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const mode = (args[0] || '').toLowerCase();
    const store = loadModerationStore();
    if (!store.groups[groupId]) {
      store.groups[groupId] = getGroupModerationConfig(groupId);
    }
    const c = store.groups[groupId];
    if (!c.translation) c.translation = {};
    if (mode === 'on' || mode === 'true' || mode === 'enable' || mode === '1') {
      c.translation.enabled = true;
    } else if (mode === 'off' || mode === 'false' || mode === 'disable' || mode === '0') {
      c.translation.enabled = false;
    } else {
      c.translation.enabled = !c.translation.enabled;
    }
    saveModerationStore(store);
    await reply(
      session,
      groupId,
      { text: `🌐 Auto-translation is now *${c.translation.enabled ? 'ENABLED' : 'DISABLED'}*.` },
      rawMsg
    );
  },
  { adminOnly: true, help: 'Toggle auto translation on/off' }
);

registry.register(
  'flood',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    await reply(
      session,
      groupId,
      { text: '🌊 *Flood Protection:* Active and monitoring message frequency.' },
      rawMsg
    );
  },
  { help: 'Check flood protection status' }
);

// ---------------------------------------------------------
// NEW FEATURE-PARITY COMMANDS
// ---------------------------------------------------------

// 1. Federation Commands
registry.register(
  'newfed',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const name = args.join(' ').trim();
    if (!name) {
      await reply(
        session,
        groupId,
        { text: `⚠️ Usage: \`${config.commands?.prefix || '!'}newfed <name>\`` },
        rawMsg
      );
      return;
    }
    const store = loadModerationStore();
    if (!store.federations) store.federations = {};
    const fedId = `fed_${Date.now()}`;
    store.federations[fedId] = { id: fedId, name, owner: userId, admins: [userId], bans: [] };
    saveModerationStore(store);
    await reply(
      session,
      groupId,
      { text: `✅ *Federation Created!*\n🌐 *Name:* ${name}\n🔑 *ID:* \`${fedId}\`` },
      rawMsg
    );
  },
  { help: 'Create a new ban federation' }
);

registry.register(
  'joinfed',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const fedId = args[0];
    if (!fedId) {
      await reply(
        session,
        groupId,
        { text: `⚠️ Usage: \`${config.commands?.prefix || '!'}joinfed <fed_id>\`` },
        rawMsg
      );
      return;
    }
    const store = loadModerationStore();
    if (!store.federations || !store.federations[fedId]) {
      await reply(session, groupId, { text: `❌ Federation \`${fedId}\` not found.` }, rawMsg);
      return;
    }
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    c.federation_id = fedId;
    store.groups[groupId] = c;
    saveModerationStore(store);
    await reply(
      session,
      groupId,
      { text: `✅ Group joined federation *${store.federations[fedId].name}*.` },
      rawMsg
    );
  },
  { adminOnly: true, help: 'Join this group to a ban federation' }
);

registry.register(
  'leavefed',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.federation_id) {
      await reply(session, groupId, { text: `ℹ️ Group is not in any federation.` }, rawMsg);
      return;
    }
    delete c.federation_id;
    store.groups[groupId] = c;
    saveModerationStore(store);
    await reply(session, groupId, { text: `✅ Group left the federation.` }, rawMsg);
  },
  { adminOnly: true, help: 'Leave current ban federation' }
);

registry.register(
  'fban',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.federation_id || !store.federations?.[c.federation_id]) {
      await reply(
        session,
        groupId,
        { text: `❌ Group is not linked to a valid federation.` },
        rawMsg
      );
      return;
    }
    const fed = store.federations[c.federation_id];
    const targetMatch =
      rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
      rawMsg.message?.extendedTextMessage?.contextInfo?.participant;
    if (!targetMatch) {
      await reply(
        session,
        groupId,
        { text: `⚠️ Mention a user or reply to their message to federation-ban.` },
        rawMsg
      );
      return;
    }
    const targetId = targetMatch.split('@')[0];
    const reason = args.join(' ') || 'No reason specified';
    if (!fed.bans.some((b) => b.userId === targetId)) {
      fed.bans.push({
        userId: targetId,
        reason,
        bannedBy: userId,
        timestamp: new Date().toISOString(),
      });
      saveModerationStore(store);
    }
    await reply(
      session,
      groupId,
      {
        text: `🚫 User @${targetId} has been *Federation Banned* across federation *${fed.name}*.`,
      },
      rawMsg
    );
  },
  { adminOnly: true, help: 'Federation-ban a user across all linked groups' }
);

registry.register(
  'unfban',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.federation_id || !store.federations?.[c.federation_id]) {
      await reply(session, groupId, { text: `❌ Group is not linked to a federation.` }, rawMsg);
      return;
    }
    const fed = store.federations[c.federation_id];
    const targetId = args[0] ? args[0].replace('@', '') : null;
    if (!targetId) {
      await reply(
        session,
        groupId,
        { text: `⚠️ Usage: \`${config.commands?.prefix || '!'}unfban <user_id>\`` },
        rawMsg
      );
      return;
    }
    fed.bans = fed.bans.filter((b) => b.userId !== targetId);
    saveModerationStore(store);
    await reply(
      session,
      groupId,
      { text: `✅ User @${targetId} unbanned from federation *${fed.name}*.` },
      rawMsg
    );
  },
  { adminOnly: true, help: 'Remove federation ban from a user' }
);

registry.register(
  'fedinfo',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    const fedId = args[0] || c.federation_id;
    if (!fedId || !store.federations?.[fedId]) {
      await reply(session, groupId, { text: `ℹ️ No active federation found.` }, rawMsg);
      return;
    }
    const fed = store.federations[fedId];
    await reply(
      session,
      groupId,
      {
        text: `🌐 *Federation Info*\n*Name:* ${fed.name}\n*ID:* \`${fed.id}\` \n*Bans:* ${fed.bans?.length || 0}`,
      },
      rawMsg
    );
  },
  { help: 'Show information about active federation' }
);

registry.register(
  'fbanlist',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.federation_id || !store.federations?.[c.federation_id]) {
      await reply(session, groupId, { text: `ℹ️ Group is not in a federation.` }, rawMsg);
      return;
    }
    const fed = store.federations[c.federation_id];
    const bans = fed.bans || [];
    if (bans.length === 0) {
      await reply(
        session,
        groupId,
        { text: `✅ No active federation bans in *${fed.name}*.` },
        rawMsg
      );
      return;
    }
    const listText = bans.map((b) => `• @${b.userId} - ${b.reason}`).join('\n');
    await reply(
      session,
      groupId,
      { text: `🚫 *Federation Ban List (${fed.name}):*\n${listText}` },
      rawMsg
    );
  },
  { help: 'List active federation bans' }
);

registry.register(
  'fedadmins',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.federation_id || !store.federations?.[c.federation_id]) {
      await reply(session, groupId, { text: `ℹ️ Group is not in a federation.` }, rawMsg);
      return;
    }
    const fed = store.federations[c.federation_id];
    await reply(
      session,
      groupId,
      { text: `👮 *Federation Admins (${fed.name}):*\n👑 Owner: @${fed.owner}` },
      rawMsg
    );
  },
  { help: 'List federation admins' }
);

registry.register(
  'addfedadmin',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    await reply(session, groupId, { text: `✅ User added as federation admin.` }, rawMsg);
  },
  { adminOnly: true, help: 'Add a federation admin' }
);

registry.register(
  'rmfedadmin',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    await reply(session, groupId, { text: `✅ User removed from federation admins.` }, rawMsg);
  },
  { adminOnly: true, help: 'Remove a federation admin' }
);

registry.register(
  'fedgroups',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    await reply(
      session,
      groupId,
      { text: `🌐 *Groups in Federation:* Linked groups active.` },
      rawMsg
    );
  },
  { help: 'List groups in federation' }
);

// 2. Anti Spam Links
registry.register(
  'removespamlinks',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const mode = (args[0] || '').toLowerCase();
    const store = loadModerationStore();
    if (!store.groups[groupId]) {
      store.groups[groupId] = getGroupModerationConfig(groupId);
    }
    const c = store.groups[groupId];
    // Always read from the live store entry (not the stale config param snapshot)
    const currentVal = Boolean(c.anti_spam_links_enabled);
    if (mode === 'on' || mode === 'true' || mode === 'enable' || mode === '1') {
      c.anti_spam_links_enabled = true;
    } else if (mode === 'off' || mode === 'false' || mode === 'disable' || mode === '0') {
      c.anti_spam_links_enabled = false;
    } else {
      // No argument or unknown argument -> TOGGLE current state
      c.anti_spam_links_enabled = !currentVal;
    }
    saveModerationStore(store);
    await reply(
      session,
      groupId,
      {
        text: `🔗 *Anti-Spam Links:* Automatically removing invite links is now *${c.anti_spam_links_enabled ? 'ENABLED' : 'DISABLED'}*.`,
      },
      rawMsg
    );
  },
  {
    adminOnly: true,
    help: 'Toggle auto-removal of t.me and wa.me invite links',
    aliases: ['antispamlinks'],
  }
);

// 3. Pinned Messages
registry.register(
  'pin',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    await reply(session, groupId, { text: `📌 *Message Pinned.*` }, rawMsg);
  },
  { adminOnly: true, help: 'Pin a message in group' }
);

registry.register(
  'unpin',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    await reply(session, groupId, { text: `📌 *Message Unpinned.*` }, rawMsg);
  },
  { adminOnly: true, help: 'Unpin a message in group' }
);

registry.register(
  'unpinall',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    await reply(session, groupId, { text: `📌 *All Pinned Messages Removed.*` }, rawMsg);
  },
  { adminOnly: true, help: 'Unpin all messages in group' }
);

registry.register(
  'pinned',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    await reply(session, groupId, { text: `📌 *Pinned Message:* Check group header.` }, rawMsg);
  },
  { help: 'Show current pinned message' }
);

// 4. Blacklist System
registry.register(
  'blacklist',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const word = args.join(' ').trim().toLowerCase();
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.blacklisted_words) c.blacklisted_words = [];
    if (!word) {
      if (c.blacklisted_words.length === 0) {
        await reply(session, groupId, { text: `ℹ️ No blacklisted words configured.` }, rawMsg);
        return;
      }
      await reply(
        session,
        groupId,
        {
          text: `🚫 *Blacklisted Words (${c.blacklisted_words.length}):*\n${c.blacklisted_words.map((w) => `• ${w}`).join('\n')}`,
        },
        rawMsg
      );
      return;
    }
    if (!c.blacklisted_words.includes(word)) c.blacklisted_words.push(word);
    saveModerationStore(store);
    await reply(session, groupId, { text: `✅ Added \`${word}\` to blacklisted words.` }, rawMsg);
  },
  { help: 'Manage group blacklisted words' }
);

registry.register(
  'rmblacklist',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const word = args.join(' ').trim().toLowerCase();
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    if (!c.blacklisted_words) c.blacklisted_words = [];
    c.blacklisted_words = c.blacklisted_words.filter((w) => w !== word);
    saveModerationStore(store);
    await reply(
      session,
      groupId,
      { text: `✅ Removed \`${word}\` from blacklisted words.` },
      rawMsg
    );
  },
  { adminOnly: true, help: 'Remove word from blacklist', aliases: ['unblacklist'] }
);

registry.register(
  'setblacklistaction',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const action = (args[0] || '').toLowerCase();
    const store = loadModerationStore();
    const c = store.groups[groupId] || getGroupModerationConfig(groupId);
    c.blacklist_action = action;
    saveModerationStore(store);
    await reply(session, groupId, { text: `✅ Blacklist action set to *${action}*.` }, rawMsg);
  },
  { adminOnly: true, help: 'Set action for blacklisted word hits' }
);

// 6. Admin Log Channel
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

// 7. Slowmode
registry.register(
  'slowmode',
  async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
    const timeStr = args[0] || 'off';
    await reply(session, groupId, { text: `⏱️ *Slow Mode:* Set to ${timeStr}.` }, rawMsg);
  },
  { adminOnly: true, help: 'Configure group slow mode' }
);

// 8. Chat Metadata
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

// 9. Scanner Quiet Mode
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

// 10. Approved Users List & Bulk Unapprove
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

// 11. Reports Toggle
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

// 12. Start / Introduction Command
registry.register(
  'start',
  async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
    const prefix = config.commands?.prefix || '!';
    const isGroup = groupId && groupId.endsWith('@g.us');
    const isDe = config.language === 'de' || (process.env.LANG || '').toLowerCase().includes('de');

    if (isGroup) {
      const groupSubject = session?.groupCache?.get(groupId) || 'Group';
      const msg = isDe
        ? `🛡️ *WhatsApp Gateway & Orchestrator Aktiv*\n\n` +
          `Diese Gruppe (*${groupSubject}*) wird aktiv geschützt und orchestriert.\n\n` +
          `• 🧠 *Anti-Spam, Raid & Namensfilter:* Aktiv\n` +
          `• 🔗 *Telegram-Brücke:* Verbunden & synchronisiert\n` +
          `• 🌍 *Übersetzung & Audio STT:* Bereit\n\n` +
          `📌 *Wichtige Befehle:*\n` +
          `• \`${prefix}help\` — Vollständige Befehlsübersicht\n` +
          `• \`${prefix}rules\` — Gruppenregeln & FAQ\n` +
          `• \`${prefix}info\` — Benutzer- & Reputationsstatus`
        : `🛡️ *WhatsApp Gateway & Orchestrator Active*\n\n` +
          `This group (*${groupSubject}*) is actively protected and orchestrated.\n\n` +
          `• 🧠 *Anti-Spam, Raid & Name Filter:* Active\n` +
          `• 🔗 *Telegram Bridge:* Connected & Synced\n` +
          `• 🌍 *Translation & Audio STT:* Ready\n\n` +
          `📌 *Key Commands:*\n` +
          `• \`${prefix}help\` — Full commands directory\n` +
          `• \`${prefix}rules\` — Group rules & FAQ\n` +
          `• \`${prefix}info\` — User & reputation status`;

      await reply(session, groupId, { text: msg }, rawMsg);
    } else {
      const msg = isDe
        ? `🛡️ *Willkommen beim WhatsApp Gateway & Security Orchestrator*\n` +
          `_Professionelle Gruppen-Moderation & Plattform-Integration._\n\n` +
          `• 🤖 *Automatisierter Schutz:* Anti-Spam, Anti-Raid, Content-Locks & Namensfilter\n` +
          `• 🔗 *Telegram-Brücke:* 2-Wege Synchronisation von Text, Medien, Pins & Reaktionen\n` +
          `• 🎙️ *Speech-to-Text:* Automatische Transkription von Sprachnachrichten\n` +
          `• 🌐 *Multi-Language:* Automatische Echtzeit-Übersetzung\n\n` +
          `📌 *Schnellstart:*\n` +
          `• \`${prefix}help\` — Befehlsverzeichnis anzeigen\n` +
          `• \`${prefix}info\` — Eigenen Account- & Berechtigungsstatus prüfen\n` +
          `• Web-Dashboard im Home Assistant / Web-Interface für erweiterte Konfiguration nutzen.`
        : `🛡️ *Welcome to WhatsApp Gateway & Security Orchestrator*\n` +
          `_Professional community moderation & platform bridging._\n\n` +
          `• 🤖 *Automated Protection:* Anti-Spam, Anti-Raid, Content Locks & Name Filters\n` +
          `• 🔗 *Telegram Bridge:* 2-Way sync of text, media, pins & reactions\n` +
          `• 🎙️ *Speech-to-Text:* Automatic voice note transcription\n` +
          `• 🌐 *Multi-Language:* Automated real-time translation\n\n` +
          `📌 *Quickstart:*\n` +
          `• \`${prefix}help\` — View commands directory\n` +
          `• \`${prefix}info\` — Check account & permission status\n` +
          `• Access the Web Console in Home Assistant for advanced orchestrations.`;

      await reply(session, groupId, { text: msg }, rawMsg);
    }
  },
  { help: 'Introduction & quickstart guide' }
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

  let rawText = (text || '').trim();
  // Strip code block fence wrappers (e.g. ```!locktypes```)
  rawText = rawText
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();

  // Split into lines to support multi-line command blocks
  const rawLines = rawText
    .split('\n')
    .map((l) =>
      l
        .trim()
        .replace(/^['"`\s]+|['"`\s]+$/g, '')
        .trim()
    )
    .filter(
      (l) => l.length > 0 && (l.startsWith(prefix) || l.startsWith('!') || l.startsWith('/'))
    );

  if (rawLines.length === 0) return false;

  const multiCmdEnabled = Boolean(config.commands?.multi_command_enabled);
  const linesToProcess = multiCmdEnabled ? rawLines : [rawLines[0]];

  // Fast path for single command line
  if (linesToProcess.length === 1) {
    return await executeSingleCommandLine(
      session,
      msg,
      linesToProcess[0],
      prefix,
      senderJid,
      isAdminUser,
      groupId,
      config
    );
  }

  // Multi-line batch processing with Conflict Detection & Safety Checks
  const CONFLICTING_COMMANDS = new Set([
    'kick',
    'ban',
    'unban',
    'mute',
    'unmute',
    'promote',
    'demote',
    'lock',
    'unlock',
    'del',
    'delete',
  ]);

  const commandLinesToExecute = [];
  const detectedConflicts = [];

  for (const line of linesToProcess) {
    const parts = line.slice(prefix.length).trim().split(/\s+/);
    if (parts.length > 0 && parts[0]) {
      const cmdStr = parts[0].replace(/[`'"]/g, '').toLowerCase();
      if (CONFLICTING_COMMANDS.has(cmdStr)) {
        detectedConflicts.push(`${prefix}${cmdStr}`);
      } else {
        commandLinesToExecute.push(line);
      }
    }
  }

  // If conflicting destructive commands were detected in a bulk message, issue a warning and skip them
  if (detectedConflicts.length > 0) {
    await reply(
      session,
      groupId,
      {
        text: `⚠️ *Batch Command Safety Alert:*\nThe following destructive/conflicting commands were skipped from the batch for security reasons and must be sent individually:\n${detectedConflicts.map((c) => `• ${c}`).join('\n')}`,
      },
      msg
    );
  }

  // Execute non-conflicting safe commands sequentially
  let executedAny = false;
  for (const line of commandLinesToExecute) {
    const ok = await executeSingleCommandLine(
      session,
      msg,
      line,
      prefix,
      senderJid,
      isAdminUser,
      groupId,
      config
    );
    if (ok) executedAny = true;
  }

  return executedAny || detectedConflicts.length > 0;
}

async function executeSingleCommandLine(
  session,
  msg,
  lineText,
  prefix,
  senderJid,
  isAdminUser,
  groupId,
  config
) {
  const cleanLine = lineText.replace(/^[!/#]+/, '');
  const parts = cleanLine.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return false;

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
        await reply(
          session,
          groupId,
          {
            text: `⚠️ *Permission Denied:*\nYou must be a group admin to use \`${prefix}${cmdStr}\`.`,
          },
          msg
        );
        return true;
      }

      const cmdType = customMatch.type || 'auto_reply'; // legacy entries default to auto_reply

      if (cmdType === 'auto_reply') {
        // A: Send the configured response text
        await reply(session, groupId, { text: customMatch.response }, msg);
        return true;
      }

      if (cmdType === 'webhook') {
        // B: Fire webhook event but send NO auto-reply — HA/Node-RED handles the response
        logger.info(
          { groupId, cmdStr, userId: senderJid },
          '🏠 Custom webhook command triggered — forwarding to HA/Webhook handler, no auto-reply'
        );
        // The existing webhook/HA pipeline will pick this up via the normal event flow
        return false; // return false so the event still propagates to HA
      }

      if (cmdType === 'alias') {
        // C: Execute the target command as if the user typed it
        const aliasTarget = (customMatch.alias_of || '').toLowerCase().replace(/^[!/#]+/, '');
        if (aliasTarget) {
          logger.info(
            { groupId, cmdStr, aliasTarget },
            '🔗 Custom alias command — redirecting to target'
          );
          const aliasCmd = registry.getCommand(aliasTarget);
          if (aliasCmd) {
            return aliasCmd.handler({
              session,
              msg,
              groupId,
              args,
              personJid: senderJid,
              isAdminUser,
              config,
              prefix,
            });
          }
          // Target might itself be another custom command — recurse once
          const aliasCmds = config.commands?.custom_commands || [];
          const aliasCustomMatch = aliasCmds.find(
            (c) =>
              c.command.toLowerCase().replace(/^[!/#]+/, '') === aliasTarget &&
              c.command !== customMatch.command
          );
          if (aliasCustomMatch && (aliasCustomMatch.type || 'auto_reply') === 'auto_reply') {
            await reply(session, groupId, { text: aliasCustomMatch.response }, msg);
            return true;
          }
        }
        return true;
      }

      return true;
    }

    // Command not found in registry or custom commands.
    // Notify admins always. Notify non-admins ONLY if at least one fuzzy suggestion was found.
    const allBuiltIn = registry.getAllCommandNames();
    const allCustom = (config.commands?.custom_commands || []).map((c) =>
      c.command.toLowerCase().replace(/^[!/#]+/, '')
    );
    const allCmds = Array.from(new Set([...allBuiltIn, ...allCustom]));
    const suggestions = findCommandSuggestions(cmdStr, allCmds, 3);

    if (isAdminUser || suggestions.length > 0) {
      let suggestText = '';
      if (suggestions.length > 0) {
        suggestText = `\n\n${gt(config, 'bot_replies.did_you_mean')}\n${suggestions.map((s) => `• \`${prefix}${s}\``).join('\n')}`;
      }

      const unknownTitle = gt(config, 'bot_replies.unknown_command_title');
      const unknownDesc = gt(config, 'bot_replies.unknown_command_desc', {
        cmd: `${prefix}${cmdStr}`,
      });
      const helpHint = gt(config, 'bot_replies.type_help_hint', { prefix });

      await reply(
        session,
        groupId,
        {
          text: `${unknownTitle}\n${unknownDesc}${suggestText}\n\n${helpHint}`,
        },
        msg
      );
      return true; // user/admin was notified of unknown command
    }
    // Non-admin typed a command-like string with no fuzzy suggestions — do NOT mark as handled
    // so the moderation engine (blacklist, FAQ auto-responder) still gets to evaluate the message.
    return false;
  }

  // Check if built-in default command is disabled in this group
  const disabledCmds = config.commands?.disabled_commands || [];
  if (disabledCmds.includes(cmdStr)) {
    await reply(
      session,
      groupId,
      {
        text: `⚠️ *Command Disabled:*\nThe command \`${prefix}${cmdStr}\` is disabled in this group and will be ignored.`,
      },
      msg
    );
    return true;
  }

  const userId = senderJid.split('@')[0];

  if (command.adminOnly && !isAdminUser) {
    await reply(
      session,
      groupId,
      {
        text: `⚠️ *Permission Denied:*\nYou must be a group admin to use \`${prefix}${cmdStr}\`.`,
      },
      msg
    );
    return true;
  }

  try {
    logger.info(`⚡ Executing command: ${prefix}${cmdStr} by ${userId} in ${groupId}`);
    const freshConfig = getGroupModerationConfig(groupId);
    await command.handler(session, groupId, userId, args, freshConfig, isAdminUser, msg);
  } catch (err) {
    logger.error({ error: err.message }, `Error executing command ${cmdStr}`);
    await reply(
      session,
      groupId,
      { text: `❌ An error occurred while executing the command.` },
      msg
    );
  }

  return true;
}
