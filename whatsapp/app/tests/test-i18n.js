import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadAllLocales,
  getAvailableLanguages,
  getLocaleDictionary,
  t,
} from '../src/locales/loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let failed = 0;
function assertTest(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    failed++;
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const keyPath = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys = keys.concat(getAllKeys(v, keyPath));
    } else {
      keys.push(keyPath);
    }
  }
  return keys;
}

function extractPlaceholders(str) {
  if (typeof str !== 'string') return [];
  const matches = str.match(/\{[a-zA-Z0-9_]+\}/g) || [];
  return Array.from(new Set(matches)).sort();
}

async function runI18nTests() {
  console.log('🌐 Running Dynamic i18n & Translation Parity Unit Tests');
  console.log('======================================================');

  // Test 1: Dynamic Locale Loader Discovery
  const localesMap = loadAllLocales();
  assertTest(
    localesMap.size >= 2,
    `Dynamically discovered at least 2 locale files (found ${localesMap.size})`
  );
  assertTest(localesMap.has('en'), 'English locale (en.json) is loaded');
  assertTest(localesMap.has('de'), 'German locale (de.json) is loaded');

  // Test 2: Available Languages Metadata
  const langList = getAvailableLanguages();
  assertTest(
    langList.some((l) => l.code === 'de' && l.flag === '🇩🇪'),
    'German language metadata correct'
  );
  assertTest(
    langList.some((l) => l.code === 'en' && l.flag === '🇬🇧'),
    'English language metadata correct'
  );

  // Test 3: Key Parity across all Addon Locale Files
  const enDict = getLocaleDictionary('en');
  const enKeys = getAllKeys(enDict);
  assertTest(enKeys.length > 0, `English locale dictionary has ${enKeys.length} translation keys`);

  for (const [code, dict] of localesMap.entries()) {
    if (code === 'en') continue;
    const langKeys = new Set(getAllKeys(dict));
    let missingKeys = [];
    for (const key of enKeys) {
      if (!langKeys.has(key)) {
        missingKeys.push(key);
      }
    }
    assertTest(
      missingKeys.length === 0,
      `Locale [${code}] has 100% key parity with [en] (missing: ${missingKeys.length > 0 ? missingKeys.join(', ') : 'none'})`
    );
  }

  // Test 4: Parameter Interpolation Match
  let placeholderMismatches = 0;
  for (const key of enKeys) {
    const enVal = t('en', key);
    const deVal = t('de', key);
    const enPlaceholders = extractPlaceholders(enVal);
    const dePlaceholders = extractPlaceholders(deVal);
    if (JSON.stringify(enPlaceholders) !== JSON.stringify(dePlaceholders)) {
      console.error(
        `⚠️ Placeholder mismatch in key "${key}": EN=${enPlaceholders.join()} vs DE=${dePlaceholders.join()}`
      );
      placeholderMismatches++;
    }
  }
  assertTest(
    placeholderMismatches === 0,
    `Template interpolation placeholders match 100% across EN and DE`
  );

  // Test 5: Dynamic Parameter Substitution Function
  const subResult = t('en', 'moderation.language_setting.title', { group: 'Test Group' });
  assertTest(
    typeof subResult === 'string' && subResult.length > 0,
    't() function resolves key correctly with parameters'
  );

  // Test 6: HA Integration Translation Files Key Parity
  const haRoot = path.resolve(__dirname, '../../../ha-whatsapp/custom_components/whatsapp');
  const stringsPath = path.join(haRoot, 'strings.json');
  const deTransPath = path.join(haRoot, 'translations/de.json');

  if (fs.existsSync(stringsPath) && fs.existsSync(deTransPath)) {
    try {
      const stringsObj = JSON.parse(fs.readFileSync(stringsPath, 'utf8'));
      const deTransObj = JSON.parse(fs.readFileSync(deTransPath, 'utf8'));
      const stringKeys = getAllKeys(stringsObj);
      const deTransKeys = new Set(getAllKeys(deTransObj));

      let haMissing = [];
      for (const k of stringKeys) {
        if (!deTransKeys.has(k)) {
          haMissing.push(k);
        }
      }
      assertTest(
        haMissing.length === 0,
        `HA Integration [translations/de.json] has 100% parity with [strings.json] (missing: ${haMissing.length > 0 ? haMissing.join(', ') : 'none'})`
      );
    } catch (e) {
      console.error('⚠️ Failed to parse HA Integration translation files:', e.message);
    }
  }

  if (failed > 0) {
    throw new Error(`i18n unit tests failed with ${failed} error(s)`);
  }
  console.log('======================================================');
  console.log('✅ ALL i18N TESTS PASSED SUCCESSFULLY\n');
}

export { runI18nTests };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runI18nTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
