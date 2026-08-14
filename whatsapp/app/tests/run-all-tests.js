#!/usr/bin/env node
/**
 * Fast Unified Test Runner
 * Runs all unit tests and validation checks in a single Node process.
 */

import { performance } from 'perf_hooks';

async function run() {
  const startTime = performance.now();
  console.log('🚀 Running WhatsApp Addon Unified Test Suite...\n');

  try {
    console.log('--- 1/7 Validating UI Scope & References ---');
    await import('./validate-ui-scope.js');

    console.log('\n--- 2/7 Testing UI Rendering ---');
    const { runUiRenderTests } = await import('./test-ui-render.js');
    await runUiRenderTests();

    console.log('\n--- 3/7 Testing Contact Cache ---');
    await import('./test-contact-cache.js');

    console.log('\n--- 4/7 Testing Moderation Engine ---');
    await import('./test-moderation.js');

    console.log('\n--- 5/7 Testing Commands Engine ---');
    await import('./test-commands.js');

    console.log('\n--- 6/7 Testing Telegram Bridge ---');
    await import('./test-telegram-bridge.js');

    console.log('\n--- 7/7 Testing Dynamic i18n & Translation Parity ---');
    const { runI18nTests } = await import('./test-i18n.js');
    await runI18nTests();

    console.log('\n--- 8/8 Testing STT Engine & Google v2 Parser ---');
    await import('./test-stt.js');

    console.log('\n--- 9/9 Testing RBAC & WhatsApp Login ---');
    await import('./test-rbac-auth.js');

    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 ALL TEST SUITES PASSED IN ${duration}s!`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

run();
