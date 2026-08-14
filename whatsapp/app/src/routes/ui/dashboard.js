// Dashboard Overview & Status Polling

function isNewerVersion(curr, latest) {
  if (!curr || !latest) return false;
  const cleanC = curr.replace(/^v/, '').trim();
  const cleanL = latest.replace(/^v/, '').trim();
  if (!cleanL || cleanC === cleanL || cleanC === 'Unknown') {
    return false;
  }
  const partsC = cleanC.split('.').map((p) => parseInt(p, 10) || 0);
  const partsL = cleanL.split('.').map((p) => parseInt(p, 10) || 0);
  const maxLen = Math.max(partsC.length, partsL.length);
  for (let i = 0; i < maxLen; i++) {
    const valC = partsC[i] || 0;
    const valL = partsL[i] || 0;
    if (valL > valC) return true;
    if (valL < valC) return false;
  }
  return false;
}

async function updateDashboard() {
  try {
    let response;
    try {
      response = await fetch(basePath + 'api/dashboard?session_id=' + currentSession, {
        headers: { Accept: 'application/json' },
      });
    } catch (netErr) {
      console.warn('⚡ Network error fetching dashboard API:', netErr);
      const badge = document.getElementById('status-badge');
      if (badge) {
        badge.className = 'status-badge disconnected';
        badge.textContent = window.t
          ? window.t('dashboard.status_connection_error')
          : 'Connection Error ⚠️';
      }
      return;
    }

    if (!response.ok) {
      const diagCard = document.getElementById('card-diagnostics');
      if (diagCard) diagCard.style.display = 'block';
      const badge = document.getElementById('status-badge');
      if (badge) {
        badge.className = 'status-badge disconnected';
        if (response.status === 403) {
          badge.textContent = window.t
            ? window.t('dashboard.status_access_blocked')
            : 'Access Blocked (403) ⛔';
        } else {
          badge.textContent = window.t
            ? window.t('dashboard.status_api_error', { status: response.status })
            : 'API Error (' + response.status + ') ⚠️';
        }
      }
      return;
    }

    const diagCard = document.getElementById('card-diagnostics');
    if (diagCard) diagCard.style.display = 'none';
    const data = await response.json();
    isConnected = data.isConnected;

    // Update footer session info
    const footerSessionId = document.getElementById('footer-session-id');
    const footerSessionStatus = document.getElementById('footer-session-status');
    if (footerSessionId) footerSessionId.textContent = data.sessionId || currentSession;
    if (footerSessionStatus)
      footerSessionStatus.textContent = data.isConnected
        ? window.t
          ? window.t('dashboard.connected')
          : 'Connected'
        : window.t
          ? window.t('dashboard.disconnected')
          : 'Disconnected';

    // Version elements
    const setElText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    setElText('node-version', data.nodeVersion || 'N/A');
    setElText('alpine-version', data.alpineVersion || 'N/A');
    setElText('addon-version-sidebar', data.addonVersion || 'N/A');
    setElText('int-version-sidebar', data.integrationVersion || 'N/A');
    setElText('baileys-version', data.baileysVersion || 'N/A');
    setElText('express-version', data.expressVersion || 'N/A');

    const infoBadge = document.getElementById('sidebar-info-badge');
    if (infoBadge) {
      infoBadge.setAttribute(
        'data-tooltip',
        `Addon: ${data.addonVersion || 'N/A'}\nIntegration: ${data.integrationVersion || 'N/A'}\nBaileys: ${data.baileysVersion || 'N/A'}\nNode: ${data.nodeVersion || 'N/A'}\nExpress: ${data.expressVersion || 'N/A'}\nAlpine: ${data.alpineVersion || 'N/A'}`
      );
    }

    window._latestReleaseData = data;

    // isNewerVersion is defined at the top-level scope above

    const hasAddonUpdate = isNewerVersion(data.addonVersion, data.latestAddonVersion);
    const hasIntUpdate = isNewerVersion(data.integrationVersion, data.latestIntegrationVersion);

    const addonBadge = document.getElementById('addon-update-badge');
    if (addonBadge) addonBadge.style.display = hasAddonUpdate ? 'inline-flex' : 'none';

    const intBadge = document.getElementById('int-update-badge');
    if (intBadge) intBadge.style.display = hasIntUpdate ? 'inline-flex' : 'none';

    ['baileys', 'node', 'express', 'alpine'].forEach((dep) => {
      const depBadge = document.getElementById(`${dep}-update-badge`);
      if (depBadge) depBadge.style.display = hasAddonUpdate ? 'inline-flex' : 'none';
    });

    const devBanner = document.getElementById('dev-banner');
    if (devBanner) devBanner.style.display = data.isDev ? 'flex' : 'none';

    // Standalone mode adjustments
    const hostUriLabel = document.getElementById('label-host-uri');
    if (hostUriLabel) {
      hostUriLabel.textContent = data.isStandalone
        ? window.t
          ? window.t('dashboard.gateway_host_domain')
          : 'Gateway Host / Domain URI'
        : window.t
          ? window.t('dashboard.addon_host_uri')
          : 'Addon Host URI';
    }
    const setupCardTitle = document.getElementById('setup-card-title');
    if (setupCardTitle) {
      setupCardTitle.innerHTML = data.isStandalone
        ? '<i class="fas fa-network-wired"></i> ' +
          (window.t ? window.t('dashboard.connection_setup') : 'Connection Setup')
        : '<i class="fas fa-home"></i> ' +
          (window.t ? window.t('dashboard.ha_setup') : 'Home Assistant Setup');
    }
    if (data.isStandalone) {
      document.title = 'WhatsApp Gateway';
      const subtitle = document.getElementById('logo-subtitle');
      if (subtitle)
        subtitle.textContent = window.t ? window.t('dashboard.standalone') : 'Standalone';
      const haRepoLink = document.getElementById('ha-repo-link');
      if (haRepoLink) {
        const span = haRepoLink.querySelector('span');
        if (span)
          span.textContent = window.t ? window.t('dashboard.project_repo') : 'Project Repository';
      }
    }

    // Ingress config logs link
    const slug = data.addonSlug || 'unknown';
    const fullLogsLink = document.getElementById('full-logs-link');
    if (fullLogsLink) {
      const isIngress = window.location.pathname.includes('/api/hassio_ingress/');
      if (isIngress && !data.isStandalone) {
        fullLogsLink.style.display = 'flex';
        fullLogsLink.href = '/config/app/' + slug + '/logs';
      } else {
        fullLogsLink.style.display = 'none';
      }
    }

    // Session drop-down list
    const select = document.getElementById('session-select');
    let options = '';
    let hasMatchingActiveSession = false;

    (data.sessionList || []).forEach((s) => {
      if (s.id === currentSession && s.connected) hasMatchingActiveSession = true;
      const isSelected = s.id === currentSession ? 'selected' : '';
      const icon = s.connected ? '\u2705' : '\u274C';
      options +=
        '<option value="' + s.id + '" ' + isSelected + '>' + s.id + ' (' + icon + ')</option>';
    });
    // Only overwrite select if we got at least one option — prevents losing the current session
    // option when the API returns an empty list (e.g. transient error or first poll).
    if (select && options) select.innerHTML = options;

    // Passkey notifications
    const pkBanner = document.getElementById('passkey-banner');
    if (pkBanner) pkBanner.style.display = data.passkeyDetected ? 'flex' : 'none';

    // Connection status details
    const badge = document.getElementById('status-badge');
    if (badge) {
      badge.className =
        'status-badge ' +
        (data.isConnected
          ? 'connected'
          : data.currentQR
            ? 'waiting'
            : data.isConnecting
              ? 'waiting'
              : 'disconnected');
      badge.textContent = data.isConnected
        ? window.t
          ? window.t('dashboard.status_connected')
          : 'Connected \u2705'
        : data.currentQR
          ? window.t
            ? window.t('dashboard.status_scan_qr')
            : 'Scan QR Code \uD83D\uDCF1'
          : data.isConnecting
            ? window.t
              ? window.t('dashboard.status_connecting')
              : 'Connecting... \u23F3'
            : data.disconnectReason === 'logged_out'
              ? window.t
                ? window.t('dashboard.status_logged_out')
                : 'Logged Out \uD83D\uDEAB'
              : window.t
                ? window.t('dashboard.status_disconnected')
                : 'Disconnected \u274C';
    }
    const discReason = document.getElementById('disconnect-reason');
    if (discReason) {
      discReason.textContent = data.currentQR
        ? ''
        : data.disconnectReason
          ? window.t
            ? window.t('dashboard.reason_label', { reason: data.disconnectReason })
            : 'Reason: ' + data.disconnectReason
          : '';
    }

    // QR setup or visual spinner loader
    const qrContainer = document.getElementById('qr-container');
    const initPlaceholder = document.getElementById('init-placeholder');
    if (!data.isConnected && data.currentQR) {
      if (qrContainer) qrContainer.style.display = 'flex';
      if (initPlaceholder) initPlaceholder.style.display = 'none';
      const qrImg = document.getElementById('qr-code');
      if (qrImg) qrImg.src = data.currentQR;
    } else if (!data.isConnected && !data.currentQR) {
      if (qrContainer) qrContainer.style.display = 'none';
      if (initPlaceholder) initPlaceholder.style.display = 'flex';
      // Show recent connection log in the placeholder so user can see what is happening
      const logEl = document.getElementById('init-log-text');
      if (logEl && data.connectionLogs && data.connectionLogs.length > 0) {
        logEl.textContent = data.connectionLogs[0].msg || '';
      }
    } else {
      if (qrContainer) qrContainer.style.display = 'none';
      if (initPlaceholder) initPlaceholder.style.display = 'none';
    }

    // Metadata details
    const whStatus = document.getElementById('webhook-status');
    if (whStatus) {
      whStatus.textContent = data.webhookEnabled
        ? t('dashboard.webhook_enabled')
        : t('dashboard.webhook_disabled');
      whStatus.style.color = data.webhookEnabled ? 'var(--primary)' : 'var(--danger)';
    }
    setElText('webhook-url', data.webhookUrl || t('dashboard.not_configured'));

    // Connected account fields
    const hasDevice = data.isConnected && data.deviceInfo && data.deviceInfo.number;
    const devGrid = document.getElementById('device-info-grid');
    if (devGrid) devGrid.style.display = hasDevice ? 'grid' : 'none';
    const noDevMsg = document.getElementById('no-device-msg');
    if (noDevMsg) noDevMsg.style.display = hasDevice ? 'none' : 'block';

    if (hasDevice) {
      setElText('device-name', data.deviceInfo.name || '—');
      setElText('device-number', '+' + data.deviceInfo.number);
      setElText('device-session', data.sessionId || 'default');
      const statusEl = document.getElementById('device-status');
      if (statusEl) {
        statusEl.textContent = data.deviceInfo.status
          ? `"${data.deviceInfo.status}"`
          : window.t
            ? window.t('dashboard.no_profile_status')
            : 'No profile status set';
      }
    }

    // Stats properties
    const stats = data.stats || {};
    setElText('stat-sent', stats.sent || 0);
    setElText('stat-received', stats.received || 0);
    setElText('stat-failed', stats.failed || 0);

    // Uptime: prefer start_time from stats (epoch ms), fall back to server process uptime
    let uptimeStr = '00:00:00';
    if (stats.start_time && stats.start_time > 0) {
      const diffSec = Math.max(0, Math.floor((Date.now() - stats.start_time) / 1000));
      const hrs = String(Math.floor(diffSec / 3600)).padStart(2, '0');
      const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
      const secs = String(diffSec % 60).padStart(2, '0');
      uptimeStr = `${hrs}:${mins}:${secs}`;
    } else if (data.uptimeSeconds > 0) {
      const diffSec = data.uptimeSeconds;
      const hrs = String(Math.floor(diffSec / 3600)).padStart(2, '0');
      const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
      const secs = String(diffSec % 60).padStart(2, '0');
      uptimeStr = `${hrs}:${mins}:${secs}`;
    }
    setElText('val-uptime', uptimeStr);
    setElText('val-reconnects', stats.totalReconnects ?? data.reconnectAttempts ?? 0);

    // Render streams lists (always escape content to prevent XSS)
    const esc = (v) =>
      String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const setElHtml = (id, html) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };

    setElHtml(
      'list-sent',
      (data.recentSent || []).length
        ? data.recentSent
            .map(
              (m) =>
                '<div class="history-item">' +
                '<span class="history-time">' +
                esc(m.timestamp) +
                '</span>' +
                '<span class="history-target">' +
                (window.t ? window.t('dashboard.to_prefix') : 'To: ') +
                esc(m.target) +
                '</span>' +
                '<div class="history-msg">' +
                esc(m.message) +
                '</div>' +
                '</div>'
            )
            .join('')
        : `<div class="empty-state">${window.t('dashboard.no_sent')}</div>`
    );

    setElHtml(
      'list-received',
      (data.recentReceived || []).length
        ? data.recentReceived
            .map(
              (m) =>
                '<div class="history-item">' +
                '<span class="history-time">' +
                esc(m.timestamp) +
                '</span>' +
                '<span class="history-sender">' +
                (window.t ? window.t('dashboard.from_prefix') : 'From: ') +
                esc(m.sender) +
                '</span>' +
                '<div class="history-msg">' +
                esc(m.message) +
                '</div>' +
                '</div>'
            )
            .join('')
        : `<div class="empty-state">${window.t('dashboard.no_received')}</div>`
    );

    setElHtml(
      'list-failures',
      (data.recentFailures || []).length
        ? data.recentFailures
            .map(
              (m) =>
                '<div class="history-item failure">' +
                '<span class="history-time">' +
                esc(m.timestamp) +
                '</span>' +
                '<span class="history-target">' +
                (window.t ? window.t('dashboard.target_prefix') : 'Target: ') +
                esc(m.target) +
                '</span>' +
                '<div class="history-msg">' +
                esc(m.message) +
                '</div>' +
                '<div class="history-reason">' +
                (window.t ? window.t('dashboard.error_prefix') : 'Error: ') +
                esc(m.reason) +
                '</div>' +
                '</div>'
            )
            .join('')
        : `<div class="empty-state">${window.t('dashboard.no_failures')}</div>`
    );
  } catch (e) {
    console.error('❌ updateDashboard error:', e);
    const badge = document.getElementById('status-badge');
    if (badge) {
      badge.className = 'status-badge disconnected';
      badge.textContent = window.t ? window.t('dashboard.ui_render_error') : 'UI Render Error ⚠️';
    }
  }
}

// System Logs, Session Management & Backups

async function loadLogs() {
  try {
    const response = await fetch(basePath + 'logs?session_id=' + currentSession);
    if (!response.ok) return;
    const logs = await response.json();

    const logsEl = document.getElementById('list-logs');
    if (logsEl) {
      logsEl.innerHTML = logs.length
        ? logs
            .map(
              (l) =>
                '<div class="log-entry"><span class="log-time">' +
                l.timestamp +
                '</span><span class="log-type-' +
                l.type +
                '">' +
                l.msg +
                '</span></div>'
            )
            .join('')
        : `<div class="log-entry">${t('dashboard.no_logs')}</div>`;
    }
  } catch (err) {
    console.error(err);
  }
}

async function downloadDebugInfo() {
  try {
    const response = await fetch(basePath + 'api/debug/download?session_id=' + currentSession, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error();
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'whatsapp-debug-' + currentSession + '.json';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    showToast(t('dashboard.debug_downloaded'), 'success');
  } catch (e) {
    showToast(t('dashboard.debug_failed'), 'danger');
  }
}

async function restartSession() {
  const ok = await showConfirm(
    t('dashboard.restart_confirm_title'),
    t('dashboard.restart_confirm_msg')
  );
  if (!ok) return;

  showToast(t('dashboard.restarting_session'), 'warning');
  try {
    const response = await fetch(basePath + 'api/session/restart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ session_id: currentSession }),
    });
    if (response.ok) {
      showToast(t('dashboard.restart_ack'), 'success');
      setTimeout(updateDashboard, 1500);
    }
  } catch (e) {
    showToast(t('dashboard.restart_failed'), 'danger');
  }
}

async function logoutSession() {
  const ok = await showConfirm(
    t('dashboard.reset_confirm_title'),
    t('dashboard.reset_confirm_msg')
  );
  if (!ok) return;

  showToast(t('dashboard.deleting_credentials'), 'warning');
  try {
    const response = await fetch(basePath + 'session', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ session_id: currentSession }),
    });
    if (response.ok) {
      showToast(t('dashboard.reset_completed'), 'success');
      updateDashboard();
    }
  } catch (e) {
    showToast(t('dashboard.reset_failed'), 'danger');
  }
}

async function purgeSessions() {
  const ok = await showConfirm(
    t('dashboard.purge_confirm_title'),
    t('dashboard.purge_confirm_msg')
  );
  if (!ok) return;

  showToast(t('dashboard.purging_sessions'), 'info');
  try {
    const response = await fetch(basePath + 'api/sessions/purge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    if (response.ok) {
      const resData = await response.json();
      showToast(t('dashboard.purged_count', { count: resData.purgedCount || 0 }), 'success');
      updateDashboard();
    } else {
      showToast(t('dashboard.purge_failed'), 'danger');
    }
  } catch (e) {
    showToast(t('dashboard.purge_failed_error', { error: e.message }), 'danger');
  }
}

async function clearLogs() {
  const ok = await showConfirm(
    t('dashboard.clear_logs_confirm_title'),
    t('dashboard.clear_logs_confirm_msg')
  );
  if (!ok) return;

  try {
    const response = await fetch(basePath + 'api/logs/clear', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ session_id: currentSession }),
    });
    if (response.ok) {
      showToast(t('dashboard.logs_cleared'), 'success');
      updateDashboard();
    }
  } catch (e) {
    showToast(t('dashboard.logs_clear_failed'), 'danger');
  }
}

function switchSession(id) {
  currentSession = id;
  const url = new URL(window.location);
  url.searchParams.set('session_id', id);
  window.history.replaceState({}, '', url);
  if (typeof window.updateRawLogsLink === 'function') {
    window.updateRawLogsLink();
  }
  updateDashboard();
}

// Update & Dependency Modals

function openUpdateModal(type) {
  const data = window._latestReleaseData || {};
  const modal = document.getElementById('version-update-modal');
  const title = document.getElementById('update-modal-title');
  const currVer = document.getElementById('update-curr-ver');
  const newVer = document.getElementById('update-new-ver');
  const newVerPill = document.getElementById('update-new-ver-pill');
  const changelog = document.getElementById('update-changelog-content');
  const actionBtn = document.getElementById('update-action-btn');

  let currentVersion = 'N/A';
  let latestVersion = null;
  let changelogText = '';
  let repoUrl = '';
  let directUpdateUrl = '';
  let compName = '';

  if (type === 'addon') {
    compName = 'WhatsApp Addon';
    currentVersion = data.addonVersion || 'N/A';
    latestVersion = data.latestAddonVersion || null;
    changelogText = data.addonChangelog || 'No release notes available.';
    repoUrl = data.addonReleaseUrl || 'https://github.com/FaserF/hassio-addons/releases';
    directUpdateUrl = data.isStandalone
      ? repoUrl
      : 'https://my.home-assistant.io/redirect/supervisor_addon/?addon=whatsapp';
  } else if (type === 'integration') {
    compName = 'WhatsApp Integration';
    currentVersion = data.integrationVersion || 'N/A';
    latestVersion = data.latestIntegrationVersion || null;
    changelogText = data.integrationChangelog || 'No release notes available.';
    repoUrl = data.integrationReleaseUrl || 'https://github.com/FaserF/ha-whatsapp/releases';
    directUpdateUrl =
      'https://my.home-assistant.io/redirect/hacs_repository/?owner=FaserF&repository=ha-whatsapp&category=integration';
  }

  // Check if latest version is actually newer than current
  const isNewer =
    typeof window.isNewerVersion === 'function'
      ? window.isNewerVersion(currentVersion, latestVersion)
      : latestVersion && latestVersion !== currentVersion;

  if (title)
    title.textContent = isNewer
      ? window.t
        ? window.t('dashboard.update_available_title', { name: compName })
        : `${compName} Update Available`
      : window.t
        ? window.t('dashboard.info_title', { name: compName })
        : `${compName} Info`;
  if (currVer) currVer.textContent = currentVersion;
  if (newVer)
    newVer.textContent =
      latestVersion || (window.t ? window.t('dashboard.up_to_date') : 'Up to date');

  if (newVerPill) {
    if (!isNewer) {
      newVerPill.style.background = 'rgba(134, 150, 160, 0.15)';
      newVerPill.style.color = 'var(--text-muted)';
    } else {
      newVerPill.style.background = 'var(--primary-glow)';
      newVerPill.style.color = 'var(--primary)';
    }
  }

  if (changelog) changelog.innerHTML = escapeHtml(changelogText);

  if (actionBtn) {
    if (isNewer) {
      actionBtn.href = directUpdateUrl;
      actionBtn.innerHTML =
        '<i class="fas fa-download"></i> ' +
        (window.t ? window.t('dashboard.update_now') : 'Update Now');
      actionBtn.style.display = 'inline-flex';
    } else {
      actionBtn.href = repoUrl;
      actionBtn.innerHTML =
        '<i class="fab fa-github"></i> ' +
        (window.t ? window.t('dashboard.view_repo') : 'View Repository');
      actionBtn.style.display = 'inline-flex';
    }
    actionBtn.target = '_blank';
  }

  if (modal) modal.classList.add('show');
}

function closeUpdateModal() {
  const modal = document.getElementById('version-update-modal');
  if (modal) modal.classList.remove('show');
}

function openDependencyModal(depName) {
  const data = window._latestReleaseData || {};
  const modal = document.getElementById('dependency-info-modal');
  const title = document.getElementById('dep-modal-title');
  const currVer = document.getElementById('dep-curr-ver');
  const addonStatus = document.getElementById('dep-addon-status');
  const addonStatusPill = document.getElementById('dep-addon-status-pill');
  const rationaleBox = document.getElementById('dep-rationale-box');
  const rationaleIcon = document.getElementById('dep-rationale-icon');
  const rationaleTitle = document.getElementById('dep-rationale-title');
  const rationaleDesc = document.getElementById('dep-rationale-desc');
  const roleDesc = document.getElementById('dep-role-desc');
  const repoBtn = document.getElementById('dep-repo-btn');
  const releasesBtn = document.getElementById('dep-releases-btn');
  const actionBtn = document.getElementById('dep-action-btn');

  const depInfo = {
    Baileys: {
      repo: 'https://github.com/WhiskeySockets/Baileys',
      releases: 'https://github.com/WhiskeySockets/Baileys/releases',
      version: data.baileysVersion || 'N/A',
      role: window.t ? window.t('dashboard.role_baileys') : 'WhatsApp Web Protocol Engine',
    },
    'Node.js': {
      repo: 'https://github.com/nodejs/node',
      releases: 'https://github.com/nodejs/node/releases',
      version: data.nodeVersion || 'N/A',
      role: window.t ? window.t('dashboard.role_nodejs') : 'JavaScript Runtime Environment',
    },
    Express: {
      repo: 'https://github.com/expressjs/express',
      releases: 'https://github.com/expressjs/express/releases',
      version: data.expressVersion || 'N/A',
      role: window.t ? window.t('dashboard.role_express') : 'REST API & Web UI Framework',
    },
    'Alpine Linux': {
      repo: 'https://alpinelinux.org',
      releases: 'https://alpinelinux.org/releases/',
      version: data.alpineVersion || 'N/A',
      role: window.t ? window.t('dashboard.role_alpine') : 'Base Docker Operating System',
    },
  };

  const info = depInfo[depName] || {
    repo: 'https://github.com',
    releases: 'https://github.com',
    version: 'N/A',
    role: window.t ? window.t('dashboard.role_core_gateway') : 'Core Gateway Component',
  };

  const hasAddonUpdate =
    typeof window.isNewerVersion === 'function'
      ? window.isNewerVersion(data.addonVersion, data.latestAddonVersion)
      : false;

  if (title)
    title.textContent = window.t
      ? window.t('dashboard.dep_info_title', { depName })
      : `${depName} Dependency Info`;
  if (currVer) currVer.textContent = info.version;
  if (roleDesc) roleDesc.textContent = info.role;

  if (addonStatus) {
    addonStatus.textContent = hasAddonUpdate
      ? window.t
        ? window.t('dashboard.update_available_ver', { version: data.latestAddonVersion })
        : `Update Available (${data.latestAddonVersion})`
      : window.t
        ? window.t('dashboard.addon_up_to_date')
        : 'Addon Up to date';
  }

  if (addonStatusPill) {
    if (hasAddonUpdate) {
      addonStatusPill.style.background = 'var(--primary-glow)';
      addonStatusPill.style.color = 'var(--primary)';
    } else {
      addonStatusPill.style.background = 'rgba(134, 150, 160, 0.15)';
      addonStatusPill.style.color = 'var(--text-muted)';
    }
  }

  if (rationaleBox && rationaleIcon && rationaleTitle && rationaleDesc) {
    if (hasAddonUpdate) {
      rationaleBox.className = 'update-rationale-box';
      rationaleIcon.className = 'fas fa-arrow-alt-circle-up rationale-icon';
      rationaleIcon.style.color = 'var(--primary)';
      rationaleTitle.textContent = window.t
        ? window.t('dashboard.addon_update_pending')
        : 'Addon Update Pending';
      rationaleDesc.textContent = window.t
        ? window.t('dashboard.addon_update_pending_desc', {
            version: data.latestAddonVersion,
            depName,
          })
        : `A newer Addon release (${data.latestAddonVersion}) is ready! Updating your Addon will automatically upgrade ${depName}.`;
    } else {
      rationaleBox.className = 'update-rationale-box warning';
      rationaleIcon.className = 'fas fa-info-circle rationale-icon';
      rationaleIcon.style.color = 'var(--warning)';
      rationaleTitle.textContent = window.t
        ? window.t('dashboard.bundled_dep_mgmt')
        : 'Bundled Dependency Management';
      rationaleDesc.textContent = window.t
        ? window.t('dashboard.bundled_dep_mgmt_desc', { depName })
        : `${depName} is bundled inside the WhatsApp Addon container and is updated with each Addon release.`;
    }
  }

  if (repoBtn) repoBtn.href = info.repo;
  if (releasesBtn) releasesBtn.href = info.releases;

  if (actionBtn) {
    if (hasAddonUpdate) {
      actionBtn.className = 'btn btn-primary btn-sm';
      actionBtn.innerHTML =
        '<i class="fas fa-download"></i> ' +
        (window.t ? window.t('dashboard.update_addon_now') : 'Update Addon Now');
      actionBtn.href = data.isStandalone
        ? data.addonReleaseUrl || 'https://github.com/FaserF/hassio-addons/releases'
        : 'https://my.home-assistant.io/redirect/supervisor_addon/?addon=whatsapp';
      actionBtn.target = '_blank';
    } else {
      actionBtn.className = 'btn btn-secondary btn-sm';
      actionBtn.innerHTML =
        '<i class="fab fa-github"></i> ' +
        (window.t ? window.t('dashboard.report_issue') : 'Report Vulnerability / Issue');
      actionBtn.href = 'https://github.com/FaserF/hassio-addons/issues/new?template=bug_report.yml';
      actionBtn.target = '_blank';
    }
  }

  if (modal) modal.classList.add('show');
}

function closeDependencyModal() {
  const modal = document.getElementById('dependency-info-modal');
  if (modal) modal.classList.remove('show');
}

// Moderation Core (Store, Group Selector, Rules, Greetings, Captcha, Warns, Commands)

let modStoreCache = null;
let currentModGroup = '';
let builtinCommandsCache = [];

// ── Dirty / Unsaved-Changes Tracking ─────────────────────────────────────────
const _dirty = {
  isDirty: false,
  panelId: null, // e.g. 'rules', 'greetings', …
  panelLabel: null, // human-readable label shown in the modal
  saveFn: null, // async function to call when user picks "Save & Switch"
  onProceed: null, // callback executed after save OR discard
};

// Snapshot of all tracked field values taken when a group is loaded or saved.
// Used to detect changes without relying on fragile event delegation.
let _formSnapshot = null;

const SUB_PANEL_LABELS = {
  rules: 'Rules',
  greetings: 'Greetings & Captcha',
  warnings: 'Warnings',
  locks: 'Locks',
  blacklist: 'Blacklist',
  filters: 'Filters',
  antispam: 'Anti-Spam',
  federation: 'Federation',
  ai: 'Gemini AI',
  commands: 'Commands',
  migration: 'Import/Export',
};

const SAVE_FN_MAP = {
  rules: () => saveGroupRules(),
  greetings: () => saveGroupGreetings(),
  warnings: () => saveGroupWarnings(),
  locks: () => saveGroupLocks(),
  blacklist: () => saveGroupBlacklist(),
  filters: () => saveGroupFilters(),
  antispam: () => saveGroupAntispam(),
  federation: () => saveGroupFederation(),
  ai: () => saveGroupAiConfig(),
  commands: () => saveGroupCommands(),
};

// IDs of all fields we track for changes (inputs, selects, textareas).
const TRACKED_FIELD_IDS = [
  'mod-rules-text',
  'mod-rules-show-on-join',
  'mod-welcome-enabled',
  'mod-welcome-msg',
  'mod-welcome-target',
  'mod-goodbye-enabled',
  'mod-goodbye-msg',
  'mod-goodbye-target',
  'mod-captcha-enabled',
  'mod-captcha-mode',
  'mod-captcha-timeout',
  'mod-max-warns',
  'mod-warn-action',
  'mod-lock-image',
  'mod-lock-video',
  'mod-lock-audio',
  'mod-lock-document',
  'mod-lock-sticker',
  'mod-lock-url',
  'mod-lock-invite',
  'mod-lock-poll',
  'mod-lock-contact',
  'mod-lock-location',
  'mod-lock-forwarded',
  'mod-lock-rtl',
  'mod-blacklist-mode',
  'mod-flood-enabled',
  'mod-flood-max',
  'mod-flood-win',
  'mod-antiraid-enabled',
  'mod-antiraid-max',
  'mod-antiraid-win',
  'mod-antispam-links-enabled',
  'mod-antispam-bot-enabled',
  'mod-notify-deleted-action',
  'mod-notify-bypassed-actions',
  'mod-ai-enabled',
  'mod-ai-faq',
  'mod-ai-sentiment',
  'mod-ai-prompt',
  'mod-ai-key',
  'mod-trans-lang',
  'mod-trans-mode',
  'mod-fed-select',
  'mod-cmds-enabled',
  'mod-cmds-multi-enabled',
  'mod-cmds-prefix',
  'mod-cmds-mute-action',
];

/** Capture current values of all tracked fields into a snapshot. */
function _captureSnapshot() {
  const snap = {};
  for (const id of TRACKED_FIELD_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    snap[id] = el.type === 'checkbox' ? el.checked : el.value;
  }
  _formSnapshot = snap;
}

/** Compare current field values to snapshot. Returns true if anything changed. */
function _isSnapshotDirty() {
  if (!_formSnapshot) return false;
  for (const id of TRACKED_FIELD_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const current = el.type === 'checkbox' ? el.checked : el.value;
    if (current !== _formSnapshot[id]) return true;
  }
  return false;
}

/** Find which sub-panel contains the first changed field. */
function _getDirtyPanel() {
  if (!_formSnapshot) return null;
  for (const id of TRACKED_FIELD_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const current = el.type === 'checkbox' ? el.checked : el.value;
    if (current !== _formSnapshot[id]) {
      const panel = el.closest('.mod-subpanel');
      if (panel) return panel.id.replace('mod-subpanel-', '');
    }
  }
  return null;
}

/** Call this whenever a tracked input changes. */
function markDirty(panelId) {
  _dirty.isDirty = true;
  _dirty.panelId = panelId;
  _dirty.panelLabel = SUB_PANEL_LABELS[panelId] || panelId;
  _dirty.saveFn = SAVE_FN_MAP[panelId] || null;
  _updateDirtyIndicator(panelId);
}

/** Call this after a successful save or discard to clear dirty state. */
function markClean() {
  _dirty.isDirty = false;
  _dirty.panelId = null;
  _dirty.panelLabel = null;
  _dirty.saveFn = null;
  _dirty.onProceed = null;
  _captureSnapshot();
  document.querySelectorAll('.mod-pill.dirty').forEach((b) => b.classList.remove('dirty'));
}

function _updateDirtyIndicator(panelId) {
  document.querySelectorAll('.mod-pill.dirty').forEach((b) => b.classList.remove('dirty'));
  const pill = document.querySelector(`.mod-pill[data-subtab="${panelId}"]`);
  if (pill) pill.classList.add('dirty');
}

/**
 * Check dirty state before switching. Uses snapshot comparison as the
 * primary check (reliable across all browsers) and falls back to the
 * _dirty.isDirty flag for non-field changes (e.g. added filter rows).
 */
function _guardDirty(proceedFn) {
  // First, do a snapshot comparison to catch any field edits
  if (_isSnapshotDirty()) {
    const panelId = _getDirtyPanel() || _dirty.panelId || 'settings';
    _dirty.isDirty = true;
    _dirty.panelId = panelId;
    _dirty.panelLabel = SUB_PANEL_LABELS[panelId] || panelId;
    _dirty.saveFn = SAVE_FN_MAP[panelId] || null;
    _updateDirtyIndicator(panelId);
  }

  if (!_dirty.isDirty) return true; // no changes – proceed

  _dirty.onProceed = proceedFn;
  const modal = document.getElementById('unsaved-changes-modal');
  const nameEl = document.getElementById('unsaved-panel-name');
  if (nameEl)
    nameEl.textContent =
      _dirty.panelLabel || (window.t ? window.t('moderation.this_section') : 'this section');
  if (modal) modal.classList.add('show');
  return false;
}

function _closeUnsavedModal() {
  const modal = document.getElementById('unsaved-changes-modal');
  if (modal) modal.classList.remove('show');
}

// Called by modal button "Stay"
function unsavedModalCancel() {
  _dirty.onProceed = null;
  _closeUnsavedModal();
}

// Called by modal button "Discard"
function unsavedModalDiscard() {
  const proceed = _dirty.onProceed;
  // Revert UI fields back to the last saved snapshot values
  if (_formSnapshot) {
    for (const id of TRACKED_FIELD_IDS) {
      const el = document.getElementById(id);
      if (!el || _formSnapshot[id] === undefined) continue;
      if (el.type === 'checkbox') {
        el.checked = Boolean(_formSnapshot[id]);
      } else {
        el.value = _formSnapshot[id];
      }
    }
  }
  markClean();
  _closeUnsavedModal();
  if (proceed) proceed();
}

// Called by modal button "Save & Switch"
async function unsavedModalSaveAndSwitch() {
  const proceed = _dirty.onProceed;
  const saveFn = _dirty.saveFn;
  _closeUnsavedModal();
  if (saveFn) {
    try {
      await saveFn();
    } catch (e) {
      console.error('Auto-save failed', e);
    }
  }
  markClean();
  if (proceed) proceed();
}
function updateModerationDisabledState() {
  const globalToggle = document.getElementById('mod-global-toggle');
  const isGlobalEnabled = globalToggle ? globalToggle.checked : true;

  const tab = document.getElementById('tab-moderation');
  if (!tab) return;

  // 1) Global moderation toggle: disable all settings cards if global is off
  const settingsCards = tab.querySelectorAll('.mod-settings-card, .mod-grid, .card');
  settingsCards.forEach((card) => {
    if (card.closest('.mod-hero')) return;

    if (!isGlobalEnabled) {
      card.classList.add('disabled-section');
      card.querySelectorAll('input, select, button, textarea').forEach((el) => {
        if (el.id !== 'mod-global-toggle') el.disabled = true;
      });
    } else {
      card.classList.remove('disabled-section');
      card.querySelectorAll('input, select, button, textarea').forEach((el) => {
        el.disabled = false;
      });
    }
  });

  // 2) Group-level toggle: disable group sub-panels if group moderation is disabled
  const groupToggle = document.getElementById('mod-group-toggle');
  const isGroupEnabled = groupToggle ? groupToggle.checked : true;
  if (isGlobalEnabled && typeof currentModGroup !== 'undefined' && currentModGroup) {
    const groupContent = document.getElementById('mod-group-content');
    if (groupContent) {
      const subCards = groupContent.querySelectorAll('.mod-settings-card, .mod-sub-panel, .card');
      subCards.forEach((card) => {
        if (!isGroupEnabled) {
          card.classList.add('disabled-section');
          card.querySelectorAll('input, select, button, textarea').forEach((el) => {
            if (el.id !== 'mod-group-toggle') el.disabled = true;
          });
        } else {
          card.classList.remove('disabled-section');
          card.querySelectorAll('input, select, button, textarea').forEach((el) => {
            el.disabled = false;
          });
        }
      });
    }
  }
}

async function loadModerationConfig() {
  try {
    const [modRes, chatsRes, cmdsRes] = await Promise.all([
      fetch(basePath + 'api/moderation/config'),
      fetch(basePath + 'api/chats?session_id=' + currentSession),
      fetch(basePath + 'api/moderation/commands'),
    ]);

    // Cache built-in commands once at load time
    try {
      if (cmdsRes.ok) {
        const cmdsJson = await cmdsRes.json();
        if (cmdsJson.success && Array.isArray(cmdsJson.data) && cmdsJson.data.length > 0) {
          builtinCommandsCache = cmdsJson.data;
        }
      }
    } catch (cmdsErr) {
      console.warn('Failed to load built-in commands list:', cmdsErr);
    }

    if (modRes.ok) {
      const json = await modRes.json();
      if (json.success && json.data) {
        modStoreCache = json.data;
        const globalToggle = document.getElementById('mod-global-toggle');
        if (globalToggle) globalToggle.checked = Boolean(modStoreCache.global_enabled);
        const aiKeyEl = document.getElementById('mod-ai-key');
        if (aiKeyEl && modStoreCache.gemini_api_key !== undefined) {
          aiKeyEl.value = modStoreCache.gemini_api_key;
        }
        const globalRulesInp = document.getElementById('mod-global-rules-input');
        if (globalRulesInp && modStoreCache.global_rules !== undefined) {
          globalRulesInp.value = modStoreCache.global_rules;
        }
        updateModerationDisabledState();
      }
    }

    // Populate group select dropdown from live chat list and moderation store
    const select = document.getElementById('mod-group-select');
    if (select) {
      const groupMap = new Map();
      if (chatsRes.ok) {
        const chats = await chatsRes.json();
        if (Array.isArray(chats)) {
          chats.forEach((c) => {
            const jid = c.jid || c.id;
            if (jid && jid.endsWith('@g.us')) {
              groupMap.set(jid, { id: jid, name: c.name || jid });
            }
          });
        }
      }
      // Also include any groups already saved in the moderation store
      if (modStoreCache && modStoreCache.groups) {
        Object.keys(modStoreCache.groups).forEach((gId) => {
          if (gId.endsWith('@g.us') && !groupMap.has(gId)) {
            const fallbackName = `Group (${gId.split('@')[0]})`;
            groupMap.set(gId, { id: gId, name: fallbackName });
          }
        });
      }

      const groups = Array.from(groupMap.values());
      const preserved = select.value;
      let opts = `<option value="">${window.t('moderation.select_group')}</option>`;
      groups.forEach((g) => {
        opts += `<option value="${g.id}"${g.id === preserved ? ' selected' : ''}>${g.name}</option>`;
      });
      select.innerHTML = opts;
      if (preserved && groupMap.has(preserved)) {
        select.value = preserved;
      }
      selectModerationGroup(select.value);
    }
    updateFedBlacklistTagsInUi();
  } catch (e) {
    console.error('Failed to load moderation config:', e);
  }
}

async function saveGlobalRulesInline() {
  const rules = document.getElementById('mod-global-rules-input')?.value || '';
  try {
    const res = await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_rules: rules }),
    });
    if (res.ok) {
      showToast(t('moderation.global_rules_saved'), 'success');
      loadModerationConfig();
    }
  } catch (e) {
    showToast(t('moderation.global_rules_save_failed'), 'danger');
  }
}

function openGlobalRulesModal() {
  const modal = document.getElementById('global-rules-modal');
  if (modal) {
    const globalRulesInp = document.getElementById('mod-global-rules-input');
    if (globalRulesInp && modStoreCache) {
      globalRulesInp.value = modStoreCache.global_rules || '';
    }
    modal.style.display = 'flex';
  }
}

function closeGlobalRulesModal() {
  const modal = document.getElementById('global-rules-modal');
  if (modal) modal.style.display = 'none';
}

async function saveGlobalRulesFromModal() {
  const rules = document.getElementById('mod-global-rules-input')?.value || '';
  try {
    const res = await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_rules: rules }),
    });
    if (res.ok) {
      showToast(t('moderation.global_rules_saved'), 'success');
      closeGlobalRulesModal();
      loadModerationConfig();
    }
  } catch (e) {
    showToast(t('moderation.global_rules_save_failed'), 'danger');
  }
}

async function toggleGlobalModeration(enabled) {
  try {
    updateModerationDisabledState();
    const res = await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_enabled: enabled }),
    });
    if (res.ok) {
      showToast(enabled ? t('moderation.global_enabled') : t('moderation.global_disabled'), 'info');
      loadModerationConfig();
    }
  } catch (e) {
    showToast(t('moderation.global_toggle_failed'), 'danger');
  }
}

async function selectModerationGroup(groupId) {
  currentModGroup = groupId;
  const contentCard = document.getElementById('mod-group-content');
  const placeholderCard = document.getElementById('mod-no-group-placeholder');

  if (!groupId) {
    if (contentCard) contentCard.style.display = 'none';
    if (placeholderCard) placeholderCard.style.display = 'block';
    return;
  }

  if (contentCard) contentCard.style.display = 'block';
  if (placeholderCard) placeholderCard.style.display = 'none';

  // Clear any pending dirty state when switching groups
  markClean();

  if (!modStoreCache) return;
  const config = modStoreCache.groups?.[groupId] || {};

  const titleEl = document.getElementById('mod-active-group-title');
  if (titleEl) {
    const groupSelect = document.getElementById('mod-group-select');
    const selectedOpt = groupSelect ? groupSelect.options[groupSelect.selectedIndex] : null;
    const name = selectedOpt ? selectedOpt.text : groupId;
    titleEl.innerHTML = `<i class="fas fa-users-cog"></i> ${escapeHtml(name)}`;
  }

  const toggle = document.getElementById('mod-group-toggle');
  if (toggle) toggle.checked = Boolean(config.enabled);

  // Rules
  const rulesText = document.getElementById('mod-rules-text');
  if (rulesText) rulesText.value = config.rules?.text || '';
  const rulesShow = document.getElementById('mod-rules-show-on-join');
  if (rulesShow) rulesShow.checked = Boolean(config.rules?.show_on_join);
  const groupLang = document.getElementById('mod-group-language-select');
  if (groupLang) groupLang.value = config.language || 'en';

  // Greetings
  const welcE = document.getElementById('mod-welcome-enabled');
  if (welcE) welcE.checked = Boolean(config.greetings?.welcome_enabled);
  const welcM = document.getElementById('mod-welcome-msg');
  if (welcM) welcM.value = config.greetings?.welcome_message || '';
  const welcT = document.getElementById('mod-welcome-target');
  if (welcT) welcT.value = config.greetings?.welcome_target || 'private';
  const goodE = document.getElementById('mod-goodbye-enabled');
  if (goodE) goodE.checked = Boolean(config.greetings?.goodbye_enabled);
  const goodM =
    document.getElementById('mod-goodbye-msg') || document.getElementById('mod-goodbye-message');
  if (goodM)
    goodM.value = config.greetings?.goodbye_message || config.greetings?.goodbye_text || '';
  const goodT = document.getElementById('mod-goodbye-target');
  if (goodT) goodT.value = config.greetings?.goodbye_target || 'private';

  // Captcha
  const capE = document.getElementById('mod-captcha-enabled');
  if (capE) {
    capE.checked = Boolean(config.greetings?.captcha_enabled);
    capE.onchange = () => {
      if (capE.checked) {
        loadCaptchaUsers();
      } else {
        const container = document.getElementById('mod-captcha-users-container');
        if (container) container.style.display = 'none';
      }
    };
  }
  const capMode = document.getElementById('mod-captcha-mode');
  if (capMode) capMode.value = config.greetings?.captcha_mode || 'math';
  const capTarget = document.getElementById('mod-captcha-target');
  if (capTarget) capTarget.value = config.greetings?.captcha_target || 'private';
  const capTime = document.getElementById('mod-captcha-timeout');
  if (capTime) capTime.value = config.greetings?.captcha_timeout_seconds || 120;
  const namePrio = document.getElementById('mod-name-priority');
  if (namePrio) namePrio.value = config.greetings?.name_priority || 'name_push_phone';
  const nameFall = document.getElementById('mod-name-fallback');
  if (nameFall) nameFall.value = config.greetings?.name_fallback || 'phone';

  if (capE && capE.checked) {
    loadCaptchaUsers();
  } else {
    const container = document.getElementById('mod-captcha-users-container');
    if (container) container.style.display = 'none';
  }

  // Warnings
  const maxW = document.getElementById('mod-max-warns');
  if (maxW) maxW.value = config.warnings?.max_warnings || 3;
  const wAct = document.getElementById('mod-warn-action');
  if (wAct) wAct.value = config.warnings?.action || 'mute';

  // Warns List UI
  const warnList = document.getElementById('mod-warns-list');
  if (warnList) {
    const userWarns = config.warnings?.user_warns || {};
    // Merge entries that share the same cleaned digits (resolves LID vs PN split)
    const mergedWarns = {};
    for (const key of Object.keys(userWarns)) {
      const cleanKey = key.replace(/\D/g, '') || key;
      if (!userWarns[key]?.length) continue;
      if (!mergedWarns[cleanKey]) mergedWarns[cleanKey] = [];
      mergedWarns[cleanKey].push(...userWarns[key]);
    }

    const entries = Object.keys(mergedWarns).filter((u) => mergedWarns[u]?.length);
    if (!entries.length) {
      warnList.innerHTML = `<div class="empty-state">${t('moderation.no_warns')}</div>`;
    } else {
      warnList.innerHTML = entries
        .map((u) => {
          const warns = mergedWarns[u];
          const items = warns
            .map(
              (w, i) =>
                `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">` +
                `${i + 1}. ${escapeHtml(w.reason)} <span style="font-size:10px;opacity:0.8;">(${new Date(w.timestamp).toLocaleString()})</span>` +
                `</div>`
            )
            .join('');
          return `
        <div class="history-item" style="padding:10px;margin-bottom:8px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <div><strong style="color:var(--primary);">@${escapeHtml(u)}</strong> <span class="badge badge-warning" style="font-size:11px;padding:2px 6px;">${warns.length} warning(s)</span></div>
            <button class="btn btn-secondary btn-sm" style="color:#e74c3c;padding:2px 8px;" onclick="clearUserWarnInUi('${escapeHtml(u)}')">Clear All</button>
          </div>
          <div style="border-top:1px solid var(--border-color);padding-top:4px;">
            ${items}
          </div>
        </div>`;
        })
        .join('');
    }
  }

  // Bans List UI
  const bansList = document.getElementById('mod-bans-list');
  if (bansList) {
    const bannedMap = config.banned_users || {};
    const bannedUserIds = Object.keys(bannedMap);
    if (!bannedUserIds.length) {
      bansList.innerHTML = `<div class="empty-state">${t('moderation.no_bans')}</div>`;
    } else {
      bansList.innerHTML = bannedUserIds
        .map((u) => {
          const info = bannedMap[u];
          const timeStr = info.timestamp ? new Date(info.timestamp).toLocaleString() : 'N/A';
          return `
        <div class="history-item" style="padding:10px;margin-bottom:8px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong style="color:#e74c3c;">🚫 @${escapeHtml(u)}</strong>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
                Reason: ${escapeHtml(info.reason || 'Banned')} &middot; <span style="font-size:10px;opacity:0.8;">${timeStr}</span>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" style="padding:2px 8px;" onclick="unbanUserInUi('${escapeHtml(u)}')"><i class="fas fa-unlock"></i> Unban</button>
          </div>
        </div>`;
        })
        .join('');
    }
  }

  // Kicks List UI
  const kicksList = document.getElementById('mod-kicks-list');
  if (kicksList) {
    const kickLogs = config.kick_log || [];
    if (!kickLogs.length) {
      kicksList.innerHTML = `<div class="empty-state">${t('moderation.no_kicks')}</div>`;
    } else {
      kicksList.innerHTML = kickLogs
        .map((k) => {
          const timeStr = k.timestamp ? new Date(k.timestamp).toLocaleString() : 'N/A';
          return `
        <div class="history-item" style="padding:10px;margin-bottom:8px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong style="color:var(--warning);">👢 @${escapeHtml(k.userId)}</strong>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
                Reason: ${escapeHtml(k.reason || 'Kick')} &middot; <span style="font-size:10px;opacity:0.8;">${timeStr}</span>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" style="color:#e74c3c;padding:2px 8px;" onclick="clearKickLogInUi('${escapeHtml(k.userId)}')"><i class="fas fa-trash"></i> Remove</button>
          </div>
        </div>`;
        })
        .join('');
    }
  }

  // Reports List UI
  const reportsList = document.getElementById('mod-reports-list');
  if (reportsList) {
    const reports = config.reports || [];
    if (!reports.length) {
      reportsList.innerHTML = `<div class="empty-state">${t('moderation.no_reports')}</div>`;
    } else {
      reportsList.innerHTML = reports
        .slice()
        .reverse()
        .map(
          (r) => `
        <div class="history-item" style="padding:10px;margin-bottom:8px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <div>
              <span class="badge ${r.status === 'resolved' ? 'badge-success' : 'badge-danger'}" style="font-size:10px;padding:2px 6px;text-transform:uppercase;">${r.status || 'open'}</span>
              <strong style="color:var(--text-main);margin-left:6px;">Reporter: @${escapeHtml(r.reporter_id)}</strong>
              ${r.target_id ? ` &rarr; <span style="color:#e74c3c;">Target: @${escapeHtml(r.target_id)}</span>` : ''}
            </div>
            ${
              r.status !== 'resolved'
                ? `<button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px;" onclick="resolveReportInUi('${escapeHtml(r.id)}')"><i class="fas fa-check"></i> Resolve</button>`
                : `<span style="font-size:11px;color:var(--text-muted);"><i class="fas fa-check-circle" style="color:#2ecc71;"></i> Resolved</span>`
            }
          </div>
          <div style="font-size:12px;color:var(--text-main);margin-top:4px;">
            <strong>Reason:</strong> ${escapeHtml(r.reason)}
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">
            <i class="far fa-clock"></i> ${new Date(r.timestamp).toLocaleString()}
          </div>
        </div>`
        )
        .join('');
    }
  }

  // Use cached built-in commands (loaded once at startup in loadModerationConfig)
  // Fall back to a live fetch only if cache is still empty
  let builtinCommands = builtinCommandsCache;
  if (builtinCommands.length === 0) {
    try {
      const res = await fetch(basePath + 'api/moderation/commands');
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        builtinCommandsCache = json.data;
        builtinCommands = builtinCommandsCache;
      }
    } catch (err) {
      console.warn('Failed to fetch dynamic commands list:', err);
    }
  }

  // Commands Config UI
  const cmdsEnabled = document.getElementById('mod-cmds-enabled');
  if (cmdsEnabled) cmdsEnabled.checked = Boolean(config.commands?.enabled !== false);
  const cmdsMultiEnabled = document.getElementById('mod-cmds-multi-enabled');
  if (cmdsMultiEnabled) cmdsMultiEnabled.checked = Boolean(config.commands?.multi_command_enabled);
  const cmdsPrefix = document.getElementById('mod-cmds-prefix');
  if (cmdsPrefix) cmdsPrefix.value = config.commands?.prefix || '!';
  const cmdsMuteAct = document.getElementById('mod-cmds-mute-action');
  if (cmdsMuteAct) cmdsMuteAct.value = config.commands?.mute_action || 'delete';

  // Default Commands Grid UI
  const defaultCmdsGrid = document.getElementById('mod-default-cmds-grid');
  if (defaultCmdsGrid) {
    const disabledCmds = config.commands?.disabled_commands || [];
    const prefix = config.commands?.prefix || '!';

    // Base docs URL – moderation page on GitHub Pages
    const DOCS_BASE = 'https://FaserF.github.io/ha-whatsapp/moderation';

    // Map command name → docs anchor (generated from heading text in moderation.md)
    // Format: "#### N. `!cmd`" → anchor "#n-cmd" (GitHub Pages / just-the-docs convention)
    const CMD_DOC_ANCHORS = {
      help: '#1-help',
      ping: '#2-ping',
      id: '#3-id',
      rules: '#4-rules',
      info: '#5-info',
      adminlist: '#6-adminlist-alias-admins',
      admins: '#6-adminlist-alias-admins',
      admin: '#6-adminlist-alias-admins',
      approved: '#7-approved',
      locktypes: '#7-locktypes',
      report: '#8-report',
      get: '#9-get',
      notes: '#10-notes',
      filters: '#11-filters',
      translate: '#12-translate',
      tr: '#12-translate',
      warn: '#13-warn',
      unwarn: '#14-unwarn',
      warns: '#15-warns',
      kick: '#16-kick-alias-ban',
      ban: '#16-kick-alias-ban',
      tban: '#17-tban',
      mute: '#18-mute',
      tmute: '#19-tmute',
      unmute: '#20-unmute',
      del: '#21-del-alias-delete',
      delete: '#21-del-alias-delete',
      approve: '#22-approve',
      unapprove: '#23-unapprove',
      setrules: '#24-setrules',
      promote: '#25-promote',
      demote: '#26-demote',
      setwelcome: '#27-setwelcome',
      welcome: '#28-welcome',
      setgoodbye: '#29-setgoodbye',
      goodbye: '#30-goodbye',
      lock: '#31-lock',
      unlock: '#32-unlock',
      locks: '#33-locks',
      save: '#34-save',
      filter: '#35-filter',
      stop: '#36-stop',
      setlang: '#37-setlang',
      resetwarn: '#38-resetwarn-alias-rmwarn',
      rmwarn: '#38-resetwarn-alias-rmwarn',
      setwarnlimit: '#39-setwarnlimit',
      setwarnaction: '#40-setwarnaction',
      whitelist: '#41-whitelist--approve',
      unwhitelist: '#42-unwhitelist--unapprove',
      whitelisted: '#43-whitelisted',
      scan: '#44-scan',
      autotranslate: '#45-autotranslate',
      flood: '#46-flood',
      newfed: '#47-newfed',
      joinfed: '#48-joinfed',
      leavefed: '#49-leavefed',
      fban: '#50-fban',
      unfban: '#51-unfban',
      fedinfo: '#52-fedinfo',
      fbanlist: '#53-fbanlist',
      fedadmins: '#54-fedadmins',
      removespamlinks: '#55-removespamlinks',
      pin: '#56-pin',
      unpin: '#57-unpin',
      unpinall: '#58-unpinall',
      pinned: '#59-pinned',
      blacklist: '#60-blacklist',
      rmblacklist: '#61-rmblacklist--unblacklist',
      unblacklist: '#61-rmblacklist--unblacklist',
      setblacklistaction: '#62-setblacklistaction',
      setlog: '#63-setlog',
      unsetlog: '#64-unsetlog',
      slowmode: '#65-slowmode',
      settitle: '#66-settitle',
      setdescription: '#67-setdescription',
      setphoto: '#68-setphoto',
      mode: '#69-mode',
      unapproveall: '#70-unapproveall',
      reports: '#71-reports',
    };

    if (builtinCommands.length > 0) {
      defaultCmdsGrid.innerHTML = builtinCommands
        .map((c) => {
          const docAnchor = CMD_DOC_ANCHORS[c.cmd] || `#${encodeURIComponent(c.cmd)}`;
          const docHref = DOCS_BASE + docAnchor;
          const infoBtn = `<a href="${docHref}" target="_blank" rel="noopener" title="View docs for !${escapeHtml(c.cmd)}" style="margin-left:auto; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; background:rgba(var(--primary-rgb,37,211,102),0.15); color:var(--primary,#25d366); font-size:10px; text-decoration:none; transition:background 0.2s;" onmouseover="this.style.background='rgba(var(--primary-rgb,37,211,102),0.35)'" onmouseout="this.style.background='rgba(var(--primary-rgb,37,211,102),0.15)'"><i class="fas fa-info"></i></a>`;
          return `<label data-cmd="${escapeHtml(c.cmd)}" data-help="${escapeHtml(c.help || '')}" title="${escapeHtml(c.help || '')}" style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:4px 8px;border-radius:4px;background:var(--card-bg);border:1px solid var(--border-color);">
            <input type="checkbox" class="mod-default-cmd-toggle" data-cmd="${escapeHtml(c.cmd)}"${!disabledCmds.includes(c.cmd) ? ' checked' : ''}>
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><code>${escapeHtml(prefix)}${escapeHtml(c.cmd)}</code>${c.adminOnly ? ' <span style="font-size:9px;color:#e74c3c;">(admin)</span>' : ''}</span>
            ${infoBtn}
          </label>`;
        })
        .join('');
    } else {
      defaultCmdsGrid.innerHTML = `<div class="empty-state">${t('moderation.no_cmds')}</div>`;
    }

    // Clear search box when group changes
    const searchBox = document.getElementById('mod-default-cmds-search');
    if (searchBox) searchBox.value = '';
  }

  // Custom Commands List UI
  const customCmdsList = document.getElementById('mod-custom-cmds-list');
  if (customCmdsList) {
    const customCmds = config.commands?.custom_commands || [];
    if (!customCmds.length) {
      customCmdsList.innerHTML = `<div class="empty-state" style="color:var(--text-muted);font-size:12px;padding:8px 0;">${t('moderation.no_custom_cmds')}</div>`;
    } else {
      const typeLabel = (t) => {
        if (t === 'webhook')
          return '<span style="font-size:10px;background:rgba(41,182,246,0.15);color:#29b6f6;padding:2px 6px;border-radius:4px;">🏠 HA/Webhook</span>';
        if (t === 'alias')
          return '<span style="font-size:10px;background:rgba(156,39,176,0.15);color:#ce93d8;padding:2px 6px;border-radius:4px;">🔗 Alias</span>';
        return '<span style="font-size:10px;background:rgba(76,175,80,0.15);color:#81c784;padding:2px 6px;border-radius:4px;">🤖 Auto Reply</span>';
      };
      customCmdsList.innerHTML = customCmds
        .map(
          (c, idx) => `
        <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;">
          <div>
            <strong style="color:var(--primary);">${escapeHtml(config.commands?.prefix || '!')}${escapeHtml(c.command)}</strong>
            ${typeLabel(c.type)}
            ${c.admin_only ? '<span style="font-size:10px;background:rgba(231,76,60,0.15);color:#e74c3c;padding:2px 6px;border-radius:4px;margin-left:6px;">Admin Only</span>' : ''}
            ${c.type === 'alias' && c.alias_of ? ` &rarr; <span style="color:var(--text-main);">runs <code>${escapeHtml(config.commands?.prefix || '!')}${escapeHtml(c.alias_of)}</code></span>` : ''}
            ${c.type === 'auto_reply' && c.response ? ` &rarr; <span style="color:var(--text-main);">${escapeHtml(c.response)}</span>` : ''}
            ${c.type === 'webhook' ? ` <span style="color:var(--text-muted);font-size:11px;">— forwarded to HA/Webhook</span>` : ''}
            ${c.description ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;"><em>Help: ${escapeHtml(c.description)}</em></div>` : ''}
          </div>
          <button class="btn btn-secondary btn-sm" style="color:#e74c3c;padding:2px 8px;" onclick="removeCustomCommandRule(${idx})"><i class="fas fa-trash"></i></button>
        </div>`
        )
        .join('');
    }
    // Populate alias target dropdown with built-in + existing custom commands
    _refreshAliasDropdown(config);
  }

  // AI & Translation
  const aiEnabled = document.getElementById('mod-ai-enabled');
  if (aiEnabled) aiEnabled.checked = Boolean(config.ai?.enabled);
  const aiFaq = document.getElementById('mod-ai-faq');
  if (aiFaq) aiFaq.checked = Boolean(config.ai?.faq_auto_reply);
  const aiSentiment = document.getElementById('mod-ai-sentiment');
  if (aiSentiment) aiSentiment.checked = Boolean(config.ai?.sentiment_moderation);
  const aiPrompt = document.getElementById('mod-ai-prompt');
  if (aiPrompt)
    aiPrompt.value =
      config.ai?.system_prompt ||
      'You are an intelligent, friendly, and professional WhatsApp Group Moderator AI. Your goals are to assist group members with accurate information, enforce group etiquette, keep responses concise, polite, and well-formatted for WhatsApp, and maintain a constructive community atmosphere.';
  const transEnabled = document.getElementById('mod-trans-enabled');
  if (transEnabled) transEnabled.checked = config.translation?.enabled !== false;
  const transLang = document.getElementById('mod-trans-lang');
  if (transLang) transLang.value = config.translation?.target_lang || 'en';
  const transMode = document.getElementById('mod-trans-mode');
  if (transMode) transMode.value = config.translation?.mode || 'manual';

  // Anti-Spam & Anti-Raid
  const floodE = document.getElementById('mod-flood-enabled');
  if (floodE) floodE.checked = Boolean(config.antispam?.flood_protection?.enabled);
  const floodMax = document.getElementById('mod-flood-max');
  if (floodMax) floodMax.value = config.antispam?.flood_protection?.max_messages || 5;
  const floodWin = document.getElementById('mod-flood-win');
  if (floodWin) floodWin.value = config.antispam?.flood_protection?.window_seconds || 5;

  const raidE = document.getElementById('mod-antiraid-enabled');
  if (raidE) raidE.checked = Boolean(config.antispam?.anti_raid?.enabled);
  const raidMax = document.getElementById('mod-antiraid-max');
  if (raidMax) raidMax.value = config.antispam?.anti_raid?.max_joins || 5;
  const raidWin = document.getElementById('mod-antiraid-win');
  if (raidWin) raidWin.value = config.antispam?.anti_raid?.window_seconds || 10;

  const antispamLinksE = document.getElementById('mod-antispam-links-enabled');
  if (antispamLinksE) antispamLinksE.checked = Boolean(config.anti_spam_links_enabled);

  const notifyDeletedE = document.getElementById('mod-notify-deleted-action');
  if (notifyDeletedE) notifyDeletedE.checked = config.antispam?.notify_deleted_action !== false; // Default true

  const notifyBypassedE = document.getElementById('mod-notify-bypassed-actions');
  if (notifyBypassedE) notifyBypassedE.checked = Boolean(config.antispam?.notify_bypassed_actions);

  const botAntispamE = document.getElementById('mod-antispam-bot-enabled');
  if (botAntispamE) botAntispamE.checked = config.antispam?.bot_anti_spam?.enabled !== false; // Default true

  const blockedPlatforms = config.antispam?.blocked_invite_platforms || {};
  const platforms = ['whatsapp', 'telegram', 'signal', 'instagram', 'discord', 'other'];
  for (const plat of platforms) {
    const el = document.getElementById(`mod-invite-platform-${plat}`);
    if (el) el.checked = blockedPlatforms[plat] !== false; // Default true if undefined
  }

  // Muted Users List UI
  const mutedList = document.getElementById('mod-muted-users-list');
  if (mutedList) {
    const mutedUsers = config.muted_users || {};
    const entries = Object.entries(mutedUsers).filter(
      ([, data]) => !data.until || data.until > Date.now()
    );
    if (!entries.length) {
      mutedList.innerHTML = `<div class="empty-state" style="color:var(--text-muted);font-size:12px;padding:6px 0;">${t('moderation.no_muted_users')}</div>`;
    } else {
      mutedList.innerHTML = entries
        .map(([userKey, data]) => {
          const reason = data.reason || 'No reason provided';
          const untilStr = data.until
            ? `Until ${new Date(data.until).toLocaleTimeString()}`
            : 'Indefinitely';
          const dateStr = data.created ? new Date(data.created).toLocaleString() : null;
          return `
        <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;">
          <div>
            <strong style="color:var(--text-main);font-size:12px;">@${escapeHtml(userKey)}</strong>
            <span class="badge badge-warning" style="font-size:10px;margin-left:6px;">${escapeHtml(untilStr)}</span>
            <div style="font-size:11px;color:var(--text-main);margin-top:2px;">
              <strong>Reason:</strong> ${escapeHtml(reason)}
            </div>
            ${dateStr ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;"><i class="far fa-clock"></i> ${escapeHtml(dateStr)}</div>` : ''}
          </div>
          <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px;" onclick="unmuteUserInUi('${escapeHtml(userKey)}')"><i class="fas fa-volume-up"></i> Unmute</button>
        </div>`;
        })
        .join('');
    }
  }

  // Locks
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
  lockKeys.forEach((key) => {
    const el = document.getElementById(`mod-lock-${key}`);
    if (el) el.checked = Boolean(config.locks?.[key]?.enabled);
  });

  // Blacklist Tag Cloud & Mode
  const blMode = document.getElementById('mod-blacklist-mode');
  if (blMode) blMode.value = config.blacklist?.matching_mode || 'exact';

  const blTags = document.getElementById('mod-blacklist-tags');
  if (blTags) {
    const words = config.blacklist?.words || [];
    if (!words.length) {
      blTags.innerHTML = `<span style="color:var(--text-muted);font-size:12px;">${t('moderation.no_blacklist_words')}</span>`;
    } else {
      blTags.innerHTML = words
        .map(
          (w, idx) => `
        <span class="mod-tag" style="display:inline-flex;align-items:center;gap:6px;background:rgba(231,76,60,0.15);color:#e74c3c;border:1px solid rgba(231,76,60,0.3);padding:4px 10px;border-radius:16px;font-size:12px;margin:3px;">
          <span>${escapeHtml(w)}</span>
          <button style="background:none;border:none;color:#e74c3c;cursor:pointer;padding:0;font-size:14px;line-height:1;" onclick="removeBlacklistWord(${idx})">&times;</button>
        </span>`
        )
        .join('');
    }
  }

  // Filters List
  const filtersList = document.getElementById('mod-filters-list');
  if (filtersList) {
    const filters = config.filters || [];
    if (!filters.length) {
      filtersList.innerHTML = `<div class="empty-state" style="color:var(--text-muted);font-size:12px;padding:8px 0;">${t('moderation.no_filters')}</div>`;
    } else {
      filtersList.innerHTML = filters
        .map(
          (f, idx) => `
        <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;">
          <div>
            <strong style="color:var(--primary);">${escapeHtml(f.trigger)}</strong>
            ${f.type === 'faq' ? '<span style="font-size:10px;background:rgba(52,152,219,0.15);color:#3498db;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:600;">💡 FAQ</span>' : '<span style="font-size:10px;background:rgba(46,204,113,0.15);color:#2ecc71;padding:2px 6px;border-radius:4px;margin-left:6px;">Reply</span>'}
            &rarr; <span style="color:var(--text-main);">${escapeHtml(f.response)}</span>
          </div>
          <button class="btn btn-secondary btn-sm" style="color:#e74c3c;padding:2px 8px;" onclick="removeFilterRule(${idx})"><i class="fas fa-trash"></i></button>
        </div>`
        )
        .join('');
    }
  }

  // Federation Select & Shared Blacklist Tags
  const fedSelect = document.getElementById('mod-fed-select');
  if (fedSelect && modStoreCache?.federations) {
    const activeFedId = config.federation_id || 'fed_global_default';
    let opts = `<option value="">${window.t('moderation.no_federation_joined')}</option>`;
    modStoreCache.federations.forEach((f) => {
      opts += `<option value="${f.id}"${f.id === activeFedId ? ' selected' : ''}>${escapeHtml(f.name || f.id)}</option>`;
    });
    fedSelect.innerHTML = opts;
    fedSelect.value = activeFedId;
  }
  updateFedBlacklistTagsInUi();
  // Capture a snapshot of all field values AFTER populating them.
  // _guardDirty() will diff against this snapshot on every subtab switch.
  _captureSnapshot();
  updateModerationDisabledState();
}

async function toggleGroupModeration(enabled) {
  if (!currentModGroup) return;
  updateModerationDisabledState();
  const url =
    basePath +
    `api/moderation/groups/${encodeURIComponent(currentModGroup)}/${enabled ? 'enable' : 'disable'}`;
  try {
    const res = await fetch(url, { method: 'POST' });
    if (res.ok) {
      showToast(
        enabled ? t('moderation.group_enabled') : t('moderation.group_disabled'),
        'success'
      );
      loadModerationConfig();
    }
  } catch (e) {
    showToast(t('moderation.group_update_failed'), 'danger');
  }
}

function _doSwitchModSubTab(subTab) {
  // Hide all panels
  const panels = document.querySelectorAll('.mod-subpanel');
  panels.forEach((p) => (p.style.display = 'none'));
  const activeP = document.getElementById(`mod-subpanel-${subTab}`);
  if (activeP) activeP.style.display = 'block';

  // Update active button state
  const subTabBar = document.querySelector('#tab-moderation .mod-subtab-bar');
  if (subTabBar) {
    subTabBar.querySelectorAll('button').forEach((btn) => btn.classList.remove('active'));
    const activeBtn = subTabBar.querySelector(`[data-subtab="${subTab}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }
}

function switchModSubTab(subTab) {
  if (!_guardDirty(() => _doSwitchModSubTab(subTab))) return;
  _doSwitchModSubTab(subTab);
}

/** Register dirty-tracking listeners – now snapshot-based, no event delegation needed. */
function _registerDirtyListeners() {
  // The snapshot is captured at the end of selectModerationGroup.
  // No event listeners needed – _guardDirty() does a snapshot diff on every switch.
}

async function saveGroupRules() {
  if (!currentModGroup) return showToast(t('moderation.select_group_warning'), 'warning');
  const text = document.getElementById('mod-rules-text')?.value || '';
  const showOnJoin = Boolean(document.getElementById('mod-rules-show-on-join')?.checked);
  const lang = document.getElementById('mod-group-language-select')?.value || 'en';

  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.rules = { text, show_on_join: showOnJoin };
  groupConfig.language = lang;

  await saveGroupConfig(groupConfig);
  markClean();
  showToast(t('moderation.group_rules_saved'), 'success');
}

async function saveGroupGreetings() {
  if (!currentModGroup) return showToast(t('moderation.select_group_warning'), 'warning');
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.greetings = {
    welcome_enabled: Boolean(document.getElementById('mod-welcome-enabled')?.checked),
    welcome_message: document.getElementById('mod-welcome-msg')?.value || '',
    welcome_target: document.getElementById('mod-welcome-target')?.value || 'private',
    goodbye_enabled: Boolean(document.getElementById('mod-goodbye-enabled')?.checked),
    goodbye_message: document.getElementById('mod-goodbye-msg')?.value || '',
    goodbye_target: document.getElementById('mod-goodbye-target')?.value || 'private',
    captcha_enabled: Boolean(document.getElementById('mod-captcha-enabled')?.checked),
    captcha_mode: document.getElementById('mod-captcha-mode')?.value || 'math',
    captcha_target: document.getElementById('mod-captcha-target')?.value || 'private',
    captcha_timeout_seconds:
      parseInt(document.getElementById('mod-captcha-timeout')?.value, 10) || 120,
    name_priority: document.getElementById('mod-name-priority')?.value || 'name_push_phone',
    name_fallback: document.getElementById('mod-name-fallback')?.value || 'phone',
  };
  await saveGroupConfig(groupConfig);
  markClean();
  showToast(t('moderation.greetings_saved'), 'success');
  loadCaptchaUsers();
}

async function loadCaptchaUsers() {
  const container = document.getElementById('mod-captcha-users-container');
  const listEl = document.getElementById('mod-captcha-users-list');
  const capE = document.getElementById('mod-captcha-enabled');

  if (!container || !listEl) return;

  const isCaptchaOn = Boolean(capE?.checked);
  if (!isCaptchaOn || !currentModGroup) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  listEl.innerHTML =
    '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading captcha user status...</div>';

  try {
    const res = await fetch(
      basePath + `api/moderation/groups/${encodeURIComponent(currentModGroup)}/captcha/users`
    );
    const json = await res.json();
    const users = json.data || [];

    if (!Array.isArray(users) || users.length === 0) {
      listEl.innerHTML = `<div class="empty-state">${window.t ? window.t('moderation.no_group_users') : 'No group users found'}</div>`;
      return;
    }

    listEl.innerHTML = users
      .map((u) => {
        let badgeHtml;
        if (u.verified) {
          badgeHtml =
            '<span class="badge badge-success" style="background:#00a884; color:#fff; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:600;"><i class="fas fa-check-circle"></i> Verified</span>';
        } else if (u.pending) {
          badgeHtml =
            '<span class="badge badge-warning" style="background:#ffbc00; color:#000; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:600;"><i class="fas fa-hourglass-half"></i> Pending</span>';
        } else {
          badgeHtml =
            '<span class="badge badge-danger" style="background:#ea0038; color:#fff; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:600;"><i class="fas fa-times-circle"></i> Unverified</span>';
        }

        const modeLabel = u.mode
          ? `<span style="font-size:11px; color:var(--text-muted); margin-left:6px;">(${u.mode})</span>`
          : '';
        const adminLabel = u.isAdmin
          ? '<span style="font-size:11px; color:var(--primary); font-weight:600; margin-left:6px;">[Admin]</span>'
          : '';

        const actionBtn = u.verified
          ? `<button class="btn btn-outline-warning btn-sm" onclick="toggleUserCaptchaVerification('${escapeHtml(u.userId)}', false)"><i class="fas fa-user-slash"></i> Set Unverified</button>`
          : `<button class="btn btn-success btn-sm" onclick="toggleUserCaptchaVerification('${escapeHtml(u.userId)}', true)"><i class="fas fa-user-check"></i> Verify User</button>`;

        return `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--border-color); gap:12px;">
            <div style="flex:1; min-width:0;">
              <div style="font-size:13px; font-weight:600; color:var(--text-main); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
                ${escapeHtml(u.name || u.userId)} ${adminLabel}
              </div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                ID: <code>${escapeHtml(u.userId)}</code> ${modeLabel}
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              ${badgeHtml}
              ${actionBtn}
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state" style="color:var(--danger);">${window.t ? window.t('moderation.failed_load_captcha_users', { error: escapeHtml(err.message) }) : 'Failed to load captcha users: ' + escapeHtml(err.message)}</div>`;
  }
}

async function toggleUserCaptchaVerification(userId, verified) {
  if (!currentModGroup || !userId) return;
  try {
    const res = await fetch(
      basePath + `api/moderation/groups/${encodeURIComponent(currentModGroup)}/captcha/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, verified: Boolean(verified) }),
      }
    );
    const json = await res.json();
    if (json.success) {
      showToast(
        t('moderation.user_verification_updated', {
          user: userId,
          status: verified ? t('moderation.verified') : t('moderation.unverified'),
        }),
        'success'
      );
      loadCaptchaUsers();
    } else {
      showToast(json.error || t('moderation.user_verification_failed'), 'error');
    }
  } catch (err) {
    showToast(t('moderation.user_verification_error', { error: err.message }), 'error');
  }
}

async function saveGroupWarnings() {
  if (!currentModGroup) return showToast(t('moderation.select_group_warning'), 'warning');
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.warnings = {
    ...(groupConfig.warnings || {}),
    max_warnings: parseInt(document.getElementById('mod-max-warns')?.value, 10) || 3,
    action: document.getElementById('mod-warn-action')?.value || 'mute',
  };
  await saveGroupConfig(groupConfig);
  markClean();
  showToast(t('moderation.warnings_saved'), 'success');
}

async function saveGroupCommands() {
  if (!currentModGroup) return showToast(t('moderation.select_group_warning'), 'warning');

  const enabled = Boolean(document.getElementById('mod-cmds-enabled')?.checked);
  const multi_command_enabled = Boolean(document.getElementById('mod-cmds-multi-enabled')?.checked);
  const prefix = document.getElementById('mod-cmds-prefix')?.value || '!';
  const mute_action = document.getElementById('mod-cmds-mute-action')?.value || 'delete';

  const disabledCmds = [];
  document.querySelectorAll('.mod-default-cmd-toggle').forEach((cb) => {
    if (!cb.checked) {
      disabledCmds.push(cb.dataset.cmd);
    }
  });

  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.commands = {
    ...(groupConfig.commands || {}),
    enabled,
    multi_command_enabled,
    prefix,
    mute_action,
    disabled_commands: disabledCmds,
  };

  await saveGroupConfig(groupConfig);
  showToast(t('moderation.commands_saved'), 'success');
}

function toggleAllDefaultCommands(enable) {
  // Only toggle visible commands (respects active search filter)
  document.querySelectorAll('.mod-default-cmd-toggle').forEach((cb) => {
    const label = cb.closest('label');
    if (!label || label.style.display === 'none') return;
    cb.checked = Boolean(enable);
  });
}

window.filterDefaultCommands = function filterDefaultCommands(query) {
  const q = (query || '').trim().toLowerCase();
  const grid = document.getElementById('mod-default-cmds-grid');
  if (!grid) return;
  let visibleCount = 0;
  grid.querySelectorAll('label[data-cmd]').forEach((label) => {
    const cmd = (label.getAttribute('data-cmd') || '').toLowerCase();
    const help = (label.getAttribute('data-help') || '').toLowerCase();
    const matches = !q || cmd.includes(q) || help.includes(q);
    label.style.display = matches ? '' : 'none';
    if (matches) visibleCount++;
  });

  // Show/hide empty state
  let emptyEl = grid.querySelector('.cmd-search-empty');
  if (visibleCount === 0 && q) {
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'cmd-search-empty empty-state';
      emptyEl.style.cssText =
        'grid-column:1/-1; color:var(--text-muted); font-size:12px; padding:8px 4px;';
      grid.appendChild(emptyEl);
    }
    emptyEl.textContent = window.t
      ? window.t('moderation.no_matching_commands', { query })
      : `No commands matching "${query}"`;
    emptyEl.style.display = '';
  } else if (emptyEl) {
    emptyEl.style.display = 'none';
  }
};
window.toggleAllDefaultCommands = toggleAllDefaultCommands;

async function addCustomCommandRule() {
  const nameInp = document.getElementById('mod-cmd-name');
  const typeInp = document.getElementById('mod-cmd-type');
  const respInp = document.getElementById('mod-cmd-response');
  const aliasInp = document.getElementById('mod-cmd-alias-target');
  const descInp = document.getElementById('mod-cmd-description');
  const adminOnlyInp = document.getElementById('mod-cmd-admin-only');

  const name = nameInp?.value.trim().replace(/^[!/#]+/, '');
  const cmdType = typeInp?.value || 'auto_reply';
  const resp = respInp?.value.trim();
  const aliasTarget = aliasInp?.value.trim();
  const desc = descInp?.value.trim();
  const adminOnly = Boolean(adminOnlyInp?.checked);

  if (!name || !currentModGroup) return;
  if (cmdType === 'auto_reply' && !resp) return;
  if (cmdType === 'alias' && !aliasTarget) {
    showToast(t('moderation.select_alias_target'), 'error');
    return;
  }

  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.commands = groupConfig.commands || {
    enabled: true,
    prefix: '!',
    mute_action: 'delete',
  };
  groupConfig.commands.custom_commands = groupConfig.commands.custom_commands || [];

  const entry = { command: name, type: cmdType, admin_only: adminOnly };
  if (cmdType === 'auto_reply') entry.response = resp;
  if (cmdType === 'alias') entry.alias_of = aliasTarget;
  if (desc) entry.description = desc;

  groupConfig.commands.custom_commands.push(entry);

  if (nameInp) nameInp.value = '';
  if (respInp) respInp.value = '';
  if (aliasInp) aliasInp.value = '';
  if (descInp) descInp.value = '';
  if (adminOnlyInp) adminOnlyInp.checked = false;

  await saveGroupConfig(groupConfig);
  showToast(t('moderation.custom_command_added', { name }), 'success');
  selectModerationGroup(currentModGroup);
  setTimeout(() => {
    if (nameInp) nameInp.focus();
  }, 50);
}

function onCustomCmdTypeChange() {
  const type = document.getElementById('mod-cmd-type')?.value;
  const respWrap = document.getElementById('mod-cmd-response-wrap');
  const aliasWrap = document.getElementById('mod-cmd-alias-wrap');
  if (!respWrap || !aliasWrap) return;
  if (type === 'alias') {
    respWrap.style.display = 'none';
    aliasWrap.style.display = 'flex';
  } else if (type === 'webhook') {
    respWrap.style.display = 'none';
    aliasWrap.style.display = 'none';
  } else {
    respWrap.style.display = 'flex';
    aliasWrap.style.display = 'none';
  }
}

function _refreshAliasDropdown(config) {
  const aliasSelect = document.getElementById('mod-cmd-alias-target');
  if (!aliasSelect) return;
  const builtins = [
    'ping',
    'help',
    'id',
    'rules',
    'warn',
    'warns',
    'unwarn',
    'kick',
    'ban',
    'mute',
    'unmute',
    'promote',
    'demote',
    'clear',
    'report',
    'notes',
    'note',
    'captcha',
    'test',
  ];
  const prefix = config.commands?.prefix || '!';
  const customCmds = (config.commands?.custom_commands || []).map((c) => c.command);
  const allTargets = [...new Set([...builtins, ...customCmds])];
  aliasSelect.innerHTML =
    `<option value="">— ${window.t('moderation.select_target')} —</option>` +
    allTargets
      .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(prefix)}${escapeHtml(c)}</option>`)
      .join('');
}

async function removeCustomCommandRule(idx) {
  if (!currentModGroup || !modStoreCache?.groups?.[currentModGroup]) return;
  const groupConfig = modStoreCache.groups[currentModGroup];
  if (groupConfig.commands?.custom_commands) {
    groupConfig.commands.custom_commands.splice(idx, 1);
    await saveGroupConfig(groupConfig);
    selectModerationGroup(currentModGroup);
  }
}

async function clearUserWarnInUi(userId) {
  if (!currentModGroup || !userId) return;
  try {
    const res = await fetch(
      basePath +
        `api/moderation/groups/${encodeURIComponent(currentModGroup)}/warn/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      }
    );
    if (res.ok) {
      showToast(t('moderation.warnings_cleared', { user: userId }), 'success');
      loadModerationConfig();
      setTimeout(() => selectModerationGroup(currentModGroup), 200);
    }
  } catch (e) {
    showToast(t('moderation.warnings_clear_failed'), 'danger');
  }
}

async function resolveReportInUi(reportId) {
  if (!currentModGroup || !reportId) return;
  try {
    const res = await fetch(
      basePath +
        `api/moderation/groups/${encodeURIComponent(currentModGroup)}/reports/${encodeURIComponent(reportId)}/resolve`,
      {
        method: 'POST',
      }
    );
    if (res.ok) {
      showToast(t('moderation.report_resolved'), 'success');
      loadModerationConfig();
      setTimeout(() => selectModerationGroup(currentModGroup), 200);
    }
  } catch (e) {
    showToast(t('moderation.report_resolve_failed'), 'danger');
  }
}

async function unbanUserInUi(userId) {
  if (!currentModGroup || !userId) return;
  try {
    const res = await fetch(
      basePath +
        `api/moderation/groups/${encodeURIComponent(currentModGroup)}/ban/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      }
    );
    if (res.ok) {
      showToast(t('moderation.unbanned_user', { user: userId }), 'success');
      loadModerationConfig();
      setTimeout(() => selectModerationGroup(currentModGroup), 200);
    }
  } catch (e) {
    showToast(t('moderation.unban_failed'), 'danger');
  }
}

async function clearKickLogInUi(userId) {
  if (!currentModGroup || !userId) return;
  try {
    const res = await fetch(
      basePath +
        `api/moderation/groups/${encodeURIComponent(currentModGroup)}/kick/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      }
    );
    if (res.ok) {
      showToast(t('moderation.kick_log_removed', { user: userId }), 'success');
      loadModerationConfig();
      setTimeout(() => selectModerationGroup(currentModGroup), 200);
    }
  } catch (e) {
    showToast(t('moderation.kick_log_remove_failed'), 'danger');
  }
}

async function unmuteUserInUi(userId) {
  if (!currentModGroup || !userId) return;
  try {
    const res = await fetch(
      basePath +
        `api/moderation/groups/${encodeURIComponent(currentModGroup)}/mute/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      }
    );
    if (res.ok) {
      showToast(t('moderation.unmuted_user', { user: userId }), 'success');
      loadModerationConfig();
      setTimeout(() => selectModerationGroup(currentModGroup), 200);
    }
  } catch (e) {
    showToast(t('moderation.unmute_failed'), 'danger');
  }
}

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

  const modal = document.getElementById('test-commands-modal');
  if (modal) modal.style.display = 'flex';

  if (logStream) logStream.style.display = 'block';
  if (progressContainer) progressContainer.style.display = 'block';
  if (progressBar) progressBar.style.width = '0%';
  if (logContent) {
    logContent.removeAttribute('data-i18n');
    logContent.innerHTML = '';
  }
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
  groupConfig.stt_engine = document.getElementById('mod-stt-engine')?.value || 'auto';
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

// Moderation Federation & Import/Export

async function saveGroupFederation() {
  if (!currentModGroup) return;
  const fedId = document.getElementById('mod-fed-select')?.value || '';
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.federation_id = fedId;
  await saveGroupConfig(groupConfig);
  markClean();
  showToast(t('moderation.federation_saved'), 'success');
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
    showToast(t('moderation.federation_created'), 'success');
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
    showToast(t('moderation.federation_exported'), 'info');
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
  if (!currentModGroup) return showToast(t('moderation.select_group_warning'), 'warning');
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
    showToast(t('moderation.federation_exported'), 'success');
  } catch (e) {
    showToast(t('moderation.federation_saved'), 'danger');
  }
}

async function importGroupModerationConfig() {
  if (!currentModGroup) return showToast(t('moderation.select_group_warning'), 'warning');
  const txt = document.getElementById('mod-import-text')?.value.trim();
  if (!txt) return showToast(t('moderation.invalid_json'), 'warning');

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
      showToast(t('moderation.federation_imported'), 'success');
      loadModerationConfig();
    } else {
      showToast(t('moderation.invalid_json'), 'danger');
    }
  } catch (e) {
    showToast(t('moderation.invalid_json'), 'danger');
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
  if (modal) modal.classList.add('show');
}

function closeCreateFederationModal() {
  const modal = document.getElementById('create-federation-modal');
  if (modal) modal.classList.remove('show');
}

async function saveNewCustomFederation() {
  const name = document.getElementById('mod-new-fed-name')?.value.trim();
  const desc =
    document.getElementById('mod-new-fed-desc')?.value.trim() || 'Custom local security federation';
  if (!name) return showToast(t('moderation.select_group_warning'), 'warning');

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
      showToast(t('moderation.federation_created'), 'success');
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
    showToast(t('moderation.federation_saved'), 'danger');
  }
}

function exportFederationConfig() {
  const fedSelect = document.getElementById('mod-fed-select');
  const fedId = fedSelect?.value || 'fed_global_default';
  const fed = (modStoreCache?.federations || []).find((f) => f.id === fedId);
  if (!fed) return showToast(t('moderation.select_group_warning'), 'warning');

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
  showToast(t('moderation.federation_exported'), 'success');
}

function openImportFederationModal() {
  const modal = document.getElementById('import-federation-modal');
  if (modal) modal.classList.add('show');
}

function closeImportFederationModal() {
  const modal = document.getElementById('import-federation-modal');
  if (modal) modal.classList.remove('show');
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
      showToast(t('moderation.federation_exported'), 'info');
      const res = await fetch(urlInp);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      importedData = await res.json();
    } catch (err) {
      showToast(t('moderation.invalid_json'), 'danger');
      return;
    }
  } else if (file) {
    try {
      const text = await file.text();
      importedData = JSON.parse(text);
    } catch (err) {
      showToast(t('moderation.invalid_json'), 'danger');
      return;
    }
  } else {
    showToast(t('moderation.invalid_json'), 'warning');
    return;
  }

  // Handle either direct federation object or wrapped export structure
  const fedObj = importedData?.federation || importedData;
  if (!fedObj || typeof fedObj !== 'object' || !fedObj.name) {
    return showToast(t('moderation.invalid_json'), 'danger');
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
      showToast(t('moderation.federation_imported'), 'success');
      closeImportFederationModal();
      await loadModerationConfig();
      const fedSelect = document.getElementById('mod-fed-select');
      if (fedSelect) {
        fedSelect.value = targetId;
        updateFedBlacklistTagsInUi();
      }
    }
  } catch (e) {
    showToast(t('moderation.federation_saved'), 'danger');
  }
}

// Telegram Bridge Dashboard UI Logic

let cachedTelegramBots = [];

function updateTelegramBridgeDisabledState(enabled) {
  const tab = document.getElementById('tab-telegram');
  if (!tab) return;
  const cards = tab.querySelectorAll('.mod-settings-card, .card');
  cards.forEach((card) => {
    if (enabled) {
      card.classList.remove('disabled-section');
    } else {
      card.classList.add('disabled-section');
    }
    const inputs = card.querySelectorAll('input, select, button, textarea');
    inputs.forEach((el) => {
      el.disabled = !enabled;
    });
  });
}

async function loadTelegramBridgeData() {
  try {
    const res = await fetch('api/telegram/config');
    const data = await res.json();
    if (data.success && data.data) {
      const cfg = data.data;
      const toggle = document.getElementById('tg-global-toggle');
      if (toggle) toggle.checked = Boolean(cfg.enabled);
      updateTelegramBridgeDisabledState(Boolean(cfg.enabled));

      const catchupEnabled = document.getElementById('tg-catchup-enabled');
      if (catchupEnabled) {
        catchupEnabled.checked = cfg.offline_catchup?.enabled !== false;
      }
      const catchupWindow = document.getElementById('tg-catchup-window');
      if (catchupWindow && cfg.offline_catchup?.max_age_minutes) {
        catchupWindow.value = String(cfg.offline_catchup.max_age_minutes);
      }

      cachedTelegramBots = cfg.bots || [];
      renderTelegramBots(cachedTelegramBots);
      renderTelegramMappings(cfg.mappings || [], cachedTelegramBots);
      populateTelegramTestMappingDropdown(cfg.mappings || []);
    }
  } catch (err) {
    console.error('Failed to load Telegram bridge config', err);
  }
}

async function saveTelegramCatchupConfig() {
  const enabled = document.getElementById('tg-catchup-enabled')?.checked ?? true;
  const max_age_minutes = Number(document.getElementById('tg-catchup-window')?.value) || 2;
  try {
    const res = await fetch(basePath + 'api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offline_catchup: {
          enabled: Boolean(enabled),
          max_age_minutes,
        },
      }),
    });
    if (res.ok) {
      showToast(window.t ? window.t('telegram.catchup_saved') || 'Offline-Nachholen gespeichert' : 'Offline Catchup settings saved', 'success');
    }
  } catch (err) {
    console.error('Failed to save offline catchup config', err);
    showToast(window.t ? window.t('telegram.catchup_save_failed') || 'Fehler beim Speichern' : 'Failed to save offline catchup settings', 'danger');
  }
}

function renderTelegramBots(bots) {
  const container = document.getElementById('tg-bots-list-container');
  if (!container) return;

  if (!bots || bots.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; color:var(--text-muted); padding:24px; border:1px dashed var(--border-color); border-radius:8px;">
        <i class="fas fa-robot" style="font-size:28px; opacity:0.4; margin-bottom:8px; display:block;"></i>
        No Telegram Bots configured. Click "Add Telegram Bot" to connect your first bot via Bot Token.
      </div>
    `;
    return;
  }

  container.innerHTML = bots
    .map(
      (b) => `
    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:12px 16px; background:var(--bg-input); border:1px solid var(--border-color); border-radius:8px;">
      <div style="display:flex; align-items:center; gap:12px; min-width:180px;">
        <div style="font-size: 20px; color: #0088cc; background: rgba(0, 136, 204, 0.15); width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink:0;">
          <i class="fas fa-robot"></i>
        </div>
        <div>
          <div style="font-weight:600; font-size:14px; word-break:break-word;">${escapeHtml(b.name || '@' + b.username)}</div>
          <div style="font-size:12px; color:var(--text-muted); font-family:monospace; word-break:break-all;">
            Username: @${escapeHtml(b.username || 'unknown')}
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px; flex-shrink:0; margin-left:auto;">
        <button class="btn btn-secondary btn-sm" style="white-space:nowrap;" onclick="editTelegramBot('${b.id}')" title="Edit Bot"><i class="fas fa-edit"></i> Edit</button>
        <button class="btn btn-danger btn-sm" style="white-space:nowrap;" onclick="deleteTelegramBot('${b.id}')" title="Delete Bot"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `
    )
    .join('');
}

function renderTelegramMappings(mappings, bots = []) {
  const tbody = document.getElementById('tg-mappings-tbody');
  if (!tbody) return;

  if (mappings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:32px;"><i class="fas fa-link" style="font-size:32px; opacity:0.3; margin-bottom:8px; display:block;"></i>No active chat mappings configured. Click "Add New Mapping" to start bridging.</td></tr>`;
    return;
  }

  tbody.innerHTML = mappings
    .map((m) => {
      const assignedBot = bots.find((b) => b.id === m.bot_id);
      const botLabel = assignedBot ? `@${assignedBot.username}` : 'Default Bot';

      let waTitle = m.wa_name && m.wa_name !== m.wa_jid ? m.wa_name : '';
      if (waTitle === '__ME_SELF_BOT__' || m.wa_jid === '__ME_SELF_BOT__') {
        waTitle = (window.t ? window.t('chats.me_self') : null) || 'Me / Self (Bot Account)';
      } else if (typeof waTitle === 'string' && waTitle.startsWith('__GROUP_FALLBACK__:')) {
        waTitle = `${(window.t ? window.t('common.group') : null) || 'Group'} (${waTitle.split(':')[1]})`;
      }

      const tgTitle =
        m.tg_chat_title && !m.tg_chat_title.startsWith('Chat ') ? m.tg_chat_title : '';

      const cleanWa = waTitle || m.wa_jid.split('@')[0];
      const cleanTg = tgTitle || `TG ${m.tg_chat_id}`;
      const threadLabel = m.tg_thread_id ? ` (Topic ${m.tg_thread_id})` : '';
      const autoName = `${cleanWa} ↔ ${cleanTg}${threadLabel}`;
      const displayName = m.name === '__ME_SELF_BOT__' ? waTitle : m.name || autoName;

      const waDisplay = waTitle
        ? `<strong>${escapeHtml(waTitle)}</strong><br><small style="color:var(--text-muted);">(${escapeHtml(m.wa_jid)})</small>`
        : `<strong>${escapeHtml(m.wa_jid)}</strong>`;

      const tgDisplay = tgTitle
        ? `<strong>${escapeHtml(tgTitle)}</strong><br><small style="color:var(--text-muted);">(${escapeHtml(m.tg_chat_id)})</small>`
        : `<strong>${escapeHtml(m.tg_chat_id)}</strong><br><small style="color:var(--text-muted);">(${m.tg_chat_type || 'chat'})</small>`;

      return `
    <tr>
      <td style="vertical-align:middle; padding:12px 14px;">
        <label class="mod-toggle-switch mod-toggle-sm">
          <input type="checkbox" ${m.enabled ? 'checked' : ''} onchange="toggleTelegramMapping('${m.id}')">
          <span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span>
        </label>
      </td>
      <td style="vertical-align:middle; padding:12px 14px;">
        <strong>${escapeHtml(displayName)}</strong><br>
        <span class="badge" style="background:rgba(0,136,204,0.12); color:#0088cc; font-size:10px; padding:2px 6px; border-radius:4px;"><i class="fas fa-robot"></i> ${escapeHtml(botLabel)}</span>
      </td>
      <td style="vertical-align:middle; padding:12px 14px;">${waDisplay}</td>
      <td style="vertical-align:middle; padding:12px 14px;">${tgDisplay}</td>
      <td style="vertical-align:middle; padding:12px 14px;"><span class="badge" style="background:var(--bg-card); border:1px solid var(--border-color);">${m.sync_mode}</span></td>
      <td style="vertical-align:middle; padding:12px 14px;">
        <small style="color:var(--text-muted); line-height:1.4; display:block;">
          ${m.is_direct_chat_mirror ? '<span class="badge" style="background:rgba(40,167,69,0.15); color:#28a745; font-size:10px; padding:2px 6px; border-radius:4px; margin-bottom:4px; display:inline-block;"><i class="fas fa-user"></i> 1:1 Direct Mirror</span><br>' : ''}
          Group: ${m.include_group_name ? 'Yes' : 'No'} | Sender: ${m.include_sender_name ? 'Yes' : 'No'}<br>
          Sync Self: <strong>${m.sync_self_messages ? 'Enabled' : 'Off'}</strong>
        </small>
      </td>
      <td style="text-align:right; vertical-align:middle; padding:12px 14px; white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" style="margin-right:6px;" onclick="editTelegramMapping('${m.id}')" title="Edit mapping settings"><i class="fas fa-edit"></i> Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTelegramMapping('${m.id}')" title="Delete mapping"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `;
    })
    .join('');
}

async function toggleTelegramBridge(enabled) {
  try {
    updateTelegramBridgeDisabledState(enabled);
    await fetch('api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    showToast(enabled ? t('telegram.bridge_active') : t('telegram.mapping_deleted'), 'info');
    loadTelegramBridgeData();
  } catch (e) {
    showToast(t('telegram.bot_add_failed'), 'danger');
  }
}

function openAddTelegramBotModal() {
  const title = document.getElementById('tg-bot-modal-title');
  if (title)
    title.innerHTML =
      '<i class="fas fa-robot"></i> ' +
      (window.t ? window.t('telegram.add_bot_modal_title') : 'Add Telegram Bot');

  const idEl = document.getElementById('tg-bot-modal-id');
  if (idEl) idEl.value = '';
  const nameEl = document.getElementById('tg-bot-modal-name');
  if (nameEl) nameEl.value = '';
  const tokenEl = document.getElementById('tg-bot-modal-token');
  if (tokenEl) tokenEl.value = '';

  const modal = document.getElementById('tg-bot-modal');
  if (modal) modal.style.display = 'flex';
}

function editTelegramBot(botId) {
  const bot = cachedTelegramBots.find((b) => b.id === botId);
  if (!bot) return;

  const title = document.getElementById('tg-bot-modal-title');
  if (title)
    title.innerHTML =
      '<i class="fas fa-edit"></i> ' +
      (window.t ? window.t('telegram.edit_bot_modal_title') : 'Edit Telegram Bot');

  const idEl = document.getElementById('tg-bot-modal-id');
  if (idEl) idEl.value = bot.id;
  const nameEl = document.getElementById('tg-bot-modal-name');
  if (nameEl) nameEl.value = bot.name || '';
  const tokenEl = document.getElementById('tg-bot-modal-token');
  if (tokenEl) tokenEl.value = bot.token || '';

  const modal = document.getElementById('tg-bot-modal');
  if (modal) modal.style.display = 'flex';
}

function closeTelegramBotModal() {
  const modal = document.getElementById('tg-bot-modal');
  if (modal) modal.style.display = 'none';
}

async function saveTelegramBotModal() {
  const id = document.getElementById('tg-bot-modal-id')?.value || '';
  const name = document.getElementById('tg-bot-modal-name')?.value || '';
  const token = document.getElementById('tg-bot-modal-token')?.value || '';

  if (!token.trim()) {
    showToast(t('telegram.bot_add_failed'), 'warning');
    return;
  }

  try {
    const res = await fetch('api/telegram/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id || undefined, name, token }),
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || t('telegram.bot_add_failed'), 'danger');
    } else {
      showToast(t('telegram.bot_added'), 'success');
      closeTelegramBotModal();
      loadTelegramBridgeData();
    }
  } catch (e) {
    showToast(t('telegram.bot_add_error', { error: e.message }), 'danger');
  }
}

async function deleteTelegramBot(botId) {
  const store = telegramStore || { bots: [], mappings: [] };
  const allBots = store.bots || [];
  const allMappings = store.mappings || [];
  const defaultBot = allBots[0];
  const isDefault = defaultBot && defaultBot.id === botId;

  // Count active mappings using this bot
  const boundMappings = allMappings.filter((m) => m.bot_id === botId || (!m.bot_id && isDefault));
  const count = boundMappings.length;
  const otherBots = allBots.filter((b) => b.id !== botId);

  let confirmMsg = t('telegram.delete_bot_confirm_msg');
  if (count > 0) {
    let choicesHtml;
    if (otherBots.length > 0) {
      const botOptionsHtml = otherBots
        .map(
          (b) =>
            `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name || b.username || b.id)}</option>`
        )
        .join('');

      choicesHtml = `
        <div style="margin-top: 12px; margin-bottom: 10px;">
          <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; font-weight: 500;">
            <input type="radio" name="del_bot_act" value="transfer" checked id="del_bot_act_transfer" style="margin-top: 3px;">
            <div>
              <span>${t('telegram.delete_bot_transfer_label')}</span>
              <select id="del_bot_target_bot" class="mod-input" style="margin-top: 6px; width: 100%;">
                ${botOptionsHtml}
              </select>
            </div>
          </label>
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--danger-color, #ef4444);">
            <input type="radio" name="del_bot_act" value="delete_all" id="del_bot_act_delete">
            <span>${t('telegram.delete_bot_delete_all_label', { count })}</span>
          </label>
        </div>
      `;
    } else {
      choicesHtml = `
        <div style="margin-top: 12px; margin-bottom: 12px; color: var(--danger-color, #ef4444); font-size: 0.9em;">
          <b>${t('telegram.delete_bot_no_other_bots_warn', { count })}</b>
        </div>
      `;
    }

    confirmMsg = `
      <div style="margin-bottom: 10px; color: var(--danger-color, #ef4444); font-weight: 600;">
        ⚠️ ${t('telegram.delete_bot_bridges_warning', { count })}
      </div>
      <p style="margin-bottom: 6px;">${t('telegram.delete_bot_choice_prompt')}</p>
      ${choicesHtml}
    `;
  }

  const confirmed = await showConfirm(
    t('telegram.delete_bot_confirm_title'),
    confirmMsg,
    t('common.delete'),
    t('common.cancel'),
    'danger'
  );
  if (!confirmed) return;

  let transferToBotId = '';
  if (count > 0 && otherBots.length > 0) {
    const transferRadio = document.getElementById('del_bot_act_transfer');
    if (transferRadio && transferRadio.checked) {
      const selectEl = document.getElementById('del_bot_target_bot');
      if (selectEl) {
        transferToBotId = selectEl.value;
      }
    }
  }

  try {
    const query = transferToBotId
      ? `?transfer_to_bot_id=${encodeURIComponent(transferToBotId)}`
      : '';
    await fetch(`api/telegram/bots/${botId}${query}`, { method: 'DELETE' });
    showToast(t('telegram.bot_deleted'), 'warning');
    loadTelegramBridgeData();
  } catch (e) {
    showToast(t('telegram.bot_delete_failed'), 'danger');
  }
}

async function toggleTelegramMapping(id) {
  await fetch(`api/telegram/mappings/${id}/toggle`, { method: 'POST' });
  showToast(t('telegram.mapping_added'), 'info');
  loadTelegramBridgeData();
}

async function deleteTelegramMapping(id) {
  const confirmed = await showConfirm(
    t('telegram.delete_mapping_confirm_title'),
    t('telegram.delete_mapping_confirm_msg'),
    t('common.delete'),
    t('common.cancel'),
    'danger'
  );
  if (!confirmed) return;
  await fetch(`api/telegram/mappings/${id}`, { method: 'DELETE' });
  showToast(t('telegram.mapping_deleted'), 'warning');
  loadTelegramBridgeData();
}

async function populateTelegramModalDropdowns(selectedBotId = '') {
  const botSelect = document.getElementById('tg-modal-bot-select');
  const waSelect = document.getElementById('tg-modal-wa-select');
  const tgSelect = document.getElementById('tg-modal-tg-select');
  const waJidInp = document.getElementById('tg-modal-wa-jid');
  const tgChatIdInp = document.getElementById('tg-modal-tg-chat-id');

  // Preserve existing selections before updating innerHTML
  const prevWaSelectVal = waSelect?.value || '';
  const prevWaJidVal = waJidInp?.value || '';
  const prevTgSelectVal = tgSelect?.value || '';
  const prevTgChatIdVal = tgChatIdInp?.value || '';

  // 0. Populate Bot Select
  if (botSelect) {
    let botOpts = '';
    if (cachedTelegramBots.length === 0) {
      botOpts = `<option value="">${window.t('telegram.no_bots_configured')}</option>`;
    } else {
      cachedTelegramBots.forEach((b) => {
        botOpts += `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name || '@' + b.username)} (@${escapeHtml(b.username)})</option>`;
      });
    }
    botSelect.innerHTML = botOpts;
    if (selectedBotId && Array.from(botSelect.options).some((o) => o.value === selectedBotId)) {
      botSelect.value = selectedBotId;
    }
  }

  const activeBotId = botSelect?.value || selectedBotId || '';

  // 1. Populate WhatsApp Chats Dropdown
  if (waSelect) {
    const selectPlaceholder =
      window.t('telegram.modal.select_wa_chat') ||
      window.t('telegram.select_wa_chat') ||
      'WhatsApp Chat / Gruppe auswählen';
    let waOpts = `<option value="">-- ${selectPlaceholder} --</option>`;
    try {
      const res = await fetch('api/chats?session_id=' + (window.currentSession || ''));
      if (res.ok) {
        const chats = await res.json();
        if (Array.isArray(chats)) {
          chats.forEach((c) => {
            const jid = c.jid || c.id;
            if (jid) {
              let name = c.name || c.formattedTitle || jid;
              if (name === '__ME_SELF_BOT__') {
                name = window.t('chats.me_self') || 'Me / Self (Bot Account)';
              } else if (typeof name === 'string' && name.startsWith('__GROUP_FALLBACK__:')) {
                name = `${window.t('common.group') || 'Group'} (${name.split(':')[1]})`;
              }
              const typeLabel = jid.endsWith('@g.us') ? 'Group' : 'Direct';
              waOpts += `<option value="${escapeHtml(jid)}">${escapeHtml(name)} (${typeLabel})</option>`;
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch WhatsApp chats for modal', e);
    }
    waOpts += '<option value="__custom__">✏️ Custom JID (Manual Entry)</option>';
    waSelect.innerHTML = waOpts;

    // Restore preserved WhatsApp selection
    const targetWaJid =
      prevWaSelectVal && prevWaSelectVal !== '__custom__' ? prevWaSelectVal : prevWaJidVal;
    if (targetWaJid && Array.from(waSelect.options).some((o) => o.value === targetWaJid)) {
      waSelect.value = targetWaJid;
      if (waJidInp) {
        waJidInp.style.display = 'none';
        waJidInp.value = targetWaJid;
      }
    } else if (prevWaSelectVal === '__custom__' || targetWaJid) {
      waSelect.value = '__custom__';
      if (waJidInp) {
        waJidInp.style.display = 'block';
        waJidInp.value = targetWaJid;
      }
    }
  }

  // 2. Populate Telegram Cached Chats Dropdown (filtered by activeBotId if set)
  if (tgSelect) {
    let tgOpts = `<option value="">-- ${window.t('telegram.select_tg_chat')} --</option>`;
    try {
      const url = activeBotId
        ? `api/telegram/chats?bot_id=${encodeURIComponent(activeBotId)}`
        : 'api/telegram/chats';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const tgChats = json.data || [];
        if (Array.isArray(tgChats)) {
          tgChats.forEach((tc) => {
            const title = tc.title || tc.username || tc.id;
            tgOpts += `<option value="${escapeHtml(tc.id)}">${escapeHtml(title)} (${tc.type || 'chat'})</option>`;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch Telegram chats for modal', e);
    }
    tgOpts += '<option value="__custom__">✏️ Custom Chat ID (Manual Entry)</option>';
    tgSelect.innerHTML = tgOpts;

    // Restore preserved Telegram selection
    const targetTgId = String(
      prevTgSelectVal && prevTgSelectVal !== '__custom__' ? prevTgSelectVal : prevTgChatIdVal
    );
    if (targetTgId && Array.from(tgSelect.options).some((o) => String(o.value) === targetTgId)) {
      tgSelect.value = targetTgId;
      if (tgChatIdInp) {
        tgChatIdInp.style.display = 'none';
        tgChatIdInp.value = targetTgId;
      }
    } else if (prevTgSelectVal === '__custom__' || targetTgId) {
      tgSelect.value = '__custom__';
      if (tgChatIdInp) {
        tgChatIdInp.style.display = 'block';
        tgChatIdInp.value = targetTgId;
      }
    }
  }
}

function onTgBotSelectChange(botId) {
  populateTelegramModalDropdowns(botId);
}

function onTgWaSelectChange(val) {
  const customInp = document.getElementById('tg-modal-wa-jid');
  if (!customInp) return;
  if (val === '__custom__') {
    customInp.style.display = 'block';
    customInp.value = '';
    customInp.focus();
  } else {
    customInp.style.display = 'none';
    customInp.value = val;
  }
}

function onTgTgSelectChange(val) {
  const customInp = document.getElementById('tg-modal-tg-chat-id');
  if (!customInp) return;
  if (val === '__custom__') {
    customInp.style.display = 'block';
    customInp.value = '';
    customInp.focus();
  } else {
    customInp.style.display = 'none';
    customInp.value = val;
  }
}

let tgMappingInitialState = null;

function getTgMappingCurrentState() {
  return {
    bot_id: document.getElementById('tg-modal-bot-select')?.value || '',
    mapping_name: document.getElementById('tg-modal-mapping-name')?.value || '',
    wa_select: document.getElementById('tg-modal-wa-select')?.value || '',
    wa_jid: document.getElementById('tg-modal-wa-jid')?.value || '',
    tg_select: document.getElementById('tg-modal-tg-select')?.value || '',
    tg_chat_id: document.getElementById('tg-modal-tg-chat-id')?.value || '',
    tg_thread_id: document.getElementById('tg-modal-tg-thread-id')?.value || '',
    sync_mode: document.getElementById('tg-modal-sync-mode')?.value || 'bidirectional',
    ignore_prefixes: document.getElementById('tg-modal-ignore-prefixes')?.value || '',
    inc_group: document.getElementById('tg-modal-inc-group')?.checked || false,
    inc_sender: document.getElementById('tg-modal-inc-sender')?.checked || false,
    sync_self: document.getElementById('tg-modal-sync-self')?.checked || false,
    convert_formatting: document.getElementById('tg-modal-convert-formatting')?.checked || false,
    anonymize_phone: document.getElementById('tg-modal-anonymize-phone')?.checked || false,
    sync_reactions: document.getElementById('tg-modal-sync-reactions')?.checked || false,
    direct_mirror: document.getElementById('tg-modal-direct-mirror')?.checked || false,
    sync_edits: document.getElementById('tg-modal-sync-edits')?.checked || false,
    sync_deletions: document.getElementById('tg-modal-sync-deletions')?.checked || false,
    poll_sync_mode: document.getElementById('tg-modal-poll-sync-mode')?.value || 'text_diagram',
    poll_diagram_text: document.getElementById('tg-modal-poll-diagram-text')?.checked || false,
    poll_update_msg: document.getElementById('tg-modal-poll-update-msg')?.checked || false,
    poll_delete_old: document.getElementById('tg-modal-poll-delete-old')?.checked || false,
    sync_system_events: document.getElementById('tg-modal-sync-system-events')?.checked || false,
    sync_pins: document.getElementById('tg-modal-sync-pins')?.checked || false,
  };
}

function hasTgMappingUnsavedChanges() {
  if (!tgMappingInitialState) return false;
  return JSON.stringify(tgMappingInitialState) !== JSON.stringify(getTgMappingCurrentState());
}

function openAddTelegramMappingModal() {
  const title = document.getElementById('tg-modal-title');
  if (title)
    title.innerHTML =
      '<i class="fas fa-link"></i> ' +
      (window.t ? window.t('telegram.add_mapping_modal_title') : 'Add Telegram Chat Mapping');
  const idEl = document.getElementById('tg-modal-id');
  if (idEl) idEl.value = '';

  const nameEl = document.getElementById('tg-modal-mapping-name');
  if (nameEl) nameEl.value = '';

  const threadEl = document.getElementById('tg-modal-tg-thread-id');
  if (threadEl) threadEl.value = '';

  const prefixesEl = document.getElementById('tg-modal-ignore-prefixes');
  if (prefixesEl) prefixesEl.value = '';

  const directMirrorEl = document.getElementById('tg-modal-direct-mirror');
  if (directMirrorEl) directMirrorEl.checked = false;
  const syncEditsEl = document.getElementById('tg-modal-sync-edits');
  if (syncEditsEl) syncEditsEl.checked = true;
  const syncDeletionsEl = document.getElementById('tg-modal-sync-deletions');
  if (syncDeletionsEl) syncDeletionsEl.checked = true;

  const pollModeEl = document.getElementById('tg-modal-poll-sync-mode');
  if (pollModeEl) pollModeEl.value = 'text_diagram';
  const pollDiagramEl = document.getElementById('tg-modal-poll-diagram-text');
  if (pollDiagramEl) pollDiagramEl.checked = true;
  const pollUpdateEl = document.getElementById('tg-modal-poll-update-msg');
  if (pollUpdateEl) pollUpdateEl.checked = true;
  const pollDeleteEl = document.getElementById('tg-modal-poll-delete-old');
  if (pollDeleteEl) pollDeleteEl.checked = true;

  const sysEvEl = document.getElementById('tg-modal-sync-system-events');
  if (sysEvEl) sysEvEl.checked = true;
  const pinsEl = document.getElementById('tg-modal-sync-pins');
  if (pinsEl) pinsEl.checked = true;

  const modal = document.getElementById('tg-mapping-modal');
  if (modal) modal.style.display = 'flex';
  populateTelegramModalDropdowns();
  setTimeout(() => {
    tgMappingInitialState = getTgMappingCurrentState();
  }, 100);
}

async function editTelegramMapping(id) {
  try {
    const res = await fetch('api/telegram/config');
    const json = await res.json();
    if (!json.success || !json.data) return;

    const mapping = (json.data.mappings || []).find((m) => m.id === id);
    if (!mapping) return;

    const title = document.getElementById('tg-modal-title');
    if (title)
      title.innerHTML =
        '<i class="fas fa-edit"></i> ' +
        (window.t ? window.t('telegram.edit_mapping_modal_title') : 'Edit Telegram Chat Mapping');

    const idEl = document.getElementById('tg-modal-id');
    if (idEl) idEl.value = mapping.id;

    const nameEl = document.getElementById('tg-modal-mapping-name');
    if (nameEl) nameEl.value = mapping.name || '';

    const waJidEl = document.getElementById('tg-modal-wa-jid');
    if (waJidEl) waJidEl.value = mapping.wa_jid || '';

    const tgChatIdEl = document.getElementById('tg-modal-tg-chat-id');
    if (tgChatIdEl) tgChatIdEl.value = mapping.tg_chat_id || '';

    const threadEl = document.getElementById('tg-modal-tg-thread-id');
    if (threadEl) threadEl.value = mapping.tg_thread_id || '';

    const syncModeEl = document.getElementById('tg-modal-sync-mode');
    if (syncModeEl) syncModeEl.value = mapping.sync_mode || 'bidirectional';

    const prefixesEl = document.getElementById('tg-modal-ignore-prefixes');
    if (prefixesEl) prefixesEl.value = mapping.ignore_command_prefixes || '';

    const incGroupEl = document.getElementById('tg-modal-inc-group');
    if (incGroupEl) incGroupEl.checked = Boolean(mapping.include_group_name);

    const incSenderEl = document.getElementById('tg-modal-inc-sender');
    if (incSenderEl) incSenderEl.checked = mapping.include_sender_name !== false;

    const syncSelfEl = document.getElementById('tg-modal-sync-self');
    if (syncSelfEl) syncSelfEl.checked = Boolean(mapping.sync_self_messages);

    const convertFormatEl = document.getElementById('tg-modal-convert-formatting');
    if (convertFormatEl) convertFormatEl.checked = mapping.convert_formatting !== false;

    const anonymizePhoneEl = document.getElementById('tg-modal-anonymize-phone');
    if (anonymizePhoneEl) anonymizePhoneEl.checked = Boolean(mapping.anonymize_phone_numbers);

    const syncReactionsEl = document.getElementById('tg-modal-sync-reactions');
    if (syncReactionsEl) syncReactionsEl.checked = mapping.sync_reactions !== false;

    const directMirrorEl = document.getElementById('tg-modal-direct-mirror');
    if (directMirrorEl) directMirrorEl.checked = Boolean(mapping.is_direct_chat_mirror);

    const syncEditsEl = document.getElementById('tg-modal-sync-edits');
    if (syncEditsEl) syncEditsEl.checked = mapping.sync_edits !== false;

    const syncDeletionsEl = document.getElementById('tg-modal-sync-deletions');
    if (syncDeletionsEl) syncDeletionsEl.checked = mapping.sync_deletions !== false;

    const pollModeEl = document.getElementById('tg-modal-poll-sync-mode');
    if (pollModeEl) pollModeEl.value = mapping.poll_sync_mode || 'text_diagram';

    const pollDiagramEl = document.getElementById('tg-modal-poll-diagram-text');
    if (pollDiagramEl) pollDiagramEl.checked = mapping.poll_send_text_diagram !== false;

    const pollUpdateEl = document.getElementById('tg-modal-poll-update-msg');
    if (pollUpdateEl) pollUpdateEl.checked = mapping.poll_send_update_message !== false;

    const pollDeleteEl = document.getElementById('tg-modal-poll-delete-old');
    if (pollDeleteEl) pollDeleteEl.checked = mapping.poll_delete_old_message !== false;

    const sysEvEl = document.getElementById('tg-modal-sync-system-events');
    if (sysEvEl) sysEvEl.checked = mapping.sync_system_events !== false;

    const pinsEl = document.getElementById('tg-modal-sync-pins');
    if (pinsEl) pinsEl.checked = mapping.sync_pins !== false;

    const modal = document.getElementById('tg-mapping-modal');
    if (modal) modal.style.display = 'flex';

    await populateTelegramModalDropdowns(mapping.bot_id);

    const waSelect = document.getElementById('tg-modal-wa-select');
    if (waSelect) {
      if (Array.from(waSelect.options).some((o) => o.value === mapping.wa_jid)) {
        waSelect.value = mapping.wa_jid;
        onTgWaSelectChange(mapping.wa_jid);
      } else {
        waSelect.value = '__custom__';
        onTgWaSelectChange('__custom__');
        if (waJidEl) waJidEl.value = mapping.wa_jid;
      }
    }

    const tgSelect = document.getElementById('tg-modal-tg-select');
    if (tgSelect) {
      if (Array.from(tgSelect.options).some((o) => o.value === mapping.tg_chat_id)) {
        tgSelect.value = mapping.tg_chat_id;
        onTgTgSelectChange(mapping.tg_chat_id);
      } else {
        tgSelect.value = '__custom__';
        onTgTgSelectChange('__custom__');
        if (tgChatIdEl) tgChatIdEl.value = mapping.tg_chat_id;
      }
    }

    tgMappingInitialState = getTgMappingCurrentState();
  } catch (e) {
    showToast(t('telegram.mapping_add_error', { error: e.message }), 'danger');
  }
}

async function closeTelegramMappingModal(force = false) {
  if (!force && hasTgMappingUnsavedChanges()) {
    const confirmClose = await showConfirm(
      t('telegram.unsaved_changes_title'),
      t('telegram.unsaved_changes_msg'),
      t('common.delete'),
      t('common.cancel'),
      'danger'
    );
    if (!confirmClose) {
      return;
    }
  }
  const modal = document.getElementById('tg-mapping-modal');
  if (modal) modal.style.display = 'none';
  tgMappingInitialState = null;
}

async function saveTelegramMappingModal() {
  const id = document.getElementById('tg-modal-id')?.value || '';
  const bot_id = document.getElementById('tg-modal-bot-select')?.value || '';
  const mapping_name = document.getElementById('tg-modal-mapping-name')?.value || '';

  const waSelect = document.getElementById('tg-modal-wa-select');
  let wa_jid = waSelect?.value || '';
  let wa_name = '';
  if (waSelect && waSelect.selectedIndex >= 0 && wa_jid !== '__custom__') {
    const optText = waSelect.options[waSelect.selectedIndex].text;
    wa_name = optText.replace(/\s*\((Group|Direct)\)$/, '').trim();
  }
  if (wa_jid === '__custom__' || !wa_jid) {
    wa_jid = document.getElementById('tg-modal-wa-jid')?.value || '';
  }

  const tgSelect = document.getElementById('tg-modal-tg-select');
  let tg_chat_id = tgSelect?.value || '';
  let tg_chat_title = '';
  if (tgSelect && tgSelect.selectedIndex >= 0 && tg_chat_id !== '__custom__') {
    const optText = tgSelect.options[tgSelect.selectedIndex].text;
    tg_chat_title = optText.replace(/\s*\([^)]+\)$/, '').trim();
  }
  if (tg_chat_id === '__custom__' || !tg_chat_id) {
    tg_chat_id = document.getElementById('tg-modal-tg-chat-id')?.value || '';
  }

  const tg_thread_id = document.getElementById('tg-modal-tg-thread-id')?.value || '';
  const sync_mode = document.getElementById('tg-modal-sync-mode')?.value || 'bidirectional';
  const ignore_command_prefixes = document.getElementById('tg-modal-ignore-prefixes')?.value || '';

  const include_group_name = document.getElementById('tg-modal-inc-group')?.checked || false;
  const include_sender_name = document.getElementById('tg-modal-inc-sender')?.checked || false;
  const sync_self_messages = document.getElementById('tg-modal-sync-self')?.checked || false;
  const convert_formatting =
    document.getElementById('tg-modal-convert-formatting')?.checked || false;
  const anonymize_phone_numbers =
    document.getElementById('tg-modal-anonymize-phone')?.checked || false;
  const sync_reactions = document.getElementById('tg-modal-sync-reactions')?.checked || false;
  const is_direct_chat_mirror = document.getElementById('tg-modal-direct-mirror')?.checked || false;
  const sync_edits = document.getElementById('tg-modal-sync-edits')?.checked || false;
  const sync_deletions = document.getElementById('tg-modal-sync-deletions')?.checked || false;
  const poll_sync_mode =
    document.getElementById('tg-modal-poll-sync-mode')?.value || 'text_diagram';
  const poll_send_text_diagram =
    document.getElementById('tg-modal-poll-diagram-text')?.checked || false;
  const poll_send_update_message =
    document.getElementById('tg-modal-poll-update-msg')?.checked || false;
  const poll_delete_old_message =
    document.getElementById('tg-modal-poll-delete-old')?.checked || false;
  const sync_system_events =
    document.getElementById('tg-modal-sync-system-events')?.checked || false;
  const sync_pins = document.getElementById('tg-modal-sync-pins')?.checked || false;

  if (!wa_jid || !tg_chat_id) {
    showToast(t('telegram.mapping_add_failed'), 'warning');
    return;
  }

  try {
    const res = await fetch('api/telegram/mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: id || undefined,
        bot_id,
        mapping_name,
        wa_jid,
        wa_name: wa_name || undefined,
        tg_chat_id,
        tg_chat_title: tg_chat_title || undefined,
        tg_thread_id,
        sync_mode,
        ignore_command_prefixes,
        include_group_name,
        include_sender_name,
        sync_self_messages,
        convert_formatting,
        anonymize_phone_numbers,
        sync_reactions,
        is_direct_chat_mirror,
        sync_edits,
        sync_deletions,
        poll_sync_mode,
        poll_send_text_diagram,
        poll_send_update_message,
        poll_delete_old_message,
        sync_system_events,
        sync_pins,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || t('telegram.mapping_add_failed'), 'danger');
    } else {
      showToast(t('telegram.mapping_added'), 'success');
      closeTelegramMappingModal(true);
      loadTelegramBridgeData();
    }
  } catch (e) {
    showToast(t('telegram.mapping_add_error', { error: e.message }), 'danger');
  }
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
window.openAddTelegramBotModal = openAddTelegramBotModal;
window.editTelegramBot = editTelegramBot;
window.closeTelegramBotModal = closeTelegramBotModal;
window.saveTelegramBotModal = saveTelegramBotModal;
window.deleteTelegramBot = deleteTelegramBot;
window.toggleTelegramMapping = toggleTelegramMapping;
window.deleteTelegramMapping = deleteTelegramMapping;
window.openAddTelegramMappingModal = openAddTelegramMappingModal;
window.editTelegramMapping = editTelegramMapping;
window.closeTelegramMappingModal = closeTelegramMappingModal;
window.saveTelegramMappingModal = saveTelegramMappingModal;
window.onTgBotSelectChange = onTgBotSelectChange;
window.onTgWaSelectChange = onTgWaSelectChange;
window.onTgTgSelectChange = onTgTgSelectChange;

function onTgDirectMirrorToggle(checked) {
  if (checked) {
    const syncSelf = document.getElementById('tg-modal-sync-self');
    const incGroup = document.getElementById('tg-modal-inc-group');
    const incSender = document.getElementById('tg-modal-inc-sender');
    if (syncSelf) syncSelf.checked = true;
    if (incGroup) incGroup.checked = false;
    if (incSender) incSender.checked = false;
  }
}
window.onTgDirectMirrorToggle = onTgDirectMirrorToggle;

function populateTelegramTestMappingDropdown(mappings = []) {
  const select = document.getElementById('tg-test-mapping-select');
  if (!select) return;
  if (mappings.length === 0) {
    select.innerHTML = `<option value="">${window.t('telegram.no_mappings_configured')}</option>`;
    return;
  }
  select.innerHTML = mappings
    .map(
      (m) =>
        `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name || 'Chat Bridge')} (WA: ${escapeHtml(m.wa_jid)} ↔ TG: ${escapeHtml(m.tg_chat_id)})</option>`
    )
    .join('');
}
window.populateTelegramTestMappingDropdown = populateTelegramTestMappingDropdown;

function selectAllTgSubtests(select) {
  const checkboxes = document.querySelectorAll('.tg-subtest-cb');
  checkboxes.forEach((cb) => {
    cb.checked = Boolean(select);
  });
}
window.selectAllTgSubtests = selectAllTgSubtests;

let tgTestPollInterval = null;

async function runTelegramBridgeTest() {
  const mappingSelect = document.getElementById('tg-test-mapping-select');
  const directionSelect = document.getElementById('tg-test-direction-select');
  const runBtn = document.getElementById('tg-run-test-btn');
  const panel = document.getElementById('tg-test-results-panel');
  const statusBadge = document.getElementById('tg-test-status-badge');
  const progressText = document.getElementById('tg-test-progress-text');
  const runIdEl = document.getElementById('tg-test-run-id');
  const logOutput = document.getElementById('tg-test-log-output');

  const mapping_id = mappingSelect?.value;
  const direction = directionSelect?.value || 'wa_to_tg';

  const selected_subtests = Array.from(document.querySelectorAll('.tg-subtest-cb:checked')).map(
    (cb) => cb.value
  );

  if (!mapping_id) {
    showToast(t('telegram.test_mapping'), 'warning');
    return;
  }

  if (selected_subtests.length === 0) {
    showToast(t('telegram.test_subtests'), 'warning');
    return;
  }

  // Pre-flight: check WhatsApp connection status before launching
  if (typeof isConnected !== 'undefined' && !isConnected) {
    showToast(t('chats.not_connected'), 'danger');
    return;
  }

  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> ' +
      (window.t ? window.t('telegram.testing_button') : 'Testing...');
  }

  if (panel) panel.style.display = 'block';
  if (typeof toggleTgTestSuiteUI === 'function') toggleTgTestSuiteUI(true);
  if (statusBadge) {
    statusBadge.style.background = '#0088cc';
    statusBadge.textContent = window.t ? window.t('telegram.status_running') : 'RUNNING';
  }
  if (progressText) {
    const label = window.t('telegram.test_progress_label') || 'Progress';
    progressText.textContent = `${label}: 0 / ${selected_subtests.length} steps`;
  }
  if (runIdEl)
    runIdEl.textContent = window.t
      ? window.t('telegram.run_id_initializing')
      : 'Run ID: Initializing...';
  if (logOutput)
    logOutput.textContent = window.t
      ? window.t('telegram.starting_test_log')
      : 'Starting integration test...\n';

  try {
    const res = await fetch('api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mapping_id,
        direction,
        selected_subtests,
        session_id: currentSession,
      }),
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.error || t('telegram.mapping_add_failed'), 'danger');
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.innerHTML =
          '<i class="fas fa-play"></i> ' +
          (window.t ? window.t('telegram.run_test') : 'Run Integration Test');
      }
      if (statusBadge) {
        statusBadge.style.background = '#dc3545';
        statusBadge.textContent = window.t ? window.t('telegram.status_failed') : 'FAILED';
      }
      if (logOutput) logOutput.textContent += `\nError: ${data.error || 'Failed to start test'}`;
      return;
    }

    const runId = data.runId;
    if (runIdEl) runIdEl.textContent = `Run ID: ${runId}`;

    if (tgTestPollInterval) clearInterval(tgTestPollInterval);

    tgTestPollInterval = setInterval(() => {
      pollTelegramTestResults(runId);
    }, 1000);

    pollTelegramTestResults(runId);
  } catch (err) {
    showToast(t('telegram.mapping_add_error', { error: err.message }), 'danger');
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerHTML = '<i class="fas fa-play"></i> Run Integration Test';
    }
  }
}
window.runTelegramBridgeTest = runTelegramBridgeTest;

async function pollTelegramTestResults(runId) {
  try {
    const res = await fetch(`api/telegram/test/results/${runId}`);
    if (!res.ok) return;

    const json = await res.json();
    if (!json.success || !json.data) return;

    const testRun = json.data;
    const statusBadge = document.getElementById('tg-test-status-badge');
    const progressText = document.getElementById('tg-test-progress-text');
    const logOutput = document.getElementById('tg-test-log-output');
    const runBtn = document.getElementById('tg-run-test-btn');

    if (progressText) {
      const label = window.t('telegram.test_progress_label') || 'Progress';
      progressText.textContent = `${label}: ${testRun.passedSteps} / ${testRun.totalSteps} steps`;
    }

    if (logOutput && Array.isArray(testRun.logs)) {
      const isAtBottom =
        logOutput.scrollHeight - logOutput.scrollTop <= logOutput.clientHeight + 60;
      const formattedLogs = testRun.logs
        .map((l) => {
          const time = l.time ? new Date(l.time).toLocaleTimeString() : '';
          const prefix =
            l.level === 'error'
              ? '❌'
              : l.level === 'success'
                ? '✅'
                : l.level === 'warn'
                  ? '⚠️'
                  : 'ℹ️';
          return `[${time}] ${prefix} [${l.step}] ${l.msg}`;
        })
        .join('\n');
      logOutput.textContent = formattedLogs;
      if (isAtBottom) {
        logOutput.scrollTop = logOutput.scrollHeight;
      }
    }

    if (testRun.status !== 'running') {
      if (tgTestPollInterval) {
        clearInterval(tgTestPollInterval);
        tgTestPollInterval = null;
      }
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fas fa-play"></i> Run Integration Test';
      }
      if (statusBadge) {
        if (testRun.status === 'passed') {
          statusBadge.style.background = '#28a745';
          statusBadge.textContent = 'PASSED ✅';
          showToast(t('telegram.test_ready'), 'success');
        } else {
          statusBadge.style.background = '#dc3545';
          statusBadge.textContent = 'FAILED ❌';
          showToast(t('telegram.test_ready'), 'warning');
        }
      }
    }
  } catch (err) {
    console.error('Error polling Telegram test results', err);
  }
}

function copyTgTestLogs() {
  const logOutput = document.getElementById('tg-test-log-output');
  if (!logOutput || !logOutput.textContent) {
    showToast(t('telegram.test_log'), 'warning');
    return;
  }
  const text = logOutput.textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast(t('telegram.copy_log'), 'success'))
      .catch(() => fallbackCopyTextToClipboard(text));
  } else {
    fallbackCopyTextToClipboard(text);
  }
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showToast(t('telegram.copy_log'), 'success');
    } else {
      showToast(t('telegram.mapping_delete_failed'), 'danger');
    }
  } catch (err) {
    showToast(t('telegram.mapping_delete_error', { error: err.message }), 'danger');
  }
  document.body.removeChild(textArea);
}

function toggleTgTestSuiteUI(forceState) {
  const body = document.getElementById('tg-test-suite-body');
  const chevron = document.getElementById('tg-test-suite-chevron');
  if (!body) return;
  const isExpanded = forceState !== undefined ? forceState : body.style.display !== 'none';
  const nextState = forceState !== undefined ? forceState : !isExpanded;

  body.style.display = nextState ? 'block' : 'none';
  if (chevron) {
    chevron.style.transform = nextState ? 'rotate(180deg)' : 'rotate(0deg)';
  }
}

window.runTelegramBridgeTest = runTelegramBridgeTest;
window.selectAllTgSubtests = selectAllTgSubtests;
window.copyTgTestLogs = copyTgTestLogs;
window.pollTelegramTestResults = pollTelegramTestResults;
window.toggleTgTestSuiteUI = toggleTgTestSuiteUI;

// Global Window Exports
window.isNewerVersion = isNewerVersion;
window.loadLogs = loadLogs;
window.saveGlobalRulesInline = saveGlobalRulesInline;
window.removeBlacklistWord = removeBlacklistWord;
window.removeFilterRule = removeFilterRule;
window.addFedBlacklistWord = addFedBlacklistWord;
window.removeFedBlacklistWord = removeFedBlacklistWord;
window.updateDashboard = updateDashboard;
window.downloadDebugInfo = downloadDebugInfo;
window.restartSession = restartSession;
window.logoutSession = logoutSession;
window.purgeSessions = purgeSessions;
window.clearLogs = clearLogs;
window.switchSession = switchSession;
window.openUpdateModal = openUpdateModal;
window.closeUpdateModal = closeUpdateModal;
window.openDependencyModal = openDependencyModal;
window.closeDependencyModal = closeDependencyModal;
window.loadModerationConfig = loadModerationConfig;
window.toggleGlobalModeration = toggleGlobalModeration;
window.updateModerationDisabledState = updateModerationDisabledState;
window.selectModerationGroup = selectModerationGroup;
window.toggleGroupModeration = toggleGroupModeration;
window.switchModSubTab = switchModSubTab;
window.saveGroupRules = saveGroupRules;
window.saveGroupGreetings = saveGroupGreetings;
window.loadCaptchaUsers = loadCaptchaUsers;
window.toggleUserCaptchaVerification = toggleUserCaptchaVerification;
window.saveGroupWarnings = saveGroupWarnings;
window.saveGroupLocks = saveGroupLocks;
window.addBlacklistWord = addBlacklistWord;
window.saveGroupBlacklist = saveGroupBlacklist;
window.addFilterRule = addFilterRule;
window.saveGroupFilters = saveGroupFilters;
window.saveGroupAntispam = saveGroupAntispam;
window.saveGroupFederation = saveGroupFederation;
window.saveGroupAiConfig = saveGroupAiConfig;
window.saveGroupCommands = saveGroupCommands;
window.openGlobalRulesModal = openGlobalRulesModal;
window.closeGlobalRulesModal = closeGlobalRulesModal;
window.saveGlobalRulesFromModal = saveGlobalRulesFromModal;
window.exportGroupModerationConfig = exportGroupModerationConfig;
window.importGroupModerationConfig = importGroupModerationConfig;
window.clearUserWarnInUi = clearUserWarnInUi;
window.updateFedBlacklistTagsInUi = updateFedBlacklistTagsInUi;
window.openCreateFederationModal = openCreateFederationModal;
window.closeCreateFederationModal = closeCreateFederationModal;
window.saveNewCustomFederation = saveNewCustomFederation;
window.exportFederationConfig = exportFederationConfig;
window.openImportFederationModal = openImportFederationModal;
window.closeImportFederationModal = closeImportFederationModal;
window.submitImportFederation = submitImportFederation;
window.addCustomCommandRule = addCustomCommandRule;
window.removeCustomCommandRule = removeCustomCommandRule;
window.toggleAllDefaultCommands = toggleAllDefaultCommands;
window.onCustomCmdTypeChange = onCustomCmdTypeChange;
window.unsavedModalCancel = unsavedModalCancel;
window.unsavedModalDiscard = unsavedModalDiscard;
window.unsavedModalSaveAndSwitch = unsavedModalSaveAndSwitch;
window.markClean = markClean;
window.markDirty = markDirty;
window.unbanUserInUi = unbanUserInUi;
window.clearKickLogInUi = clearKickLogInUi;
window.unmuteUserInUi = unmuteUserInUi;
window.generateGroupTestCommandsModal = generateGroupTestCommandsModal;
window.closeTestCommandsModal = closeTestCommandsModal;
window.updateTestCommandsPrefill = updateTestCommandsPrefill;
window.copyAllFromBlock = copyAllFromBlock;
window.sendTestSuiteToGroup = sendTestSuiteToGroup;
window.toggleAutoTestModeUI = toggleAutoTestModeUI;
window.runAutonomousModerationTest = runAutonomousModerationTest;
window.selectAllModSubtests = selectAllModSubtests;
window.clearAutoTestLogs = clearAutoTestLogs;
window.refreshModerationDiagnostics = refreshModerationDiagnostics;
window.renderModerationDiagnostics = renderModerationDiagnostics;
window.saveTelegramCatchupConfig = saveTelegramCatchupConfig;
