import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatHeader } from '../src/whatsapp/telegram/listener.js';
import { TelegramBotClient } from '../src/whatsapp/telegram/bot.js';
import { getDefaultTelegramStore } from '../src/whatsapp/telegram/store.js';

describe('Telegram Bridge Unit Tests', () => {
  it('formatHeader respects group and sender inclusion flags', () => {
    assert.strictEqual(
      formatHeader('My Group', 'Alice', true, true),
      '[My Group | Alice]: '
    );
    assert.strictEqual(
      formatHeader('My Group', 'Alice', false, true),
      '[Alice]: '
    );
    assert.strictEqual(
      formatHeader('My Group', 'Alice', true, false),
      '[My Group]: '
    );
    assert.strictEqual(
      formatHeader('My Group', 'Alice', false, false),
      ''
    );
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
});
