import assert from 'node:assert';
import { getJid } from '../src/utils/jid.js';

console.log('\n💬 Running Messaging Mentions & JID Unit Tests\n' + '='.repeat(50));

// Helper simulating mention resolution in /send_message
function resolveMentions(message, mentions) {
  const fromText = [...String(message).matchAll(/@(\d{8,15})(?=_|\b)/g)].map((m) => m[1]);
  const rawMentions = Array.isArray(mentions)
    ? mentions.filter(
        (item) => (typeof item === 'string' || typeof item === 'number') && item !== ''
      )
    : [];
  return [
    ...new Set([...rawMentions, ...fromText].map((m) => getJid(String(m).trim())).filter(Boolean)),
  ];
}

// 1. Text mention parsing with and without underscores
assert.deepStrictEqual(
  resolveMentions('Hello @491761234567 please check', []),
  ['491761234567@s.whatsapp.net'],
  'Standard inline mention should resolve to phone JID'
);

assert.deepStrictEqual(
  resolveMentions('Hello _@491761234567_ in italics', []),
  ['491761234567@s.whatsapp.net'],
  'Inline mention with enclosing underscores should resolve to phone JID'
);

assert.deepStrictEqual(
  resolveMentions('Trailing underscore @491761234567_ here', []),
  ['491761234567@s.whatsapp.net'],
  'Inline mention with closing underscore should resolve to phone JID'
);

assert.deepStrictEqual(
  resolveMentions('Multiple _@491761111111_ and @491762222222_', []),
  ['491761111111@s.whatsapp.net', '491762222222@s.whatsapp.net'],
  'Multiple inline mentions with underscores should all resolve'
);

// 2. Reject numbers >15 digits and <8 digits
assert.deepStrictEqual(
  resolveMentions('Long number @1234567890123456 should be ignored', []),
  [],
  'Number longer than 15 digits must not be matched as mention'
);

assert.deepStrictEqual(
  resolveMentions('Long number with underscore _@1234567890123456_ ignored', []),
  [],
  'Number longer than 15 digits with underscores must not be matched'
);

assert.deepStrictEqual(
  resolveMentions('Short number @1234567 should be ignored', []),
  [],
  'Number shorter than 8 digits must not be matched'
);

// 3. Mentions array with full JIDs and formatted numbers
assert.deepStrictEqual(
  resolveMentions('Check this', ['123456789012345@lid', '491761234567@s.whatsapp.net']),
  ['123456789012345@lid', '491761234567@s.whatsapp.net'],
  'Full JIDs including @lid must be preserved as-is'
);

assert.deepStrictEqual(
  resolveMentions('Check this', ['+49-176-1234567', '+1 (555) 123-4567']),
  ['491761234567@s.whatsapp.net', '15551234567@s.whatsapp.net'],
  'Formatted phone numbers with hyphens/spaces must normalize to user JIDs'
);

// 4. Defensive type checking on mentions array
assert.deepStrictEqual(
  resolveMentions('Check this', [null, undefined, {}, [], '', '491761234567']),
  ['491761234567@s.whatsapp.net'],
  'Non-string/non-number items in mentions array must be filtered out without throwing'
);

assert.deepStrictEqual(
  resolveMentions('Check this', null),
  [],
  'Null mentions payload must return empty mentions list safely'
);

// 5. Trunk zero handling: Italy retains zero, Germany strips zero
assert.strictEqual(
  getJid('+39 06 12345678'),
  '390612345678@s.whatsapp.net',
  'Italian numbers must retain trunk zero'
);
assert.strictEqual(
  getJid('+49 0176 12345678'),
  '4917612345678@s.whatsapp.net',
  'German numbers must strip trunk zero'
);

// 6. Hyphenated group IDs vs formatted phone numbers
assert.strictEqual(
  getJid('123456789-1234567890'),
  '123456789-1234567890@g.us',
  'Hyphenated group ID must resolve to @g.us'
);
assert.strictEqual(
  getJid('+49-176-1234567'),
  '491761234567@s.whatsapp.net',
  'Hyphenated phone number must resolve to @s.whatsapp.net'
);

console.log('✅ ALL MESSAGING MENTION & JID TESTS PASSED\n');
