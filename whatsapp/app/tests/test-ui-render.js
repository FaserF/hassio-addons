import { renderDashboard } from '../src/routes/ui/index.js';

async function runTests() {
    console.log('🧪 Running UI Render Unit Test');
    console.log('==================================================');
    
    try {
        const htmlOutput = renderDashboard('mock-session-id');
        
        // Basic sanity checks
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
            console.error(htmlOutput.substring(0, 500) + '...');
            process.exit(1);
        }

        console.log('✅ PASSED: UI renders successfully without throwing template errors (e.g. ReferenceError: require is not defined)');
        console.log('==================================================');
        console.log('✅ ALL UI RENDER TESTS PASSED');
        process.exit(0);
    } catch (err) {
        console.error('❌ FAILED: Unhandled exception during UI render:');
        console.error(err);
        process.exit(1);
    }
}

runTests();
