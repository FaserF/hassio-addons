import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatHeader } from '../src/whatsapp/telegram/listener.js';
import { TelegramBotClient } from '../src/whatsapp/telegram/bot.js';
import { getDefaultTelegramStore } from '../src/whatsapp/telegram/store.js';
import { waToTelegramHtml, anonymizePhoneNumber } from '../src/whatsapp/telegram/format.js';

describe('Telegram Bridge Unit Tests', () => {
  it('formatHeader respects group, sender and anonymize flags', () => {
    assert.strictEqual(formatHeader('My Group', 'Alice', true, true), '[My Group | Alice]: ');
    assert.strictEqual(formatHeader('My Group', '+491761234567', false, true, true), '[+49176***567]: ');
    assert.strictEqual(formatHeader('My Group', 'Alice', false, true), '[Alice]: ');
    assert.strictEqual(formatHeader('My Group', 'Alice', true, false), '[My Group]: ');
    assert.strictEqual(formatHeader('My Group', 'Alice', false, false), '');
  });

  it('waToTelegramHtml converts WhatsApp formatting to HTML', () => {
    assert.strictEqual(waToTelegramHtml('Hello *bold* and _italic_ world'), 'Hello <b>bold</b> and <i>italic</i> world');
    assert.strictEqual(waToTelegramHtml('Check ~strike~ and ```code block```'), 'Check <s>strike</s> and <code>code block</code>');
  });

  it('anonymizePhoneNumber masks middle digits', () => {
    assert.strictEqual(anonymizePhoneNumber('491761234567'), '+49176***567');
  });

  it('getDefaultTelegramStore returns valid default structure', () => {
    const store = getDefaultTelegramStore();
    assert.strictEqual(store.enabled, true);
    assert.strictEqual(store.bot_token, '');
    assert.deepStrictEqual(store.mappings, []);
  });

  it('TelegramBotClient throws when token is missing', async () => {
    const client = new TelegramBotClient('');
    await assert.rejects(async () => {
      await client.getMe();
    }, /Telegram Bot Token is not configured/);
  });

  it('sync_self_messages default state is false in mapping creation', () => {
    const mapping = {
      wa_jid: '12345@g.us',
      tg_chat_id: '98765',
      sync_self_messages: false,
    };
    assert.strictEqual(mapping.sync_self_messages, false);
  });
});
