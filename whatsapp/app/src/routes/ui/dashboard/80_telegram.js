// Telegram Bridge Dashboard UI Logic

let cachedTelegramBots = [];

async function loadTelegramBridgeData() {
  try {
    const res = await fetch('api/telegram/config');
    const data = await res.json();
    if (data.success && data.data) {
      const cfg = data.data;
      const toggle = document.getElementById('tg-global-toggle');
      if (toggle) toggle.checked = Boolean(cfg.enabled);

      cachedTelegramBots = cfg.bots || [];
      renderTelegramBots(cachedTelegramBots);
      renderTelegramMappings(cfg.mappings || [], cachedTelegramBots);
    }
  } catch (err) {
    console.error('Failed to load Telegram bridge config', err);
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
    <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--bg-body); border:1px solid var(--border-color); border-radius:8px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="font-size: 20px; color: #0088cc; background: rgba(0, 136, 204, 0.15); width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
          <i class="fas fa-robot"></i>
        </div>
        <div>
          <div style="font-weight:600; font-size:14px;">${escapeHtml(b.name || '@' + b.username)}</div>
          <div style="font-size:12px; color:var(--text-muted); font-family:monospace;">
            Username: @${escapeHtml(b.username || 'unknown')} | Token: ${escapeHtml(b.token ? b.token.substring(0, 10) + '...' : 'none')}
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="editTelegramBot('${b.id}')" title="Edit Bot"><i class="fas fa-edit"></i> Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTelegramBot('${b.id}')" title="Delete Bot"><i class="fas fa-trash"></i></button>
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

      const waTitle = m.wa_name && m.wa_name !== m.wa_jid ? m.wa_name : '';
      const tgTitle =
        m.tg_chat_title && !m.tg_chat_title.startsWith('Chat ') ? m.tg_chat_title : '';

      const cleanWa = waTitle || m.wa_jid.split('@')[0];
      const cleanTg = tgTitle || `TG ${m.tg_chat_id}`;
      const threadLabel = m.tg_thread_id ? ` (Topic ${m.tg_thread_id})` : '';
      const autoName = `${cleanWa} ↔ ${cleanTg}${threadLabel}`;
      const displayName = m.name || autoName;

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
    await fetch('api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    showToast(enabled ? 'Telegram Bridge Enabled ✈️' : 'Telegram Bridge Disabled', 'info');
    loadTelegramBridgeData();
  } catch (e) {
    showToast('Failed to update Telegram Bridge state', 'danger');
  }
}

function openAddTelegramBotModal() {
  const title = document.getElementById('tg-bot-modal-title');
  if (title) title.innerHTML = '<i class="fas fa-robot"></i> Add Telegram Bot';

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
  if (title) title.innerHTML = '<i class="fas fa-edit"></i> Edit Telegram Bot';

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
    showToast('Please enter a valid Bot Token', 'warning');
    return;
  }

  try {
    const res = await fetch('api/telegram/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id || undefined, name, token }),
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Failed to save bot', 'danger');
    } else {
      showToast('Telegram Bot saved & connected successfully! 🤖', 'success');
      closeTelegramBotModal();
      loadTelegramBridgeData();
    }
  } catch (e) {
    showToast('Error saving Bot Token', 'danger');
  }
}

async function deleteTelegramBot(botId) {
  if (!confirm('Are you sure you want to remove this Telegram Bot and all associated mappings?')) return;
  try {
    await fetch(`api/telegram/bots/${botId}`, { method: 'DELETE' });
    showToast('Telegram Bot removed', 'warning');
    loadTelegramBridgeData();
  } catch (e) {
    showToast('Failed to delete bot', 'danger');
  }
}

async function toggleTelegramMapping(id) {
  await fetch(`api/telegram/mappings/${id}/toggle`, { method: 'POST' });
  showToast('Mapping status updated', 'info');
  loadTelegramBridgeData();
}

async function deleteTelegramMapping(id) {
  if (!confirm('Are you sure you want to remove this Telegram chat mapping?')) return;
  await fetch(`api/telegram/mappings/${id}`, { method: 'DELETE' });
  showToast('Telegram mapping removed', 'warning');
  loadTelegramBridgeData();
}

async function populateTelegramModalDropdowns(selectedBotId = '') {
  const botSelect = document.getElementById('tg-modal-bot-select');
  const waSelect = document.getElementById('tg-modal-wa-select');
  const tgSelect = document.getElementById('tg-modal-tg-select');

  // 0. Populate Bot Select
  if (botSelect) {
    let botOpts = '';
    if (cachedTelegramBots.length === 0) {
      botOpts = '<option value="">No bots configured - Add a bot first</option>';
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
    let waOpts = '<option value="">-- Select WhatsApp Chat / Group --</option>';
    try {
      const res = await fetch('api/chats?session_id=' + (window.currentSession || ''));
      if (res.ok) {
        const chats = await res.json();
        if (Array.isArray(chats)) {
          chats.forEach((c) => {
            const jid = c.jid || c.id;
            if (jid) {
              const name = c.name || c.formattedTitle || jid;
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
  }

  // 2. Populate Telegram Cached Chats Dropdown (filtered by activeBotId if set)
  if (tgSelect) {
    let tgOpts = '<option value="">-- Select Telegram Chat / Group --</option>';
    try {
      const url = activeBotId ? `api/telegram/chats?bot_id=${encodeURIComponent(activeBotId)}` : 'api/telegram/chats';
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

function openAddTelegramMappingModal() {
  const title = document.getElementById('tg-modal-title');
  if (title) title.innerHTML = '<i class="fas fa-link"></i> Add Telegram Chat Mapping';
  const idEl = document.getElementById('tg-modal-id');
  if (idEl) idEl.value = '';

  const nameEl = document.getElementById('tg-modal-mapping-name');
  if (nameEl) nameEl.value = '';

  const threadEl = document.getElementById('tg-modal-tg-thread-id');
  if (threadEl) threadEl.value = '';

  const prefixesEl = document.getElementById('tg-modal-ignore-prefixes');
  if (prefixesEl) prefixesEl.value = '';

  const modal = document.getElementById('tg-mapping-modal');
  if (modal) modal.style.display = 'flex';
  populateTelegramModalDropdowns();
}

async function editTelegramMapping(id) {
  try {
    const res = await fetch('api/telegram/config');
    const json = await res.json();
    if (!json.success || !json.data) return;

    const mapping = (json.data.mappings || []).find((m) => m.id === id);
    if (!mapping) return;

    const title = document.getElementById('tg-modal-title');
    if (title) title.innerHTML = '<i class="fas fa-edit"></i> Edit Telegram Chat Mapping';

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
  } catch (e) {
    showToast('Error opening mapping editor', 'danger');
  }
}

function closeTelegramMappingModal() {
  const modal = document.getElementById('tg-mapping-modal');
  if (modal) modal.style.display = 'none';
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

  if (!wa_jid || !tg_chat_id) {
    showToast('Please select both a WhatsApp Chat and a Telegram Chat', 'warning');
    return;
  }

  try {
    const res = await fetch('api/telegram/mappings', {
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
      }),
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Failed to save mapping', 'danger');
    } else {
      showToast('Telegram mapping saved successfully!', 'success');
      closeTelegramMappingModal();
      loadTelegramBridgeData();
    }
  } catch (e) {
    showToast('Failed to connect to server', 'danger');
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
