import { logger } from '../../logger.js';

export const BRIDGE_DEFAULT_COMMANDS = [
  { command: 'status', description: 'View WhatsApp Bridge & Gateway Connection Status' },
  { command: 'ping', description: 'Check WhatsApp Gateway responsiveness & latency' },
  { command: 'help', description: 'Show WhatsApp Bridge user guide & command manual' },
  { command: 'sync', description: 'Trigger manual sync status check for mapped chats' },
];

export const BRIDGE_DEFAULT_DESCRIPTION =
  '🟢 WhatsApp Gateway Bridge Bot.\n\n' +
  'Bidirectional message bridging between WhatsApp and Telegram chats, including text, media, reactions, deletions & polls.\n\n' +
  'Docs: https://faserf.github.io/ha-whatsapp/';

export const BRIDGE_DEFAULT_SHORT_DESCRIPTION =
  'WhatsApp <-> Telegram Bridge Bot. https://faserf.github.io/ha-whatsapp/';



export async function runTelegramBridgeAudit(bot) {
  const checks = [];

  let botInfo = null;
  try {
    botInfo = await bot.getMe();
  } catch (e) {
    /* ignore */
  }

  // 1. Bridge Commands Check
  try {
    const registered = (await bot.request('getMyCommands')) || [];
    const registeredMap = new Map(registered.map((c) => [c.command, c.description]));
    const missing = BRIDGE_DEFAULT_COMMANDS.filter((c) => !registeredMap.has(c.command));

    if (missing.length === 0) {
      checks.push({
        key: 'commands',
        title: 'WhatsApp Bridge Commands',
        status: 'ok',
        message: `All ${BRIDGE_DEFAULT_COMMANDS.length} bridge commands (/status, /ping, /help, /sync) are registered.`,
        fixable_via_api: true,
      });
    } else {
      checks.push({
        key: 'commands',
        title: 'WhatsApp Bridge Commands',
        status: 'warning',
        message: `${missing.length} bridge command(s) missing in BotFather (${missing.map((c) => '/' + c.command).join(', ')}).`,
        fixable_via_api: true,
        details: { missing: missing.map((c) => c.command) },
      });
    }
  } catch (e) {
    checks.push({
      key: 'commands',
      title: 'WhatsApp Bridge Commands',
      status: 'error',
      message: `Failed to verify commands: ${e.message}`,
      fixable_via_api: true,
    });
  }

  // 2. Profile Description Check
  try {
    const desc = await bot.request('getMyDescription');
    if (desc && desc.description && desc.description.trim().length > 5) {
      checks.push({
        key: 'description',
        title: 'Bridge Bot Description',
        status: 'ok',
        message: 'Bot profile description is populated.',
        fixable_via_api: true,
      });
    } else {
      checks.push({
        key: 'description',
        title: 'Bridge Bot Description',
        status: 'warning',
        message: 'Bot profile description is empty or missing.',
        fixable_via_api: true,
      });
    }
  } catch (e) {
    checks.push({
      key: 'description',
      title: 'Bridge Bot Description',
      status: 'warning',
      message: `Check failed: ${e.message}`,
      fixable_via_api: true,
    });
  }

  // 3. Short Description Check
  try {
    const shortDesc = await bot.request('getMyShortDescription');
    if (shortDesc && shortDesc.short_description && shortDesc.short_description.trim().length > 5) {
      checks.push({
        key: 'short_description',
        title: 'Bridge Bot Short Description',
        status: 'ok',
        message: 'Bot short description (About text) is configured.',
        fixable_via_api: true,
      });
    } else {
      checks.push({
        key: 'short_description',
        title: 'Bridge Bot Short Description',
        status: 'warning',
        message: 'Bot short description is missing.',
        fixable_via_api: true,
      });
    }
  } catch (e) {
    checks.push({
      key: 'short_description',
      title: 'Bridge Bot Short Description',
      status: 'warning',
      message: `Check failed: ${e.message}`,
      fixable_via_api: true,
    });
  }

  // 4. Group Privacy Mode Check (Instructions)
  const username = botInfo ? botInfo.username : 'your_bot';
  checks.push({
    key: 'group_privacy',
    title: 'Telegram Group Privacy Mode',
    status: 'warning',
    message: 'To relay messages from Telegram group chats to WhatsApp, Group Privacy MUST be turned OFF in BotFather.',
    fixable_via_api: false,
    manual_instructions:
      `1. Open @BotFather on Telegram.\n` +
      `2. Send /mybots and select @${username}.\n` +
      `3. Click 'Bot Settings' -> 'Group Privacy'.\n` +
      `4. Click 'Turn off' so the bot can receive and mirror group messages to WhatsApp.`,
  });

  const okCount = checks.filter((c) => c.status === 'ok').length;
  const score = Math.round((okCount / checks.length) * 100);

  return {
    bot_id: botInfo ? botInfo.id : null,
    username: username,
    score_percentage: score,
    checks: checks,
  };
}

export async function executeTelegramBridgeFix(bot, fixKeys = null) {
  const results = {};
  const keysToFix = fixKeys || ['commands', 'description', 'short_description'];

  if (keysToFix.includes('commands')) {
    try {
      await bot.request('setMyCommands', { commands: BRIDGE_DEFAULT_COMMANDS });
      results.commands = { success: true, message: 'Updated bridge commands in BotFather (/status, /ping, /help, /sync).' };
    } catch (e) {
      results.commands = { success: false, error: e.message };
    }
  }

  if (keysToFix.includes('description')) {
    try {
      await bot.request('setMyDescription', { description: BRIDGE_DEFAULT_DESCRIPTION });
      results.description = { success: true, message: 'Updated bot profile description.' };
    } catch (e) {
      results.description = { success: false, error: e.message };
    }
  }

  if (keysToFix.includes('short_description')) {
    try {
      await bot.request('setMyShortDescription', { short_description: BRIDGE_DEFAULT_SHORT_DESCRIPTION });
      results.short_description = { success: true, message: 'Updated bot short description (About).' };
    } catch (e) {
      results.short_description = { success: false, error: e.message };
    }
  }

  return results;
}
