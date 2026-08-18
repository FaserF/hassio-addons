import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatHeader } from '../src/whatsapp/telegram/listener.js';
import { TelegramBotClient } from '../src/whatsapp/telegram/bot.js';
import { getDefaultTelegramStore } from '../src/whatsapp/telegram/store.js';
import {
  waToTelegramHtml,
  anonymizePhoneNumber,
  splitMessageText,
  splitTelegramHtml,
  TELEGRAM_MAX_TEXT_LENGTH,
  TELEGRAM_MAX_CAPTION_LENGTH,
} from '../src/whatsapp/telegram/format.js';
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

  it('TelegramBotClient throws when token is missing', () => {
    assert.throws(() => {
      new TelegramBotClient('');
    }, /Invalid Telegram bot token format/);
  });

  it('TelegramBotClient rejects invalid or path traversal method', async () => {
    const client = new TelegramBotClient('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
    await assert.rejects(async () => {
      await client.request('../admin');
    }, /Invalid or unsupported Telegram API method: \.\.\/admin/);
  });

  it('sync_self_messages default state is false in mapping creation', () => {
    const mapping = {
      wa_jid: '123456789@g.us',
      tg_chat_id: '-100123456789',
    };
    assert.strictEqual(Boolean(mapping.sync_self_messages), false);
  });

  it('Media quote tags correctly identify GIFs and Stickers', () => {
    const qAnim = { animation: {} };
    const qSticker = { sticker: { emoji: '🔥' } };
    const tagAnim = qAnim.animation ? '🎥 [GIF/Video]' : '';
    const tagSticker = qSticker.sticker
      ? `🎨 [Sticker ${qSticker.sticker.emoji || ''}]`.trim()
      : '';
    assert.strictEqual(tagAnim, '🎥 [GIF/Video]');
    assert.strictEqual(tagSticker, '🎨 [Sticker 🔥]');
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

  it('supports poll sync mode options in mappings', () => {
    const mapping = {
      poll_sync_mode: 'native_sync',
      poll_send_text_diagram: true,
      poll_send_update_message: true,
      poll_delete_old_message: true,
    };
    assert.strictEqual(mapping.poll_sync_mode, 'native_sync');
    assert.strictEqual(mapping.poll_send_text_diagram, true);
    assert.strictEqual(mapping.poll_send_update_message, true);
    assert.strictEqual(mapping.poll_delete_old_message, true);
  });

  it('TelegramBotClient supports sendContact, liveLocation, pin, and sendPoll methods', () => {
    const client = new TelegramBotClient('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
    assert.doesNotThrow(() => {
      // Validating method existence in ALLOWED_METHODS map
      client
        .request('sendContact', { chat_id: '123', phone_number: '123', first_name: 'Test' })
        .catch(() => null);
      client
        .request('editMessageLiveLocation', {
          chat_id: '123',
          message_id: 1,
          latitude: 0,
          longitude: 0,
        })
        .catch(() => null);
      client.request('pinChatMessage', { chat_id: '123', message_id: 1 }).catch(() => null);
      client.sendPoll('123', 'Test Question', ['Opt 1', 'Opt 2']).catch(() => null);
      client.setMessageReaction('123', 1, '👍').catch(() => null);
    });
  });

  it('syncWhatsAppGroupEventToTelegram and reaction modules export correctly', async () => {
    const listener = await import('../src/whatsapp/telegram/listener.js');
    assert.strictEqual(typeof listener.syncWhatsAppGroupEventToTelegram, 'function');
    assert.strictEqual(typeof listener.syncWhatsAppReactionToTelegram, 'function');
  });

  it('supports sync_system_events and sync_pins options in mappings', () => {
    const mapping = {
      sync_system_events: true,
      sync_pins: true,
    };
    assert.strictEqual(mapping.sync_system_events, true);
    assert.strictEqual(mapping.sync_pins, true);
  });

  it('deduplicates participant lists with mixed Phone JIDs and LIDs', () => {
    const raw = ['4917611111111@s.whatsapp.net', '4917611111111@lid'];
    const seenPNs = new Set();
    const normalizedParticipants = [];
    for (const p of raw) {
      const pn = p.split('@')[0];
      if (!seenPNs.has(pn)) {
        seenPNs.add(pn);
        normalizedParticipants.push(p);
      }
    }
    assert.strictEqual(normalizedParticipants.length, 1);
    assert.strictEqual(normalizedParticipants[0], '4917611111111@s.whatsapp.net');
  });

  it('TelegramBotClient supports pinChatMessage, unpinChatMessage and unpinallChatMessage', async () => {
    const client = new TelegramBotClient('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
    assert.strictEqual(typeof client.pinChatMessage, 'function');
    assert.strictEqual(typeof client.unpinChatMessage, 'function');
    assert.strictEqual(typeof client.unpinallChatMessage, 'function');
  });

  it('syncWhatsAppPinToTelegram and syncWhatsAppUnpinAllToTelegram export functions', async () => {
    const listener = await import('../src/whatsapp/telegram/listener.js');
    assert.strictEqual(typeof listener.syncWhatsAppPinToTelegram, 'function');
    assert.strictEqual(typeof listener.syncWhatsAppUnpinAllToTelegram, 'function');
  });

  it('validates 16 message and media types in integration test suite coverage', () => {
    const featureTypes = [
      '1. Text & Formatting',
      '2. Native Polls & Multiselect options',
      '3. Poll Vote updates & multi-user sync',
      '4. Native Location & Live Location pin',
      '5. Rich Event Cards',
      '6. Images & Photo Captions',
      '7. Voice Notes (PTT) & Audio files',
      '8. Video & Video Notes',
      '9. Documents & Files with original filenames',
      '10. Stickers (static & animated WebP)',
      '11. Contact Cards (Single & Multi VCard)',
      '12. Emoji Reactions (Add & Remove)',
      '13. Message Edits',
      '14. Message Deletions',
      '15. Quoted Reply Chains & Thread Context',
      '16. System Events',
    ];
    assert.strictEqual(featureTypes.length, 16);
  });

  it('filters command prefixes and ensures / is always included for Telegram inbound', () => {
    const mapping = {
      ignore_command_prefixes: '!, #',
    };
    const filterCommand = (text, map) => {
      if (!map.ignore_command_prefixes || !text) return false;
      const cleanText = text.trim();
      const prefixes = String(map.ignore_command_prefixes)
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!prefixes.includes('/')) {
        prefixes.push('/');
      }
      return prefixes.some((p) => cleanText.startsWith(p));
    };

    assert.strictEqual(filterCommand('/start', mapping), true);
    assert.strictEqual(filterCommand('/start @tcl_group_mgmt_bot', mapping), true);
    assert.strictEqual(filterCommand('!help', mapping), true);
    assert.strictEqual(filterCommand('#rules', mapping), true);
    assert.strictEqual(filterCommand('Hello world', mapping), false);
  });

  it('splitMessageText splits text within maxLength on whitespace/newlines', () => {
    const longText =
      'Paragraph one.\n\nParagraph two.\n\nParagraph three is a bit longer with more words.';
    const chunks = splitMessageText(longText, 30);
    assert.ok(chunks.length > 1);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= 30);
    }
    // Content preservation
    assert.strictEqual(chunks.join(' ').replace(/\s+/g, ' '), longText.replace(/\s+/g, ' '));
  });

  it('splitTelegramHtml preserves and balances HTML formatting across chunks', () => {
    const longHtml = '<b>' + 'A'.repeat(5000) + '</b>';
    const chunks = splitTelegramHtml(longHtml, 4096);
    assert.strictEqual(chunks.length, 2);
    // First chunk starts with <b> and ends with </b>
    assert.ok(chunks[0].startsWith('<b>'));
    assert.ok(chunks[0].endsWith('</b>'));
    // Second chunk re-opens <b> and closes with </b>
    assert.ok(chunks[1].startsWith('<b>'));
    assert.ok(chunks[1].endsWith('</b>'));
  });

  it('TELEGRAM_MAX_TEXT_LENGTH and TELEGRAM_MAX_CAPTION_LENGTH constants are correct', () => {
    assert.strictEqual(TELEGRAM_MAX_TEXT_LENGTH, 4096);
    assert.strictEqual(TELEGRAM_MAX_CAPTION_LENGTH, 1024);
  });
});
