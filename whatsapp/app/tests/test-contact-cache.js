import fs from 'fs';
import path from 'path';
import os from 'os';

let failed = false;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    failed = true;
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('\n🧪 Running Contact Cache & Matching Tests\n' + '='.repeat(50));

// Test 1: Contact Cache Persistence to Disk
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-test-'));
const mockSession = {
  id: 'test_session',
  contactCache: new Map([
    [
      '554399998888@s.whatsapp.net',
      { id: '554399998888@s.whatsapp.net', name: 'John Doe', notify: 'John' },
    ],
    ['1234567890:1@s.whatsapp.net', { id: '1234567890:1@s.whatsapp.net', name: 'Jane Smith' }],
  ]),
};

const cacheFile = path.join(tmpDir, 'contact_cache.json');
const entries = Array.from(mockSession.contactCache.entries());
fs.writeFileSync(cacheFile, JSON.stringify(entries));

const restoredSession = {
  id: 'test_session',
  contactCache: new Map(),
};
const restoredEntries = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
for (const [id, contact] of restoredEntries) {
  restoredSession.contactCache.set(id, contact);
}

assert(restoredSession.contactCache.size === 2, 'Contact cache restored all 2 entries');
assert(
  restoredSession.contactCache.get('554399998888@s.whatsapp.net')?.name === 'John Doe',
  'Restored John Doe'
);
assert(
  restoredSession.contactCache.get('1234567890:1@s.whatsapp.net')?.name === 'Jane Smith',
  'Restored Jane Smith'
);

fs.rmSync(tmpDir, { recursive: true, force: true });

// Test 2: Fuzzy JID & Device Suffix Digit Matching Logic
const testCache = new Map([
  ['554399998888:0@s.whatsapp.net', { id: '554399998888:0@s.whatsapp.net', name: 'Alice' }],
  ['491701234567@s.whatsapp.net', { id: '491701234567@s.whatsapp.net', name: 'Bob' }],
]);

function findContact(targetJid, contactCache) {
  let cached = contactCache.get(targetJid);
  if (!cached && contactCache) {
    const targetUserDigits = targetJid.split('@')[0].split(':')[0].replace(/[^\d]/g, '');
    for (const [cJid, contact] of contactCache.entries()) {
      const cUserDigits = cJid.split('@')[0].split(':')[0].replace(/[^\d]/g, '');
      if (
        cJid === targetJid ||
        (cUserDigits && cUserDigits === targetUserDigits) ||
        (cUserDigits.length >= 7 &&
          targetUserDigits.length >= 7 &&
          (cUserDigits.endsWith(targetUserDigits) || targetUserDigits.endsWith(cUserDigits))) ||
        (cUserDigits.length >= 10 &&
          targetUserDigits.length >= 10 &&
          cUserDigits.slice(-10) === targetUserDigits.slice(-10))
      ) {
        cached = contact;
        break;
      }
    }
  }
  return cached;
}

const match1 = findContact('554399998888@s.whatsapp.net', testCache);
assert(
  match1?.name === 'Alice',
  'Matches target JID without device suffix to contact with :0 suffix'
);

const match2 = findContact('01701234567@s.whatsapp.net', testCache);
assert(match2?.name === 'Bob', 'Matches national number format via suffix digit matching');

const match3 = findContact('99999999999@s.whatsapp.net', testCache);
assert(match3 === undefined, 'Returns undefined for unknown number');

// Test 3: Poll Title Resolution (name vs question)
function resolvePollTitle(body) {
  const { name, question } = body;
  return name || question;
}

assert(
  resolvePollTitle({ question: 'Pizza or Burger?' }) === 'Pizza or Burger?',
  'Resolves poll title when question is provided'
);
assert(
  resolvePollTitle({ name: 'Pizza or Burger?' }) === 'Pizza or Burger?',
  'Resolves poll title when name is provided'
);
assert(
  resolvePollTitle({ name: 'Name Title', question: 'Question Title' }) === 'Name Title',
  'Prefers name if both name and question are provided'
);
assert(
  resolvePollTitle({}) === undefined,
  'Returns undefined if neither name nor question is provided'
);

// Test 4: isAdmin Self-Message / LID Matching
import { isAdmin } from '../src/utils/security.js';

const mockLidSession = {
  sock: {
    user: { id: '123456789012345:2@lid', lid: '123456789012345:2@lid' },
  },
  stats: {
    my_number: '491701234567',
  },
  contactCache: new Map([
    [
      '491701234567@s.whatsapp.net',
      { id: '491701234567@s.whatsapp.net', lid: '123456789012345@lid' },
    ],
  ]),
};

assert(isAdmin('123456789012345@lid', mockLidSession) === true, 'isAdmin matches user LID');
assert(
  isAdmin('491701234567@s.whatsapp.net', mockLidSession) === true,
  'isAdmin matches self PN via stats and contactCache'
);
assert(
  isAdmin('499999999999@s.whatsapp.net', mockLidSession) === false,
  'isAdmin rejects non-admin number'
);

// Test 5: isMessageForJid & LID 1:1 Chat Matching
import { isMessageForJid } from '../src/utils/security.js';

const mockDmSession = {
  sock: {
    user: { id: '491701111111:0@s.whatsapp.net', lid: '111111111111111@lid' },
  },
  stats: {
    my_number: '491701111111',
  },
  contactCache: new Map([
    [
      '491702222222@s.whatsapp.net',
      { id: '491702222222@s.whatsapp.net', lid: '222222222222222@lid', name: 'Alice' },
    ],
  ]),
};

const msgExact = { key: { remoteJid: '491702222222@s.whatsapp.net', id: '1' } };
const msgLidWithAlt = {
  key: {
    remoteJid: '222222222222222@lid',
    remoteJidAlt: '491702222222@s.whatsapp.net',
    id: '2',
  },
};
const msgLidWithoutAlt = {
  key: {
    remoteJid: '222222222222222@lid',
    id: '3',
  },
};
const msgOther = {
  key: {
    remoteJid: '491703333333@s.whatsapp.net',
    id: '4',
  },
};

assert(
  isMessageForJid(msgExact, '491702222222@s.whatsapp.net', mockDmSession) === true,
  'isMessageForJid matches exact remoteJid'
);
assert(
  isMessageForJid(msgLidWithAlt, '491702222222@s.whatsapp.net', mockDmSession) === true,
  'isMessageForJid matches via remoteJidAlt'
);
assert(
  isMessageForJid(msgLidWithoutAlt, '491702222222@s.whatsapp.net', mockDmSession) === true,
  'isMessageForJid matches via contactCache LID mapping'
);
assert(
  isMessageForJid(msgOther, '491702222222@s.whatsapp.net', mockDmSession) === false,
  'isMessageForJid rejects unrelated JID'
);

console.log('='.repeat(50));
if (failed) {
  console.error('❌ TESTS FAILED');
  process.exit(1);
} else {
  console.log('✅ ALL TESTS PASSED\n');
}
