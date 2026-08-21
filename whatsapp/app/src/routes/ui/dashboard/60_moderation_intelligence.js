function onFilterMediaTypeChange() {
  const mediaType = document.getElementById('mod-filter-media-type')?.value;
  const mediaWrap = document.getElementById('mod-filter-media-wrap');
  if (mediaWrap) {
    mediaWrap.style.display = mediaType === 'sticker' || mediaType === 'gif' ? 'flex' : 'none';
  }
}

function onFilterTypeChange() {
  // Can be extended if FAQ needs custom visibility toggles
}

function addFilterPollOptionInput() {
  const container = document.getElementById('mod-filter-poll-options-list');
  if (!container) return;
  const count = container.querySelectorAll('.mod-filter-poll-opt').length + 1;
  if (count > 12) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'mod-input mod-input-sm mod-filter-poll-opt';
  input.placeholder = `Option ${count}`;
  container.appendChild(input);
}

async function addFilterRule() {
  const trig = document.getElementById('mod-filter-trigger')?.value.trim();
  const resp = document.getElementById('mod-filter-response')?.value.trim();
  const type = document.getElementById('mod-filter-type')?.value || 'reply';
  const mediaType = document.getElementById('mod-filter-media-type')?.value || 'text';
  const mediaUrl = document.getElementById('mod-filter-media-url')?.value.trim() || '';
  const reactionEmoji = document.getElementById('mod-filter-reaction')?.value.trim() || '';
  const fileUrl = document.getElementById('mod-filter-file-url')?.value.trim() || '';
  const fileName = document.getElementById('mod-filter-file-name')?.value.trim() || '';
  const pollQ = document.getElementById('mod-filter-poll-q')?.value.trim() || '';

  const pollOpts = [];
  document.querySelectorAll('.mod-filter-poll-opt').forEach((inp) => {
    const val = inp.value.trim();
    if (val) pollOpts.push(val);
  });

  if (
    !trig ||
    (!resp && !reactionEmoji && !mediaUrl && !fileUrl && pollOpts.length < 2) ||
    !currentModGroup
  )
    return;

  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.filters = groupConfig.filters || [];

  const filterEntry = {
    trigger: trig,
    response: resp,
    type: type,
    is_regex: false,
  };

  if (reactionEmoji) filterEntry.reaction_emoji = reactionEmoji;
  if (mediaType !== 'text') filterEntry.media_type = mediaType;
  if (mediaUrl) filterEntry.media_url = mediaUrl;
  if (fileUrl) filterEntry.file_url = fileUrl;
  if (fileName) filterEntry.file_name = fileName;
  if (pollQ && pollOpts.length >= 2) {
    filterEntry.poll_question = pollQ;
    filterEntry.poll_options = pollOpts;
  }

  groupConfig.filters.push(filterEntry);

  const trigInp = document.getElementById('mod-filter-trigger');
  const respInp = document.getElementById('mod-filter-response');
  const reactInp = document.getElementById('mod-filter-reaction');
  const mediaUrlInp = document.getElementById('mod-filter-media-url');
  const fileUrlInp = document.getElementById('mod-filter-file-url');
  const fileNameInp = document.getElementById('mod-filter-file-name');
  const pollQInp = document.getElementById('mod-filter-poll-q');

  if (trigInp) trigInp.value = '';
  if (respInp) respInp.value = '';
  if (reactInp) reactInp.value = '';
  if (mediaUrlInp) mediaUrlInp.value = '';
  if (fileUrlInp) fileUrlInp.value = '';
  if (fileNameInp) fileNameInp.value = '';
  if (pollQInp) pollQInp.value = '';

  const pollList = document.getElementById('mod-filter-poll-options-list');
  if (pollList) {
    pollList.innerHTML = `
      <input type="text" class="mod-input mod-input-sm mod-filter-poll-opt" placeholder="Option 1">
      <input type="text" class="mod-input mod-input-sm mod-filter-poll-opt" placeholder="Option 2">
    `;
  }

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
  groupConfig.stt_allow_private_chats = Boolean(
    document.getElementById('mod-stt-private-enabled')?.checked
  );
  groupConfig.stt_engine = document.getElementById('mod-stt-engine')?.value || 'aegisbot';
  groupConfig.stt_aegisbot_url =
    document.getElementById('mod-stt-aegisbot-url')?.value?.trim() || '';
  groupConfig.stt_aegisbot_key =
    document.getElementById('mod-stt-aegisbot-key')?.value?.trim() || '';
  groupConfig.translation = {
    enabled: document.getElementById('mod-trans-enabled')
      ? Boolean(document.getElementById('mod-trans-enabled').checked)
      : true,
    target_lang:
      (
        document.getElementById('mod-trans-lang') ||
        document.getElementById('mod-trans-target-lang')
      )?.value || 'en',
    mode: document.getElementById('mod-trans-mode')?.value || 'manual',
    provider: document.getElementById('mod-trans-provider')?.value || 'auto',
    engine_priority: [
      document.getElementById('mod-trans-prio-1')?.value,
      document.getElementById('mod-trans-prio-2')?.value,
      document.getElementById('mod-trans-prio-3')?.value,
      document.getElementById('mod-trans-prio-4')?.value,
      document.getElementById('mod-trans-prio-5')?.value,
    ].filter(Boolean),
  };
  groupConfig.security_scan = {
    enabled: Boolean(document.getElementById('mod-sec-scan-enabled')?.checked),
    scan_files: Boolean(document.getElementById('mod-sec-scan-files')?.checked),
    engine: document.getElementById('mod-sec-scan-engine')?.value || 'local',
    trigger: document.getElementById('mod-sec-scan-trigger')?.value || 'auto',
    quiet_mode: true,
  };

  const apiKey =
    (document.getElementById('mod-ai-api-key') || document.getElementById('mod-ai-key'))?.value ||
    '';

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
      setTimeout(refreshModerationDiagnostics, 200);
    }
  } catch (e) {
    showToast(t('moderation.ai_settings_save_failed'), 'danger');
  }
}

async function refreshModerationDiagnostics() {
  if (!currentModGroup) return;
  try {
    const res = await fetch(
      basePath + 'api/moderation/diagnostics?group_id=' + encodeURIComponent(currentModGroup)
    );
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        renderModerationDiagnostics(json.data);
      }
    }
  } catch (e) {
    console.debug('Failed to refresh moderation diagnostics:', e);
  }
}

function renderModerationDiagnostics(data) {
  if (!data) return;

  // --- 1. STT Diagnostics ---
  const stt = data.stt || {};
  const sttCard = document.getElementById('mod-stt-diag-card');
  const sttBadge = document.getElementById('mod-stt-status-badge');
  const sttEngine = document.getElementById('mod-stt-active-engine');
  const sttReason = document.getElementById('mod-stt-reason');
  const sttLastRow = document.getElementById('mod-stt-last-activity-row');
  const sttLastVal = document.getElementById('mod-stt-last-activity');
  const sttErrorsBox = document.getElementById('mod-stt-errors-container');
  const sttErrorsList = document.getElementById('mod-stt-errors-list');

  if (sttCard) {
    sttCard.style.display = 'block';

    if (sttBadge) {
      sttBadge.className = 'mod-diag-badge ' + (stt.status || 'disabled');
      let badgeText = stt.status || 'Unknown';
      if (stt.status === 'healthy') badgeText = t('moderation.status_healthy') || 'Operational';
      else if (stt.status === 'disabled') badgeText = t('moderation.status_disabled') || 'Disabled';
      else if (stt.status === 'no_key') badgeText = t('moderation.status_no_key') || 'No API Key';
      else if (stt.status === 'error') badgeText = t('moderation.status_error') || 'Error';
      sttBadge.textContent = badgeText;
    }

    if (sttEngine) {
      sttEngine.textContent = stt.active_engine_name || stt.active_engine || 'Auto';
    }

    if (sttReason) {
      sttReason.textContent = stt.selection_reason || '—';
    }

    if (sttLastRow && sttLastVal) {
      if (stt.last_event && stt.last_event.timestamp) {
        sttLastRow.style.display = 'flex';
        const d = new Date(stt.last_event.timestamp);
        const timeStr = d.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const outcome = stt.last_event.status === 'success' ? '✅ Success' : '❌ Failed';
        const preview = stt.last_event.transcribed_snippet
          ? ` ("${stt.last_event.transcribed_snippet}…")`
          : '';
        const errDetail = stt.last_event.error ? ` (${stt.last_event.error})` : '';
        sttLastVal.textContent = `${timeStr} — ${stt.last_event.engineName || stt.last_event.engine} [${outcome}]${preview}${errDetail}`;
      } else {
        sttLastRow.style.display = 'none';
      }
    }

    if (sttErrorsBox && sttErrorsList) {
      const errs = Array.isArray(stt.recent_errors) ? stt.recent_errors : [];
      if (errs.length > 0) {
        sttErrorsBox.style.display = 'block';
        sttErrorsList.innerHTML = errs
          .map((err) => {
            const time = new Date(err.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            return `<div class="mod-diag-error-item">
              <span class="mod-diag-error-msg"><strong>[${escapeHtml(err.engine)}]:</strong> ${escapeHtml(err.error)}</span>
              <span class="mod-diag-error-time">${time}</span>
            </div>`;
          })
          .join('');
      } else {
        sttErrorsBox.style.display = 'none';
        sttErrorsList.innerHTML = '';
      }
    }
  }

  // --- 2. Translation Diagnostics ---
  const trans = data.translation || {};
  const transCard = document.getElementById('mod-trans-diag-card');
  const transBadge = document.getElementById('mod-trans-status-badge');
  const transProv = document.getElementById('mod-trans-active-provider');
  const transReason = document.getElementById('mod-trans-reason');
  const transHealth = document.getElementById('mod-trans-providers-health');
  const transLastRow = document.getElementById('mod-trans-last-activity-row');
  const transLastVal = document.getElementById('mod-trans-last-activity');
  const transErrorsBox = document.getElementById('mod-trans-errors-container');
  const transErrorsList = document.getElementById('mod-trans-errors-list');

  if (transCard) {
    transCard.style.display = 'block';

    if (transBadge) {
      transBadge.className = 'mod-diag-badge ' + (trans.status || 'healthy');
      let badgeText = trans.status || 'Healthy';
      if (trans.status === 'healthy') badgeText = t('moderation.status_healthy') || 'Operational';
      else if (trans.status === 'disabled')
        badgeText = t('moderation.status_disabled') || 'Disabled';
      else if (trans.status === 'degraded')
        badgeText = t('moderation.status_degraded') || 'Degraded / Failover';
      else if (trans.status === 'error') badgeText = t('moderation.status_error') || 'Error';
      transBadge.textContent = badgeText;
    }

    if (transProv) {
      transProv.textContent =
        trans.active_provider_name || trans.active_provider || 'Google Translate';
    }

    if (transReason) {
      transReason.textContent = trans.selection_reason || '—';
    }

    if (transHealth && trans.health) {
      const chips = [];
      for (const [k, v] of Object.entries(trans.health)) {
        let chipClass = 'chip-healthy';
        let chipIcon = 'fa-check-circle';
        let statusLabel = 'OK';

        if (v.status === 'cooldown') {
          chipClass = 'chip-cooldown';
          chipIcon = 'fa-hourglass-half';
          statusLabel = `${v.cooldown_remaining_sec}s Cooldown`;
        } else if (v.status === 'no_key') {
          chipClass = 'chip-no_key';
          chipIcon = 'fa-key';
          statusLabel = 'No Key';
        } else if (v.status === 'error') {
          chipClass = 'chip-error';
          chipIcon = 'fa-times-circle';
          statusLabel = 'Error';
        }

        chips.push(
          `<span class="mod-diag-chip ${chipClass}"><i class="fas ${chipIcon}"></i> ${escapeHtml(v.name || k)}: ${statusLabel}</span>`
        );
      }
      transHealth.innerHTML = chips.join('');
    }

    if (transLastRow && transLastVal) {
      if (trans.last_event && trans.last_event.timestamp) {
        transLastRow.style.display = 'flex';
        const d = new Date(trans.last_event.timestamp);
        const timeStr = d.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const outcome = trans.last_event.status === 'success' ? '✅ Success' : '❌ Failed';
        const srcDst = trans.last_event.sourceLang
          ? ` (${trans.last_event.sourceLang} → ${trans.last_event.targetLang})`
          : ` (→ ${trans.last_event.targetLang})`;
        transLastVal.textContent = `${timeStr} — ${trans.last_event.providerName || trans.last_event.provider} [${outcome}]${srcDst}`;
      } else {
        transLastRow.style.display = 'none';
      }
    }

    if (transErrorsBox && transErrorsList) {
      const errs = Array.isArray(trans.recent_errors) ? trans.recent_errors : [];
      if (errs.length > 0) {
        transErrorsBox.style.display = 'block';
        transErrorsList.innerHTML = errs
          .map((err) => {
            const time = new Date(err.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            return `<div class="mod-diag-error-item">
              <span class="mod-diag-error-msg"><strong>[${escapeHtml(err.provider)}]:</strong> ${escapeHtml(err.error)}</span>
              <span class="mod-diag-error-time">${time}</span>
            </div>`;
          })
          .join('');
      } else {
        transErrorsBox.style.display = 'none';
        transErrorsList.innerHTML = '';
      }
    }
  }
}

function updateSttEngineNotice() {
  const engine = document.getElementById('mod-stt-engine')?.value;
  const aegisConfig = document.getElementById('mod-stt-aegisbot-config');
  if (aegisConfig) {
    aegisConfig.style.display = engine === 'aegisbot' || engine === 'auto' ? 'block' : 'none';
  }
}
window.updateSttEngineNotice = updateSttEngineNotice;

function onTranslationProviderChange() {
  const prov = document.getElementById('mod-trans-provider')?.value;
  const prioBox = document.getElementById('mod-trans-priority-container');
  if (prioBox) {
    prioBox.style.display = prov === 'custom' || prov === 'auto' ? 'block' : 'none';
  }
}
window.onTranslationProviderChange = onTranslationProviderChange;

async function testAegisBotConnection() {
  const urlInput = document.getElementById('mod-stt-aegisbot-url');
  const keyInput = document.getElementById('mod-stt-aegisbot-key');
  const feedback = document.getElementById('aegisbot-test-feedback');
  const btn = document.getElementById('btn-test-aegisbot');

  const url = urlInput?.value?.trim();
  const token = keyInput?.value?.trim();

  if (!url) {
    if (feedback) {
      feedback.style.display = 'inline';
      feedback.style.color = '#ef4444';
      feedback.textContent = '⚠️ Bitte gib eine AegisBot Server URL ein.';
    }
    return;
  }

  if (feedback) {
    feedback.style.display = 'inline';
    feedback.style.color = '#94a3b8';
    feedback.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> ' +
      (window.t ? window.t('moderation.stt_aegisbot_testing') : 'Verbindung wird geprüft...');
  }
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(basePath + 'api/moderation/test-aegisbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token }),
    });
    const data = await res.json();
    if (btn) btn.disabled = false;

    if (data.success) {
      if (feedback) {
        feedback.style.color = '#22c55e';
        feedback.innerHTML = `<i class="fas fa-check-circle"></i> ${data.version || 'AegisBot'} (${data.latency}ms) — ${data.engine || 'OK'}`;
      }
      if (window.showToast) {
        window.showToast(
          window.t
            ? window.t('moderation.stt_aegisbot_test_success', {
                latency: data.latency,
                version: data.version || 'v0.1.1',
              })
            : `✅ AegisBot (${data.latency}ms)`,
          'success'
        );
      }
      if (window.refreshModerationDiagnostics) refreshModerationDiagnostics();
    } else {
      if (feedback) {
        feedback.style.color = '#ef4444';
        feedback.innerHTML = `<i class="fas fa-times-circle"></i> ${data.error || 'Fehlgeschlagen'}`;
      }
      if (window.showToast) {
        window.showToast(
          window.t
            ? window.t('moderation.stt_aegisbot_test_failed', { error: data.error || 'Error' })
            : `❌ ${data.error || 'Error'}`,
          'error'
        );
      }
    }
  } catch (err) {
    if (btn) btn.disabled = false;
    if (feedback) {
      feedback.style.color = '#ef4444';
      feedback.innerHTML = `<i class="fas fa-times-circle"></i> ${err.message}`;
    }
  }
}
window.testAegisBotConnection = testAegisBotConnection;
