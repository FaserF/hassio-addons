// Telegram Bridge Dashboard UI Logic

export async function loadTelegramBridgeData() {
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

export function renderTelegramMappings(mappings) {
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

export async function toggleTelegramBridge(enabled) {
  try {
    await fetch('api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    loadTelegramBridgeData();
  } catch (e) {
    alert('Failed to update Telegram Bridge state');
  }
}

export async function saveTelegramBotToken() {
  const token = document.getElementById('tg-bot-token-input')?.value || '';
  try {
    const res = await fetch('api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_token: token }),
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || 'Failed to save bot token');
    } else {
      alert('Bot token validated and saved successfully!');
      loadTelegramBridgeData();
    }
  } catch (e) {
    alert('Error connecting to server');
  }
}

export async function toggleTelegramMapping(id) {
  await fetch(`api/telegram/mappings/${id}/toggle`, { method: 'POST' });
  loadTelegramBridgeData();
}

export async function deleteTelegramMapping(id) {
  if (!confirm('Are you sure you want to remove this Telegram chat mapping?')) return;
  await fetch(`api/telegram/mappings/${id}`, { method: 'DELETE' });
  loadTelegramBridgeData();
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
