import test from 'node:test';
import assert from 'node:assert/strict';
import { createZipBuffer, parseTimeframeCutoff, generateChatExport } from '../src/whatsapp/export.js';

test('createZipBuffer creates valid uncorrupted ZIP with files', () => {
  const files = [
    { name: 'hello.txt', content: 'Hello World!' },
    { name: 'data.json', content: JSON.stringify({ test: true, count: 42 }) },
  ];

  const zipBuf = createZipBuffer(files);
  assert.ok(zipBuf.length > 50, 'ZIP buffer should be generated');

  // Verify PKZIP local header signature 0x04034b50
  assert.strictEqual(zipBuf.readUInt32LE(0), 0x04034b50);
});

test('parseTimeframeCutoff calculates accurate ms timestamps', () => {
  const now = Date.now();
  const tf24h = parseTimeframeCutoff('24h');
  assert.ok(now - tf24h >= 24 * 60 * 60 * 1000 - 1000);
  assert.ok(now - tf24h <= 24 * 60 * 60 * 1000 + 1000);

  const tfAll = parseTimeframeCutoff('all');
  assert.strictEqual(tfAll, 0);

  const tf7d = parseTimeframeCutoff('7d');
  assert.ok(now - tf7d >= 7 * 24 * 60 * 60 * 1000 - 1000);
});

test('generateChatExport creates structured package with all required files', async () => {
  const mockSession = {
    messageStore: new Map([
      [
        'msg1',
        {
          key: { id: 'msg1', remoteJid: '123456789@g.us', fromMe: false, participant: '49170111@s.whatsapp.net' },
          messageTimestamp: Math.floor(Date.now() / 1000) - 300,
          pushName: 'Alice',
          message: { conversation: 'Hello export test' },
        },
      ],
      [
        'msg2',
        {
          key: { id: 'msg2', remoteJid: '123456789@g.us', fromMe: true },
          messageTimestamp: Math.floor(Date.now() / 1000) - 100,
          pushName: 'Bot',
          message: { extendedTextMessage: { text: 'Diagnostic Response' } },
        },
      ],
    ]),
    sock: {
      groupMetadata: async () => ({
        id: '123456789@g.us',
        subject: 'Dev Team Test',
        creation: 1700000000,
        owner: '49170111@s.whatsapp.net',
        desc: 'Testing export functionality',
        participants: [
          { id: '49170111@s.whatsapp.net', admin: 'superadmin' },
          { id: '49170222@s.whatsapp.net', admin: null },
        ],
      }),
    },
  };

  const result = await generateChatExport(mockSession, '123456789@g.us', '24h', 'all');
  assert.ok(result.buffer.length > 100);
  assert.ok(result.filename.startsWith('whatsapp_export_Dev_Team_Test_'));
  assert.strictEqual(result.totalMessages, 2);
  assert.ok(result.summary.included_files.includes('group_info.json'));
  assert.ok(result.summary.included_files.includes('chat_history.json'));
  assert.ok(result.summary.included_files.includes('chat_history.txt'));
  assert.ok(result.summary.included_files.includes('security_statistics.json'));
  assert.ok(result.summary.included_files.includes('participants.json'));
  assert.ok(result.summary.included_files.includes('export_manifest.json'));
});
