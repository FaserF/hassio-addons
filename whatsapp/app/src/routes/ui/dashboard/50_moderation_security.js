// Moderation Security (Content Locks, Anti-Spam / Anti-Raid, Blacklist)

async function saveGroupLocks() {
  if (!currentModGroup) return showToast('Please select a group', 'warning');
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  const lockKeys = [
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
  groupConfig.locks = groupConfig.locks || {};
  lockKeys.forEach((k) => {
    const el = document.getElementById(`mod-lock-${k}`);
    groupConfig.locks[k] = { enabled: Boolean(el?.checked), action: 'delete' };
  });
  await saveGroupConfig(groupConfig);
  markClean();
  showToast('Content locks saved!', 'success');
}

async function addBlacklistWord() {
  const inp = document.getElementById('mod-blacklist-new');
  if (!inp || !inp.value.trim() || !currentModGroup) return;
  const word = inp.value.trim();
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.blacklist = groupConfig.blacklist || { enabled: true, words: [], action: 'delete' };
  if (!groupConfig.blacklist.words.includes(word)) {
    groupConfig.blacklist.words.push(word);
    groupConfig.blacklist.enabled = true;
  }
  inp.value = '';
  await saveGroupConfig(groupConfig);
  selectModerationGroup(currentModGroup);
  setTimeout(() => {
    const el = document.getElementById('mod-blacklist-new');
    if (el) el.focus();
  }, 50);
}

async function removeBlacklistWord(idx) {
  if (!currentModGroup || !modStoreCache?.groups?.[currentModGroup]) return;
  const groupConfig = modStoreCache.groups[currentModGroup];
  if (groupConfig.blacklist?.words) {
    groupConfig.blacklist.words.splice(idx, 1);
    await saveGroupConfig(groupConfig);
    selectModerationGroup(currentModGroup);
  }
}

async function saveGroupBlacklist() {
  if (!currentModGroup) return;
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  await saveGroupConfig(groupConfig);
  markClean();
  showToast('Blacklist saved!', 'success');
}

async function saveGroupAntispam() {
  if (!currentModGroup) return;
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.antispam = {
    flood_protection: {
      enabled: Boolean(document.getElementById('mod-flood-enabled')?.checked),
      max_messages: parseInt(document.getElementById('mod-flood-max')?.value, 10) || 5,
      window_seconds: parseInt(document.getElementById('mod-flood-win')?.value, 10) || 5,
      action: 'mute',
    },
    anti_raid: {
      enabled: Boolean(document.getElementById('mod-antiraid-enabled')?.checked),
      max_joins: parseInt(document.getElementById('mod-antiraid-max')?.value, 10) || 5,
      window_seconds: parseInt(document.getElementById('mod-antiraid-win')?.value, 10) || 10,
      action: 'lockdown',
    },
  };
  groupConfig.anti_spam_links_enabled = Boolean(
    document.getElementById('mod-antispam-links-enabled')?.checked
  );
  await saveGroupConfig(groupConfig);
  markClean();
  showToast('Anti-Spam & Anti-Raid saved!', 'success');
}

async function generateGroupTestCommandsModal() {
  if (!currentModGroup) {
    showToast('Please select a group first.', 'warning');
    return;
  }
  const modal = document.getElementById('test-commands-modal');
  const container = document.getElementById('test-commands-modal-content');
  if (!modal || !container) return;

  const config = modStoreCache?.groups?.[currentModGroup] || {};
  const prefix = config.commands?.prefix || '!';

  // Use cached commands or fetch with basePath
  let commandsList = typeof builtinCommandsCache !== 'undefined' ? builtinCommandsCache : [];
  if (!commandsList || commandsList.length === 0) {
    try {
      const res = await fetch(
        (typeof basePath !== 'undefined' ? basePath : '') + 'api/moderation/commands'
      );
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        commandsList = json.data;
      }
    } catch (_e) {
      /* fallback */
    }
  }

  const disabledCmds = new Set(config.commands?.disabled_commands || []);
  const activeCmds = commandsList.filter((c) => !disabledCmds.has(c.cmd));

  let html = `<div style="font-size:12px;display:flex;flex-direction:column;gap:12px;">`;

  // 1. Group Info Banner
  html += `
    <div style="padding:10px;background:rgba(41,182,246,0.1);border:1px solid rgba(41,182,246,0.3);border-radius:6px;">
      <strong>Target Group:</strong> <code>${escapeHtml(currentModGroup)}</code><br>
      <strong>Configured Prefix:</strong> <code>${escapeHtml(prefix)}</code> &middot; <strong>Active Commands:</strong> ${activeCmds.length}/${commandsList.length}
    </div>`;

  // Helper for copyable block
  const makeCopyableBlock = (title, items, icon = 'fas fa-terminal') => {
    if (!items || items.length === 0) return '';
    const textContent = items.join('\n');
    return `
      <div style="background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;padding:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong style="color:var(--primary);font-size:13px;"><i class="${icon}"></i> ${escapeHtml(title)} (${items.length})</strong>
          <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px;" onclick="navigator.clipboard.writeText(\`${escapeHtml(textContent).replace(/`/g, '\\`')}\`);showToast('Copied to clipboard!','success');"><i class="fas fa-copy"></i> Copy All</button>
        </div>
        <pre style="background:var(--body-bg);padding:8px;border-radius:4px;font-size:11px;max-height:140px;overflow-y:auto;white-space:pre-wrap;margin:0;user-select:all;">${escapeHtml(textContent)}</pre>
      </div>`;
  };

  // 2. Active Built-in Commands (Sampled with realistic parameters)
  const activeTestPayloads = activeCmds.map((c) => {
    const p = prefix;
    switch (c.cmd) {
      case 'setrules':
        return `${p}setrules 1. Be polite and respectful.\\n2. No spam links allowed.`;
      case 'warn':
        return `${p}warn @user Violation of group rules`;
      case 'unwarn':
        return `${p}unwarn @user`;
      case 'mute':
        return `${p}mute @user 10m`;
      case 'tmute':
        return `${p}tmute @user 15m`;
      case 'tban':
        return `${p}tban @user 1h`;
      case 'kick':
        return `${p}kick @user`;
      case 'ban':
        return `${p}ban @user Rule violation`;
      case 'promote':
        return `${p}promote @user`;
      case 'demote':
        return `${p}demote @user`;
      case 'approve':
        return `${p}approve @user`;
      case 'unapprove':
        return `${p}unapprove @user`;
      case 'lock':
        return `${p}lock url`;
      case 'unlock':
        return `${p}unlock url`;
      case 'setwelcome':
        return `${p}setwelcome Welcome {mention} to {group}!`;
      case 'setgoodbye':
        return `${p}setgoodbye Goodbye {name}!`;
      case 'report':
        return `${p}report @user Inappropriate message content`;
      case 'notes':
        return `${p}notes #wifi 12345678`;
      case 'filter':
        return `${p}filter wlan -> Password is 1234`;
      case 'setlang':
        return `${p}setlang de`;
      case 'translate':
        return `${p}translate de Hello world`;
      case 'removespamlinks':
        return `${p}removespamlinks on`;
      case 'autotranslate':
        return `${p}autotranslate on`;
      case 'slowmode':
        return `${p}slowmode 10s`;
      default:
        return `${p}${c.cmd}`;
    }
  });

  html += makeCopyableBlock(
    'Built-in Moderation Commands (Sample Payloads)',
    activeTestPayloads,
    'fas fa-terminal'
  );

  // 3. Spam & Link Triggers (Telegram, WA, Chat Invites)
  const inviteTestPayloads = [
    'https://t.me/joinchat/SPAMMER123',
    'https://telegram.me/spambot_group',
    'https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv',
    'https://wa.me/491761234567',
    'https://wa.link/spamcode',
  ];
  html += makeCopyableBlock(
    'Fake Anti-Spam & Invite Link Triggers (t.me / wa.me / chat.whatsapp.com)',
    inviteTestPayloads,
    'fas fa-link'
  );

  // 4. Custom Mapped Commands
  const customCmds = config.commands?.custom_commands || [];
  if (customCmds.length > 0) {
    const customPayloads = customCmds.map((c) => `${prefix}${c.command.replace(/^[!/#]+/, '')}`);
    html += makeCopyableBlock('Configured Custom Commands', customPayloads, 'fas fa-cogs');
  }

  // 5. Auto-Responder Triggers
  const filters = config.filters || [];
  if (filters.length > 0) {
    const filterPayloads = filters.map((f) => f.trigger);
    html += makeCopyableBlock('Auto-Responder & FAQ Triggers', filterPayloads, 'fas fa-robot');
  }

  // 6. Blacklisted Words Triggers
  const blWords = config.blacklist?.words || [];
  if (blWords.length > 0) {
    html += makeCopyableBlock('Blacklist Word Triggers', blWords, 'fas fa-ban');
  }

  html += `</div>`;
  container.innerHTML = html;
  modal.classList.add('show');
}

function closeTestCommandsModal() {
  const modal = document.getElementById('test-commands-modal');
  if (modal) modal.classList.remove('show');
}
