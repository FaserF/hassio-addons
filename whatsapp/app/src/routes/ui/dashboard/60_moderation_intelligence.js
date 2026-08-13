// Moderation Intelligence (AI Auto-Reply, Sentiment, System Prompt, Filters)

async function addFilterRule() {
  const trig = document.getElementById('mod-filter-trigger')?.value.trim();
  const resp = document.getElementById('mod-filter-response')?.value.trim();
  const type = document.getElementById('mod-filter-type')?.value || 'reply';
  if (!trig || !resp || !currentModGroup) return;

  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.filters = groupConfig.filters || [];
  groupConfig.filters.push({ trigger: trig, response: resp, type: type, is_regex: false });

  document.getElementById('mod-filter-trigger').value = '';
  document.getElementById('mod-filter-response').value = '';

  await saveGroupConfig(groupConfig);
  showToast(
    t('moderation.filter_rule_added', { type: type === 'faq' ? 'FAQ' : 'Auto-reply' }),
    'success'
  );
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
  showToast(t('moderation.filters_saved'), 'success');
}

async function saveGroupAiConfig() {
  if (!currentModGroup) return showToast(t('moderation.select_group_warning'), 'warning');
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.ai = {
    provider: document.getElementById('mod-ai-provider')?.value || 'gemini',
    enabled: Boolean(document.getElementById('mod-ai-enabled')?.checked),
    faq_auto_reply: Boolean(document.getElementById('mod-ai-faq')?.checked),
    sentiment_moderation: Boolean(document.getElementById('mod-ai-sentiment')?.checked),
    system_prompt:
      document.getElementById('mod-ai-prompt')?.value ||
      'You are an intelligent, friendly, and professional WhatsApp Group Moderator AI. Your goals are to assist group members with accurate information, enforce group etiquette, keep responses concise, polite, and well-formatted for WhatsApp, and maintain a constructive community atmosphere.',
  };
  groupConfig.stt_enabled = Boolean(document.getElementById('mod-stt-enabled')?.checked);
  groupConfig.translation = {
    enabled: true,
    target_lang:
      (
        document.getElementById('mod-trans-lang') ||
        document.getElementById('mod-trans-target-lang')
      )?.value || 'en',
    mode: document.getElementById('mod-trans-mode')?.value || 'manual',
    provider: document.getElementById('mod-trans-provider')?.value || 'auto',
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
      showToast(t('moderation.ai_settings_saved'), 'success');
      loadModerationConfig();
    }
  } catch (e) {
    showToast(t('moderation.ai_settings_save_failed'), 'danger');
  }
}
