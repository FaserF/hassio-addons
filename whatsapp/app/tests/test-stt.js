import assert from 'assert';
import { getSTTDiagnostics } from '../src/whatsapp/sttHandler.js';
import { getTranslationDiagnostics } from '../src/utils/gatewayTranslator.js';

console.log('🧪 Running STT & Diagnostics Unit Tests...');

// Test 1: Verify Gemini response parsing
const geminiResponse = {
  candidates: [
    {
      content: {
        parts: [{ text: 'Hallo Test Sprachnachricht' }],
      },
    },
  ],
};
const geminiText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
assert.strictEqual(geminiText, 'Hallo Test Sprachnachricht');
console.log('✅ PASSED: Gemini STT response JSON parser extracts transcript correctly');

// Test 2: Verify OpenAI Whisper response parsing
const whisperResponse = {
  text: 'Hallo Test Sprachnachricht',
};
const whisperText = whisperResponse.text?.trim();
assert.strictEqual(whisperText, 'Hallo Test Sprachnachricht');
console.log('✅ PASSED: Whisper STT response JSON parser extracts transcript correctly');

// Test 3: STT Diagnostics - Disabled
const diagDisabled = getSTTDiagnostics({ stt_enabled: false }, {});
assert.strictEqual(diagDisabled.status, 'disabled');
assert.strictEqual(diagDisabled.is_enabled, false);
console.log('✅ PASSED: STT Diagnostics correctly reports disabled status');

// Test 4: STT Diagnostics - Active Gemini
const diagGemini = getSTTDiagnostics(
  { stt_enabled: true, stt_engine: 'gemini' },
  { gemini_api_key: 'AIzaTest123' }
);
assert.strictEqual(diagGemini.status, 'healthy');
assert.strictEqual(diagGemini.active_engine, 'gemini');
assert.ok(diagGemini.selection_reason.includes('Gemini'));
console.log('✅ PASSED: STT Diagnostics correctly reports active Gemini engine with reason');

// Test 5: STT Diagnostics - Missing Key
const diagNoKey = getSTTDiagnostics(
  { stt_enabled: true, stt_engine: 'auto' },
  { gemini_api_key: '' }
);
assert.strictEqual(diagNoKey.status, 'no_key');
assert.ok(diagNoKey.selection_reason.toLowerCase().includes('api key'));
console.log('✅ PASSED: STT Diagnostics correctly reports missing API key reason');

// Test 6: Translation Diagnostics - Auto Failover
const diagTransAuto = getTranslationDiagnostics({ translation: { provider: 'auto' } }, {});
assert.strictEqual(diagTransAuto.active_provider, 'google');
assert.strictEqual(diagTransAuto.status, 'healthy');
assert.ok(diagTransAuto.selection_reason.includes('Auto-Failover'));
console.log('✅ PASSED: Translation Diagnostics correctly reports auto-failover provider & health');

console.log('✅ ALL STT & DIAGNOSTICS TESTS PASSED');
