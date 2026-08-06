// Moderation Intelligence (AI Auto-Reply, Sentiment, System Prompt, Filters)

async function addFilterRule() {
  const trig = document.getElementById('mod-filter-trigger')?.value.trim();
  const resp = document.getElementById('mod-filter-response')?.value.trim();
  if (!trig || !resp || !currentModGroup) return;

  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.filters = groupConfig.filters || [];
  groupConfig.filters.push({ trigger: trig, response: resp, is_regex: false });

  document.getElementById('mod-filter-trigger').value = '';
  document.getElementById('mod-filter-response').value = '';

  await saveGroupConfig(groupConfig);
  showToast('Filter added!', 'success');
  selectModerationGroup(currentModGroup);
  setTimeout(() => {
    const el = document.getElementById('mod-filter-trigger');
    if (el) el.focus();
  }, 50);
}

async function removeFilterRule(idx) {
  if (!currentModGroup || !modStoreCache?.groups?.[currentModGroup]) return;
  const groupConfig = modStoreCache.groups[currentModGroup];
  if (groupConfig.filters) {
    groupConfig.filters.splice(idx, 1);
    await saveGroupConfig(groupConfig);
    selectModerationGroup(currentModGroup);
  }
}

async function saveGroupFilters() {
  if (!currentModGroup) return;
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  await saveGroupConfig(groupConfig);
  markClean();
  showToast('Filters saved!', 'success');
}

async function saveGroupAiConfig() {
  if (!currentModGroup) return showToast('Please select a group', 'warning');
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.ai = {
    enabled: Boolean(document.getElementById('mod-ai-enabled')?.checked),
    faq_auto_reply: Boolean(document.getElementById('mod-ai-faq')?.checked),
    sentiment_moderation: Boolean(document.getElementById('mod-ai-sentiment')?.checked),
    system_prompt:
      document.getElementById('mod-ai-prompt')?.value ||
      'You are an intelligent, friendly, and professional WhatsApp Group Moderator AI. Your goals are to assist group members with accurate information, enforce group etiquette, keep responses concise, polite, and well-formatted for WhatsApp, and maintain a constructive community atmosphere.',
  };
  groupConfig.translation = {
    enabled: true,
    target_lang: document.getElementById('mod-trans-lang')?.value || 'en',
    mode: document.getElementById('mod-trans-mode')?.value || 'manual',
  };

  const apiKey = document.getElementById('mod-ai-key')?.value || '';

  try {
    const res = await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_id: currentModGroup,
        group_config: groupConfig,
        gemini_api_key: apiKey,
      }),
    });
    if (res.ok) {
      markClean();
      showToast('AI & Translation Settings Saved!', 'success');
      loadModerationConfig();
    }
  } catch (e) {
    showToast('Failed to save AI settings', 'danger');
  }
}
