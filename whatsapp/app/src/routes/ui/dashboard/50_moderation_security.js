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
