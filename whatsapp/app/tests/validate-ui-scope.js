#!/usr/bin/env node
/**
 * CI Validation Script: UI JavaScript Scope & Reference Checker
 *
 * This script performs static analysis on the inline-bundled UI JavaScript files
 * to catch bugs that ESLint's 'no-undef: off' cannot detect. Specifically:
 *
 * 1. Ensures all `window.X = X` exports reference top-level functions/variables
 * 2. Ensures all onclick/onsubmit/onchange handlers in HTML reference exported functions
 * 3. Validates no syntax errors exist in any UI JS files
 * 4. Detects duplicate route registrations
 *
 * Run: node tests/validate-ui-scope.js
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uiDir = join(__dirname, '..', 'src', 'routes', 'ui');

let errors = 0;
let warnings = 0;

function error(file, line, msg) {
  console.error(`❌ ERROR [${file}:${line}]: ${msg}`);
  errors++;
}

function info(msg) {
  console.log(`✅ ${msg}`);
}

// --------------------------------------------------------------------------
// Test 1: Check window.X = X exports have matching top-level definitions
// --------------------------------------------------------------------------
function checkWindowExports(filename) {
  const filepath = join(uiDir, filename);
  if (!existsSync(filepath)) {
    error(filename, 0, `File not found: ${filepath}`);
    return;
  }

  const content = readFileSync(filepath, 'utf8');
  const lines = content.split('\n');

  // Find all top-level function/const/let/var declarations
  const topLevelDefs = new Set();
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track brace depth to determine top-level scope
    for (const char of line) {
      if (char === '{') braceDepth++;
      if (char === '}') braceDepth--;
    }

    // Only consider definitions at top-level (braceDepth === 0 or 1 for the line that opens)
    if (braceDepth <= 1) {
      // Match: function name(...) or async function name(...)
      const funcMatch = line.match(/^\s*(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
      if (funcMatch) topLevelDefs.add(funcMatch[1]);

      // Match: const/let/var name = ...
      const varMatch = line.match(/^\s*(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/);
      if (varMatch) topLevelDefs.add(varMatch[1]);
    }
  }

  // Find all window.X = X assignments
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(
      /^\s*window\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*;/
    );
    if (match) {
      const windowProp = match[1];
      const refName = match[2];
      if (!topLevelDefs.has(refName)) {
        error(
          filename,
          i + 1,
          `window.${windowProp} = ${refName} — but '${refName}' is NOT defined at top-level scope. This will cause a ReferenceError that crashes the entire script.`
        );
      }
    }
  }

  info(`${filename}: window.X export check complete (${topLevelDefs.size} top-level defs found)`);
}

// --------------------------------------------------------------------------
// Test 2: Check HTML onclick/onsubmit/onchange handlers reference exported functions
// --------------------------------------------------------------------------
function checkHtmlHandlers() {
  const indexPath = join(uiDir, 'index.js');
  if (!existsSync(indexPath)) {
    error('index.js', 0, 'index.js not found');
    return;
  }

  const content = readFileSync(indexPath, 'utf8');

  // Collect all window.X exports from ALL UI files
  const windowExports = new Set();
  for (const file of ['helpers.js', 'dashboard.js', 'chat.js', 'index.js']) {
    const filePath = join(uiDir, file);
    if (!existsSync(filePath)) continue;
    const fileContent = readFileSync(filePath, 'utf8');
    const exportMatches = fileContent.matchAll(/window\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g);
    for (const m of exportMatches) {
      windowExports.add(m[1]);
    }
  }

  // Also add functions defined directly in index.js with window.X = function pattern
  const indexFuncMatches = content.matchAll(
    /window\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:function|async function|\()/g
  );
  for (const m of indexFuncMatches) {
    windowExports.add(m[1]);
  }

  // Find all inline event handlers in HTML strings
  const lines = content.split('\n');
  const handlerPattern =
    /on(?:click|submit|change|input|focus|blur|keydown|keyup|keypress|mouseover|mouseout|mouseenter|mouseleave|contextmenu|dblclick|load|error)\s*=\s*"([^"]+)"/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    while ((match = handlerPattern.exec(line)) !== null) {
      const handlerCode = match[1];
      // Extract function name(s) from handler expressions like "functionName()" or "fn1(); fn2()"
      const funcCalls = handlerCode.matchAll(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g);
      for (const funcCall of funcCalls) {
        const funcName = funcCall[1];
        // Skip built-in/common functions and DOM methods
        const skipList = new Set([
          'event',
          'this',
          'return',
          'window',
          'document',
          'console',
          'alert',
          'confirm',
          'prompt',
          'setTimeout',
          'setInterval',
          'clearTimeout',
          'clearInterval',
          'parseInt',
          'parseFloat',
          'encodeURIComponent',
          'decodeURIComponent',
          'JSON',
          'Array',
          'Object',
          'String',
          'Number',
          'Boolean',
          'Date',
          'Math',
          'RegExp',
          'Error',
          'open',
          'close',
          'focus',
          'blur',
          'remove',
          'stopPropagation',
          'preventDefault',
          'scale',
          'trim',
          'split',
          'join',
          'map',
          'filter',
          'push',
          'pop',
          'shift',
          'splice',
          'toString',
          'valueOf',
          'hasOwnProperty',
          'includes',
          'replace',
          'match',
          'indexOf',
          'substring',
          'charAt',
          'toLowerCase',
          'toUpperCase',
          'fetch',
          'then',
          'catch',
        ]);
        if (skipList.has(funcName)) {
          continue;
        }
        if (!windowExports.has(funcName)) {
          error(
            'index.js',
            i + 1,
            `HTML handler references '${funcName}()' but no 'window.${funcName}' export found in any UI file`
          );
        }
      }
    }
  }

  info(`index.js: HTML handler check complete (${windowExports.size} window exports found)`);
}

// --------------------------------------------------------------------------
// Test 3: Syntax validation of all UI JS files
// --------------------------------------------------------------------------
function checkSyntax(filename) {
  const filepath = join(uiDir, filename);
  if (!existsSync(filepath)) return;

  const content = readFileSync(filepath, 'utf8');

  // Use Node.js to parse as a script — this catches real syntax errors
  // We wrap in a function body to allow top-level return, and use a
  // relaxed parse that mirrors how these files are inlined into <script>
  try {
    eval(`(function(){ ${content} })`);
    info(`${filename}: Syntax validation passed`);
  } catch (e) {
    if (e instanceof SyntaxError) {
      error(filename, 0, `Syntax error: ${e.message}`);
    }
    // Other errors (ReferenceError from undefined vars) are expected
    // because these files depend on each other — we only care about SyntaxError
    else {
      info(`${filename}: Syntax validation passed (runtime errors expected in isolation)`);
    }
  }
}

// --------------------------------------------------------------------------
// Test 4: Check for duplicate route registrations in API files
// --------------------------------------------------------------------------
function checkDuplicateRoutes() {
  const apiDir = join(__dirname, '..', 'src', 'routes', 'api');
  const apiFiles = [
    'messaging.js',
    'contacts.js',
    'groups.js',
    'channels.js',
    'session.js',
    'system.js',
    'ui_api.js',
    'moderation.js',
  ];

  for (const filename of apiFiles) {
    const filepath = join(apiDir, filename);
    if (!existsSync(filepath)) continue;

    const content = readFileSync(filepath, 'utf8');
    const routePattern = /app\.(get|post|put|delete|patch|all)\s*\(\s*['"]([^'"]+)['"]/g;
    const routes = new Map();

    let match;
    while ((match = routePattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];
      const key = `${method} ${path}`;

      if (routes.has(key)) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        error(
          filename,
          lineNum,
          `Duplicate route registration: ${key} (first at line ${routes.get(key)})`
        );
      } else {
        const lineNum = content.substring(0, match.index).split('\n').length;
        routes.set(key, lineNum);
      }
    }

    info(`${filename}: Duplicate route check complete (${routes.size} routes)`);
  }
}

// --------------------------------------------------------------------------
// Test 5: Check Home Assistant API endpoints exist in backend Express routes
// --------------------------------------------------------------------------
function checkHAEndpoints() {
  const apiDir = join(__dirname, '..', 'src', 'routes', 'api');
  const apiFiles = [
    'messaging.js',
    'contacts.js',
    'groups.js',
    'channels.js',
    'session.js',
    'system.js',
    'ui_api.js',
    'moderation.js',
  ];

  const registeredRoutes = new Set();
  for (const filename of apiFiles) {
    const filepath = join(apiDir, filename);
    if (!existsSync(filepath)) continue;
    const content = readFileSync(filepath, 'utf8');
    const routePattern = /app\.(get|post|put|delete|patch|all)\s*\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];
      if (method === 'ALL') {
        registeredRoutes.add(`GET ${path}`);
        registeredRoutes.add(`POST ${path}`);
      } else {
        registeredRoutes.add(`${method} ${path}`);
      }
    }
  }

  // List of endpoints expected by the Home Assistant integration (ha-whatsapp / api.py)
  const expectedHAEndpoints = [
    'GET /status',
    'POST /session/start',
    'DELETE /session',
    'POST /session/pair',
    'GET /qr',
    'GET /stats',
    'GET /health',
    'POST /send_message',
    'POST /send_image',
    'POST /send_audio',
    'POST /send_document',
    'POST /send_video',
    'POST /send_location',
    'POST /send_contact',
    'POST /send_event',
    'POST /send_poll',
    'POST /send_reaction',
    'POST /send_list',
    'POST /send_buttons',
    'POST /revoke_message',
    'POST /edit_message',
    'POST /contacts/check',
    'GET /contacts',
    'GET /groups',
    'GET /chats',
    'POST /mark_as_read',
    'POST /set_presence',
    'POST /groups/create',
    'POST /groups/info',
    'POST /groups/participants/add',
    'POST /groups/participants/remove',
    'POST /groups/participants/promote',
    'POST /groups/participants/demote',
    'POST /groups/leave',
    'POST /groups/subject',
    'POST /groups/description',
    'POST /groups/settings',
    'POST /groups/invite_code',
    'POST /groups/revoke_invite',
    'POST /groups/join',
    'POST /contacts/profile_picture',
    'POST /contacts/about',
    'POST /contacts/block',
    'POST /contacts/unblock',
    'POST /star_message',
    'POST /unstar_message',
    'POST /pin_message',
    'POST /unpin_message',
    'POST /forward_message',
    'POST /send_status',
    'POST /chats/archive',
    'POST /chats/unarchive',
    'POST /chats/mute',
    'POST /chats/unmute',
    'POST /mark_as_unread',
    'POST /chats/clear',
    'POST /chats/delete',
    'GET /chats/messages',
    'POST /channels/info',

    'POST /channels/follow',
    'POST /channels/unfollow',
    'POST /channels/mute',
    'POST /channels/unmute',
    'POST /labels/add_to_chat',
    'POST /labels/remove_from_chat',
  ];

  for (const ep of expectedHAEndpoints) {
    if (!registeredRoutes.has(ep)) {
      error(
        'routes/api',
        0,
        `Missing required API endpoint for Home Assistant integration: '${ep}'`
      );
    }
  }

  info(`API endpoint check complete (${expectedHAEndpoints.length} HA endpoints validated)`);
}

function checkNoEsModuleKeywords() {
  const filesToCheck = ['helpers.js', 'dashboard.js', 'chat.js'];
  const dashDir = join(uiDir, 'dashboard');
  if (existsSync(dashDir)) {
    const dashFiles = readdirSync(dashDir).filter((f) => f.endsWith('.js'));
    for (const df of dashFiles) {
      filesToCheck.push(join('dashboard', df));
    }
  }

  for (const relFile of filesToCheck) {
    const filepath = join(uiDir, relFile);
    if (!existsSync(filepath)) continue;
    const content = readFileSync(filepath, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*export\s+/.test(line) || /^\s*import\s+/.test(line)) {
        error(
          relFile,
          i + 1,
          `Found ES module keyword '${line.trim().split(' ')[0]}' in inline client script. Inline scripts do not use type="module" and will throw a SyntaxError on page load.`
        );
      }
    }
  }
  info('No forbidden ES module keywords (export/import) found in inline UI client scripts');
}

// --------------------------------------------------------------------------
// Test 6: HTML View Tag Balance & DOM Hierarchy Validation
// --------------------------------------------------------------------------
function checkHtmlViewTagBalance() {
  const viewsDir = join(uiDir, 'views');
  if (!existsSync(viewsDir)) return;

  const viewFiles = readdirSync(viewsDir).filter((f) => f.endsWith('.html.js'));
  for (const vf of viewFiles) {
    const filePath = join(viewsDir, vf);
    const fileContent = readFileSync(filePath, 'utf8');

    const opens = (fileContent.match(/<div[\s>]/gi) || []).length;
    const closes = (fileContent.match(/<\/div>/gi) || []).length;

    if (opens !== closes) {
      error(
        join('views', vf),
        0,
        `Unbalanced <div> tags in view template! Found ${opens} open <div...> and ${closes} closing </div> (diff: ${opens - closes}). An extra or missing </div> will break the DOM layout and collapse scroll containers!`
      );
    }

    const secOpens = (fileContent.match(/<section[\s>]/gi) || []).length;
    const secCloses = (fileContent.match(/<\/section>/gi) || []).length;
    if (secOpens !== secCloses) {
      error(
        join('views', vf),
        0,
        `Unbalanced <section> tags in view template! Found ${secOpens} open <section...> and ${secCloses} closing </section> (diff: ${secOpens - secCloses}).`
      );
    }
  }

  info(`HTML View Tag Balance check complete (${viewFiles.length} view templates validated)`);
}

// --------------------------------------------------------------------------
// Test 7: UI Design Standards & UX Integrity Validation
// --------------------------------------------------------------------------
function checkUiDesignStandards() {
  const files = ['helpers.js', 'dashboard.js', 'chat.js'];
  for (const f of files) {
    const p = join(uiDir, f);
    if (!existsSync(p)) continue;
    const content = readFileSync(p, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

      // Rule: No native alert/confirm/prompt in client scripts (use showToast or custom modals)
      if (/(?:^|[^\w.])window\.(?:alert|confirm|prompt)\s*\(/.test(line)) {
        error(
          f,
          idx + 1,
          'Native window.alert/confirm/prompt detected. Use showToast() or custom modal dialogs.'
        );
      }

      // Rule: No distracting animate-pulse on active tab / persistent UI indicators
      if (/activeTab === [a-zA-Z.'"`]+\s*\?\s*['"][^'"]*animate-pulse/.test(line)) {
        error(f, idx + 1, 'Do not use animate-pulse on active navigation tab icons.');
      }

      // Rule: User identifiers in flex containers must truncate to prevent overflow
      if (
        /\b(?:user_id|jid|phone)\b/.test(line) &&
        /font-mono/.test(line) &&
        !/truncate/.test(line)
      ) {
        if (lines[idx - 1] && /flex\b/.test(lines[idx - 1]) && !/min-w-0/.test(lines[idx - 1])) {
          error(
            f,
            idx + 1,
            'Identifier in flex layout missing `truncate` / parent missing `min-w-0` (risk of layout blowout).'
          );
        }
      }
    });
  }

  // Also validate view templates for hardcoded solid white containers without dark mode counterparts
  const viewsDir = join(uiDir, 'views');
  if (existsSync(viewsDir)) {
    const viewFiles = readdirSync(viewsDir).filter((f) => f.endsWith('.html.js'));
    for (const vf of viewFiles) {
      const vp = join(viewsDir, vf);
      const vContent = readFileSync(vp, 'utf8');
      const vLines = vContent.split('\n');
      vLines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('<!--')) return;
        if (
          /(?:class|className)=["'][^"']*\bbg-white\b[^"']*["']/.test(line) &&
          !/dark:bg-/.test(line) &&
          !/qr|rounded-full/i.test(line)
        ) {
          error(
            join('views', vf),
            idx + 1,
            'Solid bg-white container missing dark mode counterpart.'
          );
        }
      });
    }
  }

  info(
    'UI Design Standards check complete (No native popups, layout overflow safe, dark mode compliant)'
  );
}

// --------------------------------------------------------------------------
// Run all checks
// --------------------------------------------------------------------------
console.log('\n🔍 WhatsApp UI Scope & Reference Validation\n');
console.log('='.repeat(60));

console.log('\n📋 Test 1: window.X = X Export Scope Validation\n');
checkWindowExports('helpers.js');
checkWindowExports('dashboard.js');
checkWindowExports('chat.js');

console.log('\n📋 Test 2: HTML Event Handler Reference Validation\n');
checkHtmlHandlers();

console.log('\n📋 Test 3: Syntax Balance & ES Module Keyword Validation\n');
checkSyntax('helpers.js');
checkSyntax('dashboard.js');
checkSyntax('chat.js');
checkNoEsModuleKeywords();

console.log('\n📋 Test 4: Duplicate Route Detection\n');
checkDuplicateRoutes();

console.log('\n📋 Test 5: Home Assistant Integration Endpoint Validation\n');
checkHAEndpoints();

console.log('\n📋 Test 6: HTML View Tag Balance & DOM Structure Validation\n');
checkHtmlViewTagBalance();

console.log('\n📋 Test 7: UI Design Standards & Modal Quality Validation\n');
checkUiDesignStandards();

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Results: ${errors} error(s), ${warnings} warning(s)\n`);

if (errors > 0) {
  console.error('❌ VALIDATION FAILED — Fix the errors above before committing.\n');
  process.exit(1);
} else {
  console.log('✅ ALL CHECKS PASSED\n');
}
