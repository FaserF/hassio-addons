// Moderation Federation & Import/Export

async function saveGroupFederation() {
  if (!currentModGroup) return;
  const fedId = document.getElementById('mod-fed-select')?.value || '';
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.federation_id = fedId;
  await saveGroupConfig(groupConfig);
  showToast('Federation settings saved!', 'success');
}

async function addFedBlacklistWord() {
  const inp = document.getElementById('mod-fed-blacklist-new');
  if (!inp || !inp.value.trim() || !modStoreCache?.federations) return;
  const word = inp.value.trim();
  const fedId = document.getElementById('mod-fed-select')?.value || 'fed_global_default';
  const fed = modStoreCache.federations.find((f) => f.id === fedId) || modStoreCache.federations[0];
  if (fed) {
    fed.shared_blacklist = fed.shared_blacklist || [];
    if (!fed.shared_blacklist.includes(word)) {
      fed.shared_blacklist.push(word);
    }
    inp.value = '';
    await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ federations: modStoreCache.federations }),
    });
    showToast('Federation pattern added!', 'success');
    loadModerationConfig();
    setTimeout(() => {
      const el = document.getElementById('mod-fed-blacklist-new');
      if (el) el.focus();
    }, 50);
  }
}

async function removeFedBlacklistWord(idx) {
  if (!modStoreCache?.federations) return;
  const fedId = document.getElementById('mod-fed-select')?.value || 'fed_global_default';
  const fed = modStoreCache.federations.find((f) => f.id === fedId) || modStoreCache.federations[0];
  if (fed && fed.shared_blacklist) {
    fed.shared_blacklist.splice(idx, 1);
    await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ federations: modStoreCache.federations }),
    });
    showToast('Federation pattern removed', 'info');
    loadModerationConfig();
  }
}

async function saveGroupConfig(groupConfig) {
  // Always preserve the current enabled state from the DOM toggle
  // to prevent it from being silently dropped on partial saves
  const enabledToggle = document.getElementById('mod-group-toggle');
  if (enabledToggle !== null) {
    groupConfig.enabled = Boolean(enabledToggle.checked);
  }

  try {
    const res = await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: currentModGroup, group_config: groupConfig }),
    });
    if (res.ok) {
      loadModerationConfig();
    }
  } catch (e) {
    console.error('Failed to save group config:', e);
  }
}

async function exportGroupModerationConfig() {
  if (!currentModGroup) return showToast('Please select a group first', 'warning');
  try {
    const res = await fetch(
      basePath + `api/moderation/groups/${encodeURIComponent(currentModGroup)}/export`,
      {
        method: 'POST',
      }
    );
    if (!res.ok) return;
    const json = await res.json();
    const str = JSON.stringify(json.data, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moderation_${currentModGroup.split('@')[0]}.json`;
    a.click();
    showToast('Export downloaded!', 'success');
  } catch (e) {
    showToast('Export failed', 'danger');
  }
}

async function importGroupModerationConfig() {
  if (!currentModGroup) return showToast('Please select a group first', 'warning');
  const txt = document.getElementById('mod-import-text')?.value.trim();
  if (!txt) return showToast('Please paste JSON data first', 'warning');

  try {
    const data = JSON.parse(txt);
    const res = await fetch(
      basePath + `api/moderation/groups/${encodeURIComponent(currentModGroup)}/import`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
    if (res.ok) {
      showToast('Config imported successfully!', 'success');
      loadModerationConfig();
    } else {
      showToast('Import failed', 'danger');
    }
  } catch (e) {
    showToast('Invalid JSON format', 'danger');
  }
}

function updateFedBlacklistTagsInUi() {
  const fedSelect = document.getElementById('mod-fed-select');
  const fedTags = document.getElementById('mod-fed-blacklist-tags');
  if (!fedTags || !modStoreCache?.federations) return;

  const fedId = fedSelect?.value || 'fed_global_default';
  let fed = modStoreCache.federations.find((f) => f.id === fedId);
  if (!fed && fedId === 'fed_global_default') {
    fed = modStoreCache.federations[0];
  }
  const words = fed?.shared_blacklist || [];

  if (!words.length) {
    fedTags.innerHTML =
      '<span style="color:var(--text-muted);font-size:12px;">No shared federation patterns configured</span>';
  } else {
    fedTags.innerHTML = words
      .map(
        (w, idx) => `
      <span class="mod-tag" style="display:inline-flex;align-items:center;gap:6px;background:rgba(52,152,219,0.15);color:#3498db;border:1px solid rgba(52,152,219,0.3);padding:4px 10px;border-radius:16px;font-size:12px;margin:3px;">
        <span>${escapeHtml(w)}</span>
        <button style="background:none;border:none;color:#3498db;cursor:pointer;padding:0;font-size:14px;line-height:1;" onclick="removeFedBlacklistWord(${idx})">&times;</button>
      </span>`
      )
      .join('');
  }
}

function openCreateFederationModal() {
  const modal = document.getElementById('create-federation-modal');
  if (modal) modal.style.display = 'flex';
}

function closeCreateFederationModal() {
  const modal = document.getElementById('create-federation-modal');
  if (modal) modal.style.display = 'none';
}

async function saveNewCustomFederation() {
  const name = document.getElementById('mod-new-fed-name')?.value.trim();
  const desc =
    document.getElementById('mod-new-fed-desc')?.value.trim() || 'Custom local security federation';
  if (!name) return showToast('Please enter a federation name', 'warning');

  const newFed = {
    id: `fed_local_${Date.now()}`,
    name: name,
    description: desc,
    auto_kick_spammers: true,
    block_mass_invites: true,
    shared_blacklist_enabled: true,
    banned_users: [],
    shared_blacklist: [
      't.me/',
      'telegram.me/',
      'chat.whatsapp.com/',
      'whatsapp.com/channel/',
      'wa.me/',
      'crypto-airdrop',
      'crypto',
    ],
  };

  modStoreCache.federations = modStoreCache.federations || [];
  modStoreCache.federations.push(newFed);

  try {
    const res = await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ federations: modStoreCache.federations }),
    });
    if (res.ok) {
      showToast(`Custom Federation "${name}" created! 🛡️`, 'success');
      closeCreateFederationModal();
      const nameEl = document.getElementById('mod-new-fed-name');
      if (nameEl) nameEl.value = '';
      const descEl = document.getElementById('mod-new-fed-desc');
      if (descEl) descEl.value = '';
      await loadModerationConfig();
      const fedSelect = document.getElementById('mod-fed-select');
      if (fedSelect) {
        fedSelect.value = newFed.id;
        updateFedBlacklistTagsInUi();
      }
    }
  } catch (e) {
    showToast('Failed to create custom federation', 'danger');
  }
}

function exportFederationConfig() {
  const fedSelect = document.getElementById('mod-fed-select');
  const fedId = fedSelect?.value || 'fed_global_default';
  const fed = (modStoreCache?.federations || []).find((f) => f.id === fedId);
  if (!fed) return showToast('No active federation selected to export', 'warning');

  const exportData = {
    version: '1.0',
    type: 'whatsapp_federation',
    federation: fed,
  };

  const str = JSON.stringify(exportData, null, 2);
  const blob = new Blob([str], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `federation_${fed.id}.json`;
  a.click();
  showToast(`Exported Federation "${fed.name || fed.id}"! 🛡️`, 'success');
}

function openImportFederationModal() {
  const modal = document.getElementById('import-federation-modal');
  if (modal) modal.style.display = 'flex';
}

function closeImportFederationModal() {
  const modal = document.getElementById('import-federation-modal');
  if (modal) modal.style.display = 'none';
  const urlInp = document.getElementById('mod-import-fed-url');
  if (urlInp) urlInp.value = '';
  const fileInp = document.getElementById('mod-import-fed-file');
  if (fileInp) fileInp.value = '';
}

async function submitImportFederation() {
  const urlInp = document.getElementById('mod-import-fed-url')?.value.trim();
  const fileInp = document.getElementById('mod-import-fed-file');
  const file = fileInp?.files?.[0];

  let importedData;

  if (urlInp) {
    try {
      showToast('Fetching federation JSON from URL...', 'info');
      const res = await fetch(urlInp);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      importedData = await res.json();
    } catch (err) {
      showToast(`Failed to fetch from URL: ${err.message}`, 'danger');
      return;
    }
  } else if (file) {
    try {
      const text = await file.text();
      importedData = JSON.parse(text);
    } catch (err) {
      showToast('Invalid JSON file', 'danger');
      return;
    }
  } else {
    showToast('Please enter a URL or select a JSON file to import', 'warning');
    return;
  }

  // Handle either direct federation object or wrapped export structure
  const fedObj = importedData?.federation || importedData;
  if (!fedObj || typeof fedObj !== 'object' || !fedObj.name) {
    return showToast(
      'Invalid federation JSON structure. Must contain at least a "name" property.',
      'danger'
    );
  }

  // Ensure unique ID
  const targetId =
    fedObj.id && fedObj.id !== 'fed_global_default' ? fedObj.id : `fed_imported_${Date.now()}`;
  fedObj.id = targetId;

  modStoreCache.federations = modStoreCache.federations || [];
  const idx = modStoreCache.federations.findIndex((f) => f.id === targetId);
  if (idx >= 0) {
    modStoreCache.federations[idx] = fedObj;
  } else {
    modStoreCache.federations.push(fedObj);
  }

  try {
    const res = await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ federations: modStoreCache.federations }),
    });
    if (res.ok) {
      showToast(`Federation "${fedObj.name}" imported successfully! 🛡️`, 'success');
      closeImportFederationModal();
      await loadModerationConfig();
      const fedSelect = document.getElementById('mod-fed-select');
      if (fedSelect) {
        fedSelect.value = targetId;
        updateFedBlacklistTagsInUi();
      }
    }
  } catch (e) {
    showToast('Failed to save imported federation', 'danger');
  }
}
