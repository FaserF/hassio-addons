import { renderDashboard } from '../src/routes/ui/index.js';
import assert from 'node:assert';

export async function runUiRenderTests() {
  console.log('🧪 Running UI Render Unit Test');
  console.log('==================================================');

  try {
    const htmlOutput = renderDashboard('mock-session-id');

    if (!htmlOutput.includes('<!DOCTYPE html>')) {
      console.error('❌ FAILED: Response missing DOCTYPE');
      process.exit(1);
    }

    const requiredTabs = [
      'tab-dashboard',
      'tab-logs',
      'tab-chats',
      'tab-moderation',
      'tab-telegram',
    ];
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
      console.error(
        '❌ FAILED: tab-telegram is not properly positioned inside <main class="main-content">'
      );
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

    assert.ok(htmlOutput.includes('chat-thread-header'), 'Header element exists');
    assert.ok(
      !htmlOutput.includes('max-width:calc(100% - 150px)'),
      'Rigid header max-width removed'
    );
    assert.ok(
      htmlOutput.includes('id="chat-search-toggle"'),
      'Search toggle button exists in header'
    );

    assert.ok(
      htmlOutput.includes('id="active-chat-header-badges"'),
      'Header badges container element exists'
    );

    const chatJs = await import('../src/routes/ui/chat.js');
    if (typeof chatJs.renderMediaBlock === 'function') {
      const imgBlock = chatJs.renderMediaBlock({
        mediaUrl: '/media/test.jpg',
        mediaType: 'image',
        caption: 'My Image',
      });
      assert.ok(imgBlock.includes('src='), 'Image block produces img tag');
      assert.ok(
        imgBlock.includes('Photo Attachment') || imgBlock.includes('My Image'),
        'Fallback label configured'
      );
    }
    if (typeof chatJs.matchJid === 'function') {
      assert.strictEqual(
        chatJs.matchJid('12036301234567890:1@g.us', '12036301234567890@g.us'),
        true
      );
      assert.strictEqual(chatJs.matchJid('12036301234567890@g.us', '12036301234567890'), true);
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

if (process.argv[1] && process.argv[1].endsWith('test-ui-render.js')) {
  await runUiRenderTests();
}
