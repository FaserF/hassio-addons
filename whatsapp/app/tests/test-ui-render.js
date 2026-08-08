import { renderDashboard } from '../src/routes/ui/index.js';

export async function runUiRenderTests() {
  console.log('🧪 Running UI Render Unit Test');
  console.log('==================================================');

  try {
    const htmlOutput = renderDashboard('mock-session-id');

    if (!htmlOutput.includes('<!DOCTYPE html>')) {
      console.error('❌ FAILED: Response missing DOCTYPE');
      process.exit(1);
    }

    const requiredTabs = ['tab-dashboard', 'tab-logs', 'tab-chats', 'tab-moderation', 'tab-telegram'];
    for (const tabId of requiredTabs) {
      if (!htmlOutput.includes(`id="${tabId}"`)) {
        console.error(`❌ FAILED: Missing ${tabId} tab in output`);
        process.exit(1);
      }
    }

    // Verify DOM structure: content-body must contain all tabs and footer before closing
    const cbIndex = htmlOutput.indexOf('<div class="content-body">');
    if (cbIndex === -1) {
      console.error('❌ FAILED: Missing <div class="content-body"> container in rendered HTML');
      process.exit(1);
    }

    const mainCloseIndex = htmlOutput.indexOf('</main>');
    const telegramIndex = htmlOutput.indexOf('id="tab-telegram"');
    const footerIndex = htmlOutput.indexOf('footer-info');

    if (telegramIndex < cbIndex || telegramIndex > mainCloseIndex) {
      console.error('❌ FAILED: tab-telegram is not properly positioned inside <main class="main-content">');
      process.exit(1);
    }

    if (footerIndex < cbIndex) {
      console.error('❌ FAILED: footer-info is positioned before content-body');
      process.exit(1);
    }

    if (htmlOutput.includes('ReferenceError:') || htmlOutput.includes('SyntaxError:')) {
      console.error('❌ FAILED: Rendered output contains error stack traces');
      process.exit(1);
    }

    console.log(
      '✅ PASSED: UI renders successfully with all 5 tabs inside content-body scroll container without template errors'
    );
    console.log('==================================================');
    console.log('✅ ALL UI RENDER TESTS PASSED');
  } catch (err) {
    console.error('❌ FAILED: Unhandled exception during UI render:');
    console.error(err);
    process.exit(1);
  }
}

await runUiRenderTests();
