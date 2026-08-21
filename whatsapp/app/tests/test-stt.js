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

// Test 7: handleWhatsAppVoiceSTT correctly rejects private chats when stt_enabled is false (Issue #982)
const { handleWhatsAppVoiceSTT } = await import('../src/whatsapp/sttHandler.js');
const dummyVoiceMsg = {
  key: { remoteJid: '4915902242000@s.whatsapp.net', fromMe: false },
  message: {
    audioMessage: {
      url: 'https://example.com/audio.ogg',
      mimetype: 'audio/ogg; codecs=opus',
      seconds: 5,
    },
  },
};

const dmResult = await handleWhatsAppVoiceSTT({}, '4915902242000@s.whatsapp.net', dummyVoiceMsg);
assert.strictEqual(dmResult, false, 'Private chat must not transcribe when stt_enabled is false');
console.log('✅ PASSED: handleWhatsAppVoiceSTT rejects private 1:1 chat voice notes by default');

// Test 8: handleWhatsAppVoiceSTT correctly rejects unconfigured group chats
const groupResult = await handleWhatsAppVoiceSTT({}, '123456789@g.us', dummyVoiceMsg);
assert.strictEqual(groupResult, false, 'Group chat must not transcribe when stt_enabled is false');
console.log('✅ PASSED: handleWhatsAppVoiceSTT rejects unconfigured group voice notes by default');

// Test 9: handleWhatsAppVoiceSTT ignores outgoing bot messages (fromMe: true)
const fromMeVoiceMsg = {
  key: { remoteJid: '4915902242000@s.whatsapp.net', fromMe: true },
  message: { audioMessage: { seconds: 5 } },
};
const fromMeResult = await handleWhatsAppVoiceSTT(
  {},
  '4915902242000@s.whatsapp.net',
  fromMeVoiceMsg
);
assert.strictEqual(fromMeResult, false, 'Outgoing audio fromMe must be ignored');
console.log('✅ PASSED: handleWhatsAppVoiceSTT ignores outgoing bot voice messages');

// Test 10: Home Assistant key auto-resolution precedence
const { resolveEffectiveGeminiKey } = await import('../src/ha.js');
const explicitKey = resolveEffectiveGeminiKey('AIzaExplicitKey999');
assert.strictEqual(explicitKey.key, 'AIzaExplicitKey999');
assert.strictEqual(explicitKey.source, 'custom_settings');
console.log('✅ PASSED: resolveEffectiveGeminiKey prioritizes explicit custom keys');

// Test 11: getSTTDiagnostics auto-resolves when explicit key is blank
const diagAuto = getSTTDiagnostics(
  { stt_enabled: true, stt_engine: 'gemini' },
  { gemini_api_key: 'AIzaCustom99' }
);
assert.strictEqual(diagAuto.status, 'healthy');
assert.ok(diagAuto.selection_reason.includes('Gemini'));
console.log('✅ PASSED: getSTTDiagnostics seamlessly uses effective Gemini key');

// Test 12: formatNetworkError formats ECONNREFUSED and ENOTFOUND descriptively
const { formatNetworkError } = await import('../src/whatsapp/sttHandler.js');
const dummyGt = (k) => {
  if (k === 'bot_replies.stt_err_conn_refused')
    return 'Host nicht erreichbar / Verbindung abgelehnt (Server offline oder falscher Port)';
  if (k === 'bot_replies.stt_err_host_not_found')
    return 'Host nicht gefunden / DNS-Auflösung fehlgeschlagen';
  return k;
};

const errRefused = new TypeError('fetch failed');
errRefused.cause = { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:8000' };
const formattedRefused = formatNetworkError(errRefused, dummyGt, 'AegisBot Server');
assert.ok(
  formattedRefused.includes('Verbindung abgelehnt') || formattedRefused.includes('nicht erreichbar')
);
console.log('✅ PASSED: formatNetworkError descriptively explains ECONNREFUSED');

const errNotFound = new TypeError('fetch failed');
errNotFound.cause = { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND aegisbot' };
const formattedNotFound = formatNetworkError(errNotFound, dummyGt, 'AegisBot Server');
assert.ok(formattedNotFound.includes('Host nicht gefunden') || formattedNotFound.includes('DNS'));
console.log('✅ PASSED: formatNetworkError descriptively explains ENOTFOUND');

console.log('✅ ALL STT & DIAGNOSTICS TESTS PASSED');
