import { saveContactCache } from '../../session.js';

export function bindStore(session, ev) {
  ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.id) {
        // Prevent overwriting a full message with a metadata-only update (e.g. delivery receipt)
        const hasContent = !!(msg.message || msg.editedMessage);
        const existing = session.messageStore.get(msg.key.id);
        const existingHasContent = !!(existing?.message || existing?.editedMessage);

        if (hasContent || !existingHasContent) {
          session.messageStore.set(msg.key.id, msg);
        }
      }
      if (msg.key.remoteJid) {
        session.chatCache?.set(msg.key.remoteJid, true);
        if (!msg.key.fromMe && msg.pushName && session.contactCache) {
          const existingContact = session.contactCache.get(msg.key.remoteJid) || {
            id: msg.key.remoteJid,
          };
          session.contactCache.set(msg.key.remoteJid, {
            ...existingContact,
            notify: msg.pushName || existingContact.notify,
          });
        }
      }
    }
  });

  ev.on('chats.set', ({ chats }) => {
    session.initialChatsReceived = true;
    for (const chat of chats) {
      session.chatCache?.set(chat.id, true);
    }
  });

  ev.on('messaging-history.set', ({ chats, messages, contacts }) => {
    if (chats) {
      for (const chat of chats) {
        if (chat.id) session.chatCache?.set(chat.id, true);
      }
    }
    if (contacts) {
      for (const contact of contacts) {
        if (contact.id) {
          const existing = session.contactCache?.get(contact.id) || {};
          session.contactCache?.set(contact.id, { ...existing, ...contact });
        }
      }
      saveContactCache(session);
    }
    if (messages) {
      for (const msg of messages) {
        if (msg.key && msg.key.id) {
          const hasContent = !!(msg.message || msg.editedMessage);
          const existing = session.messageStore.get(msg.key.id);
          const existingHasContent = !!(existing?.message || existing?.editedMessage);
          if (hasContent || !existingHasContent) {
            session.messageStore.set(msg.key.id, msg);
          }
          if (msg.key.remoteJid) {
            session.chatCache?.set(msg.key.remoteJid, true);
          }
        }
      }
    }
  });

  ev.on('chats.upsert', (chats) => {
    for (const chat of chats) {
      session.chatCache?.set(chat.id, true);
    }
  });

  ev.on('groups.upsert', (groups) => {
    for (const group of groups) {
      session.groupCache?.set(group.id, group.subject);
    }
  });

  ev.on('groups.update', (groups) => {
    for (const group of groups) {
      if (group.subject) {
        session.groupCache?.set(group.id, group.subject);
      }
    }
  });

  ev.on('contacts.set', ({ contacts }) => {
    for (const contact of contacts) {
      if (contact.id) {
        const existing = session.contactCache?.get(contact.id) || {};
        session.contactCache?.set(contact.id, { ...existing, ...contact });
      }
    }
    saveContactCache(session);
  });

  ev.on('contacts.upsert', (contacts) => {
    for (const contact of contacts) {
      if (contact.id) {
        const existing = session.contactCache?.get(contact.id) || {};
        session.contactCache?.set(contact.id, { ...existing, ...contact });
      }
    }
    saveContactCache(session);
  });

  ev.on('contacts.update', (updates) => {
    for (const update of updates) {
      if (update.id) {
        const existing = session.contactCache?.get(update.id) || {};
        session.contactCache?.set(update.id, { ...existing, ...update });
      }
    }
    saveContactCache(session);
  });
}
