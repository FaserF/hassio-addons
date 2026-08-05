// Moderation Core (Store, Group Selector, Rules, Greetings, Captcha, Warns, Commands)

let modStoreCache = null;
let currentModGroup = '';

async function loadModerationConfig() {
  try {
    const [modRes, chatsRes] = await Promise.all([
      fetch(basePath + 'api/moderation/config'),
      fetch(basePath + 'api/chats?session_id=' + currentSession),
    ]);

    if (modRes.ok) {
      const json = await modRes.json();
      if (json.success && json.data) {
        modStoreCache = json.data;
        const globalToggle = document.getElementById('mod-global-toggle');
        if (globalToggle) globalToggle.checked = Boolean(modStoreCache.global_enabled);
        const aiKeyEl = document.getElementById('mod-ai-key');
        if (aiKeyEl && modStoreCache.gemini_api_key !== undefined) {
          aiKeyEl.value = modStoreCache.gemini_api_key;
        }
        const globalRulesInp = document.getElementById('mod-global-rules-input');
        if (globalRulesInp && modStoreCache.global_rules !== undefined) {
          globalRulesInp.value = modStoreCache.global_rules;
        }
      }
    }

    // Populate group select dropdown from live chat list and moderation store
    const select = document.getElementById('mod-group-select');
    if (select) {
      const groupMap = new Map();
      if (chatsRes.ok) {
        const chats = await chatsRes.json();
        if (Array.isArray(chats)) {
          chats.forEach((c) => {
            const jid = c.jid || c.id;
            if (jid && jid.endsWith('@g.us')) {
              groupMap.set(jid, { id: jid, name: c.name || jid });
            }
          });
        }
      }
      // Also include any groups already saved in the moderation store
      if (modStoreCache && modStoreCache.groups) {
        Object.keys(modStoreCache.groups).forEach((gId) => {
          if (gId.endsWith('@g.us') && !groupMap.has(gId)) {
            const fallbackName = `Group (${gId.split('@')[0]})`;
            groupMap.set(gId, { id: gId, name: fallbackName });
          }
        });
      }

      const groups = Array.from(groupMap.values());
      const preserved = select.value;
      let opts = '<option value="">Select a group...</option>';
      groups.forEach((g) => {
        opts += `<option value="${g.id}"${g.id === preserved ? ' selected' : ''}>${g.name}</option>`;
      });
      select.innerHTML = opts;
      if (preserved && groupMap.has(preserved)) {
        select.value = preserved;
      }
      selectModerationGroup(select.value);
    }
    updateFedBlacklistTagsInUi();
  } catch (e) {
    console.error('Failed to load moderation config:', e);
  }
}

async function saveGlobalRulesInline() {
  const rules = document.getElementById('mod-global-rules-input')?.value || '';
  try {
    const res = await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_rules: rules }),
    });
    if (res.ok) {
      showToast('Global default rules saved successfully! 🌐', 'success');
      loadModerationConfig();
    }
  } catch (e) {
    showToast('Failed to save global rules', 'danger');
  }
}

function openGlobalRulesModal() {
  const modal = document.getElementById('global-rules-modal');
  if (modal) {
    const globalRulesInp = document.getElementById('mod-global-rules-input');
    if (globalRulesInp && modStoreCache) {
      globalRulesInp.value = modStoreCache.global_rules || '';
    }
    modal.style.display = 'flex';
  }
}

function closeGlobalRulesModal() {
  const modal = document.getElementById('global-rules-modal');
  if (modal) modal.style.display = 'none';
}

async function saveGlobalRulesFromModal() {
  const rules = document.getElementById('mod-global-rules-input')?.value || '';
  try {
    const res = await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_rules: rules }),
    });
    if (res.ok) {
      showToast('Global rules saved successfully! 🌐', 'success');
      closeGlobalRulesModal();
      loadModerationConfig();
    }
  } catch (e) {
    showToast('Failed to save global rules', 'danger');
  }
}

async function toggleGlobalModeration(enabled) {
  try {
    const res = await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_enabled: enabled }),
    });
    if (res.ok) {
      showToast(enabled ? 'Global Moderation Enabled 🛡️' : 'Global Moderation Disabled', 'info');
      loadModerationConfig();
    }
  } catch (e) {
    showToast('Failed to toggle global moderation', 'danger');
  }
}

function selectModerationGroup(groupId) {
  currentModGroup = groupId;
  const contentCard = document.getElementById('mod-group-content');
  const placeholderCard = document.getElementById('mod-no-group-placeholder');

  if (!groupId) {
    if (contentCard) contentCard.style.display = 'none';
    if (placeholderCard) placeholderCard.style.display = 'block';
    return;
  }

  if (contentCard) contentCard.style.display = 'block';
  if (placeholderCard) placeholderCard.style.display = 'none';

  if (!modStoreCache) return;
  const config = modStoreCache.groups?.[groupId] || {};

  const titleEl = document.getElementById('mod-active-group-title');
  if (titleEl) {
    const groupSelect = document.getElementById('mod-group-select');
    const selectedOpt = groupSelect ? groupSelect.options[groupSelect.selectedIndex] : null;
    const name = selectedOpt ? selectedOpt.text : groupId;
    titleEl.innerHTML = `<i class="fas fa-users-cog"></i> ${escapeHtml(name)}`;
  }

  const toggle = document.getElementById('mod-group-toggle');
  if (toggle) toggle.checked = Boolean(config.enabled);

  // Rules
  const rulesText = document.getElementById('mod-rules-text');
  if (rulesText) rulesText.value = config.rules?.text || '';
  const rulesShow = document.getElementById('mod-rules-show-on-join');
  if (rulesShow) rulesShow.checked = Boolean(config.rules?.show_on_join);

  // Greetings
  const welcE = document.getElementById('mod-welcome-enabled');
  if (welcE) welcE.checked = Boolean(config.greetings?.welcome_enabled);
  const welcM = document.getElementById('mod-welcome-msg');
  if (welcM) welcM.value = config.greetings?.welcome_message || '';
  const goodE = document.getElementById('mod-goodbye-enabled');
  if (goodE) goodE.checked = Boolean(config.greetings?.goodbye_enabled);
  const goodM =
    document.getElementById('mod-goodbye-msg') || document.getElementById('mod-goodbye-message');
  if (goodM)
    goodM.value = config.greetings?.goodbye_message || config.greetings?.goodbye_text || '';

  // Captcha
  const capE = document.getElementById('mod-captcha-enabled');
  if (capE) capE.checked = Boolean(config.greetings?.captcha_enabled);
  const capMode = document.getElementById('mod-captcha-mode');
  if (capMode) capMode.value = config.greetings?.captcha_mode || 'button';
  const capTime = document.getElementById('mod-captcha-timeout');
  if (capTime) capTime.value = config.greetings?.captcha_timeout_seconds || 120;

  // Warnings
  const maxW = document.getElementById('mod-max-warns');
  if (maxW) maxW.value = config.warnings?.max_warnings || 3;
  const wAct = document.getElementById('mod-warn-action');
  if (wAct) wAct.value = config.warnings?.action || 'mute';

  // Warns List UI
  const warnList = document.getElementById('mod-warns-list');
  if (warnList) {
    const userWarns = config.warnings?.user_warns || {};
    const entries = Object.keys(userWarns).filter((u) => userWarns[u]?.length);
    if (!entries.length) {
      warnList.innerHTML = '<div class="empty-state">No active user warnings</div>';
    } else {
      warnList.innerHTML = entries
        .map(
          (u) => `
        <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;">
          <div><strong>@${u}</strong>: ${userWarns[u].length} warning(s)</div>
          <button class="btn btn-secondary btn-sm" onclick="clearUserWarnInUi('${u}')">Clear</button>
        </div>`
        )
        .join('');
    }
  }

  const BUILTIN_COMMANDS_LIST = [
    { cmd: 'help', label: '!help' },
    { cmd: 'ping', label: '!ping' },
    { cmd: 'id', label: '!id' },
    { cmd: 'rules', label: '!rules' },
    { cmd: 'info', label: '!info' },
    { cmd: 'adminlist', label: '!adminlist' },
    { cmd: 'locktypes', label: '!locktypes' },
    { cmd: 'translate', label: '!translate' },
    { cmd: 'warn', label: '!warn' },
    { cmd: 'warns', label: '!warns' },
    { cmd: 'unwarn', label: '!unwarn' },
    { cmd: 'kick', label: '!kick' },
    { cmd: 'ban', label: '!ban' },
    { cmd: 'mute', label: '!mute' },
    { cmd: 'unmute', label: '!unmute' },
    { cmd: 'tban', label: '!tban' },
    { cmd: 'tmute', label: '!tmute' },
    { cmd: 'promote', label: '!promote' },
    { cmd: 'demote', label: '!demote' },
    { cmd: 'setrules', label: '!setrules' },
    { cmd: 'lock', label: '!lock' },
    { cmd: 'unlock', label: '!unlock' },
    { cmd: 'locks', label: '!locks' },
    { cmd: 'report', label: '!report' },
    { cmd: 'notes', label: '!notes' },
    { cmd: 'save', label: '!save' },
    { cmd: 'get', label: '!get' },
    { cmd: 'filter', label: '!filter' },
    { cmd: 'filters', label: '!filters' },
    { cmd: 'stop', label: '!stop' },
    { cmd: 'welcome', label: '!welcome' },
    { cmd: 'goodbye', label: '!goodbye' },
    { cmd: 'del', label: '!del' },
    { cmd: 'setlang', label: '!setlang' },
  ];

  // Commands
  const cmdsEnabled = document.getElementById('mod-cmds-enabled');
  if (cmdsEnabled) cmdsEnabled.checked = Boolean(config.commands?.enabled);
  const cmdsPrefix = document.getElementById('mod-cmds-prefix');
  if (cmdsPrefix) cmdsPrefix.value = config.commands?.prefix || '!';
  const cmdsMute = document.getElementById('mod-cmds-mute-action');
  if (cmdsMute) cmdsMute.value = config.commands?.mute_action || 'delete';

  // Default Commands Grid UI
  const defaultCmdsGrid = document.getElementById('mod-default-cmds-grid');
  if (defaultCmdsGrid) {
    const disabledCmds = config.commands?.disabled_commands || [];
    defaultCmdsGrid.innerHTML = BUILTIN_COMMANDS_LIST.map(
      (c) => `
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:4px 6px;border-radius:4px;background:var(--card-bg);border:1px solid var(--border-color);">
        <input type="checkbox" class="mod-default-cmd-toggle" data-cmd="${c.cmd}"${!disabledCmds.includes(c.cmd) ? ' checked' : ''}>
        <span><code>${escapeHtml(config.commands?.prefix || '!')}${c.cmd}</code></span>
      </label>`
    ).join('');
  }

  // Custom Commands List UI
  const customCmdsList = document.getElementById('mod-custom-cmds-list');
  if (customCmdsList) {
    const customCmds = config.commands?.custom_commands || [];
    if (!customCmds.length) {
      customCmdsList.innerHTML =
        '<div class="empty-state" style="color:var(--text-muted);font-size:12px;padding:8px 0;">No custom mapped commands added yet</div>';
    } else {
      customCmdsList.innerHTML = customCmds
        .map(
          (c, idx) => `
        <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;">
          <div>
            <strong style="color:var(--primary);">${escapeHtml(config.commands?.prefix || '!')}${escapeHtml(c.command)}</strong> 
            ${c.admin_only ? '<span style="font-size:10px;background:rgba(231,76,60,0.15);color:#e74c3c;padding:2px 6px;border-radius:4px;margin-left:6px;">Admin Only</span>' : ''}
            &rarr; <span style="color:var(--text-main);">${escapeHtml(c.response)}</span>
          </div>
          <button class="btn btn-secondary btn-sm" style="color:#e74c3c;padding:2px 8px;" onclick="removeCustomCommandRule(${idx})"><i class="fas fa-trash"></i></button>
        </div>`
        )
        .join('');
    }
  }

  // AI & Translation
  const aiEnabled = document.getElementById('mod-ai-enabled');
  if (aiEnabled) aiEnabled.checked = Boolean(config.ai?.enabled);
  const aiFaq = document.getElementById('mod-ai-faq');
  if (aiFaq) aiFaq.checked = Boolean(config.ai?.faq_auto_reply);
  const aiSentiment = document.getElementById('mod-ai-sentiment');
  if (aiSentiment) aiSentiment.checked = Boolean(config.ai?.sentiment_moderation);
  const aiPrompt = document.getElementById('mod-ai-prompt');
  if (aiPrompt)
    aiPrompt.value = config.ai?.system_prompt || 'You are a helpful group moderator AI assistant.';
  const transLang = document.getElementById('mod-trans-lang');
  if (transLang) transLang.value = config.translation?.target_lang || 'en';
  const transMode = document.getElementById('mod-trans-mode');
  if (transMode) transMode.value = config.translation?.mode || 'manual';

  // Anti-Spam & Anti-Raid
  const floodE = document.getElementById('mod-flood-enabled');
  if (floodE) floodE.checked = Boolean(config.antispam?.flood_protection?.enabled);
  const floodMax = document.getElementById('mod-flood-max');
  if (floodMax) floodMax.value = config.antispam?.flood_protection?.max_messages || 5;
  const floodWin = document.getElementById('mod-flood-win');
  if (floodWin) floodWin.value = config.antispam?.flood_protection?.window_seconds || 5;

  const raidE = document.getElementById('mod-antiraid-enabled');
  if (raidE) raidE.checked = Boolean(config.antispam?.anti_raid?.enabled);
  const raidMax = document.getElementById('mod-antiraid-max');
  if (raidMax) raidMax.value = config.antispam?.anti_raid?.max_joins || 5;
  const raidWin = document.getElementById('mod-antiraid-win');
  if (raidWin) raidWin.value = config.antispam?.anti_raid?.window_seconds || 10;

  // Locks
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
  lockKeys.forEach((key) => {
    const el = document.getElementById(`mod-lock-${key}`);
    if (el) el.checked = Boolean(config.locks?.[key]?.enabled);
  });

  // Blacklist Tag Cloud
  const blTags = document.getElementById('mod-blacklist-tags');
  if (blTags) {
    const words = config.blacklist?.words || [];
    if (!words.length) {
      blTags.innerHTML =
        '<span style="color:var(--text-muted);font-size:12px;">No blacklisted words or patterns yet</span>';
    } else {
      blTags.innerHTML = words
        .map(
          (w, idx) => `
        <span class="mod-tag" style="display:inline-flex;align-items:center;gap:6px;background:rgba(231,76,60,0.15);color:#e74c3c;border:1px solid rgba(231,76,60,0.3);padding:4px 10px;border-radius:16px;font-size:12px;margin:3px;">
          <span>${escapeHtml(w)}</span>
          <button style="background:none;border:none;color:#e74c3c;cursor:pointer;padding:0;font-size:14px;line-height:1;" onclick="removeBlacklistWord(${idx})">&times;</button>
        </span>`
        )
        .join('');
    }
  }

  // Filters List
  const filtersList = document.getElementById('mod-filters-list');
  if (filtersList) {
    const filters = config.filters || [];
    if (!filters.length) {
      filtersList.innerHTML =
        '<div class="empty-state" style="color:var(--text-muted);font-size:12px;padding:8px 0;">No filter rules configured yet</div>';
    } else {
      filtersList.innerHTML = filters
        .map(
          (f, idx) => `
        <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;">
          <div>
            <strong style="color:var(--primary);">${escapeHtml(f.trigger)}</strong> &rarr; <span style="color:var(--text-main);">${escapeHtml(f.response)}</span>
          </div>
          <button class="btn btn-secondary btn-sm" style="color:#e74c3c;padding:2px 8px;" onclick="removeFilterRule(${idx})"><i class="fas fa-trash"></i></button>
        </div>`
        )
        .join('');
    }
  }

  // Federation Select & Shared Blacklist Tags
  const fedSelect = document.getElementById('mod-fed-select');
  if (fedSelect && modStoreCache?.federations) {
    const activeFedId = config.federation_id || 'fed_global_default';
    let opts = '<option value="">No Federation Joined</option>';
    modStoreCache.federations.forEach((f) => {
      opts += `<option value="${f.id}"${f.id === activeFedId ? ' selected' : ''}>${escapeHtml(f.name || f.id)}</option>`;
    });
    fedSelect.innerHTML = opts;
    fedSelect.value = activeFedId;
  }
  updateFedBlacklistTagsInUi();
}

async function toggleGroupModeration(enabled) {
  if (!currentModGroup) return;
  const url =
    basePath +
    `api/moderation/groups/${encodeURIComponent(currentModGroup)}/${enabled ? 'enable' : 'disable'}`;
  try {
    const res = await fetch(url, { method: 'POST' });
    if (res.ok) {
      showToast(enabled ? 'Group Moderation Enabled' : 'Group Moderation Disabled', 'success');
      loadModerationConfig();
    }
  } catch (e) {
    showToast('Failed to update group moderation', 'danger');
  }
}

function switchModSubTab(subTab) {
  // Hide all panels
  const panels = document.querySelectorAll('.mod-subpanel');
  panels.forEach((p) => (p.style.display = 'none'));
  const activeP = document.getElementById(`mod-subpanel-${subTab}`);
  if (activeP) activeP.style.display = 'block';

  // Update active button state
  const subTabBar = document.querySelector('#tab-moderation .mod-subtab-bar');
  if (subTabBar) {
    subTabBar.querySelectorAll('button').forEach((btn) => btn.classList.remove('active'));
    const activeBtn = subTabBar.querySelector(`[data-subtab="${subTab}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }
}

async function saveGroupRules() {
  if (!currentModGroup) return showToast('Please select a group', 'warning');
  const text = document.getElementById('mod-rules-text')?.value || '';
  const showOnJoin = Boolean(document.getElementById('mod-rules-show-on-join')?.checked);

  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.rules = { text, show_on_join: showOnJoin };

  await saveGroupConfig(groupConfig);
  showToast('Group rules saved!', 'success');
}

async function saveGroupGreetings() {
  if (!currentModGroup) return showToast('Please select a group', 'warning');
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.greetings = {
    welcome_enabled: Boolean(document.getElementById('mod-welcome-enabled')?.checked),
    welcome_message: document.getElementById('mod-welcome-msg')?.value || '',
    goodbye_enabled: Boolean(document.getElementById('mod-goodbye-enabled')?.checked),
    goodbye_message: document.getElementById('mod-goodbye-msg')?.value || '',
    captcha_enabled: Boolean(document.getElementById('mod-captcha-enabled')?.checked),
    captcha_mode: document.getElementById('mod-captcha-mode')?.value || 'button',
    captcha_timeout_seconds:
      parseInt(document.getElementById('mod-captcha-timeout')?.value, 10) || 120,
  };
  await saveGroupConfig(groupConfig);
  showToast('Greetings & Captcha saved!', 'success');
}

async function saveGroupWarnings() {
  if (!currentModGroup) return showToast('Please select a group', 'warning');
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.warnings = {
    ...(groupConfig.warnings || {}),
    max_warnings: parseInt(document.getElementById('mod-max-warns')?.value, 10) || 3,
    action: document.getElementById('mod-warn-action')?.value || 'mute',
  };
  await saveGroupConfig(groupConfig);
  showToast('Warnings config saved!', 'success');
}

async function saveGroupCommands() {
  if (!currentModGroup) return showToast('Please select a group', 'warning');

  const enabled = Boolean(document.getElementById('mod-cmds-enabled')?.checked);
  const prefix = document.getElementById('mod-cmds-prefix')?.value || '!';
  const mute_action = document.getElementById('mod-cmds-mute-action')?.value || 'delete';

  const disabledCmds = [];
  document.querySelectorAll('.mod-default-cmd-toggle').forEach((cb) => {
    if (!cb.checked) {
      disabledCmds.push(cb.dataset.cmd);
    }
  });

  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.commands = {
    ...(groupConfig.commands || {}),
    enabled,
    prefix,
    mute_action,
    disabled_commands: disabledCmds,
  };

  await saveGroupConfig(groupConfig);
  showToast('Commands configuration saved!', 'success');
}

function toggleAllDefaultCommands(enable) {
  document.querySelectorAll('.mod-default-cmd-toggle').forEach((cb) => {
    cb.checked = Boolean(enable);
  });
}

async function addCustomCommandRule() {
  const nameInp = document.getElementById('mod-cmd-name');
  const respInp = document.getElementById('mod-cmd-response');
  const adminOnlyInp = document.getElementById('mod-cmd-admin-only');

  const name = nameInp?.value.trim().replace(/^[!/#]+/, '');
  const resp = respInp?.value.trim();
  const adminOnly = Boolean(adminOnlyInp?.checked);

  if (!name || !resp || !currentModGroup) return;

  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.commands = groupConfig.commands || {
    enabled: true,
    prefix: '!',
    mute_action: 'delete',
  };
  groupConfig.commands.custom_commands = groupConfig.commands.custom_commands || [];
  groupConfig.commands.custom_commands.push({
    command: name,
    response: resp,
    admin_only: adminOnly,
  });

  if (nameInp) nameInp.value = '';
  if (respInp) respInp.value = '';
  if (adminOnlyInp) adminOnlyInp.checked = false;

  await saveGroupConfig(groupConfig);
  showToast(`Custom command !${name} added!`, 'success');
  selectModerationGroup(currentModGroup);
  setTimeout(() => {
    if (nameInp) nameInp.focus();
  }, 50);
}

async function removeCustomCommandRule(idx) {
  if (!currentModGroup || !modStoreCache?.groups?.[currentModGroup]) return;
  const groupConfig = modStoreCache.groups[currentModGroup];
  if (groupConfig.commands?.custom_commands) {
    groupConfig.commands.custom_commands.splice(idx, 1);
    await saveGroupConfig(groupConfig);
    selectModerationGroup(currentModGroup);
  }
}

async function clearUserWarnInUi(userId) {
  if (!currentModGroup || !userId) return;
  try {
    const res = await fetch(
      basePath +
        `api/moderation/groups/${encodeURIComponent(currentModGroup)}/warn/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      }
    );
    if (res.ok) {
      showToast(`Warnings cleared for @${userId}`, 'success');
      loadModerationConfig();
      setTimeout(() => selectModerationGroup(currentModGroup), 200);
    }
  } catch (e) {
    showToast('Failed to clear warnings', 'danger');
  }
}
