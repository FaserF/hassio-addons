import test from 'node:test';
import assert from 'node:assert/strict';
import { getSTTDiagnostics } from '../src/whatsapp/sttHandler.js';

test('STT Diagnostics: AegisBot Server detection and health status', () => {
  const groupConfig = {
    stt_enabled: true,
    stt_engine: 'aegisbot',
    stt_aegisbot_url: 'http://192.168.1.50:8000',
    stt_aegisbot_key: 'secret-token-123',
  };
  const store = {};

  const diag = getSTTDiagnostics(groupConfig, store);
  assert.equal(diag.is_enabled, true);
  assert.equal(diag.configured_engine, 'aegisbot');
  assert.equal(diag.active_engine, 'aegisbot');
  assert.match(diag.active_engine_name, /AegisBot/);
  assert.equal(diag.status, 'healthy');
  assert.equal(diag.health.aegisbot.status, 'ready');
});

test('STT Diagnostics: AegisBot Server without URL reports warning', () => {
  const groupConfig = {
    stt_enabled: true,
    stt_engine: 'aegisbot',
    stt_aegisbot_url: '',
    stt_aegisbot_key: '',
  };
  const store = {};

  const diag = getSTTDiagnostics(groupConfig, store);
  assert.equal(diag.is_enabled, true);
  assert.equal(diag.configured_engine, 'aegisbot');
  assert.equal(diag.active_engine, 'none');
  assert.equal(diag.status, 'no_key');
  assert.equal(diag.health.aegisbot.status, 'not_configured');
});
