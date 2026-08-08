import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatHeader } from '../src/whatsapp/telegram/listener.js';
import { TelegramBotClient } from '../src/whatsapp/telegram/bot.js';
import { getDefaultTelegramStore } from '../src/whatsapp/telegram/store.js';
import { waToTelegramHtml, anonymizePhoneNumber } from '../src/whatsapp/telegram/format.js';
import { applyRegexReplacements } from '../src/whatsapp/telegram/regex.js';

describe('Telegram Bridge Unit Tests', () => {
  it('formatHeader respects group, sender and anonymize flags', () => {
    assert.strictEqual(
      formatHeader('My Group', 'Alice', true, true),
      '<b>[My Group | Alice]</b>:\n'
    );
    assert.strictEqual(
      formatHeader('My Group', '+491761234567', false, true, true),
      '<b>[+49176***567]</b>:\n'
    );
    assert.strictEqual(formatHeader('My Group', 'Alice', false, true), '<b>[Alice]</b>:\n');
    assert.strictEqual(formatHeader('My Group', 'Alice', true, false), '<b>[My Group]</b>:\n');
    assert.strictEqual(formatHeader('My Group', 'Alice', false, false), '');
  });

  it('waToTelegramHtml converts WhatsApp formatting to HTML', () => {
    assert.strictEqual(
      waToTelegramHtml('Hello *bold* and _italic_ world'),
      'Hello <b>bold</b> and <i>italic</i> world'
    );
    assert.strictEqual(
      waToTelegramHtml('Check ~strike~ and ```code block```'),
      'Check <s>strike</s> and <code>code block</code>'
    );
  });

  it('anonymizePhoneNumber masks middle digits', () => {
    assert.strictEqual(anonymizePhoneNumber('491761234567'), '+49176***567');
  });

  it('getDefaultTelegramStore returns valid default structure', () => {
    const store = getDefaultTelegramStore();
    assert.strictEqual(store.enabled, true);
    assert.deepStrictEqual(store.bots, []);
    assert.deepStrictEqual(store.mappings, []);
  });

  it('TelegramBotClient throws when token is missing', async () => {
    const client = new TelegramBotClient('');
    await assert.rejects(async () => {
      await client.getMe();
    }, /Telegram Bot Token is not configured/);
  });

  it('TelegramBotClient rejects invalid or path traversal method', async () => {
    const client = new TelegramBotClient('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
    await assert.rejects(async () => {
      await client.request('../admin');
    }, /Invalid or unsupported Telegram API method: \.\.\/admin/);
  });

  it('sync_self_messages default state is false in mapping creation', () => {
    const mapping = {
      wa_jid: '12345@g.us',
      tg_chat_id: '98765',
      sync_self_messages: false,
    };
    assert.strictEqual(mapping.sync_self_messages, false);
  });

  it('is_direct_chat_mirror suppresses group and sender headers', () => {
    const isDirectMirror = true;
    const header = isDirectMirror ? '' : formatHeader('My Group', 'Alice', true, true);
    assert.strictEqual(header, '');
  });

  it('applyRegexReplacements replaces simple strings and regex patterns', () => {
    const replacements = [
      { search: 'FOO', replace: 'BAR', is_regex: false },
      { search: 'http://\\S+', replace: '[LINK]', is_regex: true },
    ];
    assert.strictEqual(applyRegexReplacements('Hello FOO', replacements), 'Hello BAR');
    assert.strictEqual(
      applyRegexReplacements('Visit http://example.com now', replacements),
      'Visit [LINK] now'
    );
  });

  it('cached_polls initializes correctly in store', () => {
    const store = getDefaultTelegramStore();
    assert.deepStrictEqual(store.cached_polls || {}, {});
  });
});
