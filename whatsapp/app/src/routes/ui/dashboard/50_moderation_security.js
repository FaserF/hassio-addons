// Moderation Security (Content Locks, Anti-Spam / Anti-Raid, Blacklist)

async function saveGroupLocks() {
  if (!currentModGroup) return showToast(t('moderation.select_group_warning'), 'warning');
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
  showToast(t('moderation.locks_saved'), 'success');
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
  groupConfig.blacklist = groupConfig.blacklist || { enabled: true, words: [], action: 'delete' };
  groupConfig.blacklist.matching_mode =
    document.getElementById('mod-blacklist-mode')?.value || 'exact';
  await saveGroupConfig(groupConfig);
  markClean();
  showToast(t('moderation.blacklist_saved'), 'success');
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
    bot_anti_spam: {
      enabled: Boolean(document.getElementById('mod-antispam-bot-enabled')?.checked),
      max_messages_5s: 5,
    },
    notify_deleted_action: Boolean(document.getElementById('mod-notify-deleted-action')?.checked),

    notify_bypassed_actions: Boolean(
      document.getElementById('mod-notify-bypassed-actions')?.checked
    ),
    blocked_invite_platforms: {
      whatsapp: Boolean(document.getElementById('mod-invite-platform-whatsapp')?.checked),
      telegram: Boolean(document.getElementById('mod-invite-platform-telegram')?.checked),
      signal: Boolean(document.getElementById('mod-invite-platform-signal')?.checked),
      instagram: Boolean(document.getElementById('mod-invite-platform-instagram')?.checked),
      discord: Boolean(document.getElementById('mod-invite-platform-discord')?.checked),
      other: Boolean(document.getElementById('mod-invite-platform-other')?.checked),
    },
  };
  groupConfig.anti_spam_links_enabled = Boolean(
    document.getElementById('mod-antispam-links-enabled')?.checked
  );
  await saveGroupConfig(groupConfig);
  markClean();
  showToast(t('moderation.antispam_antiraid_saved'), 'success');
}

let testTargetUser = '';

async function generateGroupTestCommandsModal() {
  if (!currentModGroup) {
    showToast(t('moderation.select_group_warning'), 'warning');
    return;
  }
  const modal = document.getElementById('test-commands-modal');
  const container = document.getElementById('test-commands-modal-content');
  if (!modal || !container) return;

  const config = modStoreCache?.groups?.[currentModGroup] || {};
  const prefix = config.commands?.prefix || '!';

  // Use cached commands or fetch with basePath
  let commandsList = typeof builtinCommandsCache !== 'undefined' ? builtinCommandsCache : [];
  if (!commandsList || commandsList.length === 0) {
    try {
      const res = await fetch(
        (typeof basePath !== 'undefined' ? basePath : '') + 'api/moderation/commands'
      );
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        commandsList = json.data;
      }
    } catch (_e) {
      /* fallback */
    }
  }

  const disabledCmds = new Set(config.commands?.disabled_commands || []);
  const activeCmds = commandsList.filter((c) => !disabledCmds.has(c.cmd));

  let html = `<div style="font-size:12px;display:flex;flex-direction:column;gap:12px;">`;

  // 1. Group Info Banner, Prefill Target Input & Send-to-Group button
  html += `
    <div style="padding:10px;background:rgba(41,182,246,0.1);border:1px solid rgba(41,182,246,0.3);border-radius:6px;display:flex;flex-direction:column;gap:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
        <div>
          <strong>Target Group:</strong> <code>${escapeHtml(currentModGroup)}</code> &middot;
          <strong>Prefix:</strong> <code>${escapeHtml(prefix)}</code> &middot;
          <strong>Active Commands:</strong> ${activeCmds.length}/${commandsList.length}
        </div>
        <button class="btn btn-primary btn-sm" style="padding:4px 12px;font-size:11px;white-space:nowrap;" onclick="sendTestSuiteToGroup()" title="Send all active commands as a WhatsApp message to this group">
          <i class="fas fa-paper-plane"></i> Send to Group
        </button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;background:var(--card-bg);padding:6px 10px;border-radius:4px;border:1px solid var(--border-color);">
        <label style="font-weight:600;white-space:nowrap;color:var(--text-main);"><i class="fas fa-user-tag" style="color:var(--primary);"></i> Prefill User / Phone:</label>
        <input type="text" id="test-target-user-input" class="mod-input" style="flex:1;padding:4px 8px;font-size:12px;" placeholder="e.g. @john, @491761234567 or 491761234567" value="${escapeHtml(testTargetUser)}" oninput="updateTestCommandsPrefill(this.value)">
      </div>
    </div>`;

  const userPlaceholder = testTargetUser
    ? testTargetUser.startsWith('@')
      ? testTargetUser
      : '@' + testTargetUser
    : '@user';

  // Helper for copyable block with per-item copy buttons
  const makeCopyableBlock = (title, items, icon = 'fas fa-terminal') => {
    if (!items || items.length === 0) return '';
    const rawText = items.join('\n');

    let itemsHtml = items
      .map((item) => {
        const escapedItem = escapeHtml(item).replace(/`/g, '&#96;').replace(/\\/g, '&#92;');
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:var(--body-bg);border:1px solid var(--border-color);border-radius:4px;margin-bottom:4px;">
          <code style="font-size:11px;white-space:pre-wrap;word-break:break-all;color:var(--text-main);">${escapedItem}</code>
          <button class="btn btn-secondary btn-sm" style="padding:1px 6px;font-size:10px;margin-left:8px;flex-shrink:0;" onclick="navigator.clipboard.writeText(this.previousElementSibling.innerText);showToast(t('chats.copied'),'success');" title="Copy command"><i class="fas fa-copy"></i></button>
        </div>`;
      })
      .join('');

    return `
      <div style="background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;padding:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <strong style="color:var(--primary);font-size:13px;"><i class="${icon}"></i> ${escapeHtml(title)} (${items.length})</strong>
          <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px;" onclick="copyAllFromBlock(this);"><i class="fas fa-copy"></i> Copy All</button>
        </div>
        <div class="copyable-block-items" style="max-height:180px;overflow-y:auto;">${itemsHtml}</div>
      </div>`;
  };

  // 2. Active Built-in Commands (Sampled with realistic parameters)
  const activeTestPayloads = activeCmds.map((c) => {
    const p = prefix;
    const u = userPlaceholder;
    switch (c.cmd) {
      case 'setrules':
        return `${p}setrules 1. Be polite and respectful.\n2. No spam links allowed.`;
      case 'warn':
        return `${p}warn ${u} Violation of group rules`;
      case 'unwarn':
        return `${p}unwarn ${u}`;
      case 'mute':
        return `${p}mute ${u} 10m`;
      case 'tmute':
        return `${p}tmute ${u} 15m`;
      case 'tban':
        return `${p}tban ${u} 1h`;
      case 'kick':
        return `${p}kick ${u}`;
      case 'ban':
        return `${p}ban ${u} Rule violation`;
      case 'promote':
        return `${p}promote ${u}`;
      case 'demote':
        return `${p}demote ${u}`;
      case 'approve':
        return `${p}approve ${u}`;
      case 'unapprove':
        return `${p}unapprove ${u}`;
      case 'lock':
        return `${p}lock url`;
      case 'unlock':
        return `${p}unlock url`;
      case 'setwelcome':
        return `${p}setwelcome Welcome {mention} to {group}!`;
      case 'setgoodbye':
        return `${p}setgoodbye Goodbye {name}!`;
      case 'report':
        return `${p}report ${u} Inappropriate message content`;
      case 'notes':
        return `${p}notes #wifi 12345678`;
      case 'filter':
        return `${p}filter wlan -> Password is 1234`;
      case 'setlang':
        return `${p}setlang de`;
      case 'translate':
        return `${p}translate de Hello world`;
      case 'removespamlinks':
        return `${p}removespamlinks on`;
      case 'autotranslate':
        return `${p}autotranslate on`;
      case 'slowmode':
        return `${p}slowmode 10s`;
      default:
        return `${p}${c.cmd}`;
    }
  });

  html += makeCopyableBlock(
    'Built-in Moderation Commands (Sample Payloads)',
    activeTestPayloads,
    'fas fa-terminal'
  );

  // 3. Spam & Link Triggers (Telegram, WA, Chat Invites)
  const inviteTestPayloads = [
    'https://t.me/joinchat/SPAMMER123',
    'https://telegram.me/spambot_group',
    'https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv',
    'https://wa.me/491761234567',
    'https://wa.link/spamcode',
  ];
  html += makeCopyableBlock(
    'Fake Anti-Spam & Invite Link Triggers (t.me / wa.me / chat.whatsapp.com)',
    inviteTestPayloads,
    'fas fa-link'
  );

  // 4. Custom Mapped Commands
  const customCmds = config.commands?.custom_commands || [];
  if (customCmds.length > 0) {
    const customPayloads = customCmds.map((c) => `${prefix}${c.command.replace(/^[!/#]+/, '')}`);
    html += makeCopyableBlock('Configured Custom Commands', customPayloads, 'fas fa-cogs');
  }

  // 5. Auto-Responder Triggers
  const filters = config.filters || [];
  if (filters.length > 0) {
    const filterPayloads = filters.map((f) => f.trigger);
    html += makeCopyableBlock('Auto-Responder & FAQ Triggers', filterPayloads, 'fas fa-robot');
  }

  // 6. Blacklisted Words Triggers
  const blWords = config.blacklist?.words || [];
  if (blWords.length > 0) {
    html += makeCopyableBlock('Blacklist Word Triggers', blWords, 'fas fa-ban');
  }

  html += `</div>`;
  container.innerHTML = html;
  modal.classList.add('show');
}

function updateTestCommandsPrefill(val) {
  testTargetUser = val ? val.trim() : '';
  generateGroupTestCommandsModal();
  const inp = document.getElementById('test-target-user-input');
  if (inp) {
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
  }
}

function copyAllFromBlock(btnBtn) {
  const block = btnBtn.closest('div').parentElement;
  const codes = block.querySelectorAll('.copyable-block-items code');
  const text = Array.from(codes)
    .map((c) => c.innerText)
    .join('\n');
  navigator.clipboard.writeText(text);
  showToast(t('chats.copied'), 'success');
}

function closeTestCommandsModal() {
  const modal = document.getElementById('test-commands-modal');
  if (modal) modal.classList.remove('show');
}

async function sendTestSuiteToGroup() {
  if (!currentModGroup) {
    showToast(t('moderation.select_group_warning'), 'warning');
    return;
  }

  // Collect all visible command codes from the modal
  const modal = document.getElementById('test-commands-modal');
  if (!modal) return;
  const codes = modal.querySelectorAll('.copyable-block-items code');
  if (!codes || codes.length === 0) {
    showToast(t('moderation.select_group_warning'), 'warning');
    return;
  }

  const lines = Array.from(codes)
    .map((c) => c.innerText.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    showToast(t('moderation.select_group_warning'), 'warning');
    return;
  }

  const message = lines.join('\n');

  try {
    const resp = await fetch((typeof basePath !== 'undefined' ? basePath : '') + 'send_message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': typeof apiToken !== 'undefined' ? apiToken : '',
      },
      body: JSON.stringify({
        number: currentModGroup,
        message,
        session_id: typeof currentSession !== 'undefined' ? currentSession : undefined,
      }),
    });
    if (resp.ok) {
      showToast(t('chats.message_sent'), 'success');
    } else {
      const err = await resp.json().catch(() => ({}));
      showToast(t('chats.message_send_failed'), 'danger');
    }
  } catch (e) {
    showToast(t('chats.network_error_send'), 'danger');
  }
}

function toggleAutoTestModeUI(enabled) {
  const optionsDiv = document.getElementById('mod-autotest-options');
  const logStream = document.getElementById('mod-autotest-log-stream');
  if (optionsDiv) {
    optionsDiv.style.display = enabled ? 'flex' : 'none';
  }
  if (!enabled && logStream) {
    logStream.style.display = 'none';
  }
}

function selectAllModSubtests(select) {
  const checkboxes = document.querySelectorAll('.mod-subtest-cb');
  checkboxes.forEach((cb) => {
    cb.checked = Boolean(select);
  });
}

function clearAutoTestLogs() {
  const logContent = document.getElementById('mod-autotest-log-content');
  const progressBar = document.getElementById('mod-autotest-progress-bar');
  const progressContainer = document.getElementById('mod-autotest-progress-bar-container');
  if (logContent) logContent.innerHTML = '';
  if (progressBar) progressBar.style.width = '0%';
  if (progressContainer) progressContainer.style.display = 'none';
}

function exportAutoTestLogs() {
  const logContent = document.getElementById('mod-autotest-log-content');
  if (!logContent || !logContent.innerText.trim()) {
    showToast(t('moderation.select_group_warning'), 'warning');
    return;
  }
  const text = logContent.innerText;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `moderation-autotest-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function runAutonomousModerationTest() {
  if (!currentModGroup) {
    showToast(t('moderation.select_group_warning'), 'warning');
    return;
  }

  const safeOnly = Boolean(document.getElementById('mod-autotest-safe-only')?.checked);
  const delayMs = parseInt(document.getElementById('mod-autotest-delay')?.value, 10) || 500;
  const runBtn = document.getElementById('btn-run-autotest');
  const logStream = document.getElementById('mod-autotest-log-stream');
  const logContent = document.getElementById('mod-autotest-log-content');
  const progressBar = document.getElementById('mod-autotest-progress-bar');
  const progressContainer = document.getElementById('mod-autotest-progress-bar-container');

  const selected_subtests = Array.from(document.querySelectorAll('.mod-subtest-cb:checked')).map(
    (cb) => cb.value
  );

  if (selected_subtests.length === 0) {
    showToast(t('moderation.select_group_warning'), 'warning');
    return;
  }

  if (logStream) logStream.style.display = 'block';
  if (progressContainer) progressContainer.style.display = 'block';
  if (progressBar) progressBar.style.width = '0%';
  if (logContent) logContent.innerHTML = '';
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> ' +
      (window.t ? window.t('moderation.running_test') : 'Running...');
  }

  const appendLog = (msg, styleType = 'normal') => {
    if (!logContent) return;
    const isAtBottom = logStream
      ? logStream.scrollHeight - logStream.scrollTop <= logStream.clientHeight + 60
      : true;
    const div = document.createElement('div');
    if (styleType === 'error') {
      div.style.color = '#ff5555';
    } else if (styleType === 'category') {
      div.style.color = '#00e5ff';
      div.style.fontWeight = 'bold';
      div.style.marginTop = '6px';
    } else if (styleType === 'header') {
      div.style.color = '#ffcc00';
      div.style.fontWeight = 'bold';
    } else if (styleType === 'success') {
      div.style.color = '#33ff33';
    } else {
      div.style.color = '#cccccc';
    }
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logContent.appendChild(div);
    if (logStream && isAtBottom) {
      logStream.scrollTop = logStream.scrollHeight;
    }
  };

  appendLog(
    `🚀 Initiating autonomous auto-test for group: ${currentModGroup} (Safe-Only: ${safeOnly}, Delay: ${delayMs}ms)...`,
    'header'
  );

  try {
    const res = await fetch(
      (typeof basePath !== 'undefined' ? basePath : '') + 'api/moderation/autotest',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': typeof apiToken !== 'undefined' ? apiToken : '',
        },
        body: JSON.stringify({
          group_id: currentModGroup,
          safe_only: safeOnly,
          delay_ms: delayMs,
          selected_subtests,
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      let errMsg = res.statusText;
      try {
        const jsonErr = JSON.parse(errText);
        errMsg = jsonErr.error || jsonErr.message || errMsg;
      } catch (_e) {}
      throw new Error(errMsg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep last incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'log') {
            const style =
              event.level === 'category_start'
                ? 'category'
                : event.level === 'error'
                  ? 'error'
                  : 'normal';
            appendLog(event.message, style);
          } else if (event.type === 'progress') {
            const pct = Math.round((event.step / event.total) * 100);
            if (progressBar) progressBar.style.width = `${pct}%`;
            const statusSymbol = event.status === 'PASSED' ? '✅' : '❌';
            appendLog(
              `Step ${event.step}/${event.total} [${event.category.split('.')[0]}]: "${event.command}" -> ${event.status} ${statusSymbol} (${event.details})`,
              event.status === 'PASSED' ? 'success' : 'error'
            );
          } else if (event.type === 'complete') {
            if (progressBar) progressBar.style.width = '100%';
            appendLog(`----------------------------------------`, 'header');
            appendLog(
              `✅ Auto-test completed! Passed: ${event.data.passed}/${event.data.total} in ${(event.data.duration_ms / 1000).toFixed(2)}s`,
              'success'
            );
            appendLog(`📩 Markdown summary report delivered to WhatsApp group!`, 'header');
            showToast(t('moderation.antispam_antiraid_saved'), 'success');
          }
        } catch (_err) {
          appendLog(line, 'normal');
        }
      }
    }

    if (buffer && buffer.trim()) {
      try {
        const event = JSON.parse(buffer.trim());
        if (event.type === 'log') {
          appendLog(
            event.message,
            event.level === 'category_start'
              ? 'category'
              : event.level === 'error'
                ? 'error'
                : 'normal'
          );
        } else if (event.type === 'complete') {
          if (progressBar) progressBar.style.width = '100%';
          appendLog(`----------------------------------------`, 'header');
          appendLog(
            `✅ Auto-test completed! Passed: ${event.data.passed}/${event.data.total} in ${(event.data.duration_ms / 1000).toFixed(2)}s`,
            'success'
          );
          appendLog(`📩 Markdown summary report delivered to WhatsApp group!`, 'header');
          showToast(t('moderation.antispam_antiraid_saved'), 'success');
        }
      } catch (_e) {
        appendLog(buffer.trim(), 'normal');
      }
    }
  } catch (err) {
    appendLog(`❌ Auto-test error: ${err.message}`, 'error');
    showToast(t('moderation.group_update_failed'), 'danger');
  } finally {
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerHTML =
        '<i class="fas fa-play"></i> ' +
        (window.t ? window.t('moderation.start_auto_test') : 'Start Auto-Test');
    }
  }
}

function copyAutoTestLogs() {
  const logContent = document.getElementById('mod-autotest-log-content');
  if (logContent && logContent.textContent) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(logContent.textContent);
    }
    showToast(t('chats.copied'), 'success');
  }
}

window.runAutonomousModerationTest = runAutonomousModerationTest;
window.clearAutoTestLogs = clearAutoTestLogs;
window.exportAutoTestLogs = exportAutoTestLogs;
window.copyAutoTestLogs = copyAutoTestLogs;
