// Telegram Bridge Dashboard UI Logic

async function loadTelegramBridgeData() {
  try {
    const res = await fetch('api/telegram/config');
    const data = await res.json();
    if (data.success && data.data) {
      const cfg = data.data;
      const toggle = document.getElementById('tg-global-toggle');
      if (toggle) toggle.checked = Boolean(cfg.enabled);

      const tokenInput = document.getElementById('tg-bot-token-input');
      if (tokenInput && cfg.bot_token) tokenInput.value = cfg.bot_token;

      const badge = document.getElementById('tg-bot-status-badge');
      const badgeText = document.getElementById('tg-bot-status-text');
      if (badge && badgeText) {
        if (cfg.bot_username) {
          badge.style.display = 'flex';
          badgeText.innerText = `Connected Telegram Bot: @${cfg.bot_username}`;
        } else {
          badge.style.display = 'none';
        }
      }

      renderTelegramMappings(cfg.mappings || []);
    }
  } catch (err) {
    console.error('Failed to load Telegram bridge config', err);
  }
}

function renderTelegramMappings(mappings) {
  const tbody = document.getElementById('tg-mappings-tbody');
  if (!tbody) return;

  if (mappings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:32px;"><i class="fas fa-link" style="font-size:32px; opacity:0.3; margin-bottom:8px; display:block;"></i>No active chat mappings configured. Click "Add New Mapping" to start bridging.</td></tr>`;
    return;
  }

  tbody.innerHTML = mappings
    .map((m) => {
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
      <td style="vertical-align:middle; padding:12px 14px;"><strong>${escapeHtml(displayName)}</strong></td>
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

async function saveTelegramBotToken() {
  const token = document.getElementById('tg-bot-token-input')?.value || '';
  try {
    const res = await fetch('api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_token: token }),
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Failed to save bot token', 'danger');
    } else {
      showToast('Bot token validated and saved successfully! 🤖', 'success');
      loadTelegramBridgeData();
    }
  } catch (e) {
    showToast('Error connecting to server', 'danger');
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

async function populateTelegramModalDropdowns() {
  const waSelect = document.getElementById('tg-modal-wa-select');
  const tgSelect = document.getElementById('tg-modal-tg-select');

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

  // 2. Populate Telegram Cached Chats Dropdown
  if (tgSelect) {
    let tgOpts = '<option value="">-- Select Telegram Chat / Group --</option>';
    try {
      const res = await fetch('api/telegram/chats');
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

    await populateTelegramModalDropdowns();

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
window.saveTelegramBotToken = saveTelegramBotToken;
window.toggleTelegramMapping = toggleTelegramMapping;
window.deleteTelegramMapping = deleteTelegramMapping;
window.openAddTelegramMappingModal = openAddTelegramMappingModal;
window.editTelegramMapping = editTelegramMapping;
window.closeTelegramMappingModal = closeTelegramMappingModal;
window.saveTelegramMappingModal = saveTelegramMappingModal;
window.onTgWaSelectChange = onTgWaSelectChange;
window.onTgTgSelectChange = onTgTgSelectChange;
