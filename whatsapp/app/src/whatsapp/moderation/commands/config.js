import { registerFederationCommands } from './config/federation.js';
import { registerSecurityCommands } from './config/security.js';
import { registerSettingsCommands } from './config/settings.js';
import { loadModerationStore, getGroupModerationConfig, saveModerationStore } from '../store.js';
import { reply } from '../../actions.js';
import { logger } from '../../../logger.js';
import { isSameUser, resolveUserDisplayName } from '../../../utils/security.js';
import { isSelfParticipant } from '../engine/penalties.js';
import { gt } from '../engine/translations.js';
import { translateTextGatewayWithReason } from '../../../utils/gatewayTranslator.js';

export function registerConfigCommands(registry) {
  registry.register(
    'setwelcome',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const text = args.join(' ');
      if (!text) {
        await reply(
          session,
          groupId,
          {
            text: `⚠️ Usage: \`${config.commands.prefix}setwelcome <text>\`\nPlaceholders: {mention}, {name}, {pushname}, {group}, {count}, {rules}, {date}, {time}`,
          },
          rawMsg
        );
        return;
      }
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.greetings) c.greetings = {};
      c.greetings.welcome_text = text;
      c.greetings.welcome_message = text;
      c.greetings.welcome_enabled = true;
      saveModerationStore(store);
      await reply(session, groupId, { text: '✅ Welcome message updated and enabled.' }, rawMsg);
    },
    { adminOnly: true, help: 'Set the welcome message' }
  );

  registry.register(
    'welcome',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const text =
        config.greetings?.welcome_text ||
        config.greetings?.welcome_message ||
        'Welcome {user} to {group}!';
      await reply(session, groupId, { text: `Current welcome message:\n\n${text}` }, rawMsg);
    },
    { adminOnly: true, help: 'View the welcome message' }
  );

  registry.register(
    'setgoodbye',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const text = args.join(' ');
      if (!text) {
        await reply(
          session,
          groupId,
          {
            text: `⚠️ Usage: \`${config.commands.prefix}setgoodbye <text>\`\nPlaceholders: {mention}, {name}, {pushname}, {group}, {count}, {rules}, {date}, {time}`,
          },
          rawMsg
        );
        return;
      }
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.greetings) c.greetings = {};
      c.greetings.goodbye_text = text;
      c.greetings.goodbye_message = text;
      c.greetings.goodbye_enabled = true;
      saveModerationStore(store);
      await reply(session, groupId, { text: '✅ Goodbye message updated and enabled.' }, rawMsg);
    },
    { adminOnly: true, help: 'Set the goodbye message' }
  );

  registry.register(
    'goodbye',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const text =
        config.greetings?.goodbye_text || config.greetings?.goodbye_message || 'Goodbye {name}!';
      await reply(session, groupId, { text: `Current goodbye message:\n\n${text}` }, rawMsg);
    },
    { adminOnly: true, help: 'View the goodbye message' }
  );

  registry.register(
    'save',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      if (args.length < 2) {
        await reply(
          session,
          groupId,
          { text: `⚠️ Usage: \`${config.commands.prefix}save <name> <content>\`` },
          rawMsg
        );
        return;
      }
      const name = args[0].toLowerCase().replace(/^#/, '');
      const content = args.slice(1).join(' ');
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.notes) c.notes = {};
      c.notes[name] = content;
      saveModerationStore(store);
      await reply(session, groupId, { text: `✅ Saved note *#${name}*.` }, rawMsg);
    },
    { adminOnly: true, help: 'Save a note (#name content)' }
  );

  registry.register(
    'get',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      if (args.length === 0) {
        await reply(
          session,
          groupId,
          { text: `⚠️ Usage: \`${config.commands.prefix}get <name>\`` },
          rawMsg
        );
        return;
      }
      const name = args[0].toLowerCase().replace(/^#/, '');
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (c.notes && c.notes[name]) {
        await reply(session, groupId, { text: c.notes[name] }, rawMsg);
      } else {
        await reply(session, groupId, { text: `❌ Note *#${name}* not found.` }, rawMsg);
      }
    },
    { help: 'Retrieve a note' }
  );

  registry.register(
    'notes',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      const noteKeys = Object.keys(c.notes || {});
      if (noteKeys.length === 0) {
        await reply(session, groupId, { text: '📝 No notes saved for this group.' }, rawMsg);
      } else {
        await reply(
          session,
          groupId,
          { text: `📝 *Saved Notes:*\n${noteKeys.map((k) => `• #${k}`).join('\n')}` },
          rawMsg
        );
      }
    },
    { help: 'List all saved notes' }
  );

  registry.register(
    'filter',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const text = args.join(' ');
      if (!text.includes('->')) {
        await reply(
          session,
          groupId,
          { text: `⚠️ Usage: \`${config.commands.prefix}filter <trigger> -> <response>\`` },
          rawMsg
        );
        return;
      }
      const [trigger, response] = text.split('->').map((s) => s.trim());
      if (!trigger || !response) return;
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!Array.isArray(c.filters)) c.filters = [];
      c.filters.push({ trigger, response, action: 'reply' });
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        { text: `✅ Added auto-responder filter for *"${trigger}"*.` },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Add auto-reply filter (trigger -> response)' }
  );

  registry.register(
    'stop',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      if (args.length === 0) {
        await reply(
          session,
          groupId,
          { text: `⚠️ Usage: \`${config.commands.prefix}stop <trigger>\`` },
          rawMsg
        );
        return;
      }
      const trigger = args.join(' ').toLowerCase().trim();
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (Array.isArray(c.filters)) {
        c.filters = c.filters.filter((f) => f.trigger.toLowerCase() !== trigger);
        saveModerationStore(store);
        await reply(session, groupId, { text: `✅ Removed filter for *"${trigger}"*.` }, rawMsg);
      } else {
        await reply(session, groupId, { text: `❌ Filter not found.` }, rawMsg);
      }
    },
    { adminOnly: true, help: 'Remove auto-reply filter' }
  );

  registry.register(
    'filters',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      const filters = c.filters || [];
      if (filters.length === 0) {
        await reply(session, groupId, { text: '💬 No active filters in this group.' }, rawMsg);
      } else {
        await reply(
          session,
          groupId,
          {
            text: `💬 *Active Filters:*\n${filters.map((f) => `• "${f.trigger}" → ${f.response}`).join('\n')}`,
          },
          rawMsg
        );
      }
    },
    { help: 'List all auto-reply filters' }
  );

  registry.register(
    'report',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      let groupMeta;
      try {
        groupMeta = await session.sock.groupMetadata(groupId);
      } catch (e) {
        logger.error(
          { error: e.message, groupId },
          'Failed to fetch group metadata for report command'
        );
      }

      const adminParticipants = (groupMeta?.participants || []).filter(
        (p) => p.admin === 'admin' || p.admin === 'superadmin'
      );
      const admins = adminParticipants.map((p) => p.id);

      const targetMatches = [
        ...(rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []),
      ];
      if (
        targetMatches.length === 0 &&
        rawMsg.message?.extendedTextMessage?.contextInfo?.participant
      ) {
        targetMatches.push(rawMsg.message.extendedTextMessage.contextInfo.participant);
      }

      const targetJid = targetMatches.length > 0 ? targetMatches[0] : null;
      const targetId = targetJid ? targetJid.split('@')[0].replace(/\D/g, '') : null;
      const cleanUserId = userId ? userId.split('@')[0].replace(/\D/g, '') : null;

      if (
        !targetJid ||
        (targetId && cleanUserId && targetId === cleanUserId) ||
        isSameUser(userId, targetJid, session)
      ) {
        await reply(
          session,
          groupId,
          {
            text: `⚠️ You cannot report yourself. Please mention (@user) or reply to the user you want to report.`,
          },
          rawMsg
        );
        return;
      }

      if (targetJid && isSameUser(targetJid, session?.sock?.user?.id, session)) {
        await reply(session, groupId, { text: `⚠️ You cannot report the bot account.` }, rawMsg);
        return;
      }

      const cleanedArgs = args.filter((a) => !a.startsWith('@'));
      const text = cleanedArgs.join(' ').trim();
      const reasonText = text ? text : 'No reason provided';

      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!Array.isArray(c.reports)) c.reports = [];

      const reportItem = {
        id: `rep_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        reporter_id: userId,
        target_id: targetId || null,
        reason: reasonText,
        timestamp: Date.now(),
        status: 'open',
      };
      c.reports.push(reportItem);
      store.groups[groupId] = c;
      saveModerationStore(store);

      let quotedMsg = undefined;
      if (rawMsg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
        quotedMsg = rawMsg;
      }

      const reporterLabel = resolveUserDisplayName(userId, session);
      const targetLabel = targetJid
        ? resolveUserDisplayName(targetJid, session)
        : targetId
          ? `@${targetId}`
          : '';
      const targetMentionStr = targetLabel ? ` against ${targetLabel}` : '';

      const nonBotAdmins = admins.filter((a) => !isSelfParticipant(a, session));
      const targetAdmins = nonBotAdmins.length > 0 ? nonBotAdmins : admins;

      await reply(
        session,
        groupId,
        {
          text: `🚨 *Report from ${reporterLabel}*${targetMentionStr}\nAdmins requested.\nReason: ${reasonText}`,
          mentions: [
            userId + '@s.whatsapp.net',
            ...(targetJid ? [targetJid] : []),
            ...targetAdmins,
          ],
        },
        quotedMsg
      );

      const groupSubject = groupMeta?.subject || groupId.split('@')[0];
      const dmText = gt(config, 'bot_replies.report_dm', {
        group: groupSubject,
        reporter: userId,
        targetText: targetId ? `🎯 *Target User:* @${targetId}\n` : '',
        reason: reasonText,
        time: new Date(reportItem.timestamp).toLocaleString(),
        groupId,
      });

      for (const adminJid of targetAdmins) {
        if (nonBotAdmins.length > 0 && isSelfParticipant(adminJid, session)) continue;
        try {
          await reply(session, adminJid, {
            text: dmText,
            mentions: [userId + '@s.whatsapp.net', ...(targetJid ? [targetJid] : [])],
          });
        } catch (err) {
          logger.warn(
            { error: err.message, adminJid },
            'Failed to send direct report message to admin'
          );
        }
      }
    },
    { adminOnly: false, help: 'Report a message or user to group admins' }
  );

  registry.register(
    'setlang',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      if (args.length === 0) {
        await reply(
          session,
          groupId,
          {
            text: `⚠️ Usage: \`${config.commands.prefix}setlang <language_code>\`\nExamples: en, de, es, fr, ar, zh, ja`,
          },
          rawMsg
        );
        return;
      }
      const lang = args[0].toLowerCase();
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      c.language = lang;
      if (!c.translation) c.translation = {};
      c.translation.target_lang = lang;
      c.translation.enabled = true;
      store.groups[groupId] = c;
      saveModerationStore(store);
      const langMsg =
        lang === 'de'
          ? `🌐 Botsprache für diese Gruppe wurde auf \`${lang}\` (Deutsch) gesetzt.`
          : `🌐 Bot language for this group set to \`${lang}\`.`;
      await reply(session, groupId, { text: langMsg }, rawMsg);
    },
    { adminOnly: true, help: 'Set the group bot response language (e.g. en, de)' }
  );

  registry.register(
    'translate',
    async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
      let targetLang = config.translation?.target_lang || 'en';
      let textToTranslate = '';

      const quoted =
        rawMsg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
        rawMsg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text;

      const supportedLangs = [
        'en',
        'de',
        'es',
        'fr',
        'it',
        'pt',
        'ru',
        'zh',
        'ja',
        'ar',
        'nl',
        'tr',
        'pl',
        'uk',
      ];

      if (quoted) {
        textToTranslate = quoted;
        if (args.length > 0 && supportedLangs.includes(args[0].toLowerCase())) {
          targetLang = args[0].toLowerCase();
        }
      } else if (args.length >= 2 && supportedLangs.includes(args[0].toLowerCase())) {
        targetLang = args[0].toLowerCase();
        textToTranslate = args.slice(1).join(' ');
      } else if (args.length > 0) {
        textToTranslate = args.join(' ');
      }

      if (!textToTranslate || !textToTranslate.trim()) {
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.translate_prompt_usage', {
              prefix: config.commands?.prefix || '!',
            }),
          },
          rawMsg
        );
        return;
      }

      const { translation, reason } = await translateTextGatewayWithReason(
        textToTranslate,
        targetLang,
        'auto',
        config
      );

      if (translation) {
        await reply(
          session,
          groupId,
          {
            text: gt(config, 'bot_replies.translate_result_header', {
              targetLang: targetLang.toUpperCase(),
              translation,
            }),
          },
          rawMsg
        );
      } else {
        logger.warn({ reason, targetLang }, 'Manual translation command failed');
        await reply(session, groupId, { text: gt(config, 'bot_replies.translate_failed') }, rawMsg);
      }
    },
    { adminOnly: false, help: 'Translate a message or text', aliases: ['tr'] }
  );

  registry.register(
    'resetwarn',
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
      if (targetMatches.length === 0) {
        await reply(
          session,
          groupId,
          { text: '⚠️ Mention a user or reply to reset warnings.' },
          rawMsg
        );
        return;
      }
      const store = loadModerationStore();
      if (!store.warnings) store.warnings = {};
      if (!store.warnings[groupId]) store.warnings[groupId] = {};

      for (const targetJid of targetMatches) {
        const targetId = targetJid.split('@')[0];
        store.warnings[groupId][targetId] = [];
      }
      saveModerationStore(store);
      await reply(session, groupId, { text: '✅ Reset warnings for target user(s).' }, rawMsg);
    },
    { adminOnly: true, help: 'Reset all warnings for a user', aliases: ['rmwarn'] }
  );

  registry.register(
    'setwarnlimit',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      if (args.length === 0 || isNaN(parseInt(args[0], 10))) {
        await reply(session, groupId, { text: '⚠️ Usage: `!setwarnlimit <1-10>`' }, rawMsg);
        return;
      }
      const limit = Math.max(1, Math.min(10, parseInt(args[0], 10)));
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.warnings) c.warnings = {};
      c.warnings.limit = limit;
      saveModerationStore(store);
      await reply(session, groupId, { text: `✅ Warning limit set to *${limit}*.` }, rawMsg);
    },
    { adminOnly: true, help: 'Set group warning threshold limit' }
  );

  registry.register(
    'setwarnaction',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const action = (args[0] || '').toLowerCase();
      if (!['kick', 'mute', 'ban', 'remove'].includes(action)) {
        await reply(
          session,
          groupId,
          { text: '⚠️ Usage: `!setwarnaction <kick|mute|ban>`' },
          rawMsg
        );
        return;
      }
      const store = loadModerationStore();
      const c = store.groups[groupId] || getGroupModerationConfig(groupId);
      if (!c.warnings) c.warnings = {};
      c.warnings.action = action;
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        { text: `✅ Warning action set to *${action.toUpperCase()}*.` },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Set group warning action upon threshold' }
  );

  registry.register(
    'autotranslate',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const mode = (args[0] || '').toLowerCase();
      const store = loadModerationStore();
      if (!store.groups[groupId]) {
        store.groups[groupId] = getGroupModerationConfig(groupId);
      }
      const c = store.groups[groupId];
      if (!c.translation) c.translation = {};
      if (mode === 'on' || mode === 'true' || mode === 'enable' || mode === '1') {
        c.translation.enabled = true;
      } else if (mode === 'off' || mode === 'false' || mode === 'disable' || mode === '0') {
        c.translation.enabled = false;
      } else {
        c.translation.enabled = !c.translation.enabled;
      }
      c.translation.mode = c.translation.enabled ? 'auto' : 'manual';
      saveModerationStore(store);
      await reply(
        session,
        groupId,
        { text: `🌐 Auto-translation is now *${c.translation.enabled ? 'ENABLED' : 'DISABLED'}*.` },
        rawMsg
      );
    },
    { adminOnly: true, help: 'Toggle auto translation on/off' }
  );

  registry.register(
    'testsuite',
    async (session, groupId, userId, args, config, _isAdmin, rawMsg) => {
      const prefix = config.commands?.prefix || '!';
      const disabledCmds = new Set(config.commands?.disabled_commands || []);
      const seen = new Set();
      const testLines = [];

      for (const [cmd, details] of Object.entries(registry.commands)) {
        if (seen.has(details)) continue;
        seen.add(details);
        if (disabledCmds.has(cmd)) continue;

        let sample;
        switch (cmd) {
          case 'setrules':
            sample = `${prefix}setrules 1. Be polite.\n2. No spam.`;
            break;
          case 'warn':
            sample = `${prefix}warn @user Violation of group rules`;
            break;
          case 'unwarn':
            sample = `${prefix}unwarn @user`;
            break;
          case 'mute':
            sample = `${prefix}mute @user 10m`;
            break;
          case 'tmute':
            sample = `${prefix}tmute @user 15m`;
            break;
          case 'tban':
            sample = `${prefix}tban @user 1h`;
            break;
          case 'kick':
            sample = `${prefix}kick @user`;
            break;
          case 'ban':
            sample = `${prefix}ban @user Rule violation`;
            break;
          case 'promote':
            sample = `${prefix}promote @user`;
            break;
          case 'demote':
            sample = `${prefix}demote @user`;
            break;
          case 'approve':
            sample = `${prefix}approve @user`;
            break;
          case 'unapprove':
            sample = `${prefix}unapprove @user`;
            break;
          case 'lock':
            sample = `${prefix}lock url`;
            break;
          case 'unlock':
            sample = `${prefix}unlock url`;
            break;
          case 'setwelcome':
            sample = `${prefix}setwelcome Welcome {mention} to {group}!`;
            break;
          case 'setgoodbye':
            sample = `${prefix}setgoodbye Goodbye {name}!`;
            break;
          case 'report':
            sample = `${prefix}report @user Inappropriate message`;
            break;
          case 'notes':
            sample = `${prefix}notes #wifi 12345678`;
            break;
          case 'filter':
            sample = `${prefix}filter wlan -> Password is 1234`;
            break;
          case 'setlang':
            sample = `${prefix}setlang de`;
            break;
          case 'translate':
            sample = `${prefix}translate de Hello world`;
            break;
          case 'autotranslate':
            sample = `${prefix}autotranslate on`;
            break;
          case 'slowmode':
            sample = `${prefix}slowmode 10s`;
            break;
          default:
            sample = `${prefix}${cmd}`;
            break;
        }
        testLines.push(sample);
      }

      const customCmds = config.commands?.custom_commands || [];
      for (const c of customCmds) {
        const cleanCmd = (c.command || '').replace(/^[!/#]+/, '');
        if (cleanCmd) testLines.push(`${prefix}${cleanCmd}`);
      }

      const header = `🧪 *Test Suite — Active Commands (${testLines.length})*\n_Prefix: ${prefix}_\n\n`;
      const body = testLines.join('\n');
      await reply(session, groupId, { text: header + body }, rawMsg);
    },
    { adminOnly: true, help: 'Post all active bot commands as test payloads into this group' }
  );

  registerFederationCommands(registry);
  registerSecurityCommands(registry);
  registerSettingsCommands(registry);
}
