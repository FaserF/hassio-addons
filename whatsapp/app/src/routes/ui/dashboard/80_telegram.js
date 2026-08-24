let cachedTelegramBots = [];

function updateTelegramBridgeDisabledState(enabled) {
  const tab = document.getElementById('tab-telegram');
  if (!tab) return;
  const cards = tab.querySelectorAll('.mod-settings-card, .card');
  cards.forEach((card) => {
    if (enabled) {
      card.classList.remove('disabled-section');
    } else {
      card.classList.add('disabled-section');
    }
    const inputs = card.querySelectorAll('input, select, button, textarea');
    inputs.forEach((el) => {
      el.disabled = !enabled;
    });
  });
}

let _isLoadingTgData = false;
async function loadTelegramBridgeData() {
  if (_isLoadingTgData) return;
  _isLoadingTgData = true;
  try {
    const res = await fetch(basePath + 'api/telegram/config');
    const data = await res.json();
    if (data.success && data.data) {
      const cfg = data.data;
      const toggle = document.getElementById('tg-global-toggle');
      if (toggle) toggle.checked = Boolean(cfg.enabled);
      updateTelegramBridgeDisabledState(Boolean(cfg.enabled));

      cachedTelegramBots = cfg.bots || [];
      renderTelegramBots(cachedTelegramBots);
      renderTelegramMappings(cfg.mappings || [], cachedTelegramBots);
      populateTelegramTestMappingDropdown(cfg.mappings || []);
      if (
        window.initialUrlState &&
        window.initialUrlState.tab === 'telegram' &&
        window.initialUrlState.params
      ) {
        if (window.initialUrlState.params.mapping) {
          const restoreMapId = window.initialUrlState.params.mapping;
          delete window.initialUrlState.params.mapping;
          editTelegramMapping(restoreMapId);
        } else if (window.initialUrlState.params.action === 'add') {
          delete window.initialUrlState.params.action;
          openAddTelegramMappingModal();
        }
      }
    }
  } catch (err) {
    console.error('Failed to load Telegram bridge config', err);
  } finally {
    _isLoadingTgData = false;
  }
}

function renderTelegramBots(bots) {
  const container = document.getElementById('tg-bots-list-container');
  if (!container) return;

  if (!bots || bots.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; color:var(--text-muted); padding:24px; border:1px dashed var(--border-color); border-radius:8px;">
        <i class="fas fa-robot" style="font-size:28px; opacity:0.4; margin-bottom:8px; display:block;"></i>
        No Telegram Bots configured. Click "Add Telegram Bot" to connect your first bot via Bot Token.
      </div>
    `;
    return;
  }

  container.innerHTML = bots
    .map(
      (b) => `
    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:12px 16px; background:var(--bg-input); border:1px solid var(--border-color); border-radius:8px;">
      <div style="display:flex; align-items:center; gap:12px; min-width:180px;">
        <div style="font-size: 20px; color: #0088cc; background: rgba(0, 136, 204, 0.15); width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink:0;">
          <i class="fas fa-robot"></i>
        </div>
        <div>
          <div style="font-weight:600; font-size:14px; word-break:break-word;">${escapeHtml(b.name || '@' + b.username)}</div>
          <div style="font-size:12px; color:var(--text-muted); font-family:monospace; word-break:break-all;">
            Username: @${escapeHtml(b.username || 'unknown')}
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px; flex-shrink:0; margin-left:auto;">
        <button class="btn btn-secondary btn-sm" style="white-space:nowrap;" onclick="editTelegramBot('${b.id}')" title="Edit Bot"><i class="fas fa-edit"></i> Edit</button>
        <button class="btn btn-danger btn-sm" style="white-space:nowrap;" onclick="deleteTelegramBot('${b.id}')" title="Delete Bot"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `
    )
    .join('');
}

function renderTelegramMappings(mappings, bots = []) {
  const tbody = document.getElementById('tg-mappings-tbody');
  if (!tbody) return;

  if (mappings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:32px;"><i class="fas fa-link" style="font-size:32px; opacity:0.3; margin-bottom:8px; display:block;"></i>No active chat mappings configured. Click "Add New Mapping" to start bridging.</td></tr>`;
    return;
  }

  tbody.innerHTML = mappings
    .map((m) => {
      const assignedBot = bots.find((b) => b.id === m.bot_id);
      const botLabel = assignedBot ? `@${assignedBot.username}` : 'Default Bot';

      let waTitle = m.wa_name && m.wa_name !== m.wa_jid ? m.wa_name : '';
      if (waTitle === '__ME_SELF_BOT__' || m.wa_jid === '__ME_SELF_BOT__') {
        waTitle = (window.t ? window.t('chats.me_self') : null) || 'Me / Self (Bot Account)';
      } else if (typeof waTitle === 'string' && waTitle.startsWith('__GROUP_FALLBACK__:')) {
        waTitle = `${(window.t ? window.t('common.group') : null) || 'Group'} (${waTitle.split(':')[1]})`;
      }

      const tgTitle =
        m.tg_chat_title && !m.tg_chat_title.startsWith('Chat ') ? m.tg_chat_title : '';

      const cleanWa = waTitle || m.wa_jid.split('@')[0];
      const cleanTg = tgTitle || `TG ${m.tg_chat_id}`;
      const threadLabel = m.tg_thread_id ? ` (Topic ${m.tg_thread_id})` : '';
      const autoName = `${cleanWa} ↔ ${cleanTg}${threadLabel}`;
      const displayName = m.name === '__ME_SELF_BOT__' ? waTitle : m.name || autoName;

      const waDisplay = waTitle
        ? `<strong>${escapeHtml(waTitle)}</strong><br><small style="color:var(--text-muted);">(${escapeHtml(m.wa_jid)})</small>`
        : `<strong>${escapeHtml(m.wa_jid)}</strong>`;

      const tgDisplay = tgTitle
        ? `<strong>${escapeHtml(tgTitle)}</strong><br><small style="color:var(--text-muted);">(${escapeHtml(m.tg_chat_id)})</small>`
        : `<strong>${escapeHtml(m.tg_chat_id)}</strong><br><small style="color:var(--text-muted);">(${m.tg_chat_type || 'chat'})</small>`;

      return `
    <tr>
      <td style="vertical-align:middle; padding:12px 14px;">
        <label class="mod-toggle-switch mod-toggle-sm">
          <input type="checkbox" ${m.enabled ? 'checked' : ''} onchange="toggleTelegramMapping('${m.id}')">
          <span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span>
        </label>
      </td>
      <td style="vertical-align:middle; padding:12px 14px;">
        <strong>${escapeHtml(displayName)}</strong><br>
        <span class="badge" style="background:rgba(0,136,204,0.12); color:#0088cc; font-size:10px; padding:2px 6px; border-radius:4px;"><i class="fas fa-robot"></i> ${escapeHtml(botLabel)}</span>
      </td>
      <td style="vertical-align:middle; padding:12px 14px;">${waDisplay}</td>
      <td style="vertical-align:middle; padding:12px 14px;">${tgDisplay}</td>
      <td style="vertical-align:middle; padding:12px 14px;"><span class="badge" style="background:var(--bg-card); border:1px solid var(--border-color);">${m.sync_mode}</span></td>
      <td style="vertical-align:middle; padding:12px 14px;">
        <small style="color:var(--text-muted); line-height:1.4; display:block;">
          ${m.is_direct_chat_mirror ? '<span class="badge" style="background:rgba(40,167,69,0.15); color:#28a745; font-size:10px; padding:2px 6px; border-radius:4px; margin-bottom:4px; display:inline-block;"><i class="fas fa-user"></i> 1:1 Direct Mirror</span><br>' : ''}
          Group: ${m.include_group_name ? 'Yes' : 'No'} | Sender: ${m.include_sender_name ? 'Yes' : 'No'}<br>
          Sync Self: <strong>${m.sync_self_messages ? 'Enabled' : 'Off'}</strong>
        </small>
      </td>
      <td style="text-align:right; vertical-align:middle; padding:12px 14px; white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" style="margin-right:6px;" onclick="editTelegramMapping('${m.id}')" title="Edit mapping settings"><i class="fas fa-edit"></i> Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTelegramMapping('${m.id}')" title="Delete mapping"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `;
    })
    .join('');
}

async function toggleTelegramBridge(enabled) {
  try {
    updateTelegramBridgeDisabledState(enabled);
    await fetch(basePath + 'api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    showToast(enabled ? t('telegram.bridge_active') : t('telegram.mapping_deleted'), 'info');
    loadTelegramBridgeData();
  } catch (e) {
    showToast(t('telegram.bot_add_failed'), 'danger');
  }
}

function openAddTelegramBotModal() {
  const title = document.getElementById('tg-bot-modal-title');
  if (title)
    title.innerHTML =
      '<i class="fas fa-robot"></i> ' +
      (window.t ? window.t('telegram.add_bot_modal_title') : 'Add Telegram Bot');

  const idEl = document.getElementById('tg-bot-modal-id');
  if (idEl) idEl.value = '';
  const nameEl = document.getElementById('tg-bot-modal-name');
  if (nameEl) nameEl.value = '';
  const tokenEl = document.getElementById('tg-bot-modal-token');
  if (tokenEl) tokenEl.value = '';

  const modal = document.getElementById('tg-bot-modal');
  if (modal) modal.style.display = 'flex';
}

function editTelegramBot(botId) {
  const bot = cachedTelegramBots.find((b) => b.id === botId);
  if (!bot) return;

  const title = document.getElementById('tg-bot-modal-title');
  if (title)
    title.innerHTML =
      '<i class="fas fa-edit"></i> ' +
      (window.t ? window.t('telegram.edit_bot_modal_title') : 'Edit Telegram Bot');

  const idEl = document.getElementById('tg-bot-modal-id');
  if (idEl) idEl.value = bot.id;
  const nameEl = document.getElementById('tg-bot-modal-name');
  if (nameEl) nameEl.value = bot.name || '';
  const tokenEl = document.getElementById('tg-bot-modal-token');
  if (tokenEl) tokenEl.value = bot.token || '';

  const modal = document.getElementById('tg-bot-modal');
  if (modal) modal.style.display = 'flex';
}

function closeTelegramBotModal() {
  const modal = document.getElementById('tg-bot-modal');
  if (modal) modal.style.display = 'none';
}

async function saveTelegramBotModal() {
  const id = document.getElementById('tg-bot-modal-id')?.value || '';
  const name = document.getElementById('tg-bot-modal-name')?.value || '';
  const token = document.getElementById('tg-bot-modal-token')?.value || '';

  if (!token.trim()) {
    showToast(t('telegram.bot_add_failed'), 'warning');
    return;
  }

  try {
    const res = await fetch(basePath + 'api/telegram/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id || undefined, name, token }),
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || t('telegram.bot_add_failed'), 'danger');
    } else {
      showToast(t('telegram.bot_added'), 'success');
      closeTelegramBotModal();
      loadTelegramBridgeData();
    }
  } catch (e) {
    showToast(t('telegram.bot_add_error', { error: e.message }), 'danger');
  }
}

async function deleteTelegramBot(botId) {
  const store = telegramStore || { bots: [], mappings: [] };
  const allBots = store.bots || [];
  const allMappings = store.mappings || [];
  const defaultBot = allBots[0];
  const isDefault = defaultBot && defaultBot.id === botId;

  // Count active mappings using this bot
  const boundMappings = allMappings.filter((m) => m.bot_id === botId || (!m.bot_id && isDefault));
  const count = boundMappings.length;
  const otherBots = allBots.filter((b) => b.id !== botId);

  let confirmMsg = t('telegram.delete_bot_confirm_msg');
  if (count > 0) {
    let choicesHtml;
    if (otherBots.length > 0) {
      const botOptionsHtml = otherBots
        .map(
          (b) =>
            `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name || b.username || b.id)}</option>`
        )
        .join('');

      choicesHtml = `
        <div style="margin-top: 12px; margin-bottom: 10px;">
          <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; font-weight: 500;">
            <input type="radio" name="del_bot_act" value="transfer" checked id="del_bot_act_transfer" style="margin-top: 3px;">
            <div>
              <span>${t('telegram.delete_bot_transfer_label')}</span>
              <select id="del_bot_target_bot" class="mod-input" style="margin-top: 6px; width: 100%;">
                ${botOptionsHtml}
              </select>
            </div>
          </label>
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--danger-color, #ef4444);">
            <input type="radio" name="del_bot_act" value="delete_all" id="del_bot_act_delete">
            <span>${t('telegram.delete_bot_delete_all_label', { count })}</span>
          </label>
        </div>
      `;
    } else {
      choicesHtml = `
        <div style="margin-top: 12px; margin-bottom: 12px; color: var(--danger-color, #ef4444); font-size: 0.9em;">
          <b>${t('telegram.delete_bot_no_other_bots_warn', { count })}</b>
        </div>
      `;
    }

    confirmMsg = `
      <div style="margin-bottom: 10px; color: var(--danger-color, #ef4444); font-weight: 600;">
        ⚠️ ${t('telegram.delete_bot_bridges_warning', { count })}
      </div>
      <p style="margin-bottom: 6px;">${t('telegram.delete_bot_choice_prompt')}</p>
      ${choicesHtml}
    `;
  }

  const confirmed = await showConfirm(
    t('telegram.delete_bot_confirm_title'),
    confirmMsg,
    t('common.delete'),
    t('common.cancel'),
    'danger'
  );
  if (!confirmed) return;

  let transferToBotId = '';
  if (count > 0 && otherBots.length > 0) {
    const transferRadio = document.getElementById('del_bot_act_transfer');
    if (transferRadio && transferRadio.checked) {
      const selectEl = document.getElementById('del_bot_target_bot');
      if (selectEl) {
        transferToBotId = selectEl.value;
      }
    }
  }

  try {
    const query = transferToBotId
      ? `?transfer_to_bot_id=${encodeURIComponent(transferToBotId)}`
      : '';
    await fetch(`api/telegram/bots/${botId}${query}`, { method: 'DELETE' });
    showToast(t('telegram.bot_deleted'), 'warning');
    loadTelegramBridgeData();
  } catch (e) {
    showToast(t('telegram.bot_delete_failed'), 'danger');
  }
}

async function toggleTelegramMapping(id) {
  await fetch(`api/telegram/mappings/${id}/toggle`, { method: 'POST' });
  showToast(t('telegram.mapping_added'), 'info');
  loadTelegramBridgeData();
}

async function deleteTelegramMapping(id) {
  const confirmed = await showConfirm(
    t('telegram.delete_mapping_confirm_title'),
    t('telegram.delete_mapping_confirm_msg'),
    t('common.delete'),
    t('common.cancel'),
    'danger'
  );
  if (!confirmed) return;
  await fetch(`api/telegram/mappings/${id}`, { method: 'DELETE' });
  showToast(t('telegram.mapping_deleted'), 'warning');
  loadTelegramBridgeData();
}

async function populateTelegramModalDropdowns(selectedBotId = '') {
  const botSelect = document.getElementById('tg-modal-bot-select');
  const waSelect = document.getElementById('tg-modal-wa-select');
  const tgSelect = document.getElementById('tg-modal-tg-select');
  const waJidInp = document.getElementById('tg-modal-wa-jid');
  const tgChatIdInp = document.getElementById('tg-modal-tg-chat-id');

  // Preserve existing selections before updating innerHTML
  const prevWaSelectVal = waSelect?.value || '';
  const prevWaJidVal = waJidInp?.value || '';
  const prevTgSelectVal = tgSelect?.value || '';
  const prevTgChatIdVal = tgChatIdInp?.value || '';

  // 0. Populate Bot Select
  if (botSelect) {
    let botOpts = '';
    if (cachedTelegramBots.length === 0) {
      botOpts = `<option value="">${window.t('telegram.no_bots_configured')}</option>`;
    } else {
      cachedTelegramBots.forEach((b) => {
        botOpts += `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name || '@' + b.username)} (@${escapeHtml(b.username)})</option>`;
      });
    }
    botSelect.innerHTML = botOpts;
    if (selectedBotId && Array.from(botSelect.options).some((o) => o.value === selectedBotId)) {
      botSelect.value = selectedBotId;
    }
  }

  const activeBotId = botSelect?.value || selectedBotId || '';

  // 1. Populate WhatsApp Chats Dropdown
  if (waSelect) {
    const rawWaT = window.t ? window.t('telegram.modal.select_wa_chat') : null;
    const selectPlaceholder =
      rawWaT && rawWaT !== 'telegram.modal.select_wa_chat' && rawWaT !== 'telegram.select_wa_chat'
        ? rawWaT
        : window.t
          ? window.t('telegram.select_wa_chat')
          : 'Select WhatsApp Chat / Group';
    let waOpts = `<option value="">-- ${selectPlaceholder} --</option>`;
    try {
      const res = await fetch(basePath + 'api/chats?session_id=' + (window.currentSession || ''));
      if (res.ok) {
        const chats = await res.json();
        if (Array.isArray(chats)) {
          chats.forEach((c) => {
            const jid = c.jid || c.id;
            if (jid) {
              let name = c.name || c.formattedTitle || jid;
              if (name === '__ME_SELF_BOT__') {
                name = window.t('chats.me_self') || 'Me / Self (Bot Account)';
              } else if (typeof name === 'string' && name.startsWith('__GROUP_FALLBACK__:')) {
                name = `${window.t('common.group') || 'Group'} (${name.split(':')[1]})`;
              }
              const typeLabel = jid.endsWith('@g.us') ? 'Group' : 'Direct';
              waOpts += `<option value="${escapeHtml(jid)}">${escapeHtml(name)} (${typeLabel})</option>`;
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch WhatsApp chats for modal', e);
    }
    waOpts += '<option value="__custom__">✏️ Custom JID (Manual Entry)</option>';
    waSelect.innerHTML = waOpts;

    // Restore preserved WhatsApp selection
    const targetWaJid =
      prevWaSelectVal && prevWaSelectVal !== '__custom__' ? prevWaSelectVal : prevWaJidVal;
    if (targetWaJid && Array.from(waSelect.options).some((o) => o.value === targetWaJid)) {
      waSelect.value = targetWaJid;
      if (waJidInp) {
        waJidInp.style.display = 'none';
        waJidInp.value = targetWaJid;
      }
    } else if (prevWaSelectVal === '__custom__' || targetWaJid) {
      waSelect.value = '__custom__';
      if (waJidInp) {
        waJidInp.style.display = 'block';
        waJidInp.value = targetWaJid;
      }
    }
  }

  // 2. Populate Telegram Cached Chats Dropdown (filtered by activeBotId if set)
  if (tgSelect) {
    const rawTgT = window.t ? window.t('telegram.modal.select_tg_chat') : null;
    const selectTgPlaceholder =
      rawTgT && rawTgT !== 'telegram.modal.select_tg_chat' && rawTgT !== 'telegram.select_tg_chat'
        ? rawTgT
        : window.t
          ? window.t('telegram.select_tg_chat')
          : 'Select Telegram Chat / Group';
    let tgOpts = `<option value="">-- ${selectTgPlaceholder} --</option>`;
    try {
      const url = activeBotId
        ? `api/telegram/chats?bot_id=${encodeURIComponent(activeBotId)}`
        : 'api/telegram/chats';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const tgChats = json.data || [];
        if (Array.isArray(tgChats)) {
          tgChats.forEach((tc) => {
            const title = tc.title || tc.username || tc.id;
            tgOpts += `<option value="${escapeHtml(tc.id)}">${escapeHtml(title)} (${tc.type || 'chat'})</option>`;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch Telegram chats for modal', e);
    }
    tgOpts += '<option value="__custom__">✏️ Custom Chat ID (Manual Entry)</option>';
    tgSelect.innerHTML = tgOpts;

    // Restore preserved Telegram selection
    const targetTgId = String(
      prevTgSelectVal && prevTgSelectVal !== '__custom__' ? prevTgSelectVal : prevTgChatIdVal
    );
    if (targetTgId && Array.from(tgSelect.options).some((o) => String(o.value) === targetTgId)) {
      tgSelect.value = targetTgId;
      if (tgChatIdInp) {
        tgChatIdInp.style.display = 'none';
        tgChatIdInp.value = targetTgId;
      }
    } else if (prevTgSelectVal === '__custom__' || targetTgId) {
      tgSelect.value = '__custom__';
      if (tgChatIdInp) {
        tgChatIdInp.style.display = 'block';
        tgChatIdInp.value = targetTgId;
      }
    }
  }
}

function onTgBotSelectChange(botId) {
  populateTelegramModalDropdowns(botId);
}

function onTgWaSelectChange(val) {
  const customInp = document.getElementById('tg-modal-wa-jid');
  if (!customInp) return;
  if (val === '__custom__') {
    customInp.style.display = 'block';
    customInp.value = '';
    customInp.focus();
  } else {
    customInp.style.display = 'none';
    customInp.value = val;
  }
}

function onTgTgSelectChange(val) {
  const customInp = document.getElementById('tg-modal-tg-chat-id');
  if (!customInp) return;
  if (val === '__custom__') {
    customInp.style.display = 'block';
    customInp.value = '';
    customInp.focus();
  } else {
    customInp.style.display = 'none';
    customInp.value = val;
  }
}

let tgMappingInitialState = null;

function getTgMappingCurrentState() {
  return {
    bot_id: document.getElementById('tg-modal-bot-select')?.value || '',
    mapping_name: document.getElementById('tg-modal-mapping-name')?.value || '',
    wa_select: document.getElementById('tg-modal-wa-select')?.value || '',
    wa_jid: document.getElementById('tg-modal-wa-jid')?.value || '',
    tg_select: document.getElementById('tg-modal-tg-select')?.value || '',
    tg_chat_id: document.getElementById('tg-modal-tg-chat-id')?.value || '',
    tg_thread_id: document.getElementById('tg-modal-tg-thread-id')?.value || '',
    sync_mode: document.getElementById('tg-modal-sync-mode')?.value || 'bidirectional',
    ignore_prefixes: document.getElementById('tg-modal-ignore-prefixes')?.value || '',
    inc_group: document.getElementById('tg-modal-inc-group')?.checked || false,
    inc_sender: document.getElementById('tg-modal-inc-sender')?.checked || false,
    sync_self: document.getElementById('tg-modal-sync-self')?.checked || false,
    convert_formatting: document.getElementById('tg-modal-convert-formatting')?.checked || false,
    anonymize_phone: document.getElementById('tg-modal-anonymize-phone')?.checked || false,
    sync_reactions: document.getElementById('tg-modal-sync-reactions')?.checked || false,
    direct_mirror: document.getElementById('tg-modal-direct-mirror')?.checked || false,
    sync_edits: document.getElementById('tg-modal-sync-edits')?.checked || false,
    sync_deletions: document.getElementById('tg-modal-sync-deletions')?.checked || false,
    poll_sync_mode: document.getElementById('tg-modal-poll-sync-mode')?.value || 'native_sync',
    poll_diagram_text: document.getElementById('tg-modal-poll-diagram-text')?.checked || false,
    poll_update_msg: document.getElementById('tg-modal-poll-update-msg')?.checked || false,
    poll_delete_old: document.getElementById('tg-modal-poll-delete-old')?.checked || false,
    sync_system_events: document.getElementById('tg-modal-sync-system-events')?.checked || false,
    sync_pins: document.getElementById('tg-modal-sync-pins')?.checked || false,
    translate_tg_to_wa: document.getElementById('tg-modal-translate-tg-to-wa')?.checked || false,
    translate_tg_to_wa_lang: document.getElementById('tg-modal-trans-tg-wa-lang')?.value || 'en',
    translate_wa_to_tg: document.getElementById('tg-modal-translate-wa-to-tg')?.checked || false,
    translate_wa_to_tg_lang: document.getElementById('tg-modal-trans-wa-tg-lang')?.value || 'en',
  };
}

function hasTgMappingUnsavedChanges() {
  if (!tgMappingInitialState) return false;
  return JSON.stringify(tgMappingInitialState) !== JSON.stringify(getTgMappingCurrentState());
}

function openAddTelegramMappingModal() {
  if (window.updateUrlState) window.updateUrlState('telegram', { action: 'add' });
  const title = document.getElementById('tg-modal-title');
  if (title)
    title.innerHTML =
      '<i class="fas fa-link"></i> ' +
      (window.t ? window.t('telegram.add_mapping_modal_title') : 'Add Telegram Chat Mapping');
  const idEl = document.getElementById('tg-modal-id');
  if (idEl) idEl.value = '';

  const nameEl = document.getElementById('tg-modal-mapping-name');
  if (nameEl) nameEl.value = '';

  const threadEl = document.getElementById('tg-modal-tg-thread-id');
  if (threadEl) threadEl.value = '';

  const prefixesEl = document.getElementById('tg-modal-ignore-prefixes');
  if (prefixesEl) prefixesEl.value = '';

  const directMirrorEl = document.getElementById('tg-modal-direct-mirror');
  if (directMirrorEl) directMirrorEl.checked = false;
  const syncEditsEl = document.getElementById('tg-modal-sync-edits');
  if (syncEditsEl) syncEditsEl.checked = true;
  const syncDeletionsEl = document.getElementById('tg-modal-sync-deletions');
  if (syncDeletionsEl) syncDeletionsEl.checked = true;

  const pollModeEl = document.getElementById('tg-modal-poll-sync-mode');
  if (pollModeEl) pollModeEl.value = 'native_sync';
  const pollDiagramEl = document.getElementById('tg-modal-poll-diagram-text');
  if (pollDiagramEl) pollDiagramEl.checked = true;
  const pollUpdateEl = document.getElementById('tg-modal-poll-update-msg');
  if (pollUpdateEl) pollUpdateEl.checked = true;
  const pollDeleteEl = document.getElementById('tg-modal-poll-delete-old');
  if (pollDeleteEl) pollDeleteEl.checked = true;

  const sysEvEl = document.getElementById('tg-modal-sync-system-events');
  if (sysEvEl) sysEvEl.checked = true;
  const pinsEl = document.getElementById('tg-modal-sync-pins');
  if (pinsEl) pinsEl.checked = true;
  const transTgWaEl = document.getElementById('tg-modal-translate-tg-to-wa');
  if (transTgWaEl) transTgWaEl.checked = false;
  const transWaTgEl = document.getElementById('tg-modal-translate-wa-to-tg');
  if (transWaTgEl) transWaTgEl.checked = false;

  const modal = document.getElementById('tg-mapping-modal');
  if (modal) modal.style.display = 'flex';
  populateTelegramModalDropdowns();
  setTimeout(() => {
    tgMappingInitialState = getTgMappingCurrentState();
  }, 100);
}

async function editTelegramMapping(id) {
  if (window.updateUrlState) window.updateUrlState('telegram', { mapping: id });
  try {
    const res = await fetch(basePath + 'api/telegram/config');
    const json = await res.json();
    if (!json.success || !json.data) return;

    const mapping = (json.data.mappings || []).find((m) => m.id === id);
    if (!mapping) return;

    const title = document.getElementById('tg-modal-title');
    if (title)
      title.innerHTML =
        '<i class="fas fa-edit"></i> ' +
        (window.t ? window.t('telegram.edit_mapping_modal_title') : 'Edit Telegram Chat Mapping');

    const idEl = document.getElementById('tg-modal-id');
    if (idEl) idEl.value = mapping.id;

    const nameEl = document.getElementById('tg-modal-mapping-name');
    if (nameEl) nameEl.value = mapping.name || '';

    const waJidEl = document.getElementById('tg-modal-wa-jid');
    if (waJidEl) waJidEl.value = mapping.wa_jid || '';

    const tgChatIdEl = document.getElementById('tg-modal-tg-chat-id');
    if (tgChatIdEl) tgChatIdEl.value = mapping.tg_chat_id || '';

    const threadEl = document.getElementById('tg-modal-tg-thread-id');
    if (threadEl) threadEl.value = mapping.tg_thread_id || '';

    const syncModeEl = document.getElementById('tg-modal-sync-mode');
    if (syncModeEl) syncModeEl.value = mapping.sync_mode || 'bidirectional';

    const prefixesEl = document.getElementById('tg-modal-ignore-prefixes');
    if (prefixesEl) prefixesEl.value = mapping.ignore_command_prefixes || '';

    const incGroupEl = document.getElementById('tg-modal-inc-group');
    if (incGroupEl) incGroupEl.checked = Boolean(mapping.include_group_name);

    const incSenderEl = document.getElementById('tg-modal-inc-sender');
    if (incSenderEl) incSenderEl.checked = mapping.include_sender_name !== false;

    const syncSelfEl = document.getElementById('tg-modal-sync-self');
    if (syncSelfEl) syncSelfEl.checked = Boolean(mapping.sync_self_messages);

    const convertFormatEl = document.getElementById('tg-modal-convert-formatting');
    if (convertFormatEl) convertFormatEl.checked = mapping.convert_formatting !== false;

    const anonymizePhoneEl = document.getElementById('tg-modal-anonymize-phone');
    if (anonymizePhoneEl) anonymizePhoneEl.checked = Boolean(mapping.anonymize_phone_numbers);

    const syncReactionsEl = document.getElementById('tg-modal-sync-reactions');
    if (syncReactionsEl) syncReactionsEl.checked = mapping.sync_reactions !== false;

    const directMirrorEl = document.getElementById('tg-modal-direct-mirror');
    if (directMirrorEl) directMirrorEl.checked = Boolean(mapping.is_direct_chat_mirror);

    const syncEditsEl = document.getElementById('tg-modal-sync-edits');
    if (syncEditsEl) syncEditsEl.checked = mapping.sync_edits !== false;

    const syncDeletionsEl = document.getElementById('tg-modal-sync-deletions');
    if (syncDeletionsEl) syncDeletionsEl.checked = mapping.sync_deletions !== false;

    const pollModeEl = document.getElementById('tg-modal-poll-sync-mode');
    if (pollModeEl) pollModeEl.value = mapping.poll_sync_mode || 'native_sync';

    const pollDiagramEl = document.getElementById('tg-modal-poll-diagram-text');
    if (pollDiagramEl) pollDiagramEl.checked = mapping.poll_send_text_diagram !== false;

    const pollUpdateEl = document.getElementById('tg-modal-poll-update-msg');
    if (pollUpdateEl) pollUpdateEl.checked = mapping.poll_send_update_message !== false;

    const pollDeleteEl = document.getElementById('tg-modal-poll-delete-old');
    if (pollDeleteEl) pollDeleteEl.checked = mapping.poll_delete_old_message !== false;

    const sysEvEl = document.getElementById('tg-modal-sync-system-events');
    if (sysEvEl) sysEvEl.checked = mapping.sync_system_events !== false;

    const pinsEl = document.getElementById('tg-modal-sync-pins');
    if (pinsEl) pinsEl.checked = mapping.sync_pins !== false;

    const transTgWaEl = document.getElementById('tg-modal-translate-tg-to-wa');
    if (transTgWaEl) transTgWaEl.checked = Boolean(mapping.translate_tg_to_wa);

    const transTgWaLangEl = document.getElementById('tg-modal-trans-tg-wa-lang');
    if (transTgWaLangEl) transTgWaLangEl.value = mapping.translate_tg_to_wa_lang || 'en';

    const transWaTgEl = document.getElementById('tg-modal-translate-wa-to-tg');
    if (transWaTgEl) transWaTgEl.checked = Boolean(mapping.translate_wa_to_tg);

    const transWaTgLangEl = document.getElementById('tg-modal-trans-wa-tg-lang');
    if (transWaTgLangEl) transWaTgLangEl.value = mapping.translate_wa_to_tg_lang || 'en';

    const modal = document.getElementById('tg-mapping-modal');
    if (modal) modal.style.display = 'flex';

    await populateTelegramModalDropdowns(mapping.bot_id);

    const waSelect = document.getElementById('tg-modal-wa-select');
    if (waSelect) {
      if (Array.from(waSelect.options).some((o) => o.value === mapping.wa_jid)) {
        waSelect.value = mapping.wa_jid;
        onTgWaSelectChange(mapping.wa_jid);
      } else {
        waSelect.value = '__custom__';
        onTgWaSelectChange('__custom__');
        if (waJidEl) waJidEl.value = mapping.wa_jid;
      }
    }

    const tgSelect = document.getElementById('tg-modal-tg-select');
    if (tgSelect) {
      if (Array.from(tgSelect.options).some((o) => o.value === mapping.tg_chat_id)) {
        tgSelect.value = mapping.tg_chat_id;
        onTgTgSelectChange(mapping.tg_chat_id);
      } else {
        tgSelect.value = '__custom__';
        onTgTgSelectChange('__custom__');
        if (tgChatIdEl) tgChatIdEl.value = mapping.tg_chat_id;
      }
    }

    tgMappingInitialState = getTgMappingCurrentState();
  } catch (e) {
    showToast(t('telegram.mapping_add_error', { error: e.message }), 'danger');
  }
}

async function closeTelegramMappingModal(force = false) {
  if (!force && hasTgMappingUnsavedChanges()) {
    const confirmClose = await showConfirm(
      t('telegram.unsaved_changes_title'),
      t('telegram.unsaved_changes_msg'),
      t('common.delete'),
      t('common.cancel'),
      'danger'
    );
    if (!confirmClose) {
      return;
    }
  }
  const modal = document.getElementById('tg-mapping-modal');
  if (modal) modal.style.display = 'none';
  tgMappingInitialState = null;
  if (window.updateUrlState) window.updateUrlState('telegram', {});
}

async function saveTelegramMappingModal() {
  const id = document.getElementById('tg-modal-id')?.value || '';
  const bot_id = document.getElementById('tg-modal-bot-select')?.value || '';
  const mapping_name = document.getElementById('tg-modal-mapping-name')?.value || '';

  const waSelect = document.getElementById('tg-modal-wa-select');
  let wa_jid = waSelect?.value || '';
  let wa_name = '';
  if (waSelect && waSelect.selectedIndex >= 0 && wa_jid !== '__custom__') {
    const optText = waSelect.options[waSelect.selectedIndex].text;
    wa_name = optText.replace(/\s*\((Group|Direct)\)$/, '').trim();
  }
  if (wa_jid === '__custom__' || !wa_jid) {
    wa_jid = document.getElementById('tg-modal-wa-jid')?.value || '';
  }

  const tgSelect = document.getElementById('tg-modal-tg-select');
  let tg_chat_id = tgSelect?.value || '';
  let tg_chat_title = '';
  if (tgSelect && tgSelect.selectedIndex >= 0 && tg_chat_id !== '__custom__') {
    const optText = tgSelect.options[tgSelect.selectedIndex].text;
    tg_chat_title = optText.replace(/\s*\([^)]+\)$/, '').trim();
  }
  if (tg_chat_id === '__custom__' || !tg_chat_id) {
    tg_chat_id = document.getElementById('tg-modal-tg-chat-id')?.value || '';
  }

  const tg_thread_id = document.getElementById('tg-modal-tg-thread-id')?.value || '';
  const sync_mode = document.getElementById('tg-modal-sync-mode')?.value || 'bidirectional';
  const ignore_command_prefixes = document.getElementById('tg-modal-ignore-prefixes')?.value || '';

  const include_group_name = document.getElementById('tg-modal-inc-group')?.checked || false;
  const include_sender_name = document.getElementById('tg-modal-inc-sender')?.checked || false;
  const sync_self_messages = document.getElementById('tg-modal-sync-self')?.checked || false;
  const convert_formatting =
    document.getElementById('tg-modal-convert-formatting')?.checked || false;
  const anonymize_phone_numbers =
    document.getElementById('tg-modal-anonymize-phone')?.checked || false;
  const sync_reactions = document.getElementById('tg-modal-sync-reactions')?.checked || false;
  const is_direct_chat_mirror = document.getElementById('tg-modal-direct-mirror')?.checked || false;
  const sync_edits = document.getElementById('tg-modal-sync-edits')?.checked || false;
  const sync_deletions = document.getElementById('tg-modal-sync-deletions')?.checked || false;
  const poll_sync_mode = document.getElementById('tg-modal-poll-sync-mode')?.value || 'native_sync';
  const poll_send_text_diagram =
    document.getElementById('tg-modal-poll-diagram-text')?.checked || false;
  const poll_send_update_message =
    document.getElementById('tg-modal-poll-update-msg')?.checked || false;
  const poll_delete_old_message =
    document.getElementById('tg-modal-poll-delete-old')?.checked || false;
  const sync_system_events =
    document.getElementById('tg-modal-sync-system-events')?.checked || false;
  const sync_pins = document.getElementById('tg-modal-sync-pins')?.checked || false;
  const translate_tg_to_wa =
    document.getElementById('tg-modal-translate-tg-to-wa')?.checked || false;
  const translate_tg_to_wa_lang =
    document.getElementById('tg-modal-trans-tg-wa-lang')?.value || 'en';
  const translate_wa_to_tg =
    document.getElementById('tg-modal-translate-wa-to-tg')?.checked || false;
  const translate_wa_to_tg_lang =
    document.getElementById('tg-modal-trans-wa-tg-lang')?.value || 'en';

  if (!wa_jid || !tg_chat_id) {
    if (!wa_jid && !tg_chat_id) {
      showToast(
        window.t
          ? window.t('telegram.select_both_chats_required')
          : 'Please select both a WhatsApp chat and a Telegram chat.',
        'warning'
      );
    } else if (!wa_jid) {
      showToast(
        window.t
          ? window.t('telegram.select_wa_chat_required')
          : 'Please select a WhatsApp chat / group.',
        'warning'
      );
    } else {
      showToast(
        window.t
          ? window.t('telegram.select_tg_chat_required')
          : 'Please select a Telegram chat / group.',
        'warning'
      );
    }
    return;
  }

  try {
    const res = await fetch(basePath + 'api/telegram/mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: id || undefined,
        bot_id,
        mapping_name,
        wa_jid,
        wa_name: wa_name || undefined,
        tg_chat_id,
        tg_chat_title: tg_chat_title || undefined,
        tg_thread_id,
        sync_mode,
        ignore_command_prefixes,
        include_group_name,
        include_sender_name,
        sync_self_messages,
        convert_formatting,
        anonymize_phone_numbers,
        sync_reactions,
        is_direct_chat_mirror,
        sync_edits,
        sync_deletions,
        poll_sync_mode,
        poll_send_text_diagram,
        poll_send_update_message,
        poll_delete_old_message,
        sync_system_events,
        sync_pins,
        translate_tg_to_wa,
        translate_tg_to_wa_lang,
        translate_wa_to_tg,
        translate_wa_to_tg_lang,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || t('telegram.mapping_add_failed'), 'danger');
    } else {
      showToast(t('telegram.mapping_added'), 'success');
      closeTelegramMappingModal(true);
      loadTelegramBridgeData();
    }
  } catch (e) {
    showToast(t('telegram.mapping_add_error', { error: e.message }), 'danger');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.loadTelegramBridgeData = loadTelegramBridgeData;
window.toggleTelegramBridge = toggleTelegramBridge;
window.openAddTelegramBotModal = openAddTelegramBotModal;
window.editTelegramBot = editTelegramBot;
window.closeTelegramBotModal = closeTelegramBotModal;
window.saveTelegramBotModal = saveTelegramBotModal;
window.deleteTelegramBot = deleteTelegramBot;
window.toggleTelegramMapping = toggleTelegramMapping;
window.deleteTelegramMapping = deleteTelegramMapping;
window.openAddTelegramMappingModal = openAddTelegramMappingModal;
window.editTelegramMapping = editTelegramMapping;
window.closeTelegramMappingModal = closeTelegramMappingModal;
window.saveTelegramMappingModal = saveTelegramMappingModal;
window.onTgBotSelectChange = onTgBotSelectChange;
window.onTgWaSelectChange = onTgWaSelectChange;
window.onTgTgSelectChange = onTgTgSelectChange;

function onTgDirectMirrorToggle(checked) {
  if (checked) {
    const syncSelf = document.getElementById('tg-modal-sync-self');
    const incGroup = document.getElementById('tg-modal-inc-group');
    const incSender = document.getElementById('tg-modal-inc-sender');
    if (syncSelf) syncSelf.checked = true;
    if (incGroup) incGroup.checked = false;
    if (incSender) incSender.checked = false;
  }
}
window.onTgDirectMirrorToggle = onTgDirectMirrorToggle;

function populateTelegramTestMappingDropdown(mappings = []) {
  const select = document.getElementById('tg-test-mapping-select');
  if (!select) return;
  if (mappings.length === 0) {
    select.innerHTML = `<option value="">${window.t('telegram.no_mappings_configured')}</option>`;
    return;
  }
  select.innerHTML = mappings
    .map(
      (m) =>
        `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name || 'Chat Bridge')} (WA: ${escapeHtml(m.wa_jid)} ↔ TG: ${escapeHtml(m.tg_chat_id)})</option>`
    )
    .join('');
}
window.populateTelegramTestMappingDropdown = populateTelegramTestMappingDropdown;

function selectAllTgSubtests(select) {
  const checkboxes = document.querySelectorAll('.tg-subtest-cb');
  checkboxes.forEach((cb) => {
    cb.checked = Boolean(select);
  });
}
window.selectAllTgSubtests = selectAllTgSubtests;

let tgTestPollInterval = null;

async function runTelegramBridgeTest() {
  const mappingSelect = document.getElementById('tg-test-mapping-select');
  const directionSelect = document.getElementById('tg-test-direction-select');
  const runBtn = document.getElementById('tg-run-test-btn');
  const panel = document.getElementById('tg-test-results-panel');
  const statusBadge = document.getElementById('tg-test-status-badge');
  const progressText = document.getElementById('tg-test-progress-text');
  const runIdEl = document.getElementById('tg-test-run-id');
  const logOutput = document.getElementById('tg-test-log-output');

  const mapping_id = mappingSelect?.value;
  const direction = directionSelect?.value || 'wa_to_tg';

  const selected_subtests = Array.from(document.querySelectorAll('.tg-subtest-cb:checked')).map(
    (cb) => cb.value
  );

  if (!mapping_id) {
    showToast(t('telegram.test_mapping'), 'warning');
    return;
  }

  if (selected_subtests.length === 0) {
    showToast(t('telegram.test_subtests'), 'warning');
    return;
  }

  // Pre-flight: check WhatsApp connection status before launching
  if (typeof isConnected !== 'undefined' && !isConnected) {
    showToast(t('chats.not_connected'), 'danger');
    return;
  }

  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> ' +
      (window.t ? window.t('telegram.testing_button') : 'Testing...');
  }

  if (panel) panel.style.display = 'block';
  if (typeof toggleTgTestSuiteUI === 'function') toggleTgTestSuiteUI(true);
  if (statusBadge) {
    statusBadge.style.background = '#0088cc';
    statusBadge.textContent = window.t ? window.t('telegram.status_running') : 'RUNNING';
  }
  if (progressText) {
    const label = window.t('telegram.test_progress_label') || 'Progress';
    progressText.textContent = `${label}: 0 / ${selected_subtests.length} steps`;
  }
  if (runIdEl)
    runIdEl.textContent = window.t
      ? window.t('telegram.run_id_initializing')
      : 'Run ID: Initializing...';
  if (logOutput)
    logOutput.textContent = window.t
      ? window.t('telegram.starting_test_log')
      : 'Starting integration test...\n';

  try {
    const res = await fetch(basePath + 'api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mapping_id,
        direction,
        selected_subtests,
        session_id: currentSession,
      }),
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.error || t('telegram.mapping_add_failed'), 'danger');
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.innerHTML =
          '<i class="fas fa-play"></i> ' +
          (window.t ? window.t('telegram.run_test') : 'Run Integration Test');
      }
      if (statusBadge) {
        statusBadge.style.background = '#dc3545';
        statusBadge.textContent = window.t ? window.t('telegram.status_failed') : 'FAILED';
      }
      if (logOutput) logOutput.textContent += `\nError: ${data.error || 'Failed to start test'}`;
      return;
    }

    const runId = data.runId;
    if (runIdEl) runIdEl.textContent = `Run ID: ${runId}`;

    if (tgTestPollInterval) clearInterval(tgTestPollInterval);

    tgTestPollInterval = setInterval(() => {
      pollTelegramTestResults(runId);
    }, 1000);

    pollTelegramTestResults(runId);
  } catch (err) {
    showToast(t('telegram.mapping_add_error', { error: err.message }), 'danger');
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerHTML = '<i class="fas fa-play"></i> Run Integration Test';
    }
  }
}
window.runTelegramBridgeTest = runTelegramBridgeTest;

async function pollTelegramTestResults(runId) {
  try {
    const res = await fetch(`api/telegram/test/results/${runId}`);
    if (!res.ok) return;

    const json = await res.json();
    if (!json.success || !json.data) return;

    const testRun = json.data;
    const statusBadge = document.getElementById('tg-test-status-badge');
    const progressText = document.getElementById('tg-test-progress-text');
    const logOutput = document.getElementById('tg-test-log-output');
    const runBtn = document.getElementById('tg-run-test-btn');

    if (progressText) {
      const label = window.t('telegram.test_progress_label') || 'Progress';
      progressText.textContent = `${label}: ${testRun.passedSteps} / ${testRun.totalSteps} steps`;
    }

    if (logOutput && Array.isArray(testRun.logs)) {
      const isAtBottom =
        logOutput.scrollHeight - logOutput.scrollTop <= logOutput.clientHeight + 60;
      const formattedLogs = testRun.logs
        .map((l) => {
          const time = l.time ? new Date(l.time).toLocaleTimeString() : '';
          const prefix =
            l.level === 'error'
              ? '❌'
              : l.level === 'success'
                ? '✅'
                : l.level === 'warn'
                  ? '⚠️'
                  : 'ℹ️';
          return `[${time}] ${prefix} [${l.step}] ${l.msg}`;
        })
        .join('\n');
      logOutput.textContent = formattedLogs;
      if (isAtBottom) {
        logOutput.scrollTop = logOutput.scrollHeight;
      }
    }

    if (testRun.status !== 'running') {
      if (tgTestPollInterval) {
        clearInterval(tgTestPollInterval);
        tgTestPollInterval = null;
      }
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fas fa-play"></i> Run Integration Test';
      }
      if (statusBadge) {
        if (testRun.status === 'passed') {
          statusBadge.style.background = '#28a745';
          statusBadge.textContent = 'PASSED ✅';
          showToast(t('telegram.test_ready'), 'success');
        } else {
          statusBadge.style.background = '#dc3545';
          statusBadge.textContent = 'FAILED ❌';
          showToast(t('telegram.test_ready'), 'warning');
        }
      }
    }
  } catch (err) {
    console.error('Error polling Telegram test results', err);
  }
}

function copyTgTestLogs() {
  const logOutput = document.getElementById('tg-test-log-output');
  if (!logOutput || !logOutput.textContent) {
    showToast(t('telegram.test_log'), 'warning');
    return;
  }
  const text = logOutput.textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast(t('telegram.copy_log'), 'success'))
      .catch(() => fallbackCopyTextToClipboard(text));
  } else {
    fallbackCopyTextToClipboard(text);
  }
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showToast(t('telegram.copy_log'), 'success');
    } else {
      showToast(t('telegram.mapping_delete_failed'), 'danger');
    }
  } catch (err) {
    showToast(t('telegram.mapping_delete_error', { error: err.message }), 'danger');
  }
  document.body.removeChild(textArea);
}

function toggleTgTestSuiteUI(forceState) {
  const body = document.getElementById('tg-test-suite-body');
  const chevron = document.getElementById('tg-test-suite-chevron');
  if (!body) return;
  const isExpanded = forceState !== undefined ? forceState : body.style.display !== 'none';
  const nextState = forceState !== undefined ? forceState : !isExpanded;

  body.style.display = nextState ? 'block' : 'none';
  if (chevron) {
    chevron.style.transform = nextState ? 'rotate(180deg)' : 'rotate(0deg)';
  }
}

window.runTelegramBridgeTest = runTelegramBridgeTest;
window.selectAllTgSubtests = selectAllTgSubtests;
window.copyTgTestLogs = copyTgTestLogs;
window.pollTelegramTestResults = pollTelegramTestResults;
window.toggleTgTestSuiteUI = toggleTgTestSuiteUI;
