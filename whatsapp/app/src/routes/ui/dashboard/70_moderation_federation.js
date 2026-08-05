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
