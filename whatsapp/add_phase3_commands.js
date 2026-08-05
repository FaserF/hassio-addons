const fs = require('fs');

const path = 'app/src/whatsapp/moderation/commands.js';
let content = fs.readFileSync(path, 'utf8');

// Add the processAiModeration import
content = content.replace(
  "import { logger } from '../../logger.js';",
  "import { logger } from '../../logger.js';\nimport { processAiModeration } from './ai.js';"
);

// Add duration parser utility and all Phase 3 commands before the Engine Hook section
const phase3Code = `
// ---------------------------------------------------------
// Utility: Duration Parser (supports 1d, 12h, 30m, 10s)
// ---------------------------------------------------------

export function parseDuration(str) {
  const match = str.match(/^(\\d+)([dhms])$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { d: 86400, h: 3600, m: 60, s: 1 };
  return value * (multipliers[unit] || 0) * 1000; // Return ms
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s >= 86400) return \`\${Math.floor(s / 86400)}d\`;
  if (s >= 3600) return \`\${Math.floor(s / 3600)}h\`;
  if (s >= 60) return \`\${Math.floor(s / 60)}m\`;
  return \`\${s}s\`;
}

// Pending temporary actions (auto-unban / auto-unmute)
const pendingTempActions = new Map();

// ---------------------------------------------------------
// Phase 3a Commands
// ---------------------------------------------------------

registry.register('info', async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
  const targetMatches = [...(rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [])];
  if (targetMatches.length === 0 && rawMsg.message?.extendedTextMessage?.contextInfo?.participant) {
    targetMatches.push(rawMsg.message.extendedTextMessage.contextInfo.participant);
  }
  
  const targetJid = targetMatches.length > 0 ? targetMatches[0] : userId + '@s.whatsapp.net';
  const targetId = targetJid.split('@')[0];
  
  const store = loadModerationStore();
  const c = store.groups[groupId] || getGroupModerationConfig(groupId);
  const warns = c.warnings?.user_warns?.[targetId] || [];
  const maxWarns = c.warnings?.max_warnings || 3;
  const isApproved = (c.approved || []).includes(targetId);
  const isMuted = c.muted_users?.[targetId] && (!c.muted_users[targetId].until || c.muted_users[targetId].until > Date.now());
  
  let infoText = \`📋 *User Info: @\${targetId}*\\n\\n\`;
  infoText += \`🆔 ID: \\\`\${targetId}\\\`\\n\`;
  infoText += \`⚠️ Warnings: \${warns.length}/\${maxWarns}\\n\`;
  infoText += \`✅ Approved: \${isApproved ? 'Yes' : 'No'}\\n\`;
  infoText += \`🔇 Muted: \${isMuted ? 'Yes' : 'No'}\\n\`;
  
  if (warns.length > 0) {
    infoText += \`\\n*Warning History:*\\n\`;
    warns.forEach((w, i) => {
      infoText += \`\${i + 1}. \${w.reason} (\${new Date(w.timestamp).toLocaleString()})\\n\`;
    });
  }
  
  await reply(session, groupId, { text: infoText, mentions: [targetJid] });
}, { adminOnly: false, help: 'View user information and warning history' });

registry.register('adminlist', async (session, groupId) => {
  try {
    const groupMeta = await session.sock.groupMetadata(groupId);
    const admins = groupMeta.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
    
    if (admins.length === 0) {
      await reply(session, groupId, { text: '❌ No admins found.' });
      return;
    }
    
    let text = \`👮 *Group Admins (\${admins.length}):*\\n\\n\`;
    for (const admin of admins) {
      const id = admin.id.split('@')[0];
      const icon = admin.admin === 'superadmin' ? '👑' : '👮';
      text += \`\${icon} @\${id}\\n\`;
    }
    
    await reply(session, groupId, { text, mentions: admins.map(a => a.id) });
  } catch (e) {
    await reply(session, groupId, { text: '❌ Failed to fetch admin list.' });
  }
}, { adminOnly: false, aliases: ['admins'], help: 'List all group administrators' });

const LOCK_TYPES = ['image', 'video', 'audio', 'document', 'sticker', 'url', 'invite', 'poll', 'contact', 'location', 'forwarded', 'rtl'];

registry.register('locktypes', async (session, groupId) => {
  const list = LOCK_TYPES.map(t => \`• \\\`\${t}\\\`\`).join('\\n');
  await reply(session, groupId, { text: \`🔒 *Available Lock Types:*\\n\${list}\` });
}, { adminOnly: false, help: 'List all available content lock types' });

registry.register('del', async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
  const quotedMsg = rawMsg.message?.extendedTextMessage?.contextInfo;
  if (!quotedMsg?.stanzaId) {
    await reply(session, groupId, { text: '⚠️ Reply to a message to delete it.' });
    return;
  }
  
  try {
    await session.sock.sendMessage(groupId, { delete: {
      remoteJid: groupId,
      fromMe: false,
      id: quotedMsg.stanzaId,
      participant: quotedMsg.participant,
    }});
    // Also delete the command message itself
    if (rawMsg.key) {
      await session.sock.sendMessage(groupId, { delete: rawMsg.key });
    }
  } catch (e) {
    await reply(session, groupId, { text: '❌ Failed to delete message. Ensure I have admin rights.' });
  }
}, { adminOnly: true, aliases: ['delete'], help: 'Delete a replied-to message' });

registry.register('mute', async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
  const targetMatches = [...(rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [])];
  if (targetMatches.length === 0 && rawMsg.message?.extendedTextMessage?.contextInfo?.participant) {
    targetMatches.push(rawMsg.message.extendedTextMessage.contextInfo.participant);
  }
  if (targetMatches.length === 0) {
    await reply(session, groupId, { text: '⚠️ You must mention a user or reply to their message to mute them.' });
    return;
  }
  
  const reason = args.join(' ') || 'No reason provided';
  const store = loadModerationStore();
  const c = store.groups[groupId] || getGroupModerationConfig(groupId);
  if (!c.muted_users) c.muted_users = {};
  
  for (const jid of targetMatches) {
    const id = jid.split('@')[0];
    c.muted_users[id] = { until: null, reason };
  }
  saveModerationStore(store);
  
  await reply(session, groupId, { 
    text: \`🔇 Muted \${targetMatches.length} user(s) indefinitely.\\nReason: \${reason}\\n\\n_Their messages will be automatically deleted._\`,
    mentions: targetMatches
  });
}, { adminOnly: true, help: 'Mute a user (their messages will be deleted)' });

registry.register('unmute', async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
  const targetMatches = [...(rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [])];
  if (targetMatches.length === 0 && rawMsg.message?.extendedTextMessage?.contextInfo?.participant) {
    targetMatches.push(rawMsg.message.extendedTextMessage.contextInfo.participant);
  }
  if (targetMatches.length === 0) {
    await reply(session, groupId, { text: '⚠️ You must mention a user or reply to their message to unmute them.' });
    return;
  }
  
  const store = loadModerationStore();
  const c = store.groups[groupId] || getGroupModerationConfig(groupId);
  if (!c.muted_users) c.muted_users = {};
  
  let unmutedCount = 0;
  for (const jid of targetMatches) {
    const id = jid.split('@')[0];
    if (c.muted_users[id]) {
      delete c.muted_users[id];
      unmutedCount++;
    }
  }
  saveModerationStore(store);
  
  if (unmutedCount > 0) {
    await reply(session, groupId, { text: \`🔊 Unmuted \${unmutedCount} user(s).\`, mentions: targetMatches });
  } else {
    await reply(session, groupId, { text: '❌ None of those users are muted.' });
  }
}, { adminOnly: true, help: 'Unmute a muted user' });

registry.register('tban', async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
  const targetMatches = [...(rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [])];
  if (targetMatches.length === 0 && rawMsg.message?.extendedTextMessage?.contextInfo?.participant) {
    targetMatches.push(rawMsg.message.extendedTextMessage.contextInfo.participant);
  }
  if (targetMatches.length === 0 || args.length === 0) {
    await reply(session, groupId, { text: \`⚠️ Usage: \\\`\${config.commands.prefix}tban <duration> [@user]\\\`\\nExample: \\\`\${config.commands.prefix}tban 1d @user\\\`\\nDurations: 10s, 30m, 12h, 1d\` });
    return;
  }
  
  const durationMs = parseDuration(args[0]);
  if (!durationMs) {
    await reply(session, groupId, { text: '❌ Invalid duration. Use format: 10s, 30m, 12h, 1d' });
    return;
  }
  
  const reason = args.slice(1).join(' ') || 'Temporary ban';
  
  for (const targetJid of targetMatches) {
    const targetId = targetJid.split('@')[0];
    
    // Kick the user
    await executePenalty(session, groupId, targetId, 'kick', reason);
    
    // Schedule auto-unban (re-add) — note: WhatsApp can't re-add automatically,
    // but we track the ban expiry so admins know when it expires
    const key = \`tban:\${groupId}:\${targetId}\`;
    if (pendingTempActions.has(key)) clearTimeout(pendingTempActions.get(key));
    
    const timeout = setTimeout(async () => {
      pendingTempActions.delete(key);
      await reply(session, groupId, { text: \`⏰ Temporary ban for @\${targetId} has expired (\${formatDuration(durationMs)}). They may rejoin the group.\`, mentions: [targetJid] });
    }, durationMs);
    pendingTempActions.set(key, timeout);
  }
  
  await reply(session, groupId, { 
    text: \`⏱️ Temporarily banned for \${formatDuration(durationMs)}.\\nReason: \${reason}\`,
    mentions: targetMatches
  });
}, { adminOnly: true, help: 'Temporarily ban a user for a specific duration' });

registry.register('tmute', async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
  const targetMatches = [...(rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [])];
  if (targetMatches.length === 0 && rawMsg.message?.extendedTextMessage?.contextInfo?.participant) {
    targetMatches.push(rawMsg.message.extendedTextMessage.contextInfo.participant);
  }
  if (targetMatches.length === 0 || args.length === 0) {
    await reply(session, groupId, { text: \`⚠️ Usage: \\\`\${config.commands.prefix}tmute <duration> [@user]\\\`\\nExample: \\\`\${config.commands.prefix}tmute 1h @user\\\`\` });
    return;
  }
  
  const durationMs = parseDuration(args[0]);
  if (!durationMs) {
    await reply(session, groupId, { text: '❌ Invalid duration. Use format: 10s, 30m, 12h, 1d' });
    return;
  }
  
  const reason = args.slice(1).join(' ') || 'Temporary mute';
  const store = loadModerationStore();
  const c = store.groups[groupId] || getGroupModerationConfig(groupId);
  if (!c.muted_users) c.muted_users = {};
  
  const until = Date.now() + durationMs;
  for (const jid of targetMatches) {
    const id = jid.split('@')[0];
    c.muted_users[id] = { until, reason };
  }
  saveModerationStore(store);
  
  // Schedule auto-unmute
  for (const jid of targetMatches) {
    const id = jid.split('@')[0];
    const key = \`tmute:\${groupId}:\${id}\`;
    if (pendingTempActions.has(key)) clearTimeout(pendingTempActions.get(key));
    
    const timeout = setTimeout(() => {
      pendingTempActions.delete(key);
      const st = loadModerationStore();
      const gc = st.groups[groupId];
      if (gc?.muted_users?.[id]) {
        delete gc.muted_users[id];
        saveModerationStore(st);
      }
      reply(session, groupId, { text: \`🔊 Temporary mute for @\${id} has expired.\`, mentions: [jid] });
    }, durationMs);
    pendingTempActions.set(key, timeout);
  }
  
  await reply(session, groupId, { 
    text: \`🔇 Temporarily muted for \${formatDuration(durationMs)}.\\nReason: \${reason}\\n\\n_Their messages will be automatically deleted until the mute expires._\`,
    mentions: targetMatches
  });
}, { adminOnly: true, help: 'Temporarily mute a user for a specific duration' });

// ---------------------------------------------------------
// Phase 3b: AI Rules Interpretation (enhanced !rules)
// ---------------------------------------------------------

// Override the original !rules to support AI queries
registry.register('rules', async (session, groupId, userId, args, config) => {
  const rulesText = config.rules?.text || 'No rules configured for this group.';
  
  if (args.length > 0 && config.ai?.enabled) {
    // AI-powered rule interpretation
    const question = args.join(' ');
    const store = loadModerationStore();
    const apiKey = store.gemini_api_key || process.env.GEMINI_API_KEY;
    
    if (apiKey) {
      const aiConfig = {
        system_prompt: \`You are a group rules interpreter. Here are the group rules:\\n\\n\${rulesText}\\n\\nAnswer the following question about these rules concisely and accurately. If the rules don't cover the question, say so.\`,
        faq_auto_reply: true,
      };
      const aiReply = await processAiModeration(question, aiConfig, apiKey);
      if (aiReply) {
        await reply(session, groupId, { text: \`📜 *Rules Interpretation:*\\n\\n\${aiReply}\` });
        return;
      }
    }
    await reply(session, groupId, { text: \`📜 *Group Rules:*\\n\\n\${rulesText}\\n\\n_(AI interpretation not available)_\` });
  } else {
    await reply(session, groupId, { text: \`📜 *Group Rules:*\\n\\n\${rulesText}\` });
  }
}, { help: 'View group rules or ask a question about them' });

// ---------------------------------------------------------
// Phase 3c: Translation Commands
// ---------------------------------------------------------

registry.register('setlang', async (session, groupId, userId, args, config) => {
  if (args.length === 0) {
    await reply(session, groupId, { text: \`⚠️ Usage: \\\`\${config.commands.prefix}setlang <language_code>\\\`\\nExamples: en, de, es, fr, ar, zh, ja\` });
    return;
  }
  const lang = args[0].toLowerCase();
  const store = loadModerationStore();
  const c = store.groups[groupId] || getGroupModerationConfig(groupId);
  if (!c.translation) c.translation = {};
  c.translation.target_lang = lang;
  c.translation.enabled = true;
  saveModerationStore(store);
  await reply(session, groupId, { text: \`🌐 Translation language set to \\\`\${lang}\\\` and enabled.\` });
}, { adminOnly: true, help: 'Set the translation target language' });

registry.register('translate', async (session, groupId, userId, args, config, isAdminUser, rawMsg) => {
  const store = loadModerationStore();
  const apiKey = store.gemini_api_key || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    await reply(session, groupId, { text: '❌ Gemini API key not configured. Set it in the Addon UI.' });
    return;
  }
  
  // Get text to translate: either from reply or from args
  let textToTranslate = '';
  if (rawMsg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation) {
    textToTranslate = rawMsg.message.extendedTextMessage.contextInfo.quotedMessage.conversation;
  } else if (rawMsg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text) {
    textToTranslate = rawMsg.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage.text;
  } else if (args.length > 0) {
    textToTranslate = args.join(' ');
  }
  
  if (!textToTranslate) {
    await reply(session, groupId, { text: '⚠️ Reply to a message or provide text to translate.' });
    return;
  }
  
  const targetLang = config.translation?.target_lang || 'en';
  const aiConfig = {
    system_prompt: \`You are a translator. Translate the following text to \${targetLang}. Reply ONLY with the translation, nothing else.\`,
    faq_auto_reply: true,
  };
  
  const translated = await processAiModeration(textToTranslate, aiConfig, apiKey);
  if (translated) {
    await reply(session, groupId, { text: \`🌐 *Translation (\${targetLang}):*\\n\\n\${translated}\` });
  } else {
    await reply(session, groupId, { text: '❌ Translation failed.' });
  }
}, { adminOnly: false, help: 'Translate a message or text' });

`;

// Insert before the Engine Hook section
content = content.replace(
  '// ---------------------------------------------------------\n// Engine Hook\n// ---------------------------------------------------------',
  phase3Code + '\n// ---------------------------------------------------------\n// Engine Hook\n// ---------------------------------------------------------'
);

fs.writeFileSync(path, content);
console.log('Phase 3 commands added successfully. File size:', content.length);
