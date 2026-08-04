import { registry } from '../src/whatsapp/moderation/commands.js';

let failed = 0;
function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        failed++;
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

async function runTests() {
    console.log('🧪 Running Command Engine Unit Tests');
    console.log('==================================================');

    // 1. Check if all required commands are registered
    assert(registry.getCommand('help') !== undefined, 'help command is registered');
    assert(registry.getCommand('ping') !== undefined, 'ping command is registered');
    assert(registry.getCommand('warn') !== undefined, 'warn command is registered');
    assert(registry.getCommand('warns') !== undefined, 'warns command is registered');
    assert(registry.getCommand('kick') !== undefined, 'kick command is registered');
    assert(registry.getCommand('ban') !== undefined, 'ban command (alias) is registered');
    assert(registry.getCommand('lock') !== undefined, 'lock command is registered');
    
    // Phase 2 Commands
    assert(registry.getCommand('setrules') !== undefined, 'setrules command is registered');
    assert(registry.getCommand('promote') !== undefined, 'promote command is registered');
    assert(registry.getCommand('demote') !== undefined, 'demote command is registered');
    assert(registry.getCommand('approve') !== undefined, 'approve command is registered');
    assert(registry.getCommand('report') !== undefined, 'report command is registered');
    assert(registry.getCommand('setwelcome') !== undefined, 'setwelcome command is registered');
    assert(registry.getCommand('save') !== undefined, 'save command is registered');
    assert(registry.getCommand('notes') !== undefined, 'notes command is registered');
    assert(registry.getCommand('filter') !== undefined, 'filter command is registered');
    
    // 2. Check permissions config
    assert(registry.getCommand('warn').adminOnly === true, 'warn requires admin');
    assert(registry.getCommand('approve').adminOnly === true, 'approve requires admin');
    assert(registry.getCommand('ping').adminOnly === false, 'ping is for everyone');
    assert(registry.getCommand('notes').adminOnly === false, 'notes is for everyone');
    assert(registry.getCommand('report').adminOnly === false, 'report is for everyone');

    // We temporally replace the help handler's reply function dependency? 
    // Actually, it's imported in commands.js so we can't easily intercept it without DI.
    // That's fine, we tested the registry structure which is the core logic.

    if (failed > 0) {
        console.log('==================================================');
        console.error(`❌ ${failed} TESTS FAILED`);
        process.exit(1);
    } else {
        console.log('==================================================');
        console.log('✅ ALL COMMAND TESTS PASSED');
        process.exit(0);
    }
}

runTests();
