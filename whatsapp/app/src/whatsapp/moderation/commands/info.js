import { loadModerationStore, getGroupModerationConfig } from '../store.js';
import { reply } from '../../actions.js';
import {
  normalizeJid,
  resolveUserDisplayName,
  resolveCanonicalUserKey,
  isSameUser,
} from '../../../utils/security.js';
import { isUserVerified } from '../engine/captcha.js';
import { processAiModeration } from '../ai.js';
import { gt } from '../engine/translations.js';

export const LOCK_TYPES = [
  'image',
  'video',
  'audio',
  'document',
  'sticker',
  'url',
  'invite',
  'poll',
  'contact',
  'location',
  'forwarded',
  'rtl',
];

export function registerInfoCommands(registry) {
  registry.register(
    'help',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      const prefix = config.commands?.prefix || '!';
      const headerText = gt(config, 'bot_replies.help_header', { prefix });
      const userCmds = [];
      const adminCmds = [];

      const seen = new Set();
      for (const [cmd, details] of Object.entries(registry.commands)) {
        if (seen.has(details)) continue;
        seen.add(details);
        const localizedHelp = gt(config, `bot_replies.cmd_${cmd}_desc`) || details.help;
        const line = `• \`${prefix}${cmd}\`: ${localizedHelp}`;
        if (details.adminOnly) {
          adminCmds.push(line);
        } else {
          userCmds.push(line);
        }
      }

      const customCmds = config.commands?.custom_commands || [];
      for (const c of customCmds) {
        const cleanCmdName = (c.command || '').replace(/^[!/#]+/, '');
        if (!cleanCmdName) continue;
        const cmdType = c.type || 'auto_reply';
        let secondary;
        if (c.description) {
          secondary = c.description.trim();
        } else if (cmdType === 'auto_reply' && c.response) {
          secondary = c.response.length > 50 ? c.response.slice(0, 47) + '…' : c.response;
        } else if (cmdType === 'webhook') {
          secondary = '(handled by Home Assistant / Webhook)';
        } else if (cmdType === 'alias' && c.alias_of) {
          secondary = `→ runs ${prefix}${c.alias_of}`;
        } else {
          secondary = 'Custom command';
        }
        const line = `• \`${prefix}${cleanCmdName}\`: ${secondary}`;
        if (c.admin_only) {
          adminCmds.push(line);
        } else {
          userCmds.push(line);
        }
      }

      let helpText = `${headerText}\n${userCmds.join('\n')}\n\n`;

      if (isAdminUser && adminCmds.length > 0) {
        const adminHeader = gt(config, 'bot_replies.help_admin_header');
        helpText += `${adminHeader}\n${adminCmds.join('\n')}`;
      } else {
        helpText += gt(config, 'bot_replies.help_admin_hidden');
      }

      await reply(session, groupId, { text: helpText }, rawMsg);
    },
    { help: 'Shows this help message' }
  );

  registry.register(
    'ping',
    async (session, groupId, _u, _a, _c, _ia, rawMsg) => {
      await reply(session, groupId, { text: '🏓 Pong!' }, rawMsg);
    },
    { help: 'Check if the bot is responsive' }
  );

  registry.register(
    'id',
    async (session, groupId, userId, _a, config, _ia, rawMsg) => {
      const cleanGroupId = groupId.split('@')[0] + '@g.us';
      const cleanUserId = userId.split('@')[0];
      await reply(
        session,
        groupId,
        {
          text: gt(config, 'bot_replies.id_info', {
            groupId: cleanGroupId,
            userId: cleanUserId,
          }),
        },
        rawMsg
      );
    },
    { help: 'Get the group and your user ID' }
  );

  registry.register(
    'info',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      const targetMatches = [
        ...(rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []),
      ];
      if (
        targetMatches.length === 0 &&
        rawMsg.message?.extendedTextMessage?.contextInfo?.participant
      ) {
        targetMatches.push(rawMsg.message.extendedTextMessage.contextInfo.participant);
      }

      const targetJid = targetMatches.length > 0 ? targetMatches[0] : userId + '@s.whatsapp.net';
      const targetId = targetJid.split('@')[0];

      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      const canonicalTarget = resolveCanonicalUserKey(targetJid, session) || targetId;
      let warns =
        c.warnings?.user_warns?.[targetId] || c.warnings?.user_warns?.[canonicalTarget] || [];
      if (!warns.length && c.warnings?.user_warns) {
        for (const [wKey, wList] of Object.entries(c.warnings.user_warns)) {
          if (isSameUser(wKey, targetJid, session)) {
            warns = wList;
            break;
          }
        }
      }
      const maxWarns = c.warnings?.max_warnings || 3;
      const isApproved =
        (c.approved || []).includes(targetId) ||
        (c.approved || []).includes(targetJid) ||
        (c.approved || []).some((a) => isSameUser(a, targetJid, session));
      let isMuted = false;
      if (c.muted_users) {
        for (const [mKey, mVal] of Object.entries(c.muted_users)) {
          if (isSameUser(mKey, targetJid, session)) {
            if (!mVal.until || mVal.until > Date.now()) {
              isMuted = true;
              break;
            }
          }
        }
      }
      const isVerified = isUserVerified(groupId, targetJid, session, rawMsg);

      const displayName = resolveUserDisplayName(targetJid, session, c.greetings);
      const yesStr = gt(config, 'bot_replies.yes');
      const noStr = gt(config, 'bot_replies.no');

      let infoText = `${gt(config, 'bot_replies.user_info', { name: displayName })}\n\n`;
      infoText += `${gt(config, 'bot_replies.user_id', { id: targetId })}\n`;
      infoText += `${gt(config, 'bot_replies.warnings', { count: warns.length, max: maxWarns })}\n`;
      infoText += `${gt(config, 'bot_replies.captcha_verified', { status: isVerified ? yesStr : noStr })}\n`;
      infoText += `${gt(config, 'bot_replies.approved_whitelist', { status: isApproved ? yesStr : noStr })}\n`;
      infoText += `${gt(config, 'bot_replies.info_muted', { status: isMuted ? yesStr : noStr })}\n`;

      if (warns.length > 0) {
        infoText += `\n${gt(config, 'bot_replies.warning_history')}\n`;
        warns.forEach((w, i) => {
          infoText += `${i + 1}. ${w.reason} (${new Date(w.timestamp).toLocaleString()})\n`;
        });
      }

      await reply(session, groupId, { text: infoText, mentions: [targetJid] }, rawMsg);
    },
    { adminOnly: false, help: 'View user information and warning history' }
  );

  registry.register(
    'adminlist',
    async (session, groupId, _u, _a, _c, _ia, rawMsg) => {
      try {
        const groupMeta = await session.sock.groupMetadata(groupId);
        const admins = groupMeta.participants.filter(
          (p) => p.admin === 'admin' || p.admin === 'superadmin'
        );

        if (admins.length === 0) {
          await reply(session, groupId, { text: '❌ No admins found.' }, rawMsg);
          return;
        }

        const botUserJid = session.sock?.user?.id ? normalizeJid(session.sock.user.id) : null;
        const botPn = session.stats?.my_number || (botUserJid ? botUserJid.split('@')[0] : null);

        let text = `👮 *Group Admins (${admins.length}):*\n\n`;
        for (const admin of admins) {
          const fullJid = admin.id;
          const phoneNum = fullJid.split('@')[0];
          const isBot = (botUserJid && fullJid === botUserJid) || (botPn && phoneNum === botPn);
          const cachedName =
            session.contactCache?.get(fullJid)?.name ||
            session.contactCache?.get(`${phoneNum}@s.whatsapp.net`)?.name;

          let displayName = cachedName ? `${cachedName} (@${phoneNum})` : `@${phoneNum}`;
          if (isBot) {
            displayName += ' 🤖 (Bot)';
          }
          const icon = admin.admin === 'superadmin' ? '👑' : '👮';
          text += `${icon} ${displayName}\n`;
        }

        await reply(session, groupId, { text, mentions: admins.map((a) => a.id) }, rawMsg);
      } catch (e) {
        await reply(session, groupId, { text: '❌ Failed to fetch admin list.' }, rawMsg);
      }
    },
    { adminOnly: false, aliases: ['admins', 'admin'], help: 'List all group administrators' }
  );

  registry.register(
    'locktypes',
    async (session, groupId, _u, _a, _c, _ia, rawMsg) => {
      const list = LOCK_TYPES.map((t) => `• \`${t}\``).join('\n');
      await reply(session, groupId, { text: `🔒 *Available Lock Types:*\n${list}` }, rawMsg);
    },
    { adminOnly: false, help: 'List all available content lock types' }
  );

  registry.register(
    'locks',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const locks = config.locks || {};
      const activeLocks = [];
      for (const [k, v] of Object.entries(locks)) {
        if (v && v.enabled) activeLocks.push(k);
      }
      if (activeLocks.length === 0) {
        await reply(session, groupId, { text: `🔓 All locks are currently disabled.` }, rawMsg);
      } else {
        await reply(
          session,
          groupId,
          { text: `🔒 *Active Locks:*\n` + activeLocks.map((l) => `• ${l}`).join('\n') },
          rawMsg
        );
      }
    },
    { adminOnly: true, help: 'List active content locks' }
  );

  registry.register(
    'rules',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const rulesText = config.rules?.text || 'No rules configured for this group.';
      if (args.length > 0 && config.ai?.enabled) {
        const question = args.join(' ');
        const store = loadModerationStore();
        const apiKey = store.gemini_api_key || process.env.GEMINI_API_KEY;

        if (apiKey) {
          const aiConfig = {
            system_prompt: `You are a group rules interpreter. Here are the group rules:\n\n${rulesText}\n\nAnswer the following question about these rules concisely and accurately. If the rules don't cover the question, say so.`,
            faq_auto_reply: true,
          };
          const aiReply = await processAiModeration(question, aiConfig, apiKey);
          if (aiReply) {
            await reply(
              session,
              groupId,
              { text: `📜 *Rules Interpretation:*\n\n${aiReply}` },
              rawMsg
            );
            return;
          }
        }
        await reply(
          session,
          groupId,
          { text: `📜 *Group Rules:*\n\n${rulesText}\n\n_(AI interpretation not available)_` },
          rawMsg
        );
      } else {
        await reply(session, groupId, { text: `📜 *Group Rules:*\n\n${rulesText}` }, rawMsg);
      }
    },
    { help: 'View group rules or ask a question about them' }
  );

  registry.register(
    'start',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      const prefix = config.commands?.prefix || '!';
      const isGroup = groupId && groupId.endsWith('@g.us');

      if (isGroup) {
        const groupSubject = session?.groupCache?.get(groupId) || 'Group';
        const msg = gt(config, 'bot_replies.start_group_msg', { group: groupSubject, prefix });
        await reply(session, groupId, { text: msg }, rawMsg);
      } else {
        const msg = gt(config, 'bot_replies.start_private_msg', { prefix });
        await reply(session, groupId, { text: msg }, rawMsg);
      }
    },
    { help: 'Introduction & quickstart guide' }
  );

  registry.register(
    'about',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      const version = process.env.npm_package_version || '2.0.0';
      const serverVersion =
        process.env.ADDON_VERSION ||
        process.env.SERVER_VERSION ||
        process.env.APP_VERSION ||
        process.env.VERSION ||
        'standalone';
      const msg = gt(config, 'bot_replies.about_text', {
        version,
        server_version: serverVersion,
      });
      await reply(session, groupId, { text: msg }, rawMsg);
    },
    { help: 'Displays project description, version, docs, repo, and support links' }
  );
}
