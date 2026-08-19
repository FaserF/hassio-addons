// Moderation Core (Store, Group Selector, Rules, Greetings, Captcha, Warns, Commands)

let modStoreCache = null;
let currentModGroup = '';
let currentModSubTab = 'core';
let builtinCommandsCache = [];

// ── Dirty / Unsaved-Changes Tracking ─────────────────────────────────────────
const _dirty = {
  isDirty: false,
  panelId: null, // e.g. 'rules', 'greetings', …
  panelLabel: null, // human-readable label shown in the modal
  saveFn: null, // async function to call when user picks "Save & Switch"
  onProceed: null, // callback executed after save OR discard
};

// Snapshot of all tracked field values taken when a group is loaded or saved.
// Used to detect changes without relying on fragile event delegation.
let _formSnapshot = null;

const SUB_PANEL_LABELS = {
  rules: 'Rules',
  greetings: 'Greetings & Captcha',
  warnings: 'Warnings',
  locks: 'Locks',
  blacklist: 'Blacklist',
  filters: 'Filters',
  antispam: 'Anti-Spam',
  federation: 'Federation',
  ai: 'Gemini AI',
  commands: 'Commands',
  migration: 'Import/Export',
};

const SAVE_FN_MAP = {
  rules: () => saveGroupRules(),
  greetings: () => saveGroupGreetings(),
  warnings: () => saveGroupWarnings(),
  locks: () => saveGroupLocks(),
  blacklist: () => saveGroupBlacklist(),
  filters: () => saveGroupFilters(),
  antispam: () => saveGroupAntispam(),
  federation: () => saveGroupFederation(),
  ai: () => saveGroupAiConfig(),
  commands: () => saveGroupCommands(),
};

// IDs of all fields we track for changes (inputs, selects, textareas).
const TRACKED_FIELD_IDS = [
  'mod-rules-text',
  'mod-rules-show-on-join',
  'mod-welcome-enabled',
  'mod-welcome-msg',
  'mod-welcome-target',
  'mod-goodbye-enabled',
  'mod-goodbye-msg',
  'mod-goodbye-target',
  'mod-captcha-enabled',
  'mod-captcha-mode',
  'mod-captcha-timeout',
  'mod-max-warns',
  'mod-warn-action',
  'mod-lock-image',
  'mod-lock-video',
  'mod-lock-audio',
  'mod-lock-document',
  'mod-lock-sticker',
  'mod-lock-url',
  'mod-lock-invite',
  'mod-lock-poll',
  'mod-lock-contact',
  'mod-lock-location',
  'mod-lock-forwarded',
  'mod-lock-rtl',
  'mod-blacklist-mode',
  'mod-flood-enabled',
  'mod-flood-max',
  'mod-flood-win',
  'mod-antiraid-enabled',
  'mod-antiraid-max',
  'mod-antiraid-win',
  'mod-antispam-links-enabled',
  'mod-antispam-bot-enabled',
  'mod-notify-deleted-action',
  'mod-notify-bypassed-actions',
  'mod-ai-provider',
  'mod-ai-enabled',
  'mod-ai-faq',
  'mod-ai-sentiment',
  'mod-ai-prompt',
  'mod-ai-key',
  'mod-stt-enabled',
  'mod-trans-lang',
  'mod-trans-mode',
  'mod-fed-select',
  'mod-cmds-enabled',
  'mod-cmds-multi-enabled',
  'mod-cmds-prefix',
  'mod-cmds-mute-action',
];

/** Capture current values of all tracked fields into a snapshot. */
function _captureSnapshot() {
  const snap = {};
  for (const id of TRACKED_FIELD_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    snap[id] = el.type === 'checkbox' ? el.checked : el.value;
  }
  _formSnapshot = snap;
}

/** Compare current field values to snapshot. Returns true if anything changed. */
function _isSnapshotDirty() {
  if (!_formSnapshot) return false;
  for (const id of TRACKED_FIELD_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const current = el.type === 'checkbox' ? el.checked : el.value;
    if (current !== _formSnapshot[id]) return true;
  }
  return false;
}

/** Find which sub-panel contains the first changed field. */
function _getDirtyPanel() {
  if (!_formSnapshot) return null;
  for (const id of TRACKED_FIELD_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const current = el.type === 'checkbox' ? el.checked : el.value;
    if (current !== _formSnapshot[id]) {
      const panel = el.closest('.mod-subpanel');
      if (panel) return panel.id.replace('mod-subpanel-', '');
    }
  }
  return null;
}

/** Call this whenever a tracked input changes. */
function markDirty(panelId) {
  _dirty.isDirty = true;
  _dirty.panelId = panelId;
  _dirty.panelLabel = SUB_PANEL_LABELS[panelId] || panelId;
  _dirty.saveFn = SAVE_FN_MAP[panelId] || null;
  _updateDirtyIndicator(panelId);
}

/** Call this after a successful save or discard to clear dirty state. */
function markClean() {
  _dirty.isDirty = false;
  _dirty.panelId = null;
  _dirty.panelLabel = null;
  _dirty.saveFn = null;
  _dirty.onProceed = null;
  _captureSnapshot();
  document.querySelectorAll('.mod-pill.dirty').forEach((b) => b.classList.remove('dirty'));
}

function _updateDirtyIndicator(panelId) {
  document.querySelectorAll('.mod-pill.dirty').forEach((b) => b.classList.remove('dirty'));
  const pill = document.querySelector(`.mod-pill[data-subtab="${panelId}"]`);
  if (pill) pill.classList.add('dirty');
}

/**
 * Check dirty state before switching. Uses snapshot comparison as the
 * primary check (reliable across all browsers) and falls back to the
 * _dirty.isDirty flag for non-field changes (e.g. added filter rows).
 */
function _guardDirty(proceedFn) {
  // First, do a snapshot comparison to catch any field edits
  if (_isSnapshotDirty()) {
    const panelId = _getDirtyPanel() || _dirty.panelId || 'settings';
    _dirty.isDirty = true;
    _dirty.panelId = panelId;
    _dirty.panelLabel = SUB_PANEL_LABELS[panelId] || panelId;
    _dirty.saveFn = SAVE_FN_MAP[panelId] || null;
    _updateDirtyIndicator(panelId);
  }

  if (!_dirty.isDirty) return true; // no changes – proceed

  _dirty.onProceed = proceedFn;
  const modal = document.getElementById('unsaved-changes-modal');
  const nameEl = document.getElementById('unsaved-panel-name');
  if (nameEl)
    nameEl.textContent =
      _dirty.panelLabel || (window.t ? window.t('moderation.this_section') : 'this section');
  if (modal) modal.classList.add('show');
  return false;
}

function _closeUnsavedModal() {
  const modal = document.getElementById('unsaved-changes-modal');
  if (modal) modal.classList.remove('show');
}

// Called by modal button "Stay"
function unsavedModalCancel() {
  _dirty.onProceed = null;
  _closeUnsavedModal();
}

// Called by modal button "Discard"
function unsavedModalDiscard() {
  const proceed = _dirty.onProceed;
  // Revert UI fields back to the last saved snapshot values
  if (_formSnapshot) {
    for (const id of TRACKED_FIELD_IDS) {
      const el = document.getElementById(id);
      if (!el || _formSnapshot[id] === undefined) continue;
      if (el.type === 'checkbox') {
        el.checked = Boolean(_formSnapshot[id]);
      } else {
        el.value = _formSnapshot[id];
      }
    }
  }
  markClean();
  _closeUnsavedModal();
  if (proceed) proceed();
}

// Called by modal button "Save & Switch"
async function unsavedModalSaveAndSwitch() {
  const proceed = _dirty.onProceed;
  const saveFn = _dirty.saveFn;
  _closeUnsavedModal();
  if (saveFn) {
    try {
      await saveFn();
    } catch (e) {
      console.error('Auto-save failed', e);
    }
  }
  markClean();
  if (proceed) proceed();
}
function updateModerationDisabledState() {
  const globalToggle = document.getElementById('mod-global-toggle');
  const isGlobalEnabled = globalToggle ? globalToggle.checked : true;

  const tab = document.getElementById('tab-moderation');
  if (!tab) return;

  // 1) Global moderation toggle: disable all settings cards if global is off
  const settingsCards = tab.querySelectorAll('.mod-settings-card, .mod-grid, .card');
  settingsCards.forEach((card) => {
    if (card.closest('.mod-hero')) return;

    if (!isGlobalEnabled) {
      card.classList.add('disabled-section');
      card.querySelectorAll('input, select, button, textarea').forEach((el) => {
        if (el.id !== 'mod-global-toggle') el.disabled = true;
      });
    } else {
      card.classList.remove('disabled-section');
      card.querySelectorAll('input, select, button, textarea').forEach((el) => {
        el.disabled = false;
      });
    }
  });

  // 2) Group-level toggle: disable group sub-panels if group moderation is disabled
  const groupToggle = document.getElementById('mod-group-toggle');
  const isGroupEnabled = groupToggle ? groupToggle.checked : true;
  if (isGlobalEnabled && typeof currentModGroup !== 'undefined' && currentModGroup) {
    const groupContent = document.getElementById('mod-group-content');
    if (groupContent) {
      const subCards = groupContent.querySelectorAll('.mod-settings-card, .mod-sub-panel, .card');
      subCards.forEach((card) => {
        if (!isGroupEnabled) {
          card.classList.add('disabled-section');
          card.querySelectorAll('input, select, button, textarea').forEach((el) => {
            if (el.id !== 'mod-group-toggle') el.disabled = true;
          });
        } else {
          card.classList.remove('disabled-section');
          card.querySelectorAll('input, select, button, textarea').forEach((el) => {
            el.disabled = false;
          });
        }
      });
    }
  }
}

let _isLoadingModConfig = false;
async function loadModerationConfig() {
  if (_isLoadingModConfig) return;
  _isLoadingModConfig = true;
  try {
    const [modRes, chatsRes, cmdsRes] = await Promise.all([
      fetch(basePath + 'api/moderation/config'),
      fetch(basePath + 'api/chats?session_id=' + currentSession),
      fetch(basePath + 'api/moderation/commands'),
    ]);

    // Cache built-in commands once at load time
    try {
      if (cmdsRes.ok) {
        const cmdsJson = await cmdsRes.json();
        if (cmdsJson.success && Array.isArray(cmdsJson.data) && cmdsJson.data.length > 0) {
          builtinCommandsCache = cmdsJson.data;
        }
      }
    } catch (cmdsErr) {
      console.warn('Failed to load built-in commands list:', cmdsErr);
    }

    if (modRes.ok) {
      const json = await modRes.json();
      if (json.success && json.data) {
        modStoreCache = json.data;
        const globalToggle = document.getElementById('mod-global-toggle');
        if (globalToggle) globalToggle.checked = Boolean(modStoreCache.global_enabled);
        const aiKeyEl =
          document.getElementById('mod-ai-api-key') || document.getElementById('mod-ai-key');
        const aiKeyHint = document.getElementById('mod-ai-key-hint');
        if (aiKeyEl) {
          if (modStoreCache.gemini_api_key) {
            aiKeyEl.value = modStoreCache.gemini_api_key;
          } else {
            aiKeyEl.value = '';
            if (modStoreCache.ha_gemini_detected) {
              aiKeyEl.placeholder = '✨ (Optional) Auto-detected from Home Assistant';
              if (aiKeyHint) {
                aiKeyHint.textContent = `✨ Key is automatically used from ${modStoreCache.ha_gemini_source || 'Home Assistant'}. Enter a custom key only if you want to override it.`;
              }
            }
          }
        }
        const globalRulesInp = document.getElementById('mod-global-rules-input');
        if (globalRulesInp && modStoreCache.global_rules !== undefined) {
          globalRulesInp.value = modStoreCache.global_rules;
        }

        // Missed messages settings
        const missedEnabledEl = document.getElementById('mod-missed-enabled');
        const missedLookbackEl = document.getElementById('mod-missed-lookback');
        const missedNotifyEl = document.getElementById('mod-missed-notify');
        const missedCfg = modStoreCache.missed_messages || {};

        if (missedEnabledEl) {
          missedEnabledEl.checked = missedCfg.enabled !== false;
        }
        if (missedLookbackEl) {
          missedLookbackEl.value = missedCfg.lookback_hours ?? 3;
        }
        if (missedNotifyEl) {
          missedNotifyEl.checked = Boolean(missedCfg.notify_skipped);
        }

        updateModerationDisabledState();
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
      let preserved = select.value;
      if (
        window.initialUrlState &&
        window.initialUrlState.tab === 'moderation' &&
        window.initialUrlState.params
      ) {
        if (window.initialUrlState.params.group) {
          const restoreGroup = window.initialUrlState.params.group;
          delete window.initialUrlState.params.group;
          if (groupMap.has(restoreGroup)) {
            preserved = restoreGroup;
          }
        }
        if (window.initialUrlState.params.subtab) {
          const restoreSubTab = window.initialUrlState.params.subtab;
          delete window.initialUrlState.params.subtab;
          _doSwitchModSubTab(restoreSubTab);
        }
      }
      const selectLabel =
        window.t && window.t('moderation.select_group') !== 'moderation.select_group'
          ? window.t('moderation.select_group')
          : 'Select a Group to Configure';
      let opts = `<option value="" data-i18n="moderation.select_group">${selectLabel}</option>`;
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
  } finally {
    _isLoadingModConfig = false;
  }
}

async function saveGlobalRulesInline() {
  const rules = document.getElementById('mod-global-rules-input')?.value || '';
  const missedEnabled = document.getElementById('mod-missed-enabled')?.checked ?? true;
  const missedLookback = parseInt(document.getElementById('mod-missed-lookback')?.value, 10) || 3;
  const missedNotify = document.getElementById('mod-missed-notify')?.checked ?? false;

  try {
    const res = await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        global_rules: rules,
        missed_messages: {
          enabled: missedEnabled,
          lookback_hours: missedLookback,
          notify_skipped: missedNotify,
        },
      }),
    });
    if (res.ok) {
      showToast(t('moderation.global_rules_saved'), 'success');
      loadModerationConfig();
    }
  } catch (e) {
    showToast(t('moderation.global_rules_save_failed'), 'danger');
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
      showToast(t('moderation.global_rules_saved'), 'success');
      closeGlobalRulesModal();
      loadModerationConfig();
    }
  } catch (e) {
    showToast(t('moderation.global_rules_save_failed'), 'danger');
  }
}

async function toggleGlobalModeration(enabled) {
  try {
    updateModerationDisabledState();
    const res = await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_enabled: enabled }),
    });
    if (res.ok) {
      showToast(enabled ? t('moderation.global_enabled') : t('moderation.global_disabled'), 'info');
      loadModerationConfig();
    }
  } catch (e) {
    showToast(t('moderation.global_toggle_failed'), 'danger');
  }
}

async function selectModerationGroup(groupId) {
  currentModGroup = groupId;
  if (window.updateUrlState) {
    const params = {};
    if (groupId) params.group = groupId;
    if (currentModSubTab && currentModSubTab !== 'core') params.subtab = currentModSubTab;
    window.updateUrlState('moderation', params);
  }
  const contentCard = document.getElementById('mod-group-content');
  const placeholderCard = document.getElementById('mod-no-group-placeholder');

  if (!groupId) {
    if (contentCard) contentCard.style.display = 'none';
    if (placeholderCard) placeholderCard.style.display = 'block';
    return;
  }

  if (contentCard) contentCard.style.display = 'block';
  if (placeholderCard) placeholderCard.style.display = 'none';

  // Clear any pending dirty state when switching groups
  markClean();

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
  const groupLang = document.getElementById('mod-group-language-select');
  if (groupLang) groupLang.value = config.language || 'en';

  // Greetings
  const welcE = document.getElementById('mod-welcome-enabled');
  if (welcE) welcE.checked = Boolean(config.greetings?.welcome_enabled);
  const welcM = document.getElementById('mod-welcome-msg');
  if (welcM) welcM.value = config.greetings?.welcome_message || '';
  const welcT = document.getElementById('mod-welcome-target');
  if (welcT) welcT.value = config.greetings?.welcome_target || 'private';
  const goodE = document.getElementById('mod-goodbye-enabled');
  if (goodE) goodE.checked = Boolean(config.greetings?.goodbye_enabled);
  const goodM =
    document.getElementById('mod-goodbye-msg') || document.getElementById('mod-goodbye-message');
  if (goodM)
    goodM.value = config.greetings?.goodbye_message || config.greetings?.goodbye_text || '';
  const goodT = document.getElementById('mod-goodbye-target');
  if (goodT) goodT.value = config.greetings?.goodbye_target || 'private';

  // Captcha
  const capE = document.getElementById('mod-captcha-enabled');
  if (capE) {
    capE.checked = Boolean(config.greetings?.captcha_enabled);
    capE.onchange = () => {
      if (capE.checked) {
        loadCaptchaUsers();
      } else {
        const container = document.getElementById('mod-captcha-users-container');
        if (container) container.style.display = 'none';
      }
    };
  }
  const capMode = document.getElementById('mod-captcha-mode');
  if (capMode) capMode.value = config.greetings?.captcha_mode || 'math';
  const capTarget = document.getElementById('mod-captcha-target');
  if (capTarget) capTarget.value = config.greetings?.captcha_target || 'private';
  const capTime = document.getElementById('mod-captcha-timeout');
  if (capTime) capTime.value = config.greetings?.captcha_timeout_seconds || 120;
  const namePrio = document.getElementById('mod-name-priority');
  if (namePrio) namePrio.value = config.greetings?.name_priority || 'name_push_phone';
  const nameFall = document.getElementById('mod-name-fallback');
  if (nameFall) nameFall.value = config.greetings?.name_fallback || 'phone';

  if (capE && capE.checked) {
    loadCaptchaUsers();
  } else {
    const container = document.getElementById('mod-captcha-users-container');
    if (container) container.style.display = 'none';
  }

  // Warnings
  const maxW = document.getElementById('mod-max-warns');
  if (maxW) maxW.value = config.warnings?.max_warnings || 3;
  const wAct = document.getElementById('mod-warn-action');
  if (wAct) wAct.value = config.warnings?.action || 'mute';

  // Warns List UI
  const warnList = document.getElementById('mod-warns-list');
  if (warnList) {
    const userWarns = config.warnings?.user_warns || {};
    // Merge entries that share the same cleaned digits (resolves LID vs PN split)
    const mergedWarns = {};
    for (const key of Object.keys(userWarns)) {
      const cleanKey = key.replace(/\D/g, '') || key;
      if (!userWarns[key]?.length) continue;
      if (!mergedWarns[cleanKey]) mergedWarns[cleanKey] = [];
      mergedWarns[cleanKey].push(...userWarns[key]);
    }

    const entries = Object.keys(mergedWarns).filter((u) => mergedWarns[u]?.length);
    if (!entries.length) {
      warnList.innerHTML = `<div class="empty-state" data-i18n="moderation.no_warns">${t('moderation.no_warns')}</div>`;
    } else {
      warnList.innerHTML = entries
        .map((u) => {
          const warns = mergedWarns[u];
          const items = warns
            .map(
              (w, i) =>
                `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">` +
                `${i + 1}. ${escapeHtml(w.reason)} <span style="font-size:10px;opacity:0.8;">(${new Date(w.timestamp).toLocaleString()})</span>` +
                `</div>`
            )
            .join('');
          return `
        <div class="history-item" style="padding:12px 14px;margin-bottom:10px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <strong style="color:var(--primary);font-size:14px;">@${escapeHtml(u)}</strong>
              <span class="badge badge-warning" style="font-size:11px;padding:3px 8px;border-radius:12px;margin-left:8px;">${t('moderation.warn_badge', { count: warns.length })}</span>
            </div>
            <button class="btn btn-secondary btn-sm" style="color:#e74c3c;border-color:rgba(231,76,60,0.3);padding:3px 10px;font-size:12px;" onclick="clearUserWarnInUi('${escapeHtml(u)}')">${t('moderation.clear_all_warns')}</button>
          </div>
          <div style="border-top:1px solid var(--border-color);padding-top:6px;margin-top:6px;">
            ${items}
          </div>
        </div>`;
        })
        .join('');
    }
  }

  // Bans List UI
  const bansList = document.getElementById('mod-bans-list');
  if (bansList) {
    const bannedMap = config.banned_users || {};
    const bannedUserIds = Object.keys(bannedMap);
    if (!bannedUserIds.length) {
      bansList.innerHTML = `<div class="empty-state" data-i18n="moderation.no_bans">${t('moderation.no_bans')}</div>`;
    } else {
      bansList.innerHTML = bannedUserIds
        .map((u) => {
          const info = bannedMap[u];
          const timeStr = info.timestamp ? new Date(info.timestamp).toLocaleString() : 'N/A';
          const reasonText = escapeHtml(info.reason || t('moderation.reason_banned_default'));
          return `
        <div class="history-item" style="padding:12px 14px;margin-bottom:10px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;flex-direction:column;gap:3px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <i class="fas fa-user-slash" style="color:#ef4444;font-size:13px;"></i>
              <strong style="color:var(--text-main);font-size:14px;font-weight:600;">@${escapeHtml(u)}</strong>
            </div>
            <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
              <span>${t('moderation.reason_label_fmt', { reason: reasonText })}</span>
              <span>&middot;</span>
              <span style="opacity:0.8;font-size:11px;">${timeStr}</span>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" style="padding:5px 12px;font-size:12px;display:inline-flex;align-items:center;gap:6px;" onclick="unbanUserInUi('${escapeHtml(u)}')"><i class="fas fa-unlock"></i> ${t('moderation.unban_btn')}</button>
        </div>`;
        })
        .join('');
    }
  }

  // Kicks List UI
  const kicksList = document.getElementById('mod-kicks-list');
  if (kicksList) {
    const kickLogs = config.kick_log || [];
    if (!kickLogs.length) {
      kicksList.innerHTML = `<div class="empty-state" data-i18n="moderation.no_kicks">${t('moderation.no_kicks')}</div>`;
    } else {
      kicksList.innerHTML = kickLogs
        .map((k) => {
          const timeStr = k.timestamp ? new Date(k.timestamp).toLocaleString() : 'N/A';
          const reasonText = escapeHtml(k.reason || t('moderation.reason_kick_default'));
          return `
        <div class="history-item" style="padding:12px 14px;margin-bottom:10px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;flex-direction:column;gap:3px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <i class="fas fa-user-minus" style="color:#f59e0b;font-size:13px;"></i>
              <strong style="color:var(--text-main);font-size:14px;font-weight:600;">@${escapeHtml(k.userId)}</strong>
            </div>
            <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
              <span>${t('moderation.reason_label_fmt', { reason: reasonText })}</span>
              <span>&middot;</span>
              <span style="opacity:0.8;font-size:11px;">${timeStr}</span>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" style="color:#ef4444;border-color:rgba(239,68,68,0.3);padding:5px 12px;font-size:12px;display:inline-flex;align-items:center;gap:6px;" onclick="clearKickLogInUi('${escapeHtml(k.userId)}')"><i class="fas fa-trash-alt"></i> ${t('moderation.remove_btn')}</button>
        </div>`;
        })
        .join('');
    }
  }

  // Reports List UI
  const reportsList = document.getElementById('mod-reports-list');
  if (reportsList) {
    const reports = config.reports || [];
    if (!reports.length) {
      reportsList.innerHTML = `<div class="empty-state" data-i18n="moderation.no_reports">${t('moderation.no_reports')}</div>`;
    } else {
      reportsList.innerHTML = reports
        .slice()
        .reverse()
        .map(
          (r) => `
        <div class="history-item" style="padding:12px 14px;margin-bottom:10px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="badge ${r.status === 'resolved' ? 'badge-success' : 'badge-danger'}" style="font-size:10px;padding:3px 8px;border-radius:12px;text-transform:uppercase;">${r.status || 'open'}</span>
              <strong style="color:var(--text-main);font-size:13px;">Reporter: @${escapeHtml(r.reporter_id)}</strong>
              ${r.target_id ? `<span style="color:#ef4444;font-size:13px;">&rarr; Target: @${escapeHtml(r.target_id)}</span>` : ''}
            </div>
            ${
              r.status !== 'resolved'
                ? `<button class="btn btn-secondary btn-sm" style="padding:4px 10px;font-size:12px;display:inline-flex;align-items:center;gap:4px;" onclick="resolveReportInUi('${escapeHtml(r.id)}')"><i class="fas fa-check"></i> Resolve</button>`
                : `<span style="font-size:11px;color:var(--text-muted);display:inline-flex;align-items:center;gap:4px;"><i class="fas fa-check-circle" style="color:#10b981;"></i> Resolved</span>`
            }
          </div>
          <div style="font-size:12px;color:var(--text-main);margin-top:4px;">
            <strong>Reason:</strong> ${escapeHtml(r.reason)}
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">
            <i class="far fa-clock"></i> ${new Date(r.timestamp).toLocaleString()}
          </div>
        </div>`
        )
        .join('');
    }
  }

  // Use cached built-in commands (loaded once at startup in loadModerationConfig)
  // Fall back to a live fetch only if cache is still empty
  let builtinCommands = builtinCommandsCache;
  if (builtinCommands.length === 0) {
    try {
      const res = await fetch(basePath + 'api/moderation/commands');
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        builtinCommandsCache = json.data;
        builtinCommands = builtinCommandsCache;
      }
    } catch (err) {
      console.warn('Failed to fetch dynamic commands list:', err);
    }
  }

  // Commands Config UI
  const cmdsEnabled = document.getElementById('mod-cmds-enabled');
  if (cmdsEnabled) cmdsEnabled.checked = Boolean(config.commands?.enabled !== false);
  const cmdsMultiEnabled = document.getElementById('mod-cmds-multi-enabled');
  if (cmdsMultiEnabled) cmdsMultiEnabled.checked = Boolean(config.commands?.multi_command_enabled);
  const cmdsPrefix = document.getElementById('mod-cmds-prefix');
  if (cmdsPrefix) cmdsPrefix.value = config.commands?.prefix || '!';
  const cmdsMuteAct = document.getElementById('mod-cmds-mute-action');
  if (cmdsMuteAct) cmdsMuteAct.value = config.commands?.mute_action || 'delete';

  // Default Commands Grid UI
  const defaultCmdsGrid = document.getElementById('mod-default-cmds-grid');
  if (defaultCmdsGrid) {
    const disabledCmds = config.commands?.disabled_commands || [];
    const prefix = config.commands?.prefix || '!';

    // Base docs URL – moderation page on GitHub Pages
    const DOCS_BASE = 'https://FaserF.github.io/ha-whatsapp/moderation';

    // Map command name → docs anchor (generated from heading text in moderation.md)
    // Format: "#### N. `!cmd`" → anchor "#n-cmd" (GitHub Pages / just-the-docs convention)
    const CMD_DOC_ANCHORS = {
      help: '#1-help',
      ping: '#2-ping',
      id: '#3-id',
      rules: '#4-rules',
      info: '#5-info',
      adminlist: '#6-adminlist-alias-admins',
      admins: '#6-adminlist-alias-admins',
      admin: '#6-adminlist-alias-admins',
      approved: '#7-approved',
      locktypes: '#7-locktypes',
      report: '#8-report',
      get: '#9-get',
      notes: '#10-notes',
      filters: '#11-filters',
      translate: '#12-translate',
      tr: '#12-translate',
      warn: '#13-warn',
      unwarn: '#14-unwarn',
      warns: '#15-warns',
      kick: '#16-kick-alias-ban',
      ban: '#16-kick-alias-ban',
      tban: '#17-tban',
      mute: '#18-mute',
      tmute: '#19-tmute',
      unmute: '#20-unmute',
      del: '#21-del-alias-delete',
      delete: '#21-del-alias-delete',
      approve: '#22-approve',
      unapprove: '#23-unapprove',
      setrules: '#24-setrules',
      promote: '#25-promote',
      demote: '#26-demote',
      setwelcome: '#27-setwelcome',
      welcome: '#28-welcome',
      setgoodbye: '#29-setgoodbye',
      goodbye: '#30-goodbye',
      lock: '#31-lock',
      unlock: '#32-unlock',
      locks: '#33-locks',
      save: '#34-save',
      filter: '#35-filter',
      stop: '#36-stop',
      setlang: '#37-setlang',
      resetwarn: '#38-resetwarn-alias-rmwarn',
      rmwarn: '#38-resetwarn-alias-rmwarn',
      setwarnlimit: '#39-setwarnlimit',
      setwarnaction: '#40-setwarnaction',
      whitelist: '#41-whitelist--approve',
      unwhitelist: '#42-unwhitelist--unapprove',
      whitelisted: '#43-whitelisted',
      scan: '#44-scan',
      autotranslate: '#45-autotranslate',
      flood: '#46-flood',
      newfed: '#47-newfed',
      joinfed: '#48-joinfed',
      leavefed: '#49-leavefed',
      fban: '#50-fban',
      unfban: '#51-unfban',
      fedinfo: '#52-fedinfo',
      fbanlist: '#53-fbanlist',
      fedadmins: '#54-fedadmins',
      removespamlinks: '#55-removespamlinks',
      pin: '#56-pin',
      unpin: '#57-unpin',
      unpinall: '#58-unpinall',
      pinned: '#59-pinned',
      blacklist: '#60-blacklist',
      rmblacklist: '#61-rmblacklist--unblacklist',
      unblacklist: '#61-rmblacklist--unblacklist',
      setblacklistaction: '#62-setblacklistaction',
      setlog: '#63-setlog',
      unsetlog: '#64-unsetlog',
      slowmode: '#65-slowmode',
      settitle: '#66-settitle',
      setdescription: '#67-setdescription',
      setphoto: '#68-setphoto',
      mode: '#69-mode',
      unapproveall: '#70-unapproveall',
      reports: '#71-reports',
    };

    if (builtinCommands.length > 0) {
      defaultCmdsGrid.innerHTML = builtinCommands
        .map((c) => {
          const docAnchor = CMD_DOC_ANCHORS[c.cmd] || `#${encodeURIComponent(c.cmd)}`;
          const docHref = DOCS_BASE + docAnchor;
          const infoBtn = `<a href="${docHref}" target="_blank" rel="noopener" title="View docs for !${escapeHtml(c.cmd)}" style="margin-left:auto; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; background:rgba(var(--primary-rgb,37,211,102),0.15); color:var(--primary,#25d366); font-size:10px; text-decoration:none; transition:background 0.2s;" onmouseover="this.style.background='rgba(var(--primary-rgb,37,211,102),0.35)'" onmouseout="this.style.background='rgba(var(--primary-rgb,37,211,102),0.15)'"><i class="fas fa-info"></i></a>`;
          return `<label data-cmd="${escapeHtml(c.cmd)}" data-help="${escapeHtml(c.help || '')}" title="${escapeHtml(c.help || '')}" style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:4px 8px;border-radius:4px;background:var(--card-bg);border:1px solid var(--border-color);">
            <input type="checkbox" class="mod-default-cmd-toggle" data-cmd="${escapeHtml(c.cmd)}"${!disabledCmds.includes(c.cmd) ? ' checked' : ''}>
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><code>${escapeHtml(prefix)}${escapeHtml(c.cmd)}</code>${c.adminOnly ? ' <span style="font-size:9px;color:#e74c3c;">(admin)</span>' : ''}</span>
            ${infoBtn}
          </label>`;
        })
        .join('');
    } else {
      defaultCmdsGrid.innerHTML = `<div class="empty-state">${t('moderation.no_cmds')}</div>`;
    }

    // Clear search box when group changes
    const searchBox = document.getElementById('mod-default-cmds-search');
    if (searchBox) searchBox.value = '';
  }

  // Custom Commands List UI
  const customCmdsList = document.getElementById('mod-custom-cmds-list');
  if (customCmdsList) {
    const customCmds = config.commands?.custom_commands || [];
    if (!customCmds.length) {
      customCmdsList.innerHTML = `<div class="empty-state" style="color:var(--text-muted);font-size:12px;padding:8px 0;">${t('moderation.no_custom_cmds')}</div>`;
    } else {
      const typeLabel = (t) => {
        if (t === 'webhook')
          return '<span style="font-size:10px;background:rgba(41,182,246,0.15);color:#29b6f6;padding:2px 6px;border-radius:4px;">🏠 HA/Webhook</span>';
        if (t === 'alias')
          return '<span style="font-size:10px;background:rgba(156,39,176,0.15);color:#ce93d8;padding:2px 6px;border-radius:4px;">🔗 Alias</span>';
        return '<span style="font-size:10px;background:rgba(76,175,80,0.15);color:#81c784;padding:2px 6px;border-radius:4px;">🤖 Auto Reply</span>';
      };
      customCmdsList.innerHTML = customCmds
        .map(
          (c, idx) => `
        <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;">
          <div>
            <strong style="color:var(--primary);">${escapeHtml(config.commands?.prefix || '!')}${escapeHtml(c.command)}</strong>
            ${typeLabel(c.type)}
            ${c.admin_only ? '<span style="font-size:10px;background:rgba(231,76,60,0.15);color:#e74c3c;padding:2px 6px;border-radius:4px;margin-left:6px;">Admin Only</span>' : ''}
            ${c.type === 'alias' && c.alias_of ? ` &rarr; <span style="color:var(--text-main);">runs <code>${escapeHtml(config.commands?.prefix || '!')}${escapeHtml(c.alias_of)}</code></span>` : ''}
            ${c.type === 'auto_reply' && c.response ? ` &rarr; <span style="color:var(--text-main);">${escapeHtml(c.response)}</span>` : ''}
            ${c.type === 'webhook' ? ` <span style="color:var(--text-muted);font-size:11px;">— forwarded to HA/Webhook</span>` : ''}
            ${c.description ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;"><em>Help: ${escapeHtml(c.description)}</em></div>` : ''}
          </div>
          <button class="btn btn-secondary btn-sm" style="color:#e74c3c;padding:2px 8px;" onclick="removeCustomCommandRule(${idx})"><i class="fas fa-trash"></i></button>
        </div>`
        )
        .join('');
    }
    // Populate alias target dropdown with built-in + existing custom commands
    _refreshAliasDropdown(config);
  }

  // AI & Translation
  const aiProvider = document.getElementById('mod-ai-provider');
  if (aiProvider) aiProvider.value = config.ai?.provider || 'gemini';
  const aiEnabled = document.getElementById('mod-ai-enabled');
  if (aiEnabled) aiEnabled.checked = Boolean(config.ai?.enabled);
  const aiFaq = document.getElementById('mod-ai-faq');
  if (aiFaq) aiFaq.checked = Boolean(config.ai?.faq_auto_reply);
  const aiSentiment = document.getElementById('mod-ai-sentiment');
  if (aiSentiment) aiSentiment.checked = Boolean(config.ai?.sentiment_moderation);
  const aiPrompt = document.getElementById('mod-ai-prompt');
  if (aiPrompt)
    aiPrompt.value =
      config.ai?.system_prompt ||
      'You are an intelligent, friendly, and professional WhatsApp Group Moderator AI. Your goals are to assist group members with accurate information, enforce group etiquette, keep responses concise, polite, and well-formatted for WhatsApp, and maintain a constructive community atmosphere.';
  const transEnabled = document.getElementById('mod-trans-enabled');
  if (transEnabled) transEnabled.checked = config.translation?.enabled !== false;
  const transLang =
    document.getElementById('mod-trans-lang') || document.getElementById('mod-trans-target-lang');
  if (transLang) transLang.value = config.translation?.target_lang || 'en';
  const transMode = document.getElementById('mod-trans-mode');
  if (transMode) transMode.value = config.translation?.mode || 'manual';
  const transProv = document.getElementById('mod-trans-provider');
  if (transProv) transProv.value = config.translation?.provider || 'auto';

  const defaultPrio = ['aegisbot', 'google', 'lingva', 'mymemory', 'ai'];
  const configuredPrio = config.translation?.engine_priority || defaultPrio;
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`mod-trans-prio-${i}`);
    if (el) {
      el.value = configuredPrio[i - 1] !== undefined ? configuredPrio[i - 1] : '';
    }
  }
  if (typeof onTranslationProviderChange === 'function') {
    onTranslationProviderChange();
  }

  // Speech-to-Text (STT)
  const sttEnabled = document.getElementById('mod-stt-enabled');
  if (sttEnabled) sttEnabled.checked = Boolean(config.stt_enabled);
  const sttEngine = document.getElementById('mod-stt-engine');
  if (sttEngine) sttEngine.value = config.stt_engine || 'aegisbot';
  const sttAegisUrl = document.getElementById('mod-stt-aegisbot-url');
  if (sttAegisUrl) sttAegisUrl.value = config.stt_aegisbot_url || '';
  const sttAegisKey = document.getElementById('mod-stt-aegisbot-key');
  if (sttAegisKey) sttAegisKey.value = config.stt_aegisbot_key || '';
  if (typeof updateSttEngineNotice === 'function') {
    updateSttEngineNotice();
  }

  // Security Scanner
  const secEnabled = document.getElementById('mod-sec-scan-enabled');
  if (secEnabled) secEnabled.checked = config.security_scan?.enabled !== false;
  const secFiles = document.getElementById('mod-sec-scan-files');
  if (secFiles) secFiles.checked = config.security_scan?.scan_files !== false;
  const secEngine = document.getElementById('mod-sec-scan-engine');
  if (secEngine) secEngine.value = config.security_scan?.engine || 'local';
  const secTrigger = document.getElementById('mod-sec-scan-trigger');
  if (secTrigger) secTrigger.value = config.security_scan?.trigger || 'auto';

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

  const antispamLinksE = document.getElementById('mod-antispam-links-enabled');
  if (antispamLinksE) antispamLinksE.checked = Boolean(config.anti_spam_links_enabled);

  const notifyDeletedE = document.getElementById('mod-notify-deleted-action');
  if (notifyDeletedE) notifyDeletedE.checked = config.antispam?.notify_deleted_action !== false; // Default true

  const notifyBypassedE = document.getElementById('mod-notify-bypassed-actions');
  if (notifyBypassedE) notifyBypassedE.checked = Boolean(config.antispam?.notify_bypassed_actions);

  const botAntispamE = document.getElementById('mod-antispam-bot-enabled');
  if (botAntispamE) botAntispamE.checked = config.antispam?.bot_anti_spam?.enabled !== false; // Default true

  const blockedPlatforms = config.antispam?.blocked_invite_platforms || {};
  const platforms = ['whatsapp', 'telegram', 'signal', 'instagram', 'discord', 'other'];
  for (const plat of platforms) {
    const el = document.getElementById(`mod-invite-platform-${plat}`);
    if (el) el.checked = blockedPlatforms[plat] !== false; // Default true if undefined
  }

  // Muted Users List UI
  const mutedList = document.getElementById('mod-muted-users-list');
  if (mutedList) {
    const mutedUsers = config.muted_users || {};
    const entries = Object.entries(mutedUsers).filter(
      ([, data]) => !data.until || data.until > Date.now()
    );
    if (!entries.length) {
      mutedList.innerHTML = `<div class="empty-state" style="color:var(--text-muted);font-size:12px;padding:6px 0;">${t('moderation.no_muted_users')}</div>`;
    } else {
      mutedList.innerHTML = entries
        .map(([userKey, data]) => {
          const reason = data.reason || 'No reason provided';
          const untilStr = data.until
            ? `Until ${new Date(data.until).toLocaleTimeString()}`
            : 'Indefinitely';
          const dateStr = data.created ? new Date(data.created).toLocaleString() : null;
          return `
        <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;">
          <div>
            <strong style="color:var(--text-main);font-size:12px;">@${escapeHtml(userKey)}</strong>
            <span class="badge badge-warning" style="font-size:10px;margin-left:6px;">${escapeHtml(untilStr)}</span>
            <div style="font-size:11px;color:var(--text-main);margin-top:2px;">
              <strong>Reason:</strong> ${escapeHtml(reason)}
            </div>
            ${dateStr ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;"><i class="far fa-clock"></i> ${escapeHtml(dateStr)}</div>` : ''}
          </div>
          <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px;" onclick="unmuteUserInUi('${escapeHtml(userKey)}')"><i class="fas fa-volume-up"></i> Unmute</button>
        </div>`;
        })
        .join('');
    }
  }

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

  // Blacklist Tag Cloud & Mode
  const blMode = document.getElementById('mod-blacklist-mode');
  if (blMode) blMode.value = config.blacklist?.matching_mode || 'exact';

  const blTags = document.getElementById('mod-blacklist-tags');
  if (blTags) {
    const words = config.blacklist?.words || [];
    if (!words.length) {
      blTags.innerHTML = `<span style="color:var(--text-muted);font-size:12px;">${t('moderation.no_blacklist_words')}</span>`;
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
      filtersList.innerHTML = `<div class="empty-state" style="color:var(--text-muted);font-size:12px;padding:8px 0;">${t('moderation.no_filters')}</div>`;
    } else {
      filtersList.innerHTML = filters
        .map((f, idx) => {
          const reactionBadge = f.reaction_emoji
            ? `<span style="font-size:11px;background:rgba(255,193,7,0.15);color:#ffc107;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:600;">⚡ ${escapeHtml(f.reaction_emoji)}</span>`
            : '';
          const mediaBadge =
            f.media_type === 'sticker'
              ? `<span style="font-size:10px;background:rgba(156,39,176,0.15);color:#ce93d8;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:600;">🎨 Sticker</span>`
              : f.media_type === 'gif'
                ? `<span style="font-size:10px;background:rgba(233,30,99,0.15);color:#f48fb1;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:600;">🎬 GIF</span>`
                : '';
          const fileBadge = f.file_url
            ? `<span style="font-size:10px;background:rgba(33,150,243,0.15);color:#64b5f6;padding:2px 6px;border-radius:4px;margin-left:6px;"><i class="fas fa-paperclip"></i> ${escapeHtml(f.file_name || 'File')}</span>`
            : '';
          const pollBadge =
            f.poll_options && f.poll_options.length >= 2
              ? `<span style="font-size:10px;background:rgba(76,175,80,0.15);color:#81c784;padding:2px 6px;border-radius:4px;margin-left:6px;"><i class="fas fa-poll"></i> Poll (${f.poll_options.length})</span>`
              : '';

          const responseText = f.response
            ? ` &rarr; <span style="color:var(--text-main);">${escapeHtml(f.response)}</span>`
            : '';

          return `
        <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;">
          <div>
            <strong style="color:var(--primary);">${escapeHtml(f.trigger)}</strong>
            ${f.type === 'faq' ? '<span style="font-size:10px;background:rgba(52,152,219,0.15);color:#3498db;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:600;">💡 FAQ</span>' : '<span style="font-size:10px;background:rgba(46,204,113,0.15);color:#2ecc71;padding:2px 6px;border-radius:4px;margin-left:6px;">Reply</span>'}
            ${reactionBadge}
            ${mediaBadge}
            ${fileBadge}
            ${pollBadge}
            ${responseText}
          </div>
          <button class="btn btn-secondary btn-sm" style="color:#e74c3c;padding:2px 8px;" onclick="removeFilterRule(${idx})"><i class="fas fa-trash"></i></button>
        </div>`;
        })
        .join('');
    }
  }

  // Federation Select & Shared Blacklist Tags
  const fedSelect = document.getElementById('mod-fed-select');
  if (fedSelect && modStoreCache?.federations) {
    const activeFedId = config.federation_id || 'fed_global_default';
    let opts = `<option value="">${window.t('moderation.no_federation_joined')}</option>`;
    modStoreCache.federations.forEach((f) => {
      opts += `<option value="${f.id}"${f.id === activeFedId ? ' selected' : ''}>${escapeHtml(f.name || f.id)}</option>`;
    });
    fedSelect.innerHTML = opts;
    fedSelect.value = activeFedId;
  }
  updateFedBlacklistTagsInUi();
  // Capture a snapshot of all field values AFTER populating them.
  // _guardDirty() will diff against this snapshot on every subtab switch.
  _captureSnapshot();
  updateModerationDisabledState();
  if (typeof populateAutoTestMemberSelect === 'function') {
    populateAutoTestMemberSelect(groupId);
  }
  if (typeof refreshModerationDiagnostics === 'function') {
    refreshModerationDiagnostics();
  }
}

async function toggleGroupModeration(enabled) {
  if (!currentModGroup) return;
  updateModerationDisabledState();
  const url =
    basePath +
    `api/moderation/groups/${encodeURIComponent(currentModGroup)}/${enabled ? 'enable' : 'disable'}`;
  try {
    const res = await fetch(url, { method: 'POST' });
    if (res.ok) {
      showToast(
        enabled ? t('moderation.group_enabled') : t('moderation.group_disabled'),
        'success'
      );
      loadModerationConfig();
    }
  } catch (e) {
    showToast(t('moderation.group_update_failed'), 'danger');
  }
}

function _doSwitchModSubTab(subTab) {
  currentModSubTab = subTab;
  // Hide all panels
  const panels = document.querySelectorAll('.mod-subpanel');
  panels.forEach((p) => {
    p.style.display = 'none';
    p.classList.remove('active');
  });
  const activeP = document.getElementById(`mod-subpanel-${subTab}`);
  if (activeP) {
    activeP.style.display = 'block';
    activeP.classList.add('active');
  }

  if (subTab === 'ai') {
    if (typeof populateAutoTestMemberSelect === 'function' && currentModGroup) {
      populateAutoTestMemberSelect(currentModGroup);
    }
    if (typeof refreshModerationDiagnostics === 'function') {
      refreshModerationDiagnostics();
    }
  }

  // Update active button state
  const subTabBar = document.querySelector('#tab-moderation .mod-subtab-bar');
  if (subTabBar) {
    subTabBar.querySelectorAll('button').forEach((btn) => btn.classList.remove('active'));
    const activeBtn = subTabBar.querySelector(`[data-subtab="${subTab}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  if (window.updateUrlState) {
    const params = {};
    if (currentModGroup) params.group = currentModGroup;
    if (currentModSubTab && currentModSubTab !== 'core') params.subtab = currentModSubTab;
    window.updateUrlState('moderation', params);
  }
}

function switchModSubTab(subTab) {
  if (!_guardDirty(() => _doSwitchModSubTab(subTab))) return;
  _doSwitchModSubTab(subTab);
}

/** Register dirty-tracking listeners – now snapshot-based, no event delegation needed. */
function _registerDirtyListeners() {
  // The snapshot is captured at the end of selectModerationGroup.
  // No event listeners needed – _guardDirty() does a snapshot diff on every switch.
}

async function saveGroupRules() {
  if (!currentModGroup) return showToast(t('moderation.select_group_warning'), 'warning');
  const text = document.getElementById('mod-rules-text')?.value || '';
  const showOnJoin = Boolean(document.getElementById('mod-rules-show-on-join')?.checked);
  const lang = document.getElementById('mod-group-language-select')?.value || 'en';

  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.rules = { text, show_on_join: showOnJoin };
  groupConfig.language = lang;

  await saveGroupConfig(groupConfig);
  markClean();
  showToast(t('moderation.group_rules_saved'), 'success');
}

async function saveGroupGreetings() {
  if (!currentModGroup) return showToast(t('moderation.select_group_warning'), 'warning');
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.greetings = {
    welcome_enabled: Boolean(document.getElementById('mod-welcome-enabled')?.checked),
    welcome_message: document.getElementById('mod-welcome-msg')?.value || '',
    welcome_target: document.getElementById('mod-welcome-target')?.value || 'private',
    goodbye_enabled: Boolean(document.getElementById('mod-goodbye-enabled')?.checked),
    goodbye_message: document.getElementById('mod-goodbye-msg')?.value || '',
    goodbye_target: document.getElementById('mod-goodbye-target')?.value || 'private',
    captcha_enabled: Boolean(document.getElementById('mod-captcha-enabled')?.checked),
    captcha_mode: document.getElementById('mod-captcha-mode')?.value || 'math',
    captcha_target: document.getElementById('mod-captcha-target')?.value || 'private',
    captcha_timeout_seconds:
      parseInt(document.getElementById('mod-captcha-timeout')?.value, 10) || 120,
    name_priority: document.getElementById('mod-name-priority')?.value || 'name_push_phone',
    name_fallback: document.getElementById('mod-name-fallback')?.value || 'phone',
  };
  await saveGroupConfig(groupConfig);
  markClean();
  showToast(t('moderation.greetings_saved'), 'success');
  loadCaptchaUsers();
}

async function loadCaptchaUsers() {
  const container = document.getElementById('mod-captcha-users-container');
  const listEl = document.getElementById('mod-captcha-users-list');
  const capE = document.getElementById('mod-captcha-enabled');

  if (!container || !listEl) return;

  const isCaptchaOn = Boolean(capE?.checked);
  if (!isCaptchaOn || !currentModGroup) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  listEl.innerHTML =
    '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading captcha user status...</div>';

  try {
    const res = await fetch(
      basePath + `api/moderation/groups/${encodeURIComponent(currentModGroup)}/captcha/users`
    );
    const json = await res.json();
    const users = json.data || [];

    if (!Array.isArray(users) || users.length === 0) {
      listEl.innerHTML = `<div class="empty-state">${window.t ? window.t('moderation.no_group_users') : 'No group users found'}</div>`;
      return;
    }

    listEl.innerHTML = users
      .map((u) => {
        let badgeHtml;
        if (u.verified) {
          badgeHtml =
            '<span class="badge badge-success" style="background:#00a884; color:#fff; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:600;"><i class="fas fa-check-circle"></i> Verified</span>';
        } else if (u.pending) {
          badgeHtml =
            '<span class="badge badge-warning" style="background:#ffbc00; color:#000; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:600;"><i class="fas fa-hourglass-half"></i> Pending</span>';
        } else {
          badgeHtml =
            '<span class="badge badge-danger" style="background:#ea0038; color:#fff; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:600;"><i class="fas fa-times-circle"></i> Unverified</span>';
        }

        const modeLabel = u.mode
          ? `<span style="font-size:11px; color:var(--text-muted); margin-left:6px;">(${u.mode})</span>`
          : '';
        const adminLabel = u.isAdmin
          ? '<span style="font-size:11px; color:var(--primary); font-weight:600; margin-left:6px;">[Admin]</span>'
          : '';

        const actionBtn = u.verified
          ? `<button class="btn btn-outline-warning btn-sm" onclick="toggleUserCaptchaVerification('${escapeHtml(u.userId)}', false)"><i class="fas fa-user-slash"></i> Set Unverified</button>`
          : `<button class="btn btn-success btn-sm" onclick="toggleUserCaptchaVerification('${escapeHtml(u.userId)}', true)"><i class="fas fa-user-check"></i> Verify User</button>`;

        return `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--border-color); gap:12px;">
            <div style="flex:1; min-width:0;">
              <div style="font-size:13px; font-weight:600; color:var(--text-main); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
                ${escapeHtml(u.name || u.userId)} ${adminLabel}
              </div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                ID: <code>${escapeHtml(u.userId)}</code> ${modeLabel}
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              ${badgeHtml}
              ${actionBtn}
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state" style="color:var(--danger);">${window.t ? window.t('moderation.failed_load_captcha_users', { error: escapeHtml(err.message) }) : 'Failed to load captcha users: ' + escapeHtml(err.message)}</div>`;
  }
}

async function toggleUserCaptchaVerification(userId, verified) {
  if (!currentModGroup || !userId) return;
  try {
    const res = await fetch(
      basePath + `api/moderation/groups/${encodeURIComponent(currentModGroup)}/captcha/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, verified: Boolean(verified) }),
      }
    );
    const json = await res.json();
    if (json.success) {
      showToast(
        t('moderation.user_verification_updated', {
          user: userId,
          status: verified ? t('moderation.verified') : t('moderation.unverified'),
        }),
        'success'
      );
      loadCaptchaUsers();
    } else {
      showToast(json.error || t('moderation.user_verification_failed'), 'error');
    }
  } catch (err) {
    showToast(t('moderation.user_verification_error', { error: err.message }), 'error');
  }
}

async function saveGroupWarnings() {
  if (!currentModGroup) return showToast(t('moderation.select_group_warning'), 'warning');
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.warnings = {
    ...(groupConfig.warnings || {}),
    max_warnings: parseInt(document.getElementById('mod-max-warns')?.value, 10) || 3,
    action: document.getElementById('mod-warn-action')?.value || 'mute',
  };
  await saveGroupConfig(groupConfig);
  markClean();
  showToast(t('moderation.warnings_saved'), 'success');
}

async function saveGroupCommands() {
  if (!currentModGroup) return showToast(t('moderation.select_group_warning'), 'warning');

  const enabled = Boolean(document.getElementById('mod-cmds-enabled')?.checked);
  const multi_command_enabled = Boolean(document.getElementById('mod-cmds-multi-enabled')?.checked);
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
    multi_command_enabled,
    prefix,
    mute_action,
    disabled_commands: disabledCmds,
  };

  await saveGroupConfig(groupConfig);
  showToast(t('moderation.commands_saved'), 'success');
}

function toggleAllDefaultCommands(enable) {
  // Only toggle visible commands (respects active search filter)
  document.querySelectorAll('.mod-default-cmd-toggle').forEach((cb) => {
    const label = cb.closest('label');
    if (!label || label.style.display === 'none') return;
    cb.checked = Boolean(enable);
  });
}

window.filterDefaultCommands = function filterDefaultCommands(query) {
  const q = (query || '').trim().toLowerCase();
  const grid = document.getElementById('mod-default-cmds-grid');
  if (!grid) return;
  let visibleCount = 0;
  grid.querySelectorAll('label[data-cmd]').forEach((label) => {
    const cmd = (label.getAttribute('data-cmd') || '').toLowerCase();
    const help = (label.getAttribute('data-help') || '').toLowerCase();
    const matches = !q || cmd.includes(q) || help.includes(q);
    label.style.display = matches ? '' : 'none';
    if (matches) visibleCount++;
  });

  // Show/hide empty state
  let emptyEl = grid.querySelector('.cmd-search-empty');
  if (visibleCount === 0 && q) {
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'cmd-search-empty empty-state';
      emptyEl.style.cssText =
        'grid-column:1/-1; color:var(--text-muted); font-size:12px; padding:8px 4px;';
      grid.appendChild(emptyEl);
    }
    emptyEl.textContent = window.t
      ? window.t('moderation.no_matching_commands', { query })
      : `No commands matching "${query}"`;
    emptyEl.style.display = '';
  } else if (emptyEl) {
    emptyEl.style.display = 'none';
  }
};
window.toggleAllDefaultCommands = toggleAllDefaultCommands;

window.filterModerationSettings = function filterModerationSettings(query) {
  const q = (query || '').trim().toLowerCase();
  const modPanel = document.getElementById('tab-moderation');
  if (!modPanel) return;

  if (!q) {
    // Show all elements when search query is empty
    modPanel
      .querySelectorAll(
        '.mod-subpanel, .mod-field-group, .mod-option-row, .mod-inline-controls, .mod-feature-header'
      )
      .forEach((el) => {
        el.style.display = '';
      });
    // Restore current active subtab
    _doSwitchModSubTab(currentModSubTab || 'rules');
    return;
  }

  // When searching, reveal all subpanels so matching settings can be highlighted
  modPanel.querySelectorAll('.mod-subpanel').forEach((panel) => {
    panel.style.display = 'block';
  });

  let totalMatches = 0;
  modPanel
    .querySelectorAll('.mod-field-group, .mod-option-row, .mod-inline-controls')
    .forEach((group) => {
      const text = group.textContent.toLowerCase();
      const inputs = Array.from(group.querySelectorAll('input, select, textarea')).map(
        (i) => (i.id || '').toLowerCase() + ' ' + (i.placeholder || '').toLowerCase()
      );
      const matches = text.includes(q) || inputs.some((i) => i.includes(q));

      if (matches) {
        group.style.display = '';
        totalMatches++;
      } else {
        group.style.display = 'none';
      }
    });
};

async function addCustomCommandRule() {
  const nameInp = document.getElementById('mod-cmd-name');
  const typeInp = document.getElementById('mod-cmd-type');
  const respInp = document.getElementById('mod-cmd-response');
  const aliasInp = document.getElementById('mod-cmd-alias-target');
  const descInp = document.getElementById('mod-cmd-description');
  const adminOnlyInp = document.getElementById('mod-cmd-admin-only');

  const name = nameInp?.value.trim().replace(/^[!/#]+/, '');
  const cmdType = typeInp?.value || 'auto_reply';
  const resp = respInp?.value.trim();
  const aliasTarget = aliasInp?.value.trim();
  const desc = descInp?.value.trim();
  const adminOnly = Boolean(adminOnlyInp?.checked);

  if (!name || !currentModGroup) return;
  if (cmdType === 'auto_reply' && !resp) return;
  if (cmdType === 'alias' && !aliasTarget) {
    showToast(t('moderation.select_alias_target'), 'error');
    return;
  }

  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.commands = groupConfig.commands || {
    enabled: true,
    prefix: '!',
    mute_action: 'delete',
  };
  groupConfig.commands.custom_commands = groupConfig.commands.custom_commands || [];

  const entry = { command: name, type: cmdType, admin_only: adminOnly };
  if (cmdType === 'auto_reply') entry.response = resp;
  if (cmdType === 'alias') entry.alias_of = aliasTarget;
  if (desc) entry.description = desc;

  groupConfig.commands.custom_commands.push(entry);

  if (nameInp) nameInp.value = '';
  if (respInp) respInp.value = '';
  if (aliasInp) aliasInp.value = '';
  if (descInp) descInp.value = '';
  if (adminOnlyInp) adminOnlyInp.checked = false;

  await saveGroupConfig(groupConfig);
  showToast(t('moderation.custom_command_added', { name }), 'success');
  selectModerationGroup(currentModGroup);
  setTimeout(() => {
    if (nameInp) nameInp.focus();
  }, 50);
}

function onCustomCmdTypeChange() {
  const type = document.getElementById('mod-cmd-type')?.value;
  const respWrap = document.getElementById('mod-cmd-response-wrap');
  const aliasWrap = document.getElementById('mod-cmd-alias-wrap');
  if (!respWrap || !aliasWrap) return;
  if (type === 'alias') {
    respWrap.style.display = 'none';
    aliasWrap.style.display = 'flex';
  } else if (type === 'webhook') {
    respWrap.style.display = 'none';
    aliasWrap.style.display = 'none';
  } else {
    respWrap.style.display = 'flex';
    aliasWrap.style.display = 'none';
  }
}

function _refreshAliasDropdown(config) {
  const aliasSelect = document.getElementById('mod-cmd-alias-target');
  if (!aliasSelect) return;
  const builtins = [
    'ping',
    'help',
    'id',
    'rules',
    'warn',
    'warns',
    'unwarn',
    'kick',
    'ban',
    'mute',
    'unmute',
    'promote',
    'demote',
    'clear',
    'report',
    'notes',
    'note',
    'captcha',
    'test',
  ];
  const prefix = config.commands?.prefix || '!';
  const customCmds = (config.commands?.custom_commands || []).map((c) => c.command);
  const allTargets = [...new Set([...builtins, ...customCmds])];
  aliasSelect.innerHTML =
    `<option value="">— ${window.t('moderation.select_target')} —</option>` +
    allTargets
      .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(prefix)}${escapeHtml(c)}</option>`)
      .join('');
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
      showToast(t('moderation.warnings_cleared', { user: userId }), 'success');
      loadModerationConfig();
      setTimeout(() => selectModerationGroup(currentModGroup), 200);
    }
  } catch (e) {
    showToast(t('moderation.warnings_clear_failed'), 'danger');
  }
}

async function resolveReportInUi(reportId) {
  if (!currentModGroup || !reportId) return;
  try {
    const res = await fetch(
      basePath +
        `api/moderation/groups/${encodeURIComponent(currentModGroup)}/reports/${encodeURIComponent(reportId)}/resolve`,
      {
        method: 'POST',
      }
    );
    if (res.ok) {
      showToast(t('moderation.report_resolved'), 'success');
      loadModerationConfig();
      setTimeout(() => selectModerationGroup(currentModGroup), 200);
    }
  } catch (e) {
    showToast(t('moderation.report_resolve_failed'), 'danger');
  }
}

async function unbanUserInUi(userId) {
  if (!currentModGroup || !userId) return;
  try {
    const res = await fetch(
      basePath +
        `api/moderation/groups/${encodeURIComponent(currentModGroup)}/ban/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      }
    );
    if (res.ok) {
      showToast(t('moderation.unbanned_user', { user: userId }), 'success');
      loadModerationConfig();
      setTimeout(() => selectModerationGroup(currentModGroup), 200);
    }
  } catch (e) {
    showToast(t('moderation.unban_failed'), 'danger');
  }
}

async function clearKickLogInUi(userId) {
  if (!currentModGroup || !userId) return;
  try {
    const res = await fetch(
      basePath +
        `api/moderation/groups/${encodeURIComponent(currentModGroup)}/kick/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      }
    );
    if (res.ok) {
      showToast(t('moderation.kick_log_removed', { user: userId }), 'success');
      loadModerationConfig();
      setTimeout(() => selectModerationGroup(currentModGroup), 200);
    }
  } catch (e) {
    showToast(t('moderation.kick_log_remove_failed'), 'danger');
  }
}

async function unmuteUserInUi(userId) {
  if (!currentModGroup || !userId) return;
  try {
    const res = await fetch(
      basePath +
        `api/moderation/groups/${encodeURIComponent(currentModGroup)}/mute/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      }
    );
    if (res.ok) {
      showToast(t('moderation.unmuted_user', { user: userId }), 'success');
      loadModerationConfig();
      setTimeout(() => selectModerationGroup(currentModGroup), 200);
    }
  } catch (e) {
    showToast(t('moderation.unmute_failed'), 'danger');
  }
}
