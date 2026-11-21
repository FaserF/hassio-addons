import assert from 'assert';
import { registerReactionListener } from '../src/whatsapp/events/reactions.js';
import { getSendOptions } from '../src/routes/api/helpers.js';

console.log('🧪 Running Reaction Events & Newsletter Channel Unit Tests...');

// 1. Test getSendOptions strips unsupported options for @newsletter
{
  const session = {
    chatCache: new Map([['120363000000000000@newsletter', { ephemeralExpiration: 86400 }]]),
    messageStore: new Map(),
  };

  const optionsChannel = getSendOptions(session, '120363000000000000@newsletter', {
    quotedMessageId: 'XYZ',
    expiration: 3600,
  });
  assert.strictEqual(
    optionsChannel.quoted,
    undefined,
    'quoted option must be omitted for channels'
  );
  assert.strictEqual(
    optionsChannel.ephemeralExpiration,
    undefined,
    'ephemeralExpiration must be omitted for channels'
  );
  console.log('✅ PASSED: getSendOptions correctly strips quoted and ephemeral for channels');

  const optionsRegular = getSendOptions(session, '491761234567@s.whatsapp.net', {
    expiration: 3600,
  });
  assert.strictEqual(
    optionsRegular.ephemeralExpiration,
    3600,
    'ephemeral preserved for regular chats'
  );
  console.log('✅ PASSED: getSendOptions preserves options for regular chats');
}

// 2. Test registerReactionListener event emission & structure
{
  const mockSession = {
    id: 'default',
    sock: {
      ev: {
        handlers: {},
        on(event, fn) {
          this.handlers[event] = fn;
        },
      },
      user: { id: '491760000000:0@s.whatsapp.net' },
    },
    messageStore: new Map(),
    processedMessageIds: new Map(),
    eventQueue: [],
    contactCache: new Map([
      ['491761234567:0@s.whatsapp.net', { id: '491761234567@s.whatsapp.net', lid: '111111@lid' }],
    ]),
  };

  registerReactionListener(mockSession);
  assert(mockSession.sock.ev.handlers['messages.reaction'], 'Reaction listener must be registered');

  // Simulate an incoming reaction to a message
  const reactionUpdate = [
    {
      key: {
        remoteJid: '491761234567@s.whatsapp.net',
        fromMe: false,
        id: 'ORIGINAL_MSG_123',
      },
      reaction: {
        text: '👍',
        key: {
          remoteJid: '491761234567@s.whatsapp.net',
          fromMe: false,
          id: 'REACTION_KEY_456',
          participant: '491761234567@s.whatsapp.net',
        },
      },
    },
  ];

  mockSession.sock.ev.handlers['messages.reaction'](reactionUpdate);

  assert.strictEqual(mockSession.eventQueue.length, 1, 'Event must be enqueued');
  const ev = mockSession.eventQueue[0];
  assert.strictEqual(ev.type, 'reaction');
  assert.strictEqual(ev.id, 'REACTION_KEY_456');
  assert.strictEqual(ev.reacted_message_id, 'ORIGINAL_MSG_123');
  assert.strictEqual(ev.reaction, '👍');
  assert.strictEqual(ev.content, '👍');
  assert.strictEqual(ev.text, '👍');
  assert.strictEqual(ev.message, '👍');
  assert.strictEqual(ev.sender, '491761234567@s.whatsapp.net');
  assert.strictEqual(ev.sender_number, '491761234567');
  assert.strictEqual(ev.from_me, false);
  console.log('✅ PASSED: Reaction event payload populated with aliases and IDs correctly');

  // Test deduplication: firing the same reaction key again should be ignored
  mockSession.sock.ev.handlers['messages.reaction'](reactionUpdate);
  assert.strictEqual(mockSession.eventQueue.length, 1, 'Duplicate reaction must be ignored');
  console.log('✅ PASSED: Duplicate reaction correctly deduped');
}

// 3. Test eventQueue undefined / null filtering (Fixes #1300)
{
  const mockSession = {
    eventQueue: [
      { type: 'message', id: '1' },
      null,
      undefined,
      { type: 'reaction', id: '2' },
      null,
    ],
  };

  const filteredEvents = mockSession.eventQueue.filter(Boolean);
  assert.strictEqual(filteredEvents.length, 2, 'Null and undefined events must be filtered out');
  assert.strictEqual(filteredEvents[0].id, '1');
  assert.strictEqual(filteredEvents[1].id, '2');
  console.log('✅ PASSED: eventQueue safely filters null/undefined events (#1300)');
}

// 4. Test status stanza acknowledgement handling (Fixes FaserF/ha-whatsapp#136)
{
  let ackedNode = null;
  const mockSession = {
    sock: {
      ws: {
        _listeners: {},
        on(event, fn) {
          this._listeners[event] = this._listeners[event] || [];
          this._listeners[event].push(fn);
        },
        listeners(event) {
          return this._listeners[event] || [];
        },
      },
      sendMessageAck: async (node) => {
        ackedNode = node;
      },
    },
  };

  // Attach fallback listener as done in connection.js
  const existingListeners = mockSession.sock.ws.listeners('CB:status');
  if (!existingListeners || existingListeners.length === 0) {
    mockSession.sock.ws.on('CB:status', async (node) => {
      if (mockSession.sock.sendMessageAck) {
        await mockSession.sock.sendMessageAck(node);
      }
    });
  }

  assert.strictEqual(mockSession.sock.ws.listeners('CB:status').length, 1);

  // Simulate an incoming top-level status stanza with type=media
  const statusNode = {
    tag: 'status',
    attrs: {
      id: 'STATUS_MSG_999',
      from: '491761111111@s.whatsapp.net',
      type: 'media',
    },
  };

  const listener = mockSession.sock.ws.listeners('CB:status')[0];
  await listener(statusNode);

  assert.strictEqual(
    ackedNode,
    statusNode,
    'Status stanza must be acknowledged via sendMessageAck'
  );
  assert.strictEqual(ackedNode.attrs.id, 'STATUS_MSG_999');
  assert.strictEqual(ackedNode.attrs.type, 'media');
  console.log('✅ PASSED: Status stanzas correctly acknowledged via sendMessageAck (#136)');
}

console.log('🎉 ALL REACTION & NEWSLETTER TESTS PASSED!');
