import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../../store.js';
import { reply } from '../../../actions.js';
import { gt } from '../../engine/translations.js';

export function registerFederationCommands(registry) {
  registry.register(
    'newfed',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const name = args.join(' ').trim();
      const prefix = config.commands?.prefix || '!';
      if (!name) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.cmd_newfed_usage', { prefix }) },
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
        { text: gt(config, 'bot_replies.fed_created', { name, fedId }) },
        rawMsg
      );
    },
    { help: 'Create a new ban federation' }
  );

  registry.register(
    'joinfed',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const fedId = args[0];
      const prefix = config.commands?.prefix || '!';
      if (!fedId) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.cmd_joinfed_usage', { prefix }) },
          rawMsg
        );
        return;
      }
      const store = loadModerationStore();
      if (!store.federations || !store.federations[fedId]) {
        await reply(session, groupId, { text: gt(config, 'bot_replies.fed_not_found', { fedId }) }, rawMsg);
        return;
      }
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      c.federation_id = fedId;
      store.groups[groupId] = c;
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        { text: gt(config, 'bot_replies.fed_joined', { name: store.federations[fedId].name }) },
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
        await reply(session, groupId, { text: gt(config, 'bot_replies.fed_not_in_any') }, rawMsg);
        return;
      }
      delete c.federation_id;
      store.groups[groupId] = c;
      saveModerationStore(store);
      await reply(session, groupId, { text: gt(config, 'bot_replies.fed_left') }, rawMsg);
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
          { text: gt(config, 'bot_replies.fed_not_linked') },
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
          { text: gt(config, 'bot_replies.fed_mention_required') },
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
          text: gt(config, 'bot_replies.fed_banned_user', { targetId, name: fed.name }),
          mentions: [`${targetId}@s.whatsapp.net`],
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
        await reply(session, groupId, { text: gt(config, 'bot_replies.fed_not_linked') }, rawMsg);
        return;
      }
      const fed = store.federations[c.federation_id];
      const targetId = args[0] ? args[0].replace('@', '') : null;
      const prefix = config.commands?.prefix || '!';
      if (!targetId) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.cmd_unfban_usage', { prefix }) },
          rawMsg
        );
        return;
      }
      fed.bans = fed.bans.filter((b) => b.userId !== targetId);
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        { text: gt(config, 'bot_replies.fed_unbanned_user', { targetId, name: fed.name }), mentions: [`${targetId}@s.whatsapp.net`] },
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
        await reply(session, groupId, { text: gt(config, 'bot_replies.fed_no_active') }, rawMsg);
        return;
      }
      const fed = store.federations[fedId];
      await reply(
        session,
        groupId,
        {
          text: gt(config, 'bot_replies.fed_info', {
            name: fed.name,
            id: fed.id,
            bans: fed.bans?.length || 0,
          }),
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
        await reply(session, groupId, { text: gt(config, 'bot_replies.fed_not_in_any') }, rawMsg);
        return;
      }
      const fed = store.federations[c.federation_id];
      const bans = fed.bans || [];
      if (bans.length === 0) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.fed_no_bans', { name: fed.name }) },
          rawMsg
        );
        return;
      }
      const listText = bans.map((b) => `• @${b.userId} - ${b.reason}`).join('\n');
      await reply(
        session,
        groupId,
        { text: gt(config, 'bot_replies.fed_ban_list_header', { name: fed.name, list: listText }) },
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
        await reply(session, groupId, { text: gt(config, 'bot_replies.fed_not_in_any') }, rawMsg);
        return;
      }
      const fed = store.federations[c.federation_id];
      await reply(
        session,
        groupId,
        { text: gt(config, 'bot_replies.fed_admins_header', { name: fed.name, owner: fed.owner }) },
        rawMsg
      );
    },
    { help: 'List federation admins' }
  );

  registry.register(
    'addfedadmin',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      await reply(session, groupId, { text: gt(config, 'bot_replies.fed_admin_added') }, rawMsg);
    },
    { adminOnly: true, help: 'Add a federation admin' }
  );

  registry.register(
    'rmfedadmin',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      await reply(session, groupId, { text: gt(config, 'bot_replies.fed_admin_removed') }, rawMsg);
    },
    { adminOnly: true, help: 'Remove a federation admin' }
  );

  registry.register(
    'fedgroups',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      await reply(
        session,
        groupId,
        { text: gt(config, 'bot_replies.fed_groups_active') },
        rawMsg
      );
    },
    { help: 'List groups in federation' }
  );
}
