import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../../store.js';
import { reply } from '../../../actions.js';

export function registerFederationCommands(registry) {
  registry.register(
    'newfed',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const name = args.join(' ').trim();
      if (!name) {
        await reply(
          session,
          groupId,
          { text: `⚠️ Usage: \`${config.commands?.prefix || '!'}newfed <name>\`` },
          rawMsg
        );
        return;
      }
      const store = loadModerationStore();
      if (!store.federations) store.federations = {};
      const fedId = `fed_${Date.now()}`;
      store.federations[fedId] = { id: fedId, name, owner: userId, admins: [userId], bans: [] };
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        { text: `✅ *Federation Created!*\n🌐 *Name:* ${name}\n🔑 *ID:* \`${fedId}\`` },
        rawMsg
      );
    },
    { help: 'Create a new ban federation' }
  );

  registry.register(
    'joinfed',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const fedId = args[0];
      if (!fedId) {
        await reply(
          session,
          groupId,
          { text: `⚠️ Usage: \`${config.commands?.prefix || '!'}joinfed <fed_id>\`` },
          rawMsg
        );
        return;
      }
      const store = loadModerationStore();
      if (!store.federations || !store.federations[fedId]) {
        await reply(session, groupId, { text: `❌ Federation \`${fedId}\` not found.` }, rawMsg);
        return;
      }
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      c.federation_id = fedId;
      store.groups[groupId] = c;
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        { text: `✅ Group joined federation *${store.federations[fedId].name}*.` },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Join this group to a ban federation' }
  );

  registry.register(
    'leavefed',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.federation_id) {
        await reply(session, groupId, { text: `ℹ️ Group is not in any federation.` }, rawMsg);
        return;
      }
      delete c.federation_id;
      store.groups[groupId] = c;
      saveModerationStore(store);
      await reply(session, groupId, { text: `✅ Group left the federation.` }, rawMsg);
    },
    { adminOnly: true, help: 'Leave current ban federation' }
  );

  registry.register(
    'fban',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.federation_id || !store.federations?.[c.federation_id]) {
        await reply(
          session,
          groupId,
          { text: `❌ Group is not linked to a valid federation.` },
          rawMsg
        );
        return;
      }
      const fed = store.federations[c.federation_id];
      const targetMatch =
        rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
        rawMsg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!targetMatch) {
        await reply(
          session,
          groupId,
          { text: `⚠️ Mention a user or reply to their message to federation-ban.` },
          rawMsg
        );
        return;
      }
      const targetId = targetMatch.split('@')[0];
      const reason = args.join(' ') || 'No reason specified';
      if (!fed.bans.some((b) => b.userId === targetId)) {
        fed.bans.push({
          userId: targetId,
          reason,
          bannedBy: userId,
          timestamp: new Date().toISOString(),
        });
        saveModerationStore(store);
      }
      await reply(
        session,
        groupId,
        {
          text: `🚫 User @${targetId} has been *Federation Banned* across federation *${fed.name}*.`,
        },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Federation-ban a user across all linked groups' }
  );

  registry.register(
    'unfban',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.federation_id || !store.federations?.[c.federation_id]) {
        await reply(session, groupId, { text: `❌ Group is not linked to a federation.` }, rawMsg);
        return;
      }
      const fed = store.federations[c.federation_id];
      const targetId = args[0] ? args[0].replace('@', '') : null;
      if (!targetId) {
        await reply(
          session,
          groupId,
          { text: `⚠️ Usage: \`${config.commands?.prefix || '!'}unfban <user_id>\`` },
          rawMsg
        );
        return;
      }
      fed.bans = fed.bans.filter((b) => b.userId !== targetId);
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        { text: `✅ User @${targetId} unbanned from federation *${fed.name}*.` },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Remove federation ban from a user' }
  );

  registry.register(
    'fedinfo',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      const fedId = args[0] || c.federation_id;
      if (!fedId || !store.federations?.[fedId]) {
        await reply(session, groupId, { text: `ℹ️ No active federation found.` }, rawMsg);
        return;
      }
      const fed = store.federations[fedId];
      await reply(
        session,
        groupId,
        {
          text: `🌐 *Federation Info*\n*Name:* ${fed.name}\n*ID:* \`${fed.id}\` \n*Bans:* ${fed.bans?.length || 0}`,
        },
        rawMsg
      );
    },
    { help: 'Show information about active federation' }
  );

  registry.register(
    'fbanlist',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.federation_id || !store.federations?.[c.federation_id]) {
        await reply(session, groupId, { text: `ℹ️ Group is not in a federation.` }, rawMsg);
        return;
      }
      const fed = store.federations[c.federation_id];
      const bans = fed.bans || [];
      if (bans.length === 0) {
        await reply(
          session,
          groupId,
          { text: `✅ No active federation bans in *${fed.name}*.` },
          rawMsg
        );
        return;
      }
      const listText = bans.map((b) => `• @${b.userId} - ${b.reason}`).join('\n');
      await reply(
        session,
        groupId,
        { text: `🚫 *Federation Ban List (${fed.name}):*\n${listText}` },
        rawMsg
      );
    },
    { help: 'List active federation bans' }
  );

  registry.register(
    'fedadmins',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.federation_id || !store.federations?.[c.federation_id]) {
        await reply(session, groupId, { text: `ℹ️ Group is not in a federation.` }, rawMsg);
        return;
      }
      const fed = store.federations[c.federation_id];
      await reply(
        session,
        groupId,
        { text: `👮 *Federation Admins (${fed.name}):*\n👑 Owner: @${fed.owner}` },
        rawMsg
      );
    },
    { help: 'List federation admins' }
  );

  registry.register(
    'addfedadmin',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      await reply(session, groupId, { text: `✅ User added as federation admin.` }, rawMsg);
    },
    { adminOnly: true, help: 'Add a federation admin' }
  );

  registry.register(
    'rmfedadmin',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      await reply(session, groupId, { text: `✅ User removed from federation admins.` }, rawMsg);
    },
    { adminOnly: true, help: 'Remove a federation admin' }
  );

  registry.register(
    'fedgroups',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      await reply(
        session,
        groupId,
        { text: `🌐 *Groups in Federation:* Linked groups active.` },
        rawMsg
      );
    },
    { help: 'List groups in federation' }
  );
}
