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
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:24px;">No active chat mappings configured. Click "Add New Mapping" to start bridging.</td></tr>`;
    return;
  }

  tbody.innerHTML = mappings
    .map(
      (m) => `
    <tr>
      <td>
        <label class="mod-toggle-switch mod-toggle-sm">
          <input type="checkbox" ${m.enabled ? 'checked' : ''} onchange="toggleTelegramMapping('${m.id}')">
          <span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span>
        </label>
      </td>
      <td><strong>${escapeHtml(m.wa_name || m.wa_jid)}</strong><br><small style="color:var(--text-muted);">${escapeHtml(m.wa_jid)}</small></td>
      <td><strong>${escapeHtml(m.tg_chat_title || m.tg_chat_id)}</strong><br><small style="color:var(--text-muted);">${escapeHtml(m.tg_chat_id)} (${m.tg_chat_type || 'chat'})</small></td>
      <td><span class="badge" style="background:var(--bg-card); border:1px solid var(--border-color);">${m.sync_mode}</span></td>
      <td>
        <small style="color:var(--text-muted);">
          Group: ${m.include_group_name ? 'Yes' : 'No'} | Sender: ${m.include_sender_name ? 'Yes' : 'No'}<br>
          Sync Self Messages: <strong>${m.sync_self_messages ? 'Enabled' : 'Disabled (Off)'}</strong>
        </small>
      </td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteTelegramMapping('${m.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `
    )
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
  const modal = document.getElementById('tg-mapping-modal');
  if (modal) modal.style.display = 'flex';
  populateTelegramModalDropdowns();
}

function closeTelegramMappingModal() {
  const modal = document.getElementById('tg-mapping-modal');
  if (modal) modal.style.display = 'none';
}

async function saveTelegramMappingModal() {
  let wa_jid = document.getElementById('tg-modal-wa-select')?.value || '';
  if (wa_jid === '__custom__' || !wa_jid) {
    wa_jid = document.getElementById('tg-modal-wa-jid')?.value || '';
  }

  let tg_chat_id = document.getElementById('tg-modal-tg-select')?.value || '';
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
        wa_jid,
        tg_chat_id,
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
window.closeTelegramMappingModal = closeTelegramMappingModal;
window.saveTelegramMappingModal = saveTelegramMappingModal;
window.onTgWaSelectChange = onTgWaSelectChange;
window.onTgTgSelectChange = onTgTgSelectChange;
