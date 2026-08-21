import { registerPunishmentCommands } from './admin/punishments.js';
import {
  registerMuteCommands,
  parseDuration,
  formatDuration,
  pendingTempActions,
} from './admin/mutes.js';
import { registerRoleCommands } from './admin/roles.js';
import { registerContentCommands } from './admin/content.js';
import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../store.js';
import { reply } from '../../actions.js';
import { gt } from '../engine/translations.js';

export { parseDuration, formatDuration, pendingTempActions };

export function registerAdminCommands(registry) {
  registry.register(
    'setrules',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const text = args.join(' ');
      const prefix = config.commands?.prefix || '!';
      if (!text) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.usage_setrules', { prefix }) },
          rawMsg
        );
        return;
      }
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.rules) c.rules = {};
      c.rules.text = text;
      saveModerationStore(store);
      await reply(session, groupId, { text: gt(config, 'bot_replies.rules_updated') }, rawMsg);
    },
    { adminOnly: true, help: 'Set the group rules' }
  );

  registerPunishmentCommands(registry);
  registerMuteCommands(registry);
  registerRoleCommands(registry);
  registerContentCommands(registry);
}
