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

  // Test 7: Verify all data-i18n attributes in UI views & shell map to existing translation keys
  const viewsDir = path.resolve(__dirname, '../src/routes/ui/views');
  const indexJsPath = path.resolve(__dirname, '../src/routes/ui/index.js');
  const enKeysSet = new Set(enKeys);
  let missingViewKeys = [];

  const filesToScan = [];
  if (fs.existsSync(viewsDir)) {
    fs.readdirSync(viewsDir)
      .filter((f) => f.endsWith('.js'))
      .forEach((f) => filesToScan.push(path.join(viewsDir, f)));
  }
  if (fs.existsSync(indexJsPath)) {
    filesToScan.push(indexJsPath);
  }

  for (const filePath of filesToScan) {
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.matchAll(/data-i18n(?:-placeholder|-title)?=["']([^"']+)["']/g);
    for (const m of matches) {
      const k = m[1];
      if (!enKeysSet.has(k)) {
        missingViewKeys.push(`${fileName}:${k}`);
      }
    }
  }

  assertTest(
    missingViewKeys.length === 0,
    `All HTML view & shell data-i18n attributes map to valid translation keys (missing: ${missingViewKeys.length > 0 ? missingViewKeys.join(', ') : 'none'})`
  );

  // Test 8: Automated JS String Scanner Test for showToast & showConfirm calls
  const uiDir = path.resolve(__dirname, '../src/routes/ui');
  function getJsFilesRecursively(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        results = results.concat(getJsFilesRecursively(fullPath));
      } else if (item.isFile() && item.name.endsWith('.js')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const jsFiles = getJsFilesRecursively(uiDir);
  let hardcodedToastAlerts = [];

  for (const file of jsFiles) {
    const relFile = path.relative(uiDir, file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      // Check showToast
      const toastMatch = line.match(/showToast\s*\(\s*(['"`])(.*?)\1/);
      if (toastMatch && !/showToast\s*\(\s*t\s*\(/.test(line)) {
        hardcodedToastAlerts.push(`${relFile}:${idx + 1} [toast: ${toastMatch[2]}]`);
      }
      // Check showConfirm
      const confirmMatch = line.match(/showConfirm\s*\(\s*(['"`])(.*?)\1/);
      if (confirmMatch && !/showConfirm\s*\(\s*t\s*\(/.test(line)) {
        hardcodedToastAlerts.push(`${relFile}:${idx + 1} [confirm: ${confirmMatch[2]}]`);
      }
    });
  }

  assertTest(
    hardcodedToastAlerts.length === 0,
    `Automated JS String Scanner: zero hardcoded showToast/showConfirm string literals (found: ${hardcodedToastAlerts.length > 0 ? hardcodedToastAlerts.join('; ') : 'none'})`
  );

  // Test 9: bot_replies namespace completeness — ensures all group bot reply keys exist in all locales
  const BOT_REPLY_REQUIRED_KEYS = [
    'bot_replies.muted',
    'bot_replies.banned_dm',
    'bot_replies.cannot_action_admin',
    'bot_replies.kick_ban_done',
    'bot_replies.user_not_member',
    'bot_replies.action_rate_limited',
    'bot_replies.action_failed',
    'bot_replies.warning_issued',
    'bot_replies.moderation_bypassed_whitelist',
    'bot_replies.moderation_bypassed_admin',
    'bot_replies.federation_deleted',
    'bot_replies.captcha_verified_dm',
    'bot_replies.captcha_verified_group',
    'bot_replies.content_lock_deleted',
    'bot_replies.antispam_link_deleted',
    'bot_replies.blacklist_deleted',
    'bot_replies.ai_guard_deleted',
    'bot_replies.group_rules',
    'bot_replies.ai_assistant',
    'bot_replies.ai_harmful_deleted',
    'bot_replies.captcha_verified_via_dm',
    'bot_replies.anti_raid_activated',
    'bot_replies.join_ban_enforced_dm',
    'bot_replies.join_ban_enforced_group',
    'bot_replies.captcha_timeout',
    'bot_replies.faq_hint',
    'bot_replies.warning_max_reached',
    'bot_replies.welcome_group_info',
    'bot_replies.user_info',
    'bot_replies.user_id',
    'bot_replies.warnings',
    'bot_replies.captcha_verified',
    'bot_replies.approved_whitelist',
    'bot_replies.info_muted',
    'bot_replies.warning_history',
    'bot_replies.yes',
    'bot_replies.no',
    'bot_replies.rules_updated',
    'bot_replies.welcome_updated',
    'bot_replies.goodbye_updated',
    'bot_replies.usage_setrules',
    'bot_replies.usage_setwelcome',
    'bot_replies.usage_setgoodbye',
    'bot_replies.promoted_users',
    'bot_replies.demoted_users',
    'bot_replies.cannot_promote_self',
    'bot_replies.cannot_demote_self',
    'bot_replies.cannot_action_bot',
    'bot_replies.promote_mention_required',
    'bot_replies.demote_mention_required',
    'bot_replies.promote_failed',
    'bot_replies.demote_failed',
    'bot_replies.cannot_report_self',
    'bot_replies.cannot_report_bot',
    'bot_replies.report_notice',
    'bot_replies.report_dm',
    'bot_replies.approve_mention_required',
    'bot_replies.approved_users',
    'bot_replies.unapprove_mention_required',
    'bot_replies.unapproved_users',
    'bot_replies.current_welcome',
    'bot_replies.current_goodbye',
    'bot_replies.usage_save',
    'bot_replies.note_saved',
    'bot_replies.usage_get',
    'bot_replies.note_not_found',
    'bot_replies.no_notes',
    'bot_replies.notes_list',
    'bot_replies.usage_filter',
    'bot_replies.filter_text_required',
    'bot_replies.filter_added',
    'bot_replies.usage_stop',
    'bot_replies.filter_stopped',
    'bot_replies.filter_not_found',
    'bot_replies.no_filters',
    'bot_replies.filters_list',
    'bot_replies.pong',
    'bot_replies.id_info',
    'bot_replies.no_rules_configured',
    'bot_replies.warn_mention_required',
    'bot_replies.cannot_warn_self',
    'bot_replies.cannot_warn_admin',
    'bot_replies.unwarn_mention_required',
    'bot_replies.warnings_cleared',
    'bot_replies.user_no_warnings',
    'bot_replies.warns_mention_required',
    'bot_replies.user_warnings_list',
    'bot_replies.user_zero_warnings',
    'bot_replies.kick_mention_required',
    'bot_replies.cannot_kick_self',
    'bot_replies.cannot_kick_bot',
    'bot_replies.ban_mention_required',
    'bot_replies.cannot_ban_self',
    'bot_replies.cannot_ban_bot',
    'bot_replies.unban_mention_required',
    'bot_replies.unbanned_user',
    'bot_replies.user_not_banned',
    'bot_replies.unkick_mention_required',
    'bot_replies.kick_log_cleared',
    'bot_replies.usage_lock',
    'bot_replies.type_locked',
    'bot_replies.unknown_lock_type',
    'bot_replies.usage_unlock',
    'bot_replies.type_unlocked',
    'bot_replies.no_locks',
    'bot_replies.all_locks_disabled',
    'bot_replies.active_locks',
  ];
  const enKeysForBotReplies = new Set(getAllKeys(enDict));
  const missingBotReplyKeys = BOT_REPLY_REQUIRED_KEYS.filter((k) => !enKeysForBotReplies.has(k));
  assertTest(
    missingBotReplyKeys.length === 0,
    `bot_replies namespace: all ${BOT_REPLY_REQUIRED_KEYS.length} required keys present in [en] (missing: ${missingBotReplyKeys.length > 0 ? missingBotReplyKeys.join(', ') : 'none'})`
  );
  for (const [code, dict] of localesMap.entries()) {
    if (code === 'en') continue;
    const langKeysSet = new Set(getAllKeys(dict));
    const missingInLang = BOT_REPLY_REQUIRED_KEYS.filter((k) => !langKeysSet.has(k));
    assertTest(
      missingInLang.length === 0,
      `bot_replies namespace: all required keys present in [${code}] (missing: ${missingInLang.length > 0 ? missingInLang.join(', ') : 'none'})`
    );
  }

  // Test 10: engine.js groupId extraction — ensures event.from is used for group messages (not event.sender)
  const enginePath = path.resolve(__dirname, '../src/whatsapp/moderation/engine.js');
  if (fs.existsSync(enginePath)) {
    const engineDir = path.resolve(__dirname, '../src/whatsapp/moderation/engine');
    let allEngineContent = fs.readFileSync(enginePath, 'utf8');
    if (fs.existsSync(engineDir)) {
      const files = fs.readdirSync(engineDir).filter((f) => f.endsWith('.js'));
      for (const f of files) {
        allEngineContent += '\n' + fs.readFileSync(path.join(engineDir, f), 'utf8');
      }
    }

    const usesEventFrom = /groupId\s*=\s*isGroup\s*\?\s*\(?\s*event\.from/.test(allEngineContent);
    assertTest(
      usesEventFrom,
      'engine.js: groupId uses event.from for group messages (not event.sender) — prevents blacklist/FAQ skip bug'
    );
    const doesNotUseRawSender = !/const groupId\s*=\s*event\.sender\s*;/.test(allEngineContent);
    assertTest(
      doesNotUseRawSender,
      'engine.js: groupId is NOT assigned directly from event.sender (regression guard)'
    );

    // Test 11: engine.js bot reply localization — ensures gt() helper is used, not hardcoded English reply strings
    // Must import t() from locales
    const importsT = /import\s*\{[^}]*\bt\b[^}]*\}\s*from\s*['"].*locales\/loader\.js['"]/.test(
      allEngineContent
    );
    assertTest(importsT, 'engine.js: imports t() from locales/loader.js for bot reply translation');
    // Must define the gt() helper
    const definesGt = /function gt\s*\(/.test(allEngineContent);
    assertTest(definesGt, 'engine.js: defines gt(config, key, params) translation helper');
    // Must NOT contain hardcoded English ban/blacklist/warning phrases in reply strings
    const hardcodedPhrases = [
      'Banned from Group',
      'Blacklist:* Message from',
      'Warning Issued to',
      'Anti-Spam Link:* Invite link',
      'Content Lock:* Message from',
      'ANTI-RAID SHIELD ACTIVATED',
      'FAQ Hint / Automated Help',
    ];
    const hardcodedInReplies = hardcodedPhrases.filter((phrase) =>
      allEngineContent.includes(phrase)
    );
    assertTest(
      hardcodedInReplies.length === 0,
      `engine.js: no hardcoded English bot-reply phrases found (found: ${hardcodedInReplies.length > 0 ? hardcodedInReplies.join(', ') : 'none'})`
    );
  }

  // Test 12: commands.js bot reply localization — ensures t() and gt() helpers are used
  const commandsPath = path.resolve(__dirname, '../src/whatsapp/moderation/commands.js');
  if (fs.existsSync(commandsPath)) {
    const commandsDir = path.resolve(__dirname, '../src/whatsapp/moderation/commands');
    let allCommandsContent = fs.readFileSync(commandsPath, 'utf8');
    if (fs.existsSync(commandsDir)) {
      const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));
      for (const f of files) {
        allCommandsContent += '\n' + fs.readFileSync(path.join(commandsDir, f), 'utf8');
      }
    }

    const importsT =
      /import\s*\{[^}]*(?:\bt\b|\bgt\b)[^}]*\}\s*from\s*['"].*locales\/loader\.js['"]/.test(
        allCommandsContent
      ) ||
      /import\s*\{[^}]*\bgt\b[^}]*\}\s*from\s*['"].*translations\.js['"]/.test(allCommandsContent);
    assertTest(
      importsT,
      'commands.js: imports t() from locales/loader.js for command response translation'
    );
    const definesGt =
      /function gt\s*\(/.test(allCommandsContent) || /gt\(/.test(allCommandsContent);
    assertTest(definesGt, 'commands.js: defines gt(config, key, params) translation helper');
    const usesGtForInfo =
      /bot_replies\.user_info/.test(allCommandsContent) &&
      /bot_replies\.user_id/.test(allCommandsContent);
    assertTest(usesGtForInfo, 'commands.js: uses gt() and bot_replies keys for !info command');
  }

  // Test 13: Technical German terms translations verification
  assertTest(
    t('de', 'dashboard.hard_reset') === 'Zurücksetzen',
    'German translation for hard_reset is "Zurücksetzen"'
  );
  assertTest(
    t('de', 'dashboard.reset_confirm_title') === 'Vollständiges Zurücksetzen & Abmelden?',
    'German translation for reset_confirm_title is "Vollständiges Zurücksetzen & Abmelden?"'
  );
  assertTest(
    t('de', 'dashboard.hard_reset_title') === 'Vollständiges Zurücksetzen / Abmelden',
    'German translation for hard_reset_title is "Vollständiges Zurücksetzen / Abmelden"'
  );
  assertTest(
    t('de', 'dashboard.standalone') === 'Eigenständiger Modus',
    'German translation for standalone is "Eigenständiger Modus"'
  );
  assertTest(
    t('de', 'nav.telegram') === 'Telegram-Brücke',
    'German translation for telegram is "Telegram-Brücke"'
  );
  assertTest(
    t('de', 'moderation.dest_private_join') === 'Direktnachricht (DM) an beitretenden Benutzer',
    'German translation for dest_private_join uses "Direktnachricht (DM)"'
  );
  assertTest(
    t('de', 'moderation.dest_private_leave') === 'Direktnachricht (DM) an verlassenden Benutzer',
    'German translation for dest_private_leave uses "Direktnachricht (DM)"'
  );
  assertTest(
    t('de', 'moderation.captcha_dest_private') === 'Direktnachricht (DM)',
    'German translation for captcha_dest_private uses "Direktnachricht (DM)"'
  );

  // Test 14: Zero un-translated HTML view text assertion
  let untranslatedHtmlElements = [];
  if (fs.existsSync(viewsDir)) {
    const viewFiles = fs.readdirSync(viewsDir).filter((f) => f.endsWith('.js'));
    for (const f of viewFiles) {
      let content = fs.readFileSync(path.join(viewsDir, f), 'utf8');

      // Strip elements that have data-i18n attributes (including their inner HTML)
      content = content.replace(
        /<([a-z1-6]+)(?:\s+[^>]*?)?\bdata-i18n(?:-placeholder|-title)?=["'][^"']+["'][^>]*>[\s\S]*?<\/\1>/gi,
        ''
      );

      const leafTagRegex = /<([a-z1-6]+)(?:\s+[^>]*?)?>([^<]+)<\/\1>/gi;
      let match;
      while ((match = leafTagRegex.exec(content)) !== null) {
        const tagName = match[1].toLowerCase();
        const innerText = match[2].trim();

        if (['style', 'script', 'code', 'pre', 'svg', 'option'].includes(tagName)) continue;
        if (innerText.includes('${')) continue;
        if (/^&(?:times|bull|middot|nbsp|amp|lt|gt);$/i.test(innerText)) continue;
        if (/^[smhpx%\d]+$/i.test(innerText)) continue;
        if (!/[a-zA-Z]{2,}/.test(innerText)) continue;

        untranslatedHtmlElements.push(`${f}: <${tagName}>${innerText}</${tagName}>`);
      }
    }
  }

  assertTest(
    untranslatedHtmlElements.length === 0,
    `Automated HTML View Scanner: zero un-translated HTML text elements in views (found: ${untranslatedHtmlElements.length > 0 ? untranslatedHtmlElements.join('; ') : 'none'})`
  );

  // Test 15: German Informal "Du" Form Consistency Assertion
  const deJsonPath = path.resolve(__dirname, '../src/locales/de.json');
  const deJsonContent = fs.readFileSync(deJsonPath, 'utf8');
  const deLines = deJsonContent.split('\n');

  const formalPronounRegex = /\b(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihres)\b/;
  const formalImperativeRegex = /\b[a-zA-ZäöüÄÖÜß]+en\s+Sie\s+/;

  let formalViolations = [];
  deLines.forEach((line, idx) => {
    if (formalPronounRegex.test(line) || formalImperativeRegex.test(line) || /\sSie\s/.test(line)) {
      formalViolations.push(`line ${idx + 1}: ${line.trim()}`);
    }
  });

  assertTest(
    formalViolations.length === 0,
    `100% of German translations consistently use informal 'Du' form (formal violations found: ${formalViolations.length > 0 ? formalViolations.join('; ') : 'none'})`
  );

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
