import assert from 'node:assert';
import {
  getDefaultModerationStore,
  getGroupModerationConfig,
  setGroupModerationConfig,
  saveModerationStore,
} from '../src/whatsapp/moderation/store.js';
import {
  issueUserWarning,
  clearUserWarnings,
  handleModerationMessage,
} from '../src/whatsapp/moderation/engine.js';
import {
  exportGroupModeration,
  importGroupModeration,
} from '../src/whatsapp/moderation/migration.js';

console.log('\n🧪 Running Rose & Aegis Moderation Unit Tests\n' + '='.repeat(50));

saveModerationStore(getDefaultModerationStore());

try {
  // Test 1: Defaults
  const store = getDefaultModerationStore();
  assert.strictEqual(store.global_enabled, false, 'Global moderation should be disabled by default');
  console.log('✅ PASSED: Moderation is disabled by default');

  const groupConfig = getGroupModerationConfig('1203630123456789@g.us');
  assert.strictEqual(groupConfig.enabled, false, 'Group moderation should be disabled by default');
  console.log('✅ PASSED: Group moderation is disabled by default');

  // Enable for testing
  store.global_enabled = true;
  saveModerationStore(store);

  groupConfig.enabled = true;
  groupConfig.locks.image.enabled = true;
  groupConfig.locks.url.enabled = true;
  groupConfig.blacklist = { enabled: true, words: ['badword', '/spam[0-9]+/'], action: 'delete' };
  groupConfig.warnings.max_warnings = 3;
  setGroupModerationConfig('1203630123456789@g.us', groupConfig);

  // Mock session object
  const mockSession = {
    sock: {
      sendMessage: async () => ({ key: { id: 'test' } }),
      sendMessageAck: async () => {},
      groupParticipantsUpdate: async () => {},
    },
    stats: { sent: 0, received: 0, failed: 0 },
    recentSent: [],
    recentReceived: [],
    recentFailures: [],
  };

  // Test 2: Warnings System
  await issueUserWarning(mockSession, '1203630123456789@g.us', '491761234567', 'Testing warning');
  let updatedConfig = getGroupModerationConfig('1203630123456789@g.us');
  let warns = updatedConfig.warnings.user_warns['491761234567'];
  assert.strictEqual(warns.length, 1, 'Warning count should be 1');
  console.log('✅ PASSED: User warning issued and recorded correctly');

  clearUserWarnings('1203630123456789@g.us', '491761234567');
  updatedConfig = getGroupModerationConfig('1203630123456789@g.us');
  assert.strictEqual(updatedConfig.warnings.user_warns['491761234567'].length, 0, 'Warnings cleared');
  console.log('✅ PASSED: User warnings cleared successfully');

  // Test 3: Message Moderation Locks & Blacklist
  const eventLock = {
    sender: '1203630123456789@g.us',
    sender_number: '491761234567',
    content: 'Check out https://spam.com',
    media_type: null,
    raw: { key: { id: 'msg1' } },
  };

  const lockHandled = await handleModerationMessage(mockSession, eventLock);
  assert.strictEqual(lockHandled, true, 'URL lock should handle URL message');
  console.log('✅ PASSED: Content lock correctly detected locked URL');

  const eventBlacklist = {
    sender: '1203630123456789@g.us',
    sender_number: '491761234567',
    content: 'This message has badword inside',
    media_type: null,
    raw: { key: { id: 'msg2' } },
  };
  const blHandled = await handleModerationMessage(mockSession, eventBlacklist);
  assert.strictEqual(blHandled, true, 'Blacklist should match prohibited word');
  console.log('✅ PASSED: Blacklist correctly matched prohibited word');

  // Test 4: Rose / Aegis Import & Export
  const exported = exportGroupModeration('1203630123456789@g.us');
  assert.strictEqual(exported.export_source, 'RoseAegisModerationEngine', 'Export header matches');
  console.log('✅ PASSED: Moderation config export structure valid');

  const importPayload = {
    rules: '1. No spam\n2. Be nice',
    filters: [{ trigger: '!faq', reply: 'Check our wiki' }],
    blacklist: { words: ['prohibited'], action: 'warn' },
  };

  const importedConfig = importGroupModeration('1203630987654321@g.us', importPayload);
  assert.strictEqual(importedConfig.rules.text, '1. No spam\n2. Be nice');
  assert.strictEqual(importedConfig.filters[0].trigger, '!faq');
  assert.strictEqual(importedConfig.blacklist.words[0], 'prohibited');
  console.log('✅ PASSED: Rose / Aegis JSON config imported successfully');

  // Reset store
  saveModerationStore(getDefaultModerationStore());
  console.log('='.repeat(50) + '\n✅ ALL MODERATION TESTS PASSED\n');
} catch (err) {
  console.error('❌ MODERATION TEST FAILED:', err);
  process.exit(1);
}
