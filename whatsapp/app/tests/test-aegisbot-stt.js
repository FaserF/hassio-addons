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

test('validateSafeHttpUrl blocks SSRF cloud metadata and invalid schemes', async () => {
  const { validateSafeHttpUrl } = await import('../src/utils/security.js');

  // Block cloud metadata IPs
  assert.equal(validateSafeHttpUrl('http://169.254.169.254/latest/meta-data/'), null);
  assert.equal(validateSafeHttpUrl('http://metadata.google.internal/computeMetadata/v1/'), null);
  assert.equal(validateSafeHttpUrl('http://169.254.170.2/v2/metadata'), null);
  assert.equal(validateSafeHttpUrl('http://user:pass@192.168.1.100:8000'), null);
  assert.equal(validateSafeHttpUrl('ftp://192.168.1.100'), null);
  assert.equal(validateSafeHttpUrl('javascript:alert(1)'), null);

  // Valid AegisBot local URLs
  const validLocal = validateSafeHttpUrl('http://localhost:8000/');
  assert.notEqual(validLocal, null);
  assert.equal(validLocal.origin, 'http://localhost:8000');
  assert.equal(validLocal.healthUrl, 'http://localhost:8000/api/v1/health');

  const validIp = validateSafeHttpUrl('http://192.168.1.50:8000/aegis');
  assert.notEqual(validIp, null);
  assert.equal(validIp.healthUrl, 'http://192.168.1.50:8000/aegis/api/v1/health');
});
