import { loadModerationStore, getGroupModerationConfig } from './store.js';
import { reply } from '../actions.js';
import { logger } from '../../logger.js';
import { gt } from './engine/translations.js';
import { findCommandSuggestions, levenshteinDistance } from './commands/suggestions.js';
import { registerAdminCommands, parseDuration, formatDuration, pendingTempActions } from './commands/admin.js';
import { registerInfoCommands, LOCK_TYPES } from './commands/info.js';
import { registerConfigCommands } from './commands/config.js';

export class CommandRegistry {
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

export const registry = new CommandRegistry();

// Register all modular commands
registerAdminCommands(registry);
registerInfoCommands(registry);
registerConfigCommands(registry);

export { findCommandSuggestions, levenshteinDistance, parseDuration, formatDuration, pendingTempActions, LOCK_TYPES };

export async function processCommand(session, msg, text, senderJid, isAdminUser, groupId) {
  const store = loadModerationStore();
  if (!store.global_enabled) return false;

  const isPrivateChat = !groupId || !groupId.endsWith('@g.us');
  const config = getGroupModerationConfig(groupId);
  if (!isPrivateChat && (!config.enabled || !config.commands?.enabled)) return false;

  const prefix = config.commands?.prefix || '!';

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
    .filter((l) => {
      if (l.length === 0) return false;
      if (l.startsWith(prefix) || l.startsWith('!') || l.startsWith('/')) return true;
      if (isPrivateChat) {
        const firstWord = l.split(/\s+/)[0].toLowerCase();
        return registry.getCommand(firstWord) !== undefined;
      }
      return false;
    });

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

      const cmdType = customMatch.type || 'auto_reply';

      if (cmdType === 'auto_reply') {
        await reply(session, groupId, { text: customMatch.response }, msg);
        return true;
      }

      if (cmdType === 'webhook') {
        logger.info(
          { groupId, cmdStr, userId: senderJid },
          '🏠 Custom webhook command triggered — forwarding to HA/Webhook handler, no auto-reply'
        );
        return false;
      }

      if (cmdType === 'alias') {
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

    const allBuiltIn = registry.getAllCommandNames();
    const allCustom = (config.commands?.custom_commands || []).map((c) =>
      c.command.toLowerCase().replace(/^[!/#]+/, '')
    );
    const allCmds = Array.from(new Set([...allBuiltIn, ...allCustom]));
    const suggestions = findCommandSuggestions(cmdStr, allCmds, 3);

    const isPrivateChat = !groupId || !groupId.endsWith('@g.us');
    if (isAdminUser || isPrivateChat || suggestions.length > 0) {
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
      return true;
    }
    return false;
  }

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
