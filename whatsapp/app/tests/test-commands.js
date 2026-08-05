import { registry, parseDuration, processCommand } from '../src/whatsapp/moderation/commands.js';
import { getGroupModerationConfig, setGroupModerationConfig } from '../src/whatsapp/moderation/store.js';

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
  assert(disabledHandled === true, 'Disabled built-in command !ping should be handled with notification');
  console.log('✅ PASSED: Disabled built-in command !ping handled and notified user successfully');

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
    process.exit(0);
  }
}

runTests();
