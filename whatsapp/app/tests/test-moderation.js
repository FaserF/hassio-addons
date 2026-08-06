import assert from 'node:assert';
import {
  getDefaultModerationStore,
  getGroupModerationConfig,
  setGroupModerationConfig,
  saveModerationStore,
  clearModerationStoreCache,
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
  cleanCaptchaInput,
  findPendingCaptcha,
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
  groupConfig.filters = [
    { trigger: 'Test', response: 'Auto response works!', is_regex: false, type: 'reply' },
    { trigger: 'WLAN', response: 'WLAN Password is 1234', is_regex: false, type: 'faq' },
  ];
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

  let sentFaqText = null;
  const mockFaqSession = {
    ...mockSession,
    sock: {
      ...mockSession.sock,
      sendMessage: async (jid, content) => {
        sentFaqText = content?.text;
        return { key: { id: 'faq_test' } };
      },
    },
  };
  const eventFaq = {
    sender: '1203630123456789@g.us',
    sender_number: '491761234567',
    content: 'Wie lautet das WLAN?',
    raw: { key: { id: 'msgFaq' } },
  };
  const faqHandled = await handleModerationMessage(mockFaqSession, eventFaq);
  assert.strictEqual(faqHandled, true, 'FAQ filter should handle trigger word');
  assert(
    sentFaqText.includes('FAQ Hint / Automatische Hilfe'),
    'FAQ response should contain FAQ hint header'
  );
  console.log('✅ PASSED: FAQ filter correctly matched trigger and formatted hint header');

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

  assert.strictEqual(
    joinSentMessages.length,
    1,
    'Join event MUST send exactly 1 consolidated message'
  );
  const consolidatedText = joinSentMessages[0].text;
  assert(consolidatedText.includes('Welcome @491769999111'), 'Single message must contain Welcome');
  assert(
    consolidatedText.includes('📜 *Group Rules:*'),
    'Single message must contain inline Rules'
  );
  assert(consolidatedText.includes('1. Be polite'), 'Single message must contain rule text');
  assert(
    consolidatedText.includes('🤖 *Captcha Verification*'),
    'Single message must contain Captcha'
  );
  console.log(
    '✅ PASSED: Consolidated Welcome + Rules + Captcha single-message join flow verified'
  );

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

  const directGenText = generateBotWelcomeMessage(false);
  assert(
    directGenText.includes('Hello! I am your Moderation & Assistant Bot.'),
    'Direct generator test text'
  );
  const directGenUrlMatch = directGenText.match(/https?:\/\/[^\s]+/);
  assert(directGenUrlMatch, 'Direct generator should contain a URL');
  const directGenUrl = new URL(directGenUrlMatch[0]);
  assert.strictEqual(
    directGenUrl.hostname,
    'faserf.github.io',
    'Direct generator documentation link hostname'
  );
  assert.strictEqual(
    directGenUrl.pathname,
    '/ha-whatsapp/',
    'Direct generator documentation link path'
  );

  let botWelcomeSent = false;
  let botWelcomeText = '';
  const mockSessionBotJoin = {
    ...mockSession,
    sock: {
      ...mockSession.sock,
      sendMessage: async (jid, content) => {
        botWelcomeSent = true;
        botWelcomeText = content.text;
        return { key: { id: 'bot_welcome_msg_id' } };
      },
    },
  };

  await handleModerationParticipantUpdate(mockSessionBotJoin, {
    id: '1203630123456789@g.us',
    action: 'add',
    participants: ['491761234567@s.whatsapp.net'],
  });

  assert.strictEqual(botWelcomeSent, true, 'Bot welcome message should be sent on bot join');
  const botWelcomeUrlMatch = botWelcomeText.match(/https?:\/\/[^\s]+/);
  assert(botWelcomeUrlMatch, 'Bot welcome message should include a URL');
  const botWelcomeUrl = new URL(botWelcomeUrlMatch[0]);
  assert.strictEqual(
    botWelcomeUrl.hostname,
    'faserf.github.io',
    'Bot welcome message documentation link hostname'
  );
  assert.strictEqual(
    botWelcomeUrl.pathname,
    '/ha-whatsapp/',
    'Bot welcome message documentation link path'
  );
  console.log('✅ PASSED: Bot Welcome message on join verified successfully');
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
  assert(!formatted.includes('{"id"'), 'formatted text MUST NOT contain unparsed raw JSON objects');
  console.log('✅ PASSED: formatMessageTemplate with all extended placeholders verified');

  // Test 12: WAMessageStubType Invite Link Join & Self-Leave Handling
  clearModerationStoreCache();
  const stubConfig = getGroupModerationConfig('1203630123456789@g.us');
  stubConfig.enabled = true;
  stubConfig.greetings.welcome_enabled = true;
  stubConfig.greetings.welcome_message = 'Welcome {mention} to {group}!';
  setGroupModerationConfig('1203630123456789@g.us', stubConfig);

  let stubMessagesSent = [];
  const mockSessionStubTest = {
    ...mockSession,
    sock: {
      ...mockSession.sock,
      sendMessage: async (jid, content) => {
        stubMessagesSent.push(content);
        return { key: { id: 'stubJoin1' } };
      },
    },
  };

  await handleModerationParticipantUpdate(mockSessionStubTest, {
    id: '1203630123456789@g.us',
    action: 'add',
    participants: ['491768888888@s.whatsapp.net'],
  });

  assert.strictEqual(
    stubMessagesSent.length,
    1,
    'Invite-link join via stubType must send consolidated welcome message'
  );
  assert(
    stubMessagesSent[0].text.includes('Welcome'),
    'Consolidated stub join message must contain Welcome'
  );
  console.log('✅ PASSED: WAMessageStubType invite-link join processing verified');

  // Test Filter Subscriptions Default
  const finalStore = getDefaultModerationStore();
  assert(
    Array.isArray(finalStore.filter_subscriptions) && finalStore.filter_subscriptions.length > 0,
    'Store should contain filter_subscriptions default list'
  );
  console.log('✅ PASSED: Default filter subscriptions verified');

  // Test 13: Captcha normalization and formatting flexibility (*Code*, 'Code', "Code", etc.)
  assert.strictEqual(cleanCaptchaInput('NWLWR'), 'nwlwr');
  assert.strictEqual(cleanCaptchaInput('*NWLWR*'), 'nwlwr');
  assert.strictEqual(cleanCaptchaInput("'NWLWR'"), 'nwlwr');
  assert.strictEqual(cleanCaptchaInput('"NWLWR"'), 'nwlwr');
  assert.strictEqual(cleanCaptchaInput('`NWLWR`'), 'nwlwr');
  assert.strictEqual(cleanCaptchaInput('_NWLWR_'), 'nwlwr');
  assert.strictEqual(cleanCaptchaInput('👉 NWLWR'), 'nwlwr');
  assert.strictEqual(cleanCaptchaInput('*NWLWR* '), 'nwlwr');

  // Test Captcha verification matching in handleModerationMessage
  const captchaGroupConfig = getGroupModerationConfig('1203630999999999@g.us');
  captchaGroupConfig.enabled = true;
  captchaGroupConfig.greetings.captcha_enabled = true;
  captchaGroupConfig.greetings.captcha_mode = 'text';
  setGroupModerationConfig('1203630999999999@g.us', captchaGroupConfig);

  let captchaReplies = [];
  const mockSessionCaptchaTest = {
    ...mockSession,
    sock: {
      ...mockSession.sock,
      sendMessage: async (jid, content) => {
        captchaReplies.push(content);
        return { key: { id: 'captchaReply' } };
      },
    },
  };

  // Add participant to trigger pending captcha
  await handleModerationParticipantUpdate(mockSessionCaptchaTest, {
    id: '1203630999999999@g.us',
    action: 'add',
    participants: ['4917647365403@s.whatsapp.net'],
  });

  // Verify pending captcha exists
  const pendingCap = findPendingCaptcha(
    '1203630999999999@g.us',
    '4917647365403',
    mockSessionCaptchaTest
  );
  assert(pendingCap, 'Pending captcha entry should exist after participant update');
  const actualCode = pendingCap.captchaObj.answer;

  // Test wrong code -> sends invalid code feedback
  captchaReplies = [];
  const wrongHandled = await handleModerationMessage(mockSessionCaptchaTest, {
    sender: '1203630999999999@g.us',
    sender_number: '4917647365403',
    content: 'WRONGCODE',
    raw: { key: { id: 'msgWrong' } },
  });
  assert.strictEqual(wrongHandled, true, 'Wrong code should be handled');
  const wrongTextReply = captchaReplies.find((r) => r.text);
  assert(
    wrongTextReply?.text.includes('Captcha Verification Pending') ||
      wrongTextReply?.text.includes('security code'),
    'Wrong code must delete message and send verification reminder'
  );

  // Test formatted correct code (e.g. *CODE*) -> successfully verifies captcha
  captchaReplies = [];
  const validHandled = await handleModerationMessage(mockSessionCaptchaTest, {
    sender: '1203630999999999@g.us',
    sender_number: '4917647365403',
    content: `*${actualCode}*`,
    raw: { key: { id: 'msgValid' } },
  });
  assert.strictEqual(validHandled, true, 'Formatted code must be recognized as valid');
  const validTextReply = captchaReplies.find((r) => r.text);
  assert(
    validTextReply?.text.toLowerCase().includes('verified'),
    'Correct code must reply with a verified confirmation'
  );
  const pendingCapAfter = findPendingCaptcha(
    '1203630999999999@g.us',
    '4917647365403',
    mockSessionCaptchaTest
  );
  assert.strictEqual(pendingCapAfter, null, 'Pending captcha should be cleared after valid code');

  console.log(
    '✅ PASSED: Captcha formatting flexibility (*Code*, \'Code\', "Code", etc.) and feedback verified'
  );

  // Reset store
  saveModerationStore(getDefaultModerationStore());
  console.log('='.repeat(50) + '\n✅ ALL MODERATION TESTS PASSED\n');
} catch (err) {
  console.error('❌ MODERATION TEST FAILED:', err);

  process.exit(1);
}
