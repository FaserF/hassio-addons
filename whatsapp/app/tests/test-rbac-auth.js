import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  determineUserRole,
  requestOtpCode,
  verifyOtpCode,
  handleOptOutCommand,
  saveRbacConfig,
  loadRbacConfig,
  normalizePhoneNumber,
} from '../src/rbac.js';

describe('RBAC & WhatsApp Login Tests', () => {
  beforeEach(() => {
    // Reset config for clean test run
    saveRbacConfig({
      superadmin_numbers: ['491761111111'],
      blocked_numbers: [],
    });
  });

  it('Normalizes phone numbers correctly', () => {
    assert.strictEqual(normalizePhoneNumber('491761234567@s.whatsapp.net'), '491761234567');
    assert.strictEqual(normalizePhoneNumber('+49 176 1234567'), '491761234567');
    assert.strictEqual(normalizePhoneNumber(''), '');
  });

  it('Ingress requests are automatically authorized as Super Admin', () => {
    const req = {
      headers: { 'x-ingress-path': '/api/hassio_ingress/xyz' },
      ip: '192.168.1.50',
    };
    const roleInfo = determineUserRole(req);
    assert.strictEqual(roleInfo.role, 'superadmin');
    assert.strictEqual(roleInfo.isSuperAdmin, true);
    assert.strictEqual(roleInfo.authMethod, 'ingress');
  });

  it('Local private IP without password is auto authorized as Super Admin', () => {
    const req = {
      headers: {},
      ip: '192.168.1.100',
    };
    const roleInfo = determineUserRole(req);
    assert.strictEqual(roleInfo.role, 'superadmin');
    assert.strictEqual(roleInfo.isSuperAdmin, true);
    assert.strictEqual(roleInfo.authMethod, 'local_trusted');
  });

  it('External IP request requires login when unauthenticated', () => {
    const req = {
      headers: {},
      ip: '203.0.113.195', // Public IP
    };
    const roleInfo = determineUserRole(req);
    assert.strictEqual(roleInfo.role, 'unauthenticated');
    assert.strictEqual(roleInfo.isSuperAdmin, false);
  });

  it('Generates 6-digit OTP code and enforces 60s anti-spam rate limit', () => {
    const phone = '491769999999';
    const firstRes = requestOtpCode(phone);
    assert.strictEqual(firstRes.success, true);
    assert.strictEqual(typeof firstRes.code, 'string');
    assert.strictEqual(firstRes.code.length, 6);
    assert.match(firstRes.messageText, /\/stoplogin/);

    // Immediate second attempt should be rate limited
    const secondRes = requestOtpCode(phone);
    assert.strictEqual(secondRes.success, false);
    assert.strictEqual(secondRes.error, 'rate_limited');
  });

  it('Verifies correct OTP code and issues session token', () => {
    const phone = '491768888888';
    const reqRes = requestOtpCode(phone);
    assert.strictEqual(reqRes.success, true);

    // Incorrect code
    const badVerify = verifyOtpCode(phone, '000000');
    assert.strictEqual(badVerify.success, false);
    assert.strictEqual(badVerify.error, 'invalid_code');

    // Correct code
    const goodVerify = verifyOtpCode(phone, reqRes.code);
    assert.strictEqual(goodVerify.success, true);
    assert.strictEqual(typeof goodVerify.sessionToken, 'string');

    // Test request with valid session token
    const authReq = {
      headers: { 'x-session-token': goodVerify.sessionToken },
      ip: '203.0.113.195',
    };
    const roleInfo = determineUserRole(authReq);
    assert.strictEqual(roleInfo.role, 'user');
    assert.strictEqual(roleInfo.phone, phone);
  });

  it('Mapped superadmin phone number gets Super Admin role on external login', () => {
    const phone = '491761111111'; // Listed in superadmin_numbers
    const reqRes = requestOtpCode(phone);
    const verifyRes = verifyOtpCode(phone, reqRes.code);
    assert.strictEqual(verifyRes.success, true);
    assert.strictEqual(verifyRes.isSuperAdmin, true);

    const authReq = {
      headers: { 'x-session-token': verifyRes.sessionToken },
      ip: '203.0.113.195',
    };
    const roleInfo = determineUserRole(authReq);
    assert.strictEqual(roleInfo.role, 'superadmin');
    assert.strictEqual(roleInfo.isSuperAdmin, true);
  });

  it('Handles /stoplogin opt-out command and blocks further OTP messages', () => {
    const phone = '491767777777';
    const optOutResult = handleOptOutCommand(`${phone}@s.whatsapp.net`);
    assert.strictEqual(optOutResult, true);

    const rbacConfig = loadRbacConfig();
    assert.strictEqual(rbacConfig.blocked_numbers.includes(phone), true);

    // Requesting OTP for blocked number should fail
    const blockedReq = requestOtpCode(phone);
    assert.strictEqual(blockedReq.success, false);
    assert.strictEqual(blockedReq.error, 'blocked');
  });
});
