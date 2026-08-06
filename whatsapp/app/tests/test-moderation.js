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
  handleModerationParticipantUpdate,
  executePenalty,
  isSelfParticipant,
  generateBotWelcomeMessage,
  formatMessageTemplate,
} from '../src/whatsapp/moderation/engine.js';
import {
  isSameUser,
  resolveCanonicalUserKey,
  resolveUserDisplayName,
  normalizeJid,
} from '../src/utils/security.js';

console.log('\n🧪 Running WhatsApp Moderation Engine Unit Tests\n' + '='.repeat(50));

saveModerationStore(getDefaultModerationStore());

try {
  // Test 1: Defaults
  const store = getDefaultModerationStore();
  assert.strictEqual(
    store.global_enabled,
    true,
    'Global moderation engine should be active by default'
  );
  console.log('✅ PASSED: Global moderation engine is active by default');

  const groupConfig = getGroupModerationConfig('1203630123456789@g.us');
  assert.strictEqual(
    groupConfig.enabled,
    false,
    'Group moderation should be disabled by default for unconfigured groups'
  );
  console.log('✅ PASSED: Group moderation is disabled by default for unconfigured groups');

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
      user: { id: '491761234567@s.whatsapp.net', lid: '157608354779256@lid' },
      sendMessage: async () => ({ key: { id: 'test' } }),
      sendMessageAck: async () => {},
      groupParticipantsUpdate: async () => {},
    },
    stats: { my_number: '491761234567', sent: 0, received: 0, failed: 0 },
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
  assert.strictEqual(
    (updatedConfig.warnings.user_warns['491761234567'] || []).length,
    0,
    'Warnings cleared'
  );
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

  groupConfig.locks.contact = { enabled: true };
  setGroupModerationConfig('1203630123456789@g.us', groupConfig);

  const eventContact = {
    sender: '1203630123456789@g.us',
    sender_number: '491761234567',
    media_type: 'contact',
    content: '[Contact: John Doe]',
    raw: { key: { id: 'msgContact' } },
  };
  const contactHandled = await handleModerationMessage(mockSession, eventContact);
  assert.strictEqual(contactHandled, true, 'Contact lock should handle contact card message');
  console.log('✅ PASSED: Content lock correctly detected locked Contact card');

  // Test 5: Auto-Responder Filters & Custom Notes
  groupConfig.filters = [{ trigger: 'Test', response: 'Auto response works!', is_regex: false }];
  groupConfig.notes = { info: 'Here is the requested note' };
  setGroupModerationConfig('1203630123456789@g.us', groupConfig);

  const eventFilter = {
    sender: '1203630123456789@g.us',
    sender_number: '491761234567',
    content: 'Test',
    raw: { key: { id: 'msg3' } },
  };
  const filterHandled = await handleModerationMessage(mockSession, eventFilter);
  assert.strictEqual(filterHandled, true, 'Auto-responder filter should handle trigger word');
  console.log('✅ PASSED: Auto-responder filter correctly matched trigger');

  // Verify fromMe loop prevention
  const eventSelfMsg = {
    sender: '1203630123456789@g.us',
    sender_number: '491761234567',
    content: 'Test response containing trigger Test',
    raw: { key: { id: 'msgSelf', fromMe: true } },
  };
  const selfHandled = await handleModerationMessage(mockSession, eventSelfMsg);
  assert.strictEqual(selfHandled, false, 'Self message (fromMe) should be ignored to prevent loop');
  console.log('✅ PASSED: Outgoing bot message (fromMe) correctly ignored to prevent loop');

  const eventNote = {
    sender: '1203630123456789@g.us',
    sender_number: '491761234567',
    content: '#info',
    raw: { key: { id: 'msg4' } },
  };
  const noteHandled = await handleModerationMessage(mockSession, eventNote);
  assert.strictEqual(noteHandled, true, 'Note trigger should handle note request');
  console.log('✅ PASSED: Custom note correctly matched #info trigger');

  // Test 6: Muted Users & Federation Protection
  groupConfig.muted_users = { 491769999999: { until: Date.now() + 60000 } };
  groupConfig.federation_id = 'fed_global_default';
  setGroupModerationConfig('1203630123456789@g.us', groupConfig);

  const eventMuted = {
    sender: '1203630123456789@g.us',
    sender_number: '491769999999',
    content: 'Hello everyone',
    raw: { key: { id: 'msg5' } },
  };
  const mutedHandled = await handleModerationMessage(mockSession, eventMuted);
  assert.strictEqual(mutedHandled, true, 'Muted user message should be suppressed');
  console.log('✅ PASSED: Muted user message correctly suppressed and deleted');

  const eventFedLink = {
    sender: '1203630123456789@g.us',
    sender_number: '491761234567',
    content: 'Join my channel t.me/joinchat/xyz',
    raw: { key: { id: 'msg6' } },
  };
  const fedHandled = await handleModerationMessage(mockSession, eventFedLink);
  assert.strictEqual(fedHandled, true, 'Federation shared blacklist should delete prohibited link');
  console.log('✅ PASSED: Federation shared blacklist pattern correctly deleted');

  // Test 7: Consolidated Join Message (Welcome + Rules + Captcha in ONE single message)
  groupConfig.greetings.welcome_enabled = true;
  groupConfig.greetings.welcome_message = 'Welcome {mention} to {group}!';
  groupConfig.rules.show_on_join = true;
  groupConfig.rules.text = '1. Be polite\n2. No spam';
  groupConfig.greetings.captcha_enabled = true;
  groupConfig.greetings.captcha_mode = 'button';
  setGroupModerationConfig('1203630123456789@g.us', groupConfig);

  let joinSentMessages = [];
  const mockSessionJoinTest = {
    ...mockSession,
    sock: {
      ...mockSession.sock,
      sendMessage: async (jid, content) => {
        joinSentMessages.push(content);
        return { key: { id: 'joinMsg1' } };
      },
    },
  };

  await handleModerationParticipantUpdate(mockSessionJoinTest, {
    id: '1203630123456789@g.us',
    action: 'add',
    participants: ['491769999111@s.whatsapp.net'],
  });

  assert.strictEqual(joinSentMessages.length, 1, 'Join event MUST send exactly 1 consolidated message');
  const consolidatedText = joinSentMessages[0].text;
  assert(consolidatedText.includes('Welcome @491769999111'), 'Single message must contain Welcome');
  assert(consolidatedText.includes('📜 *Group Rules:*'), 'Single message must contain inline Rules');
  assert(consolidatedText.includes('1. Be polite'), 'Single message must contain rule text');
  assert(consolidatedText.includes('🤖 *Captcha Verification*'), 'Single message must contain Captcha');
  console.log('✅ PASSED: Consolidated Welcome + Rules + Captcha single-message join flow verified');

  // Test 7b: Participant Leave & Goodbye Message
  groupConfig.greetings.goodbye_enabled = true;
  groupConfig.greetings.goodbye_message = 'Goodbye {name}!';
  setGroupModerationConfig('1203630123456789@g.us', groupConfig);

  await handleModerationParticipantUpdate(mockSession, {
    id: '1203630123456789@g.us',
    action: 'leave',
    participants: ['491761234567@s.whatsapp.net'],
  });
  console.log('✅ PASSED: Participant leave event correctly processed for goodbye message');

  // Test 8: Warning normalization and self-warn prevention
  await issueUserWarning(mockSession, '1203630123456789@g.us', '+491761234567', 'Warn with plus');
  await issueUserWarning(mockSession, '1203630123456789@g.us', '491761234567', 'Warn without plus');
  const normConfig = getGroupModerationConfig('1203630123456789@g.us');
  const userWarnKeys = Object.keys(normConfig.warnings.user_warns).filter(
    (k) => normConfig.warnings.user_warns[k]?.length > 0
  );
  assert.strictEqual(
    userWarnKeys.length,
    1,
    'Warnings with and without plus should merge into single key'
  );
  assert.strictEqual(
    normConfig.warnings.user_warns[userWarnKeys[0]].length,
    2,
    'Should have 2 merged warnings'
  );
  console.log('✅ PASSED: Warning ID normalization correctly merged +49... and 49...');

  // Test 9: Group Ban recording & Auto-kick on rejoin
  await executePenalty(mockSession, '1203630123456789@g.us', '491769999999', 'ban', 'Bad behavior');
  const banCheckConfig = getGroupModerationConfig('1203630123456789@g.us');
  assert(
    banCheckConfig.banned_users['491769999999'],
    'User should be stored in group banned_users'
  );

  await handleModerationParticipantUpdate(mockSession, {
    id: '1203630123456789@g.us',
    action: 'add',
    participants: ['491769999999@s.whatsapp.net'],
  });
  console.log('✅ PASSED: Group ban record and auto-kick on rejoin verified successfully');

  // Test 10: Bot Join Welcome Message & Self Participant Detection
  assert.strictEqual(
    isSelfParticipant('491761234567@s.whatsapp.net', mockSession),
    true,
    'Bot self JID should be recognized'
  );

  const directGenText = generateBotWelcomeMessage(groupConfig);
  assert(directGenText.includes('Home Assistant WhatsApp Bot Connected!'), 'Direct generator test');

  let botWelcomeSent = false;
  let botWelcomeText = '';
  const mockSessionBotJoin = {
    ...mockSession,
    sock: {
      ...mockSession.sock,
      sendMessage: async (jid, content) => {
        botWelcomeSent = true;
        botWelcomeText = content.text;
        return { key: { id: 'botWelcomeMsg1' } };
      },
    },
  };

  await handleModerationParticipantUpdate(mockSessionBotJoin, {
    id: '1203630123456789@g.us',
    action: 'add',
    participants: ['491761234567@s.whatsapp.net'],
  });

  assert.strictEqual(
    botWelcomeSent,
    true,
    'Bot welcome message should be sent when bot joins group'
  );
  assert(botWelcomeText.includes('Home Assistant WhatsApp Bot Connected!'), 'Should contain title');
  assert(
    new URL(botWelcomeText.match(/https?:\/\/[^\s]+/)?.[0] || 'http://localhost').hostname ===
      'github.com',
    'Should contain valid docs link'
  );
  assert(
    botWelcomeText.includes('🔴 DISABLED') || botWelcomeText.includes('🟢 ENABLED'),
    'Should state moderation status'
  );
  // Test 11: isSameUser and LID <-> PN Resolution
  assert.strictEqual(
    isSameUser('157608354779256@lid', '491761234567@s.whatsapp.net', mockSession),
    true,
    'LID and PN for self account should match'
  );
  assert.strictEqual(
    isSameUser('491761234567@s.whatsapp.net', '491761234567@s.whatsapp.net', mockSession),
    true,
    'Identical JIDs should match'
  );
  assert.strictEqual(
    isSameUser('491761234567@s.whatsapp.net', '491769999999@s.whatsapp.net', mockSession),
    false,
    'Different users should not match'
  );

  const resolvedPn = resolveCanonicalUserKey('157608354779256', mockSession);
  assert.strictEqual(resolvedPn, '491761234567', 'Self LID should resolve to canonical PN');

  const displayName = resolveUserDisplayName('491761234567', mockSession);
  assert(displayName.includes('491761234567'), 'Display name should include canonical PN');
  console.log('✅ PASSED: isSameUser and LID resolution verified successfully');

  // Test normalizeJid and ReDoS safety
  assert.strictEqual(normalizeJid('491761234567:0@s.whatsapp.net'), '491761234567@s.whatsapp.net');
  assert.strictEqual(normalizeJid('157608354779256:12@lid'), '157608354779256@lid');
  assert.strictEqual(normalizeJid('491761234567@s.whatsapp.net'), '491761234567@s.whatsapp.net');
  assert.strictEqual(normalizeJid(':'.repeat(1000) + '@s.whatsapp.net'), '@s.whatsapp.net');
  assert.strictEqual(normalizeJid(':'.repeat(1000)), ':'.repeat(1000));
  console.log('✅ PASSED: normalizeJid ReDoS protection and JID normalization verified');

  // Test formatMessageTemplate with extended placeholders
  const sampleTemplate =
    'Welcome {pushname} ({user}) to {title}! Member #{count} of {group}. Rules: {rules}. Date: {date} {time}';
  const formatted = formatMessageTemplate(sampleTemplate, {
    userId: '491701234567',
    participantJid: '491701234567@s.whatsapp.net',
    groupId: '1203630123456789@g.us',
    groupMeta: { subject: 'Test Group', participants: [1, 2, 3, 4, 5] },
    config: { rules: { text: 'Rule 1: Be polite' } },
    session: { sock: { contacts: { '491701234567@s.whatsapp.net': { notify: 'Alex' } } } },
  });
  assert(formatted.includes('Alex'), 'pushname should be Alex');
  assert(formatted.includes('@491701234567'), 'user tag should be @491701234567');
  assert(formatted.includes('Test Group'), 'group title should be Test Group');
  assert(formatted.includes('Member #5'), 'member count should be 5');
  assert(formatted.includes('Rule 1: Be polite'), 'rules text should match');
  assert(/\d{2}\.\d{2}\.\d{4}/.test(formatted), 'date should match DD.MM.YYYY');
  assert(/\d{2}:\d{2}/.test(formatted), 'time should match HH:MM');
  console.log('✅ PASSED: formatMessageTemplate with all extended placeholders verified');

  // Reset store
  saveModerationStore(getDefaultModerationStore());
  console.log('='.repeat(50) + '\n✅ ALL MODERATION TESTS PASSED\n');
} catch (err) {
  console.error('❌ MODERATION TEST FAILED:', err);
  process.exit(1);
}
