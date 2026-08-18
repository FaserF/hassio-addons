import assert from 'node:assert';
import {
  getDefaultAutoResponderStore,
  saveAutoResponderStore,
  clearAutoResponderStoreCache,
  isAutoResponderActive,
  resetSeenRecipients,
} from '../src/whatsapp/autoresponder/store.js';
import {
  formatAutoResponderText,
  handleAutoResponder,
} from '../src/whatsapp/autoresponder/engine.js';

console.log('\n🌴 Running Auto Responder Unit Tests\n' + '='.repeat(50));

try {
  clearAutoResponderStoreCache();

  // Test 1: Defaults
  const store = getDefaultAutoResponderStore();
  assert.strictEqual(store.enabled, false, 'Auto responder should be disabled by default');
  assert.strictEqual(store.direct_only, true, 'Default scope should be direct_only: true');
  assert.strictEqual(store.once_per_contact, true, 'Default frequency should be once_per_contact: true');
  assert.strictEqual(typeof store.message_template, 'string', 'Message template should be string');
  console.log('✅ PASSED: Default Auto Responder store configuration');

  // Test 2: Active time window logic
  // Case A: Disabled
  store.enabled = false;
  saveAutoResponderStore(store);
  assert.strictEqual(isAutoResponderActive(), false, 'Should be inactive when enabled is false');

  // Case B: Enabled without dates (immediately & indefinitely)
  store.enabled = true;
  store.start_time = null;
  store.end_time = null;
  saveAutoResponderStore(store);
  assert.strictEqual(isAutoResponderActive(), true, 'Should be active immediately when start_time/end_time are null');

  // Case C: Start time in future
  const now = Date.now();
  store.start_time = new Date(now + 600000).toISOString(); // +10 min
  store.end_time = new Date(now + 1200000).toISOString();
  saveAutoResponderStore(store);
  assert.strictEqual(isAutoResponderActive(now), false, 'Should not be active before start_time');

  // Case D: Currently within timeframe
  store.start_time = new Date(now - 600000).toISOString(); // -10 min
  store.end_time = new Date(now + 600000).toISOString();   // +10 min
  saveAutoResponderStore(store);
  assert.strictEqual(isAutoResponderActive(now), true, 'Should be active within timeframe');

  // Case E: End time in past
  store.start_time = new Date(now - 1200000).toISOString(); // -20 min
  store.end_time = new Date(now - 600000).toISOString();   // -10 min
  saveAutoResponderStore(store);
  assert.strictEqual(isAutoResponderActive(now), false, 'Should not be active after end_time');
  console.log('✅ PASSED: Time window evaluation (past, present, future)');

  // Test 3: Template placeholder interpolation
  const tpl = 'Hi {sender_name}! I am away{end_time_text}.\n{once_notice}';
  const renderedWithEnd = formatAutoResponderText(tpl, {
    sender_name: 'Alice',
    end_time: '2026-08-25',
    once_per_contact: true,
  });
  assert.ok(renderedWithEnd.includes('Hi Alice!'), 'Should interpolate sender_name');
  assert.ok(renderedWithEnd.includes('(until 2026-08-25)'), 'Should interpolate end_time_text');
  assert.ok(renderedWithEnd.includes('only receive this automated reply once'), 'Should interpolate once_notice');

  const renderedWithoutEnd = formatAutoResponderText(tpl, {
    sender_name: 'Bob',
    end_time: '',
    once_per_contact: false,
  });
  assert.ok(renderedWithoutEnd.includes('Hi Bob!'), 'Should interpolate sender_name');
  assert.ok(!renderedWithoutEnd.includes('(until'), 'Should not have end_time_text when empty');
  assert.ok(!renderedWithoutEnd.includes('only receive this automated reply once'), 'Should omit once_notice when once_per_contact is false');
  console.log('✅ PASSED: Template formatting & placeholder substitution');

  // Test 4: Engine message handling & deduplication
  const sentMessages = [];
  const mockSession = {
    id: 'test_session',
    recentSent: [],
    recentFailures: [],
    stats: { sent: 0, failed: 0 },
    sock: {
      sendMessage: async (targetJid, content) => {
        sentMessages.push({ targetJid, content });
        return { key: { id: 'mock_reply_id' } };
      },
    },
  };

  // Reset store to active state
  store.enabled = true;
  store.start_time = null;
  store.end_time = null;
  store.direct_only = true;
  store.once_per_contact = true;
  store.seen_recipients = {};
  saveAutoResponderStore(store);

  // Incoming message from self (fromMe: true) -> should be ignored
  await handleAutoResponder(mockSession, {
    sender: '491761234567@s.whatsapp.net',
    sender_name: 'Self',
    is_group: false,
    raw: { key: { fromMe: true, remoteJid: '491761234567@s.whatsapp.net' } },
  });
  assert.strictEqual(sentMessages.length, 0, 'Self messages must not trigger auto responder');

  // Incoming message to group when direct_only: true -> should be ignored
  await handleAutoResponder(mockSession, {
    sender: '491769999999@s.whatsapp.net',
    sender_name: 'Group Member',
    is_group: true,
    raw: { key: { fromMe: false, remoteJid: '1203630123456789@g.us' } },
  });
  assert.strictEqual(sentMessages.length, 0, 'Group messages must be ignored when direct_only is true');

  // Incoming direct message from Contact A -> should reply and record seen
  await handleAutoResponder(mockSession, {
    sender: '491761111111@s.whatsapp.net',
    sender_name: 'Contact A',
    is_group: false,
    raw: { key: { fromMe: false, remoteJid: '491761111111@s.whatsapp.net' } },
  });
  assert.strictEqual(sentMessages.length, 1, 'First direct message must trigger reply');
  assert.strictEqual(sentMessages[0].targetJid, '491761111111@s.whatsapp.net');

  // Second incoming message from Contact A (once_per_contact: true) -> should NOT reply again
  await handleAutoResponder(mockSession, {
    sender: '491761111111@s.whatsapp.net',
    sender_name: 'Contact A',
    is_group: false,
    raw: { key: { fromMe: false, remoteJid: '491761111111@s.whatsapp.net' } },
  });
  assert.strictEqual(sentMessages.length, 1, 'Second message from same contact must not trigger another reply');

  // Reset seen contacts -> Contact A should receive reply again
  resetSeenRecipients();
  await handleAutoResponder(mockSession, {
    sender: '491761111111@s.whatsapp.net',
    sender_name: 'Contact A',
    is_group: false,
    raw: { key: { fromMe: false, remoteJid: '491761111111@s.whatsapp.net' } },
  });
  assert.strictEqual(sentMessages.length, 2, 'Contact should receive reply again after seen recipients reset');

  console.log('✅ PASSED: Engine message filtering, loop safety, and once_per_contact deduping');

  // Test 5: Direct + Groups when direct_only: false
  store.direct_only = false;
  store.seen_recipients = {};
  saveAutoResponderStore(store);

  await handleAutoResponder(mockSession, {
    sender: '491769999999@s.whatsapp.net',
    sender_name: 'Group Member',
    is_group: true,
    raw: { key: { fromMe: false, remoteJid: '1203630123456789@g.us', participant: '491769999999@s.whatsapp.net' } },
  });
  assert.strictEqual(sentMessages.length, 3, 'Group message must trigger reply when direct_only is false');
  assert.strictEqual(sentMessages[2].targetJid, '1203630123456789@g.us');
  console.log('✅ PASSED: Group chat response when direct_only is disabled');

  console.log('==================================================');
  console.log('✅ ALL AUTO RESPONDER TESTS PASSED\n');
} catch (err) {
  console.error('❌ Auto Responder test failed:', err);
  process.exit(1);
}
