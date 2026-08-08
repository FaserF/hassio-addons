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

    if (!htmlOutput.includes('tab-dashboard')) {
      console.error('❌ FAILED: Missing dashboard tab in output');
      process.exit(1);
    }

    if (htmlOutput.includes('ReferenceError:') || htmlOutput.includes('SyntaxError:')) {
      console.error('❌ FAILED: Rendered output contains error stack traces');
      process.exit(1);
    }

    console.log(
      '✅ PASSED: UI renders successfully without throwing template errors (e.g. ReferenceError: require is not defined)'
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
