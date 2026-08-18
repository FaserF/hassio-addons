// Google Antigravity Ingress Dashboard Client

(function () {
  'use strict';

  // Ingress-aware API base path resolver
  const currentPath = window.location.pathname.replace(/\/+$/, '');
  const API_BASE = currentPath ? `${currentPath}/api` : '/api';

  // DOM Elements
  const accountSelect = document.getElementById('accountSelect');
  const refreshBtn = document.getElementById('refreshBtn');
  const openGuideBtn = document.getElementById('openGuideBtn');
  const closeGuideBtn = document.getElementById('closeGuideBtn');
  const modalDoneBtn = document.getElementById('modalDoneBtn');
  const guideModal = document.getElementById('guideModal');
  const testCredsBtn = document.getElementById('testCredsBtn');
  const testCredsInput = document.getElementById('testCredsInput');
  const testResult = document.getElementById('testResult');
  const noticeBanner = document.getElementById('noticeBanner');
  const noticeText = document.getElementById('noticeText');

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

  async function fetchStatus() {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      systemStatus = await res.json();
      renderApp();
    } catch (err) {
      console.error('Failed to load status:', err);
      showNotice(`Error communicating with Antigravity addon API: ${err.message}`, true);
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
      showNotice(`Force refresh failed: ${err.message}`, true);
    } finally {
      refreshBtn.disabled = false;
      if (icon) icon.classList.remove('spinning');
    }
  }

  function renderApp() {
    if (!systemStatus || !systemStatus.accounts) return;

    // Populate Account Switcher Dropdown
    updateAccountDropdown();

    const currentAccount = getSelectedAccount();
    if (!currentAccount) return;

    // Render Notice Banner if account is in demo / notice state
    if (currentAccount.error_message) {
      showNotice(currentAccount.error_message, currentAccount.status === 'unauthenticated');
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
    planBadge.textContent = acc.plan ? acc.plan.name : 'Pro Tier';
    accountEmail.textContent = acc.email || 'account@google.com';
    projectId.textContent = acc.project_id || 'antigravity-core';

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
      creditsSubtext.textContent = `$${acc.credits.used.toFixed(2)} consumed this cycle`;
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
      pollingBadge.textContent = `Base Scan (${Math.round(sched.base_interval / 60)}m)`;
      pollingBadge.className = 'badge badge-pro';
    }

    currentIntervalDisplay.textContent = `${Math.round(sched.current_interval / 60)} minutes`;
    lastUpdatedTime.textContent = sched.last_polled_at
      ? formatTimeAgo(new Date(sched.last_polled_at))
      : 'Recently';
  }

  function renderRollingGauge(limit) {
    if (!limit) return;
    const pct = Math.min(100, Math.max(0, limit.used_percentage));
    rollingGaugePath.setAttribute('stroke-dasharray', `${pct}, 100`);
    rollingGaugeValue.textContent = `${pct}%`;
    rollingRequestsText.textContent = `${limit.used} / ${limit.limit} reqs`;
    rollingResetPill.textContent = `⏳ Resets in ${limit.reset_display}`;
    rollingProgressBar.style.width = `${pct}%`;
    rollingRemainingCount.textContent = `${limit.remaining} requests`;
    rollingRemainingPct.textContent = `${limit.remaining_percentage}%`;
  }

  function renderWeeklyGauge(limit) {
    if (!limit) return;
    const pct = Math.min(100, Math.max(0, limit.used_percentage));
    weeklyGaugePath.setAttribute('stroke-dasharray', `${pct}, 100`);
    weeklyGaugeValue.textContent = `${pct}%`;
    weeklyRequestsText.textContent = `${limit.used} / ${limit.limit} reqs`;
    weeklyResetPill.textContent = `⏳ Resets in ${limit.reset_display}`;
    weeklyProgressBar.style.width = `${pct}%`;
    weeklyRemainingCount.textContent = `${limit.remaining} requests`;
    weeklyRemainingPct.textContent = `${limit.remaining_percentage}%`;
  }

  function renderModels(models) {
    modelsGrid.innerHTML = '';
    if (models.length === 0) {
      modelsGrid.innerHTML =
        '<div class="model-card"><p style="color:var(--text-muted);">No model data available.</p></div>';
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
          <span class="model-used-text">${m.requests_used} / ${m.requests_limit} reqs</span>
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

  function showNotice(msg, isError) {
    noticeText.textContent = msg;
    noticeBanner.className = isError ? 'notice-banner' : 'notice-banner';
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

  // Credentials Testing Tool in Modal
  async function handleTestCreds() {
    const input = testCredsInput.value.trim();
    if (!input) {
      showTestResult('Please paste a token or JSON snippet first.', false);
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
      showTestResult(`Verification request error: ${err.message}`, false);
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

  // Event Listeners
  accountSelect.addEventListener('change', (e) => {
    selectedAccountName = e.target.value;
    renderApp();
  });

  refreshBtn.addEventListener('click', handleRefresh);

  openGuideBtn.addEventListener('click', () => {
    guideModal.classList.remove('hidden');
  });

  const closeModal = () => guideModal.classList.add('hidden');
  closeGuideBtn.addEventListener('click', closeModal);
  modalDoneBtn.addEventListener('click', closeModal);
  guideModal.addEventListener('click', (e) => {
    if (e.target === guideModal) closeModal();
  });

  testCredsBtn.addEventListener('click', handleTestCreds);

  // Initial Fetch & Auto Refresh every 60s as backup
  fetchStatus();
  setInterval(fetchStatus, 60000);
})();
