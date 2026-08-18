import { registry, parseDuration, processCommand } from '../src/whatsapp/moderation/commands.js';
import {
  getGroupModerationConfig,
  setGroupModerationConfig,
  loadModerationStore,
} from '../src/whatsapp/moderation/store.js';
import { resetBotOutboundSpamGuard } from '../src/whatsapp/actions.js';

let failed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    failed++;
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Running Command Engine Unit Tests (Full Suite)');
  console.log('==================================================');
  resetBotOutboundSpamGuard();

  // Phase 1 Commands
  assert(registry.getCommand('help') !== undefined, 'help command is registered');
  assert(registry.getCommand('ping') !== undefined, 'ping command is registered');
  assert(registry.getCommand('warn') !== undefined, 'warn command is registered');
  assert(registry.getCommand('warns') !== undefined, 'warns command is registered');
  assert(registry.getCommand('kick') !== undefined, 'kick command is registered');
  assert(registry.getCommand('ban') !== undefined, 'ban command (alias) is registered');
  assert(registry.getCommand('lock') !== undefined, 'lock command is registered');
  assert(registry.getCommand('unlock') !== undefined, 'unlock command is registered');
  assert(registry.getCommand('locks') !== undefined, 'locks command is registered');
  assert(registry.getCommand('id') !== undefined, 'id command is registered');
  assert(registry.getCommand('rules') !== undefined, 'rules command is registered');
  assert(registry.getCommand('unwarn') !== undefined, 'unwarn command is registered');
  assert(registry.getCommand('unban') !== undefined, 'unban command is registered');
  assert(registry.getCommand('unkick') !== undefined, 'unkick command is registered');

  // Phase 2 Commands
  assert(registry.getCommand('setrules') !== undefined, 'setrules command is registered');
  assert(registry.getCommand('promote') !== undefined, 'promote command is registered');
  assert(registry.getCommand('demote') !== undefined, 'demote command is registered');
  assert(registry.getCommand('approve') !== undefined, 'approve command is registered');
  assert(registry.getCommand('unapprove') !== undefined, 'unapprove command is registered');
  assert(registry.getCommand('report') !== undefined, 'report command is registered');
  assert(registry.getCommand('setwelcome') !== undefined, 'setwelcome command is registered');
  assert(registry.getCommand('welcome') !== undefined, 'welcome command is registered');
  assert(registry.getCommand('setgoodbye') !== undefined, 'setgoodbye command is registered');
  assert(registry.getCommand('goodbye') !== undefined, 'goodbye command is registered');
  assert(registry.getCommand('save') !== undefined, 'save command is registered');
  assert(registry.getCommand('get') !== undefined, 'get command is registered');
  assert(registry.getCommand('notes') !== undefined, 'notes command is registered');
  assert(registry.getCommand('filter') !== undefined, 'filter command is registered');
  assert(registry.getCommand('stop') !== undefined, 'stop command is registered');
  assert(registry.getCommand('filters') !== undefined, 'filters command is registered');

  // Phase 3a Commands
  assert(registry.getCommand('info') !== undefined, 'info command is registered');
  assert(registry.getCommand('adminlist') !== undefined, 'adminlist command is registered');
  assert(registry.getCommand('admins') !== undefined, 'admins alias is registered');
  assert(registry.getCommand('admin') !== undefined, 'admin alias is registered');
  assert(registry.getCommand('locktypes') !== undefined, 'locktypes command is registered');
  assert(registry.getCommand('del') !== undefined, 'del command is registered');
  assert(registry.getCommand('delete') !== undefined, 'delete alias is registered');
  assert(registry.getCommand('mute') !== undefined, 'mute command is registered');
  assert(registry.getCommand('unmute') !== undefined, 'unmute command is registered');
  assert(registry.getCommand('tban') !== undefined, 'tban command is registered');
  assert(registry.getCommand('tmute') !== undefined, 'tmute command is registered');

  // Phase 3c Commands
  assert(registry.getCommand('setlang') !== undefined, 'setlang command is registered');
  assert(registry.getCommand('translate') !== undefined, 'translate command is registered');
  assert(registry.getCommand('tr') !== undefined, 'tr command (alias) is registered');
  assert(registry.getCommand('resetwarn') !== undefined, 'resetwarn command is registered');
  assert(registry.getCommand('rmwarn') !== undefined, 'rmwarn command (alias) is registered');
  assert(registry.getCommand('setwarnlimit') !== undefined, 'setwarnlimit command is registered');
  assert(registry.getCommand('setwarnaction') !== undefined, 'setwarnaction command is registered');
  assert(registry.getCommand('whitelist') !== undefined, 'whitelist command is registered');
  assert(registry.getCommand('unwhitelist') !== undefined, 'unwhitelist command is registered');
  assert(registry.getCommand('whitelisted') !== undefined, 'whitelisted command is registered');
  assert(registry.getCommand('scan') !== undefined, 'scan command is registered');
  assert(registry.getCommand('autotranslate') !== undefined, 'autotranslate command is registered');
  assert(registry.getCommand('flood') !== undefined, 'flood command is registered');

  // Feature Parity New Commands
  assert(registry.getCommand('newfed') !== undefined, 'newfed command is registered');
  assert(registry.getCommand('joinfed') !== undefined, 'joinfed command is registered');
  assert(registry.getCommand('leavefed') !== undefined, 'leavefed command is registered');
  assert(registry.getCommand('fban') !== undefined, 'fban command is registered');
  assert(registry.getCommand('unfban') !== undefined, 'unfban command is registered');
  assert(registry.getCommand('fedinfo') !== undefined, 'fedinfo command is registered');
  assert(registry.getCommand('fbanlist') !== undefined, 'fbanlist command is registered');
  assert(registry.getCommand('fedadmins') !== undefined, 'fedadmins command is registered');
  assert(
    registry.getCommand('removespamlinks') !== undefined,
    'removespamlinks command is registered'
  );
  assert(registry.getCommand('pin') !== undefined, 'pin command is registered');
  assert(registry.getCommand('unpin') !== undefined, 'unpin command is registered');
  assert(registry.getCommand('unpinall') !== undefined, 'unpinall command is registered');
  assert(registry.getCommand('pinned') !== undefined, 'pinned command is registered');
  assert(registry.getCommand('blacklist') !== undefined, 'blacklist command is registered');
  assert(registry.getCommand('rmblacklist') !== undefined, 'rmblacklist command is registered');
  assert(
    registry.getCommand('setblacklistaction') !== undefined,
    'setblacklistaction command is registered'
  );
  assert(registry.getCommand('setlog') !== undefined, 'setlog command is registered');
  assert(registry.getCommand('unsetlog') !== undefined, 'unsetlog command is registered');
  assert(registry.getCommand('slowmode') !== undefined, 'slowmode command is registered');
  assert(registry.getCommand('settitle') !== undefined, 'settitle command is registered');
  assert(
    registry.getCommand('setdescription') !== undefined,
    'setdescription command is registered'
  );
  assert(registry.getCommand('setphoto') !== undefined, 'setphoto command is registered');
  assert(registry.getCommand('mode') !== undefined, 'mode command is registered');
  assert(registry.getCommand('approved') !== undefined, 'approved command is registered');
  assert(registry.getCommand('unapproveall') !== undefined, 'unapproveall command is registered');
  assert(registry.getCommand('reports') !== undefined, 'reports command is registered');

  // Permission checks
  assert(registry.getCommand('warn').adminOnly === true, 'warn requires admin');
  assert(registry.getCommand('approve').adminOnly === true, 'approve requires admin');
  assert(registry.getCommand('mute').adminOnly === true, 'mute requires admin');
  assert(registry.getCommand('unmute').adminOnly === true, 'unmute requires admin');
  assert(registry.getCommand('tban').adminOnly === true, 'tban requires admin');
  assert(registry.getCommand('tmute').adminOnly === true, 'tmute requires admin');
  assert(registry.getCommand('del').adminOnly === true, 'del requires admin');
  assert(registry.getCommand('setlang').adminOnly === true, 'setlang requires admin');
  assert(registry.getCommand('ping').adminOnly === false, 'ping is for everyone');
  assert(registry.getCommand('notes').adminOnly === false, 'notes is for everyone');
  assert(registry.getCommand('report').adminOnly === false, 'report is for everyone');
  assert(registry.getCommand('info').adminOnly === false, 'info is for everyone');
  assert(registry.getCommand('adminlist').adminOnly === false, 'adminlist is for everyone');
  assert(registry.getCommand('locktypes').adminOnly === false, 'locktypes is for everyone');
  assert(registry.getCommand('translate').adminOnly === false, 'translate is for everyone');

  // Duration parser tests
  assert(parseDuration('10s') === 10000, 'parseDuration 10s = 10000ms');
  assert(parseDuration('30m') === 1800000, 'parseDuration 30m = 1800000ms');
  assert(parseDuration('12h') === 43200000, 'parseDuration 12h = 43200000ms');
  assert(parseDuration('1d') === 86400000, 'parseDuration 1d = 86400000ms');
  assert(parseDuration('invalid') === null, 'parseDuration invalid returns null');
  assert(parseDuration('') === null, 'parseDuration empty returns null');
  assert(parseDuration('5x') === null, 'parseDuration 5x (bad unit) returns null');

  // Test Custom Commands Execution
  const mockSession = {
    id: 'default',
    recentFailures: [],
    recentSent: [],
    stats: { sent: 0, failed: 0, received: 0 },
    sock: {
      sendMessage: async () => ({ key: { id: 'test_msg' } }),
    },
  };
  const mockMsg = { key: { remoteJid: '1203630123456789@g.us', id: 'm1' } };

  const groupConfig = getGroupModerationConfig('1203630123456789@g.us');
  groupConfig.enabled = true;
  groupConfig.commands = {
    enabled: true,
    prefix: '!',
    custom_commands: [{ command: 'wifi', response: 'GuestWifi', admin_only: false }],
  };
  setGroupModerationConfig('1203630123456789@g.us', groupConfig);

  // Test Custom Mapped Commands in !help
  groupConfig.commands.custom_commands = [
    {
      command: 'wifi',
      response: 'SSID: Guest | Pass: 12345',
      description: 'Shows Wi-Fi credentials',
    },
    { command: 'adminsecret', response: 'Secret', admin_only: true },
  ];
  setGroupModerationConfig('1203630123456789@g.us', groupConfig);
  resetBotOutboundSpamGuard();

  let helpOutput = '';
  const mockSessionHelp = {
    ...mockSession,
    sock: {
      ...mockSession.sock,
      sendMessage: async (jid, msgObj) => {
        helpOutput = msgObj.text;
        return { key: { id: 'test_help' } };
      },
    },
  };

  await processCommand(
    mockSessionHelp,
    mockMsg,
    '!help',
    '491761234567@s.whatsapp.net',
    true, // Admin user
    '1203630123456789@g.us'
  );

  assert(helpOutput.includes('!wifi'), '!help output should contain custom command !wifi');
  assert(
    helpOutput.includes('Shows Wi-Fi credentials'),
    '!help output should contain custom command description'
  );
  assert(
    helpOutput.includes('!adminsecret'),
    '!help output for admin should contain admin_only custom command'
  );
  console.log('✅ PASSED: Custom commands with optional description listed in !help');

  const customHandled = await processCommand(
    mockSession,
    mockMsg,
    '!wifi',
    '491761234567@s.whatsapp.net',
    false,
    '1203630123456789@g.us'
  );
  assert(customHandled === true, 'Custom mapped command !wifi should be handled');
  console.log('✅ PASSED: Custom mapped command !wifi executed successfully');

  // Test Disabled Built-in Commands Execution
  groupConfig.commands.disabled_commands = ['ping'];
  setGroupModerationConfig('1203630123456789@g.us', groupConfig);

  const disabledHandled = await processCommand(
    mockSession,
    mockMsg,
    '!ping',
    '491761234567@s.whatsapp.net',
    false,
    '1203630123456789@g.us'
  );
  assert(
    disabledHandled === true,
    'Disabled built-in command !ping should be handled with notification'
  );
  console.log('✅ PASSED: Disabled built-in command !ping handled and notified user successfully');

  // Test Formatted Text Input (e.g. '!locktypes', `!help`, ```!rules```)
  groupConfig.commands.disabled_commands = [];
  setGroupModerationConfig('1203630123456789@g.us', groupConfig);

  const formattedHandled = await processCommand(
    mockSession,
    mockMsg,
    "'!ping'",
    '491761234567@s.whatsapp.net',
    false,
    '1203630123456789@g.us'
  );
  assert(
    formattedHandled === true,
    'Formatted command input (!ping) should be sanitized and handled'
  );

  const backtickHandled = await processCommand(
    mockSession,
    mockMsg,
    '`!locktypes`',
    '491761234567@s.whatsapp.net',
    false,
    '1203630123456789@g.us'
  );
  assert(
    backtickHandled === true,
    'Backtick wrapped command (`!locktypes`) should be sanitized and handled'
  );

  const codeblockHandled = await processCommand(
    mockSession,
    mockMsg,
    '```\n!ping\n```',
    '491761234567@s.whatsapp.net',
    false,
    '1203630123456789@g.us'
  );
  assert(
    codeblockHandled === true,
    'Codeblock wrapped command (```!ping```) should be sanitized and handled'
  );
  assert(
    formattedHandled && backtickHandled && codeblockHandled,
    "Formatted command inputs ('!ping', `!locktypes`, ```!ping```) handled successfully"
  );

  // Ensure mock group has multi_command_enabled set to true for multi-line batch tests
  const currentCfg = getGroupModerationConfig('1203630123456789@g.us');
  currentCfg.enabled = true;
  currentCfg.commands = {
    ...(currentCfg.commands || {}),
    enabled: true,
    prefix: '!',
    multi_command_enabled: true,
  };
  setGroupModerationConfig('1203630123456789@g.us', currentCfg);
  let batchOutputMessages = [];
  const mockSessionBatch = {
    ...mockSession,
    sock: {
      ...mockSession.sock,
      sendMessage: async (jid, msgObj) => {
        batchOutputMessages.push(msgObj.text);
        return { key: { id: 'test_batch' } };
      },
    },
  };

  const safeMultiLineText = '!ping\n!id\n!rules';
  const batchHandled = await processCommand(
    mockSessionBatch,
    mockMsg,
    safeMultiLineText,
    '491761234567@s.whatsapp.net',
    true,
    '1203630123456789@g.us'
  );
  assert(batchHandled, 'Multi-line safe command batch should be handled');
  console.log('✅ PASSED: Multi-line safe command block execution verified');

  // Test conflicting command batch detection
  resetBotOutboundSpamGuard();
  batchOutputMessages = [];
  const conflictingMultiLineText = '!ping\n!kick @user\n!ban @user\n!id';
  await processCommand(
    mockSessionBatch,
    mockMsg,
    conflictingMultiLineText,
    '491761234567@s.whatsapp.net',
    true,
    '1203630123456789@g.us'
  );
  const alertMsg = batchOutputMessages.find((m) => m && m.includes('Batch Command Safety Alert'));
  assert(alertMsg, 'Conflicting destructive commands in batch should trigger safety alert');
  assert(
    alertMsg.includes('!kick') && alertMsg.includes('!ban'),
    'Alert should list conflicting commands'
  );
  console.log(
    '✅ PASSED: Conflicting destructive batch commands correctly intercepted with safety warning'
  );

  // Test Report Command (saves to store and DMs admins)
  mockSession.sock.groupMetadata = async () => ({
    subject: 'Test Group',
    participants: [{ id: '491769999999@s.whatsapp.net', admin: 'admin' }],
  });
  const mockReportMsg = {
    ...mockMsg,
    message: {
      extendedTextMessage: {
        text: '!report @491760000000 Test report reason',
        contextInfo: {
          mentionedJid: ['491760000000@s.whatsapp.net'],
        },
      },
    },
  };
  const reportHandled = await processCommand(
    mockSession,
    mockReportMsg,
    '!report @491760000000 Test report reason',
    '491761234567@s.whatsapp.net',
    false,
    '1203630123456789@g.us'
  );
  assert(reportHandled === true, 'Report command should execute successfully');
  const storeAfterReport = loadModerationStore();
  const repConfig =
    storeAfterReport.groups['1203630123456789@g.us'] ||
    getGroupModerationConfig('1203630123456789@g.us');
  assert(
    repConfig.reports && repConfig.reports.length >= 1,
    'Report should be saved to group config'
  );
  assert(
    repConfig.reports[repConfig.reports.length - 1].reason === 'Test report reason',
    'Report reason should be parsed'
  );
  console.log('✅ PASSED: Report command saves report item to store and DMs admins');

  // Test Toggle Commands (e.g. !removespamlinks without args toggles state)
  const testGroupJid = '1203630123456789@g.us';
  const cfgBefore = getGroupModerationConfig(testGroupJid);
  const initialState = cfgBefore.anti_spam_links_enabled;

  await processCommand(
    mockSession,
    mockMsg,
    '!removespamlinks',
    '491761234567@s.whatsapp.net',
    true,
    testGroupJid
  );
  const cfgAfter1 = getGroupModerationConfig(testGroupJid);
  assert(
    cfgAfter1.anti_spam_links_enabled === !initialState,
    '!removespamlinks without arguments correctly toggles state'
  );

  await processCommand(
    mockSession,
    mockMsg,
    '!removespamlinks',
    '491761234567@s.whatsapp.net',
    true,
    testGroupJid
  );
  const cfgAfter2 = getGroupModerationConfig(testGroupJid);
  assert(
    cfgAfter2.anti_spam_links_enabled === Boolean(initialState),
    '!removespamlinks second invocation toggles state back'
  );

  // Test Self/Outgoing Message Command Execution (fromMe: true)
  const selfMsg = {
    key: { remoteJid: testGroupJid, fromMe: true, id: 'SELF_MSG_1' },
    message: { conversation: '!rules' },
  };
  const selfHandled = await processCommand(
    mockSession,
    selfMsg,
    '!rules',
    '491761234567@s.whatsapp.net',
    true,
    testGroupJid
  );
  assert(
    selfHandled === true,
    'Outgoing self-sent message (fromMe: true) correctly triggers command processing'
  );

  // Test Slash Prefix Command Execution (/ping, /id, /rules)
  const slashMsg = {
    key: { remoteJid: testGroupJid, fromMe: true, id: 'SLASH_MSG_1' },
    message: { conversation: '/ping' },
  };
  const slashHandled = await processCommand(
    mockSession,
    slashMsg,
    '/ping',
    '491761234567@s.whatsapp.net',
    true,
    testGroupJid
  );
  assert(
    slashHandled === true,
    'Slash prefix command (/ping) correctly triggers command processing'
  );

  // Test Fuzzy Search Suggestions & Unknown Command Response
  const { levenshteinDistance, findCommandSuggestions } =
    await import('../src/whatsapp/moderation/commands.js');
  assert(
    levenshteinDistance('cat', 'cut') === 1,
    'levenshteinDistance calculates single edit correctly'
  );
  assert(
    levenshteinDistance('ping', 'pong') === 1,
    'levenshteinDistance calculates single edit substitution'
  );
  assert(levenshteinDistance('pin', 'ping') === 1, 'levenshteinDistance calculates single edit');

  const suggestions = findCommandSuggestions(
    'pinng',
    ['ping', 'pong', 'pin', 'setrules', 'lock'],
    3
  );
  assert(
    suggestions.includes('ping') && suggestions.includes('pin'),
    'findCommandSuggestions finds close matches for "pinng"'
  );

  const unknownCmdMsg = {
    key: { remoteJid: testGroupJid, fromMe: true, id: 'UNKNOWN_MSG_1' },
    message: { conversation: '!pinng' },
  };
  const unknownHandled = await processCommand(
    mockSession,
    unknownCmdMsg,
    '!pinng',
    '491761234567@s.whatsapp.net',
    true,
    testGroupJid
  );
  assert(
    unknownHandled === true,
    'Unknown command from admin triggers warning response with fuzzy suggestions'
  );

  // Test: Safe alias for Save command
  const saveWithSafeMsg = {
    key: { remoteJid: testGroupJid, fromMe: true, id: 'SAFE_MSG_1' },
    message: { conversation: '!safe testnote This is a test note content' },
  };
  const safeHandled = await processCommand(
    mockSession,
    saveWithSafeMsg,
    '!safe testnote This is a test note content',
    '491761234567@s.whatsapp.net',
    true,
    testGroupJid
  );
  assert(safeHandled === true, '!safe alias executes save command');

  // Test: Invoking note via #testnote hashtag
  const noteHashtagMsg = {
    key: { remoteJid: testGroupJid, fromMe: false, id: 'NOTE_TAG_MSG_1' },
    message: { conversation: '#testnote' },
  };
  const noteTagHandled = await processCommand(
    mockSession,
    noteHashtagMsg,
    '#testnote',
    '491769999999@s.whatsapp.net',
    false,
    testGroupJid
  );
  assert(noteTagHandled === true, '#testnote retrieves and replies with saved note content');

  // Test: Non-existent hashtag is safely ignored (returns false without unknown command warning)
  const regularHashtagMsg = {
    key: { remoteJid: testGroupJid, fromMe: false, id: 'RANDOM_TAG_MSG_1' },
    message: { conversation: '#randomnonexistenttag' },
  };
  const regularTagHandled = await processCommand(
    mockSession,
    regularHashtagMsg,
    '#randomnonexistenttag',
    '491769999999@s.whatsapp.net',
    false,
    testGroupJid
  );
  assert(regularTagHandled === false, 'Non-note hashtag is safely ignored without unknown command error');

  // Count total commands (deduplicated)
  const seen = new Set();
  let totalCommands = 0;
  for (const [, details] of Object.entries(registry.commands)) {
    if (!seen.has(details)) {
      seen.add(details);
      totalCommands++;
    }
  }
  console.log(`\n📊 Total unique commands registered: ${totalCommands}`);

  if (failed > 0) {
    console.log('==================================================');
    console.error(`❌ ${failed} TESTS FAILED`);
    process.exit(1);
  } else {
    console.log('==================================================');
    console.log('✅ ALL COMMAND TESTS PASSED');
  }
}

await runTests();
