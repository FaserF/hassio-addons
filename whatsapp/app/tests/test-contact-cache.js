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
    ['554399998888@s.whatsapp.net', { id: '554399998888@s.whatsapp.net', name: 'John Doe', notify: 'John' }],
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
assert(restoredSession.contactCache.get('554399998888@s.whatsapp.net')?.name === 'John Doe', 'Restored John Doe');
assert(restoredSession.contactCache.get('1234567890:1@s.whatsapp.net')?.name === 'Jane Smith', 'Restored Jane Smith');

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
assert(match1?.name === 'Alice', 'Matches target JID without device suffix to contact with :0 suffix');

const match2 = findContact('01701234567@s.whatsapp.net', testCache);
assert(match2?.name === 'Bob', 'Matches national number format via suffix digit matching');

const match3 = findContact('99999999999@s.whatsapp.net', testCache);
assert(match3 === undefined, 'Returns undefined for unknown number');

console.log('='.repeat(50));
if (failed) {
  console.error('❌ TESTS FAILED');
  process.exit(1);
} else {
  console.log('✅ ALL CONTACT CACHE TESTS PASSED\n');
  process.exit(0);
}
