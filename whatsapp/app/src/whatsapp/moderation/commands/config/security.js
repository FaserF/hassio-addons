import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../../store.js';
import { reply } from '../../../actions.js';
import { gt } from '../../engine/translations.js';

export function registerSecurityCommands(registry) {
  registry.register(
    'whitelist',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const prefix = config.commands?.prefix || '!';
      if (args.length === 0) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.cmd_whitelist_usage', { prefix }) },
          rawMsg
        );
        return;
      }
      const domain = args[0].toLowerCase();
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.whitelisted_domains) c.whitelisted_domains = [];
      if (!c.whitelisted_domains.includes(domain)) {
        c.whitelisted_domains.push(domain);
        saveModerationStore(store);
      }
      await reply(
        session,
        groupId,
        { text: gt(config, 'bot_replies.whitelist_added', { domain }) },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Add a domain to allowed link whitelist' }
  );

  registry.register(
    'unwhitelist',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const prefix = config.commands?.prefix || '!';
      if (args.length === 0) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.cmd_unwhitelist_usage', { prefix }) },
          rawMsg
        );
        return;
      }
      const domain = args[0].toLowerCase();
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (c.whitelisted_domains) {
        c.whitelisted_domains = c.whitelisted_domains.filter((d) => d !== domain);
        saveModerationStore(store);
      }
      await reply(
        session,
        groupId,
        { text: gt(config, 'bot_replies.whitelist_removed', { domain }) },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Remove a domain from link whitelist' }
  );

  registry.register(
    'whitelisted',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const c = getGroupModerationConfig(groupId);
      const list = c.whitelisted_domains || [];
      if (list.length === 0) {
        await reply(session, groupId, { text: gt(config, 'bot_replies.whitelist_empty') }, rawMsg);
      } else {
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.whitelist_list_header', {
              list: list.map((d) => `• \`${d}\``).join('\n'),
            }),
          },
          rawMsg
        );
      }
    },
    { help: 'List whitelisted domains' }
  );

  registry.register(
    'scan',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const targetText =
        args.join(' ') ||
        rawMsg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
        rawMsg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage
          ?.text ||
        '';

      const quotedMsg = rawMsg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const hasAttachment = Boolean(
        quotedMsg?.imageMessage ||
        quotedMsg?.videoMessage ||
        quotedMsg?.documentMessage ||
        quotedMsg?.audioMessage ||
        rawMsg?.message?.imageMessage ||
        rawMsg?.message?.documentMessage
      );

      const urlMatches = targetText.match(/https?:\/\/[^\s]+/gi) || [];
      const threats = [];

      for (const url of urlMatches) {
        let parsedUrl;
        try {
          parsedUrl = new URL(url);
        } catch (e) {
          parsedUrl = null;
        }

        const hostname = parsedUrl ? parsedUrl.hostname.toLowerCase() : '';
        const pathname = parsedUrl ? parsedUrl.pathname.toLowerCase() : '';
        const lower = url.toLowerCase();

        const isSuspiciousExt =
          pathname.endsWith('.exe') ||
          pathname.endsWith('.scr') ||
          pathname.endsWith('.bat') ||
          pathname.endsWith('.vbs') ||
          pathname.endsWith('.zip') ||
          lower.includes('.exe') ||
          lower.includes('.scr') ||
          lower.includes('.bat') ||
          lower.includes('.vbs') ||
          lower.includes('.zip');

        const isShortener =
          hostname === 'bit.ly' ||
          hostname.endsWith('.bit.ly') ||
          hostname === 'tinyurl.com' ||
          hostname.endsWith('.tinyurl.com');

        if (isSuspiciousExt || isShortener) {
          threats.push(`Suspicious link/extension: \`${url}\``);
        }

        const isInviteLink =
          hostname === 't.me' ||
          hostname.endsWith('.t.me') ||
          hostname === 'chat.whatsapp.com' ||
          hostname.endsWith('.chat.whatsapp.com');

        if (isInviteLink) {
          threats.push(`Invite link detected: \`${url}\``);
        }
      }

      if (threats.length > 0) {
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.scan_alert_threats', {
              threats: threats.map((t) => `• ${t}`).join('\n'),
            }),
          },
          rawMsg
        );
        return;
      }

      const typeDesc = hasAttachment
        ? 'Attachment (Media/Document)'
        : urlMatches.length > 0
          ? `URL Link (${urlMatches.length})`
          : 'Message Text';

      await reply(
        session,
        groupId,
        {
          text: gt(config, 'bot_replies.scan_results_clean', { target: typeDesc }),
        },
        rawMsg
      );
    },
    { help: 'Security scan a message attachment or link' }
  );

  registry.register(
    'removespamlinks',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const mode = (args[0] || '').toLowerCase();
      const store = loadModerationStore();
      if (!store.groups[groupId]) {
        store.groups[groupId] = getGroupModerationConfig(groupId);
      }
      const c = store.groups[groupId];
      const currentVal = Boolean(c.anti_spam_links_enabled);
      if (mode === 'on' || mode === 'true' || mode === 'enable' || mode === '1') {
        c.anti_spam_links_enabled = true;
      } else if (mode === 'off' || mode === 'false' || mode === 'disable' || mode === '0') {
        c.anti_spam_links_enabled = false;
      } else {
        c.anti_spam_links_enabled = !currentVal;
      }
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        {
          text: gt(config, 'bot_replies.anti_spam_links_status', {
            status: c.anti_spam_links_enabled ? 'ENABLED' : 'DISABLED',
          }),
        },
        rawMsg
      );
    },
    {
      adminOnly: true,
      help: 'Toggle auto-removal of t.me and wa.me invite links',
      aliases: ['antispamlinks'],
    }
  );

  registry.register(
    'blacklist',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const word = args.join(' ').trim().toLowerCase();
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.blacklisted_words) c.blacklisted_words = [];
      if (!word) {
        if (c.blacklisted_words.length === 0) {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.blacklist_empty') },
            rawMsg
          );
          return;
        }
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.blacklist_list_header', {
              count: c.blacklisted_words.length,
              list: c.blacklisted_words.map((w) => `• ${w}`).join('\n'),
            }),
          },
          rawMsg
        );
        return;
      }
      if (!c.blacklisted_words.includes(word)) c.blacklisted_words.push(word);
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        { text: gt(config, 'bot_replies.blacklist_added', { word }) },
        rawMsg
      );
    },
    { help: 'Manage group blacklisted words' }
  );

  registry.register(
    'rmblacklist',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const word = args.join(' ').trim().toLowerCase();
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.blacklisted_words) c.blacklisted_words = [];
      c.blacklisted_words = c.blacklisted_words.filter((w) => w !== word);
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        { text: gt(config, 'bot_replies.blacklist_removed', { word }) },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Remove word from blacklist', aliases: ['unblacklist'] }
  );

  registry.register(
    'setblacklistaction',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const action = (args[0] || '').toLowerCase();
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      c.blacklist_action = action;
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        { text: gt(config, 'bot_replies.blacklist_action_set', { action }) },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Set action for blacklisted word hits' }
  );

  registry.register(
    'flood',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      await reply(
        session,
        groupId,
        { text: gt(config, 'bot_replies.flood_status_active') },
        rawMsg
      );
    },
    { help: 'Check flood protection status' }
  );
}
