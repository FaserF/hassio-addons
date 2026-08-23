// Google Antigravity Ingress Dashboard Client

(function () {
  'use strict';

  // Ingress-aware API base path resolver
  const currentPath = window.location.pathname.replace(/\/+$/, '');
  const API_BASE = currentPath ? `${currentPath}/api` : '/api';

  // DOM Elements - Header & Global
  const accountSelect = document.getElementById('accountSelect');
  const accountSelectorWrapper = document.getElementById('accountSelectorWrapper');
  const refreshBtn = document.getElementById('refreshBtn');
  const openAddAccountBtn = document.getElementById('openAddAccountBtn');
  const deleteAccountBtn = document.getElementById('deleteAccountBtn');
  const openGuideBtn = document.getElementById('openGuideBtn');
  const closeGuideBtn = document.getElementById('closeGuideBtn');
  const modalDoneBtn = document.getElementById('modalDoneBtn');
  const guideModal = document.getElementById('guideModal');
  const noticeBanner = document.getElementById('noticeBanner');
  const noticeTitle = document.getElementById('noticeTitle');
  const noticeText = document.getElementById('noticeText');
  const noticeGuideBtn = document.getElementById('noticeGuideBtn');

  // Containers
  const emptyStateContainer = document.getElementById('emptyStateContainer');
  const emptyStateAddBtn = document.getElementById('emptyStateAddBtn');
  const dashboardContent = document.getElementById('dashboardContent');

  // Add Account Modal Elements
  const addAccountModal = document.getElementById('addAccountModal');
  const closeAddAccountBtn = document.getElementById('closeAddAccountBtn');
  const tabDeviceBtn = document.getElementById('tabDeviceBtn');
  const tabManualBtn = document.getElementById('tabManualBtn');
  const tabDeviceContent = document.getElementById('tabDeviceContent');
  const tabManualContent = document.getElementById('tabManualContent');

  // Device Flow Elements
  const deviceStartSection = document.getElementById('deviceStartSection');
  const deviceActiveSection = document.getElementById('deviceActiveSection');
  const deviceAccountNameInput = document.getElementById('deviceAccountNameInput');
  const startDeviceFlowBtn = document.getElementById('startDeviceFlowBtn');
  const deviceUserCode = document.getElementById('deviceUserCode');
  const copyCodeBtn = document.getElementById('copyCodeBtn');
  const deviceAuthLink = document.getElementById('deviceAuthLink');
  const devicePollStatusText = document.getElementById('devicePollStatusText');

  // Manual Account Elements
  const manualAccountNameInput = document.getElementById('manualAccountNameInput');
  const manualTokenInput = document.getElementById('manualTokenInput');
  const saveManualAccountBtn = document.getElementById('saveManualAccountBtn');
  const manualSaveResult = document.getElementById('manualSaveResult');

  // Guide / Test Elements
  const testCredsBtn = document.getElementById('testCredsBtn');
  const testCredsInput = document.getElementById('testCredsInput');
  const testResult = document.getElementById('testResult');

  // Metrics elements
  const planBadge = document.getElementById('planBadge');
  const accountEmail = document.getElementById('accountEmail');
  const projectId = document.getElementById('projectId');
  const accountStatus = document.getElementById('accountStatus');
  const creditsBadge = document.getElementById('creditsBadge');
  const creditsBalance = document.getElementById('creditsBalance');
  const creditsSubtext = document.getElementById('creditsSubtext');
  const pollingBadge = document.getElementById('pollingBadge');
  const nextPollCountdown = document.getElementById('nextPollCountdown');
  const currentIntervalDisplay = document.getElementById('currentIntervalDisplay');
  const lastUpdatedTime = document.getElementById('lastUpdatedTime');

  // Gauge elements
  const rollingResetPill = document.getElementById('rollingResetPill');
  const rollingGaugePath = document.getElementById('rollingGaugePath');
  const rollingGaugeValue = document.getElementById('rollingGaugeValue');
  const rollingRequestsText = document.getElementById('rollingRequestsText');
  const rollingProgressBar = document.getElementById('rollingProgressBar');
  const rollingRemainingCount = document.getElementById('rollingRemainingCount');
  const rollingRemainingPct = document.getElementById('rollingRemainingPct');

  const weeklyResetPill = document.getElementById('weeklyResetPill');
  const weeklyGaugePath = document.getElementById('weeklyGaugePath');
  const weeklyGaugeValue = document.getElementById('weeklyGaugeValue');
  const weeklyRequestsText = document.getElementById('weeklyRequestsText');
  const weeklyProgressBar = document.getElementById('weeklyProgressBar');
  const weeklyRemainingCount = document.getElementById('weeklyRemainingCount');
  const weeklyRemainingPct = document.getElementById('weeklyRemainingPct');

  const modelsGrid = document.getElementById('modelsGrid');

  // State
  let systemStatus = null;
  let selectedAccountName = '';
  let countdownSeconds = 0;
  let countdownTimer = null;
  let devicePollInterval = null;

  async function fetchStatus() {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      systemStatus = await res.json();
      renderApp();
    } catch (err) {
      console.error('Failed to load status:', err);
      showNotice('Connection Error', `Failed to query Antigravity API: ${err.message}`, true);
    }
  }

  async function handleRefresh() {
    refreshBtn.disabled = true;
    const icon = refreshBtn.querySelector('.refresh-icon');
    if (icon) icon.classList.add('spinning');

    try {
      const payload = { account_name: selectedAccountName || null, force: true };
      const res = await fetch(`${API_BASE}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      systemStatus = await res.json();
      renderApp();
    } catch (err) {
      console.error('Refresh error:', err);
      showNotice('Refresh Failed', err.message, true);
    } finally {
      refreshBtn.disabled = false;
      if (icon) icon.classList.remove('spinning');
    }
  }

  function renderApp() {
    if (!systemStatus) return;

    const accounts = systemStatus.accounts || [];
    const validAccounts = accounts.filter(
      (a) => a.status !== 'unconfigured' && a.email !== 'Not configured'
    );

    // Empty state handling
    if (accounts.length === 0 || validAccounts.length === 0) {
      emptyStateContainer.classList.remove('hidden');
      dashboardContent.classList.add('hidden');
      deleteAccountBtn.classList.add('hidden');
      accountSelectorWrapper.classList.add('hidden');
      hideNotice();
      return;
    }

    emptyStateContainer.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    accountSelectorWrapper.classList.remove('hidden');
    deleteAccountBtn.classList.remove('hidden');

    // Populate Account Switcher Dropdown
    updateAccountDropdown();

    const currentAccount = getSelectedAccount();
    if (!currentAccount) return;

    // Render Notice Banner if account has error
    if (currentAccount.error_message) {
      showNotice(
        currentAccount.status === 'unauthenticated' ? 'Authentication Required' : 'Notice',
        currentAccount.error_message,
        currentAccount.status === 'unauthenticated'
      );
    } else {
      hideNotice();
    }

    // Top Cards
    renderAccountCard(currentAccount);
    renderCreditsCard(currentAccount);
    renderPollingCard();

    // Gauges
    renderRollingGauge(currentAccount.rolling_5h_limit);
    renderWeeklyGauge(currentAccount.weekly_limit);

    // Models Breakdown
    renderModels(currentAccount.models || []);

    // Countdown setup
    setupCountdown();
  }

  function updateAccountDropdown() {
    const prevSelected = accountSelect.value || selectedAccountName;
    accountSelect.innerHTML = '';

    systemStatus.accounts.forEach((acc) => {
      const opt = document.createElement('option');
      opt.value = acc.account_name;
      opt.textContent = `${acc.account_name} (${acc.email})`;
      accountSelect.appendChild(opt);
    });

    if (prevSelected && systemStatus.accounts.some((a) => a.account_name === prevSelected)) {
      accountSelect.value = prevSelected;
      selectedAccountName = prevSelected;
    } else if (systemStatus.accounts.length > 0) {
      selectedAccountName = systemStatus.accounts[0].account_name;
      accountSelect.value = selectedAccountName;
    }
  }

  function getSelectedAccount() {
    return (
      systemStatus.accounts.find((a) => a.account_name === selectedAccountName) ||
      systemStatus.accounts[0]
    );
  }

  function renderAccountCard(acc) {
    planBadge.textContent = acc.plan ? acc.plan.name : 'Connected Tier';
    accountEmail.textContent = acc.email || '--';
    projectId.textContent = acc.project_id || '--';

    if (acc.status === 'unauthenticated') {
      accountStatus.innerHTML =
        '<span class="status-dot" style="background:#f43f5e;box-shadow:0 0 8px #f43f5e;"></span> Unauthenticated';
      accountStatus.style.color = '#f43f5e';
    } else {
      accountStatus.innerHTML = '<span class="status-dot"></span> Active';
      accountStatus.style.color = 'var(--color-emerald)';
    }
  }

  function renderCreditsCard(acc) {
    if (acc.credits) {
      creditsBalance.textContent = acc.credits.display || `$${acc.credits.balance.toFixed(2)}`;
      creditsSubtext.textContent = acc.credits.status || 'Active';
      creditsBadge.textContent = acc.credits.status || 'Active';
    }
  }

  function renderPollingCard() {
    const sched = systemStatus.scheduler;
    if (!sched) return;

    if (sched.is_fast_polling) {
      pollingBadge.textContent = `Adaptive: Fast (${Math.round(sched.fast_interval / 60)}m)`;
      pollingBadge.className = 'badge badge-success';
    } else if (sched.current_interval >= sched.idle_interval) {
      pollingBadge.textContent = `Idle Backoff (${Math.round(sched.idle_interval / 60)}m)`;
      pollingBadge.className = 'badge badge-adaptive';
    } else {
      pollingBadge.textContent = `Base (${Math.round(sched.base_interval / 60)}m)`;
      pollingBadge.className = 'badge badge-pro';
    }

    currentIntervalDisplay.textContent = `${Math.round(sched.current_interval / 60)} minutes`;
    lastUpdatedTime.textContent = sched.last_polled_at
      ? formatTimeAgo(new Date(sched.last_polled_at))
      : 'Just now';
  }

  function renderRollingGauge(limit) {
    if (!limit || limit.limit === 0) {
      rollingGaugePath.setAttribute('stroke-dasharray', '0, 100');
      rollingGaugeValue.textContent = '0%';
      rollingRequestsText.textContent = '0 / 0 requests';
      rollingResetPill.textContent = '⏳ Resets in --';
      rollingProgressBar.style.width = '0%';
      rollingRemainingCount.textContent = '0';
      rollingRemainingPct.textContent = '0%';
      return;
    }
    const pct = Math.min(100, Math.max(0, limit.used_percentage));
    rollingGaugePath.setAttribute('stroke-dasharray', `${pct}, 100`);
    rollingGaugeValue.textContent = `${pct}%`;
    rollingRequestsText.textContent = `${limit.used} / ${limit.limit} requests`;
    rollingResetPill.textContent = `⏳ Resets in ${limit.reset_display}`;
    rollingProgressBar.style.width = `${pct}%`;
    rollingRemainingCount.textContent = `${limit.remaining}`;
    rollingRemainingPct.textContent = `${limit.remaining_percentage}%`;
  }

  function renderWeeklyGauge(limit) {
    if (!limit || limit.limit === 0) {
      weeklyGaugePath.setAttribute('stroke-dasharray', '0, 100');
      weeklyGaugeValue.textContent = '0%';
      weeklyRequestsText.textContent = '0 / 0 requests';
      weeklyResetPill.textContent = '⏳ Resets in --';
      weeklyProgressBar.style.width = '0%';
      weeklyRemainingCount.textContent = '0';
      weeklyRemainingPct.textContent = '0%';
      return;
    }
    const pct = Math.min(100, Math.max(0, limit.used_percentage));
    weeklyGaugePath.setAttribute('stroke-dasharray', `${pct}, 100`);
    weeklyGaugeValue.textContent = `${pct}%`;
    weeklyRequestsText.textContent = `${limit.used} / ${limit.limit} requests`;
    weeklyResetPill.textContent = `⏳ Resets in ${limit.reset_display}`;
    weeklyProgressBar.style.width = `${pct}%`;
    weeklyRemainingCount.textContent = `${limit.remaining}`;
    weeklyRemainingPct.textContent = `${limit.remaining_percentage}%`;
  }

  function renderModels(models) {
    modelsGrid.innerHTML = '';
    if (!models || models.length === 0) {
      modelsGrid.innerHTML =
        '<div class="model-card"><p style="color:var(--text-muted);">No specific model quotas active.</p></div>';
      return;
    }

    models.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'model-card';

      const pct = Math.min(100, Math.max(0, m.used_percentage));
      const pillClass = m.status === 'OK' ? 'pill-ok' : 'pill-warn';

      card.innerHTML = `
        <div class="model-header">
          <span class="model-name">${escapeHtml(m.display_name)}</span>
          <span class="model-pill ${pillClass}">${escapeHtml(m.status)}</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill bg-cyan" style="width: ${pct}%;"></div>
        </div>
        <div class="model-metric-row">
          <span class="model-used-text">${m.requests_used} / ${m.requests_limit} requests</span>
          <span style="color:var(--text-muted);">${m.remaining_percentage}% free</span>
        </div>
      `;
      modelsGrid.appendChild(card);
    });
  }

  function setupCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);

    const sched = systemStatus.scheduler;
    if (!sched || !sched.seconds_until_next_poll) {
      nextPollCountdown.textContent = '--:--';
      return;
    }

    countdownSeconds = sched.seconds_until_next_poll;
    updateCountdownDisplay();

    countdownTimer = setInterval(() => {
      countdownSeconds--;
      if (countdownSeconds <= 0) {
        clearInterval(countdownTimer);
        fetchStatus();
      } else {
        updateCountdownDisplay();
      }
    }, 1000);
  }

  function updateCountdownDisplay() {
    const mins = Math.floor(countdownSeconds / 60);
    const secs = countdownSeconds % 60;
    nextPollCountdown.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function formatTimeAgo(date) {
    const sec = Math.floor((new Date() - date) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    return `${Math.floor(sec / 3600)}h ago`;
  }

  function showNotice(title, desc, isError) {
    if (noticeTitle) noticeTitle.textContent = title;
    if (noticeText) noticeText.textContent = desc;
    noticeBanner.className = isError ? 'notice-banner notice-error' : 'notice-banner';
    noticeBanner.classList.remove('hidden');
  }

  function hideNotice() {
    noticeBanner.classList.add('hidden');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==========================================
  // Device Flow Authentication Handler
  // ==========================================
  async function startDeviceFlow() {
    startDeviceFlowBtn.disabled = true;
    startDeviceFlowBtn.textContent = 'Generating code...';

    try {
      const res = await fetch(`${API_BASE}/oauth/device/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      const deviceData = await res.json();
      deviceUserCode.textContent = deviceData.user_code;
      deviceAuthLink.href = `${deviceData.verification_url}?user_code=${deviceData.user_code}`;

      deviceStartSection.classList.add('hidden');
      deviceActiveSection.classList.remove('hidden');
      devicePollStatusText.textContent = 'Waiting for confirmation in browser...';

      // Start polling
      if (devicePollInterval) clearInterval(devicePollInterval);
      const pollIntervalSeconds = Math.max(3, deviceData.interval || 5);

      devicePollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch(`${API_BASE}/oauth/device/poll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              device_code: deviceData.device_code,
              account_name: deviceAccountNameInput.value.trim() || 'Google Account',
            }),
          });

          const pollData = await pollRes.json();
          if (pollData.status === 'success') {
            clearInterval(devicePollInterval);
            devicePollStatusText.textContent = `✅ ${pollData.message}`;
            setTimeout(() => {
              closeAddModal();
              fetchStatus();
            }, 1200);
          } else if (pollData.status === 'expired' || pollData.status === 'denied' || pollData.status === 'error') {
            clearInterval(devicePollInterval);
            devicePollStatusText.textContent = `❌ ${pollData.message}`;
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, pollIntervalSeconds * 1000);

    } catch (err) {
      alert(`Error starting Google login: ${err.message}`);
    } finally {
      startDeviceFlowBtn.disabled = false;
      startDeviceFlowBtn.textContent = '🚀 Start Login';
    }
  }

  // Copy Device Code
  copyCodeBtn.addEventListener('click', () => {
    const code = deviceUserCode.textContent;
    navigator.clipboard.writeText(code).then(() => {
      copyCodeBtn.textContent = 'Copied!';
      setTimeout(() => (copyCodeBtn.textContent = 'Copy'), 2000);
    });
  });

  // Manual Account Save
  async function handleSaveManualAccount() {
    const name = manualAccountNameInput.value.trim() || 'Google Account';
    const raw = manualTokenInput.value.trim();
    if (!raw) {
      showManualResult('Please provide a refresh token or JSON string.', false);
      return;
    }

    saveManualAccountBtn.disabled = true;
    saveManualAccountBtn.textContent = 'Saving & Validating...';

    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          raw_json: raw,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      showManualResult(`✅ ${data.message}`, true);
      setTimeout(() => {
        closeAddModal();
        fetchStatus();
      }, 1200);
    } catch (err) {
      showManualResult(`❌ ${err.message}`, false);
    } finally {
      saveManualAccountBtn.disabled = false;
      saveManualAccountBtn.textContent = '💾 Save Account';
    }
  }

  function showManualResult(msg, success) {
    manualSaveResult.textContent = msg;
    manualSaveResult.className = `test-result ${success ? 'success' : 'error'}`;
    manualSaveResult.classList.remove('hidden');
  }

  // Delete Account
  async function handleDeleteAccount() {
    if (!selectedAccountName) return;
    const confirmDelete = confirm(`Do you really want to delete the account "${selectedAccountName}"?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_BASE}/accounts/${encodeURIComponent(selectedAccountName)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      fetchStatus();
    } catch (err) {
      alert(`Error deleting account: ${err.message}`);
    }
  }

  // Credentials Testing Tool in Modal
  async function handleTestCreds() {
    const input = testCredsInput.value.trim();
    if (!input) {
      showTestResult('Please enter a refresh token or JSON string first.', false);
      return;
    }

    testCredsBtn.disabled = true;
    testCredsBtn.textContent = 'Testing...';

    try {
      const res = await fetch(`${API_BASE}/test-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_json: input }),
      });
      const data = await res.json();
      showTestResult(data.message, data.valid);
    } catch (err) {
      showTestResult(`Connection error: ${err.message}`, false);
    } finally {
      testCredsBtn.disabled = false;
      testCredsBtn.textContent = 'Test & Validate';
    }
  }

  function showTestResult(msg, success) {
    testResult.textContent = msg;
    testResult.className = `test-result ${success ? 'success' : 'error'}`;
    testResult.classList.remove('hidden');
  }

  // Modals & Tabs
  function openAddModal() {
    deviceStartSection.classList.remove('hidden');
    deviceActiveSection.classList.add('hidden');
    manualSaveResult.classList.add('hidden');
    addAccountModal.classList.remove('hidden');
  }

  function closeAddModal() {
    if (devicePollInterval) clearInterval(devicePollInterval);
    addAccountModal.classList.add('hidden');
  }

  tabDeviceBtn.addEventListener('click', () => {
    tabDeviceBtn.classList.add('active');
    tabManualBtn.classList.remove('active');
    tabDeviceContent.classList.remove('hidden');
    tabManualContent.classList.add('hidden');
  });

  tabManualBtn.addEventListener('click', () => {
    tabManualBtn.classList.add('active');
    tabDeviceBtn.classList.remove('active');
    tabManualContent.classList.remove('hidden');
    tabDeviceContent.classList.add('hidden');
  });

  // Event Listeners
  accountSelect.addEventListener('change', (e) => {
    selectedAccountName = e.target.value;
    renderApp();
  });

  refreshBtn.addEventListener('click', handleRefresh);
  openAddAccountBtn.addEventListener('click', openAddModal);
  emptyStateAddBtn.addEventListener('click', openAddModal);
  noticeGuideBtn.addEventListener('click', openAddModal);
  deleteAccountBtn.addEventListener('click', handleDeleteAccount);
  closeAddAccountBtn.addEventListener('click', closeAddModal);

  startDeviceFlowBtn.addEventListener('click', startDeviceFlow);
  saveManualAccountBtn.addEventListener('click', handleSaveManualAccount);

  openGuideBtn.addEventListener('click', () => guideModal.classList.remove('hidden'));
  const closeGuide = () => guideModal.classList.add('hidden');
  closeGuideBtn.addEventListener('click', closeGuide);
  modalDoneBtn.addEventListener('click', closeGuide);

  addAccountModal.addEventListener('click', (e) => {
    if (e.target === addAccountModal) closeAddModal();
  });
  guideModal.addEventListener('click', (e) => {
    if (e.target === guideModal) closeGuide();
  });

  testCredsBtn.addEventListener('click', handleTestCreds);

  // Initial Fetch & Auto Refresh every 60s
  fetchStatus();
  setInterval(fetchStatus, 60000);
})();
