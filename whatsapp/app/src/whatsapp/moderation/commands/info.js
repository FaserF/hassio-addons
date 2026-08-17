import { loadModerationStore, getGroupModerationConfig } from '../store.js';
import { ADDON_VERSION, BAILEYS_VERSION } from '../../../config.js';
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
      const version = ADDON_VERSION;
      const baileysVersion = BAILEYS_VERSION;
      const msg = gt(config, 'bot_replies.about_text', {
        version,
        baileys_version: baileysVersion,
      });
      await reply(session, groupId, { text: msg }, rawMsg);
    },
    { help: 'Displays project description, version, docs, repo, and support links' }
  );

  registry.register(
    'roll',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      const argsStr = (args || []).join(' ').trim();
      const lowerArgs = argsStr.toLowerCase();

      // 0. Subcommand: Help
      if (lowerArgs === 'help' || lowerArgs === 'hilfe' || lowerArgs === '?') {
        const prefix = config.commands?.prefix || '!';
        const helpText = gt(config, 'bot_replies.dice_usage', { prefix });
        await reply(session, groupId, { text: helpText }, rawMsg);
        return;
      }

      // 1. Subcommand: Coin Flip
      if (['coin', 'flip', 'coinflip', 'münze', 'muenze', 'kopfoderzahl'].includes(lowerArgs)) {
        const outcome =
          Math.random() < 0.5
            ? gt(config, 'bot_replies.dice_coin_heads')
            : gt(config, 'bot_replies.dice_coin_tails');
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.dice_coin_result', { outcome }) },
          rawMsg
        );
        return;
      }

      // 2. Subcommand: Pick / Choice
      const tokens = lowerArgs.split(/\s+/).filter(Boolean);
      if (
        tokens.length > 0 &&
        ['pick', 'choose', 'choice', 'auswahl', 'select'].includes(tokens[0])
      ) {
        const optRaw = argsStr.slice(tokens[0].length).trim();
        const options = optRaw.includes(',')
          ? optRaw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : optRaw
              .split(/\s+/)
              .map((s) => s.trim())
              .filter(Boolean);

        if (options.length < 2) {
          const prefix = config.commands?.prefix || '!';
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.dice_pick_error', { prefix }) },
            rawMsg
          );
          return;
        }
        const picked = options[Math.floor(Math.random() * options.length)];
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.dice_pick_result', { choice: picked }) },
          rawMsg
        );
        return;
      }

      // 3. Parse formula tokens and flags for group roll
      const allKeywords = new Set(['all', 'alle', '@all', 'group', 'gruppe']);
      const uniqueKeywords = new Set([
        'unique',
        'distinct',
        'nodup',
        'nodups',
        'nodupes',
        'reihenfolge',
        'order',
        'ohne-duplikate',
        'ohneduplikate',
        '-u',
        '--unique',
        'no-dup',
        'no-dups',
        'eindeutig',
      ]);

      let isAll = false;
      let isUnique = false;
      let formulaToken = null;

      for (const tok of tokens) {
        if (allKeywords.has(tok)) {
          isAll = true;
        } else if (uniqueKeywords.has(tok)) {
          isUnique = true;
        } else if (!formulaToken) {
          formulaToken = tok;
        }
      }

      const diceSymbols = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

      // 4. Single User Roll
      if (!isAll) {
        if (!formulaToken) {
          formulaToken = lowerArgs || '1d6';
        }

        let count;
        let sides;

        if (/^\d+$/.test(formulaToken)) {
          count = 1;
          sides = parseInt(formulaToken, 10);
        } else {
          const match = formulaToken.match(/^(\d+)?(?:d|w)(\d+)$/);
          if (!match) {
            const val = Math.floor(Math.random() * 6) + 1;
            const sym = diceSymbols[val] || '';
            await reply(
              session,
              groupId,
              {
                text: gt(config, 'bot_replies.dice_result_single', {
                  formula: '1d6',
                  result: `${sym} *${val}*`,
                }),
              },
              rawMsg
            );
            return;
          }
          count = match[1] ? parseInt(match[1], 10) : 1;
          sides = parseInt(match[2], 10);
        }

        if (count < 1 || count > 20) {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.dice_count_error') },
            rawMsg
          );
          return;
        }
        if (sides < 2 || sides > 1000) {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.dice_sides_error') },
            rawMsg
          );
          return;
        }

        const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
        const total = rolls.reduce((a, b) => a + b, 0);

        if (count === 1) {
          const sym = sides === 6 ? `${diceSymbols[rolls[0]] || ''} ` : '';
          await reply(
            session,
            groupId,
            {
              text: gt(config, 'bot_replies.dice_result_single', {
                formula: `1d${sides}`,
                result: `${sym}*${rolls[0]}*`,
              }),
            },
            rawMsg
          );
        } else {
          const rollsStr = rolls
            .map((r) => (sides === 6 ? `${diceSymbols[r] || ''} ${r}`.trim() : r))
            .join(' + ');
          await reply(
            session,
            groupId,
            {
              text: gt(config, 'bot_replies.dice_result_multi', {
                formula: `${count}d${sides}`,
                rolls: rollsStr,
                total,
              }),
            },
            rawMsg
          );
        }
        return;
      }

      // 5. Group Roll for All Members
      const isGroup = groupId && groupId.endsWith('@g.us');
      if (!isGroup) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.dice_all_group_only') },
          rawMsg
        );
        return;
      }

      let count = 1;
      let sides = 6;
      if (formulaToken) {
        if (/^\d+$/.test(formulaToken)) {
          count = 1;
          sides = parseInt(formulaToken, 10);
        } else {
          const match = formulaToken.match(/^(\d+)?(?:d|w)(\d+)$/);
          if (match) {
            count = match[1] ? parseInt(match[1], 10) : 1;
            sides = parseInt(match[2], 10);
          }
        }
      }

      if (count < 1 || count > 20) {
        await reply(session, groupId, { text: gt(config, 'bot_replies.dice_count_error') }, rawMsg);
        return;
      }
      if (sides < 2 || sides > 1000) {
        await reply(session, groupId, { text: gt(config, 'bot_replies.dice_sides_error') }, rawMsg);
        return;
      }

      try {
        const groupMeta = await session.sock.groupMetadata(groupId);
        const botUserJid = session.sock?.user?.id ? normalizeJid(session.sock.user.id) : null;
        const botPn = session.stats?.my_number || (botUserJid ? botUserJid.split('@')[0] : null);

        const eligible = (groupMeta?.participants || []).filter((p) => {
          const pJid = p.id;
          const pNum = pJid.split('@')[0];
          return !(botUserJid && pJid === botUserJid) && !(botPn && pNum === botPn);
        });

        if (eligible.length === 0) {
          await reply(
            session,
            groupId,
            { text: gt(config, 'bot_replies.dice_all_no_members') },
            rawMsg
          );
          return;
        }

        const numMembers = eligible.length;
        const results = [];

        if (isUnique) {
          const actualSides = Math.max(sides, numMembers);
          // Shuffle array of numbers 1..actualSides
          const pool = Array.from({ length: actualSides }, (_, i) => i + 1);
          for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
          }
          for (let i = 0; i < numMembers; i++) {
            const val = pool[i];
            results.push({
              participant: eligible[i],
              total: val,
              rolls: [val],
              sides: actualSides,
            });
          }
        } else {
          for (const member of eligible) {
            const rolls = Array.from(
              { length: count },
              () => Math.floor(Math.random() * sides) + 1
            );
            const total = rolls.reduce((a, b) => a + b, 0);
            results.push({ participant: member, total, rolls, sides });
          }
        }

        results.sort((a, b) => b.total - a.total);

        const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
        const lines = [];

        if (isUnique) {
          lines.push(
            gt(config, 'bot_replies.dice_group_header_unique', {
              sides: results[0]?.sides || sides,
              members: numMembers,
            })
          );
        } else {
          const formulaDesc = count > 1 ? `${count}d${sides}` : `1d${sides}`;
          lines.push(
            gt(config, 'bot_replies.dice_group_header', {
              formula: formulaDesc,
              members: numMembers,
            })
          );
        }

        const mentions = [];
        results.forEach((item, idx) => {
          const rank = idx + 1;
          const medal = medals[rank] || `*${rank}.*`;
          const pJid = item.participant.id;
          mentions.push(pJid);
          const pNum = pJid.split('@')[0];
          const cachedName =
            session.contactCache?.get(pJid)?.name ||
            session.contactCache?.get(`${pNum}@s.whatsapp.net`)?.name;
          const displayName = cachedName ? `${cachedName} (@${pNum})` : `@${pNum}`;

          if (count === 1) {
            const sym = item.sides === 6 ? `${diceSymbols[item.total] || '🎲'} ` : '🎲 ';
            lines.push(`${medal} *${displayName}*: ${sym}*${item.total}*`);
          } else {
            const rollsStr = item.rolls.join(' + ');
            lines.push(`${medal} *${displayName}*: 🎲 *${item.total}* _(${rollsStr})_`);
          }
        });

        await reply(session, groupId, { text: lines.join('\n'), mentions }, rawMsg);
      } catch (err) {
        await reply(
          session,
          groupId,
          { text: gt(config, 'bot_replies.dice_group_error', { error: err.message }) },
          rawMsg
        );
      }
    },
    {
      adminOnly: false,
      aliases: ['dice', 'wuerfel'],
      help: 'Roll dice, flip a coin, or pick random options',
    }
  );

  registry.register(
    'coin',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      const outcome =
        Math.random() < 0.5
          ? gt(config, 'bot_replies.dice_coin_heads')
          : gt(config, 'bot_replies.dice_coin_tails');
      await reply(
        session,
        groupId,
        { text: gt(config, 'bot_replies.dice_coin_result', { outcome }) },
        rawMsg
      );
    },
    {
      adminOnly: false,
      aliases: ['coinflip', 'münze', 'muenze', 'flip'],
      help: 'Flip a coin (Heads or Tails 🪙)',
    }
  );
}
