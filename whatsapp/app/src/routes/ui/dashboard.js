// Dashboard Overview & Status Polling

function isNewerVersion(curr, latest) {
  if (!curr || !latest) return false;
  const cleanC = curr.replace(/^v/, '').trim();
  const cleanL = latest.replace(/^v/, '').trim();
  if (
    !cleanL ||
    cleanC === cleanL ||
    cleanC === 'Unknown' ||
    cleanC.includes('dev') ||
    cleanC.includes('edge')
  ) {
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
        badge.textContent = 'Connection Error ⚠️';
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
          badge.textContent = 'Access Blocked (403) ⛔';
        } else {
          badge.textContent = 'API Error (' + response.status + ') ⚠️';
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
      footerSessionStatus.textContent = data.isConnected ? 'Connected' : 'Disconnected';

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
      hostUriLabel.textContent = data.isStandalone ? 'Gateway Host / Domain URI' : 'Addon Host URI';
    }
    const setupCardTitle = document.getElementById('setup-card-title');
    if (setupCardTitle) {
      setupCardTitle.innerHTML = data.isStandalone
        ? '<i class="fas fa-network-wired"></i> Connection Setup'
        : '<i class="fas fa-home"></i> Home Assistant Setup';
    }
    if (data.isStandalone) {
      document.title = 'WhatsApp Gateway';
      const subtitle = document.getElementById('logo-subtitle');
      if (subtitle) subtitle.textContent = 'Standalone';
      const haRepoLink = document.getElementById('ha-repo-link');
      if (haRepoLink) {
        const span = haRepoLink.querySelector('span');
        if (span) span.textContent = 'Project Repository';
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
        ? 'Connected \u2705'
        : data.currentQR
          ? 'Scan QR Code \uD83D\uDCF1'
          : data.isConnecting
            ? 'Connecting... \u23F3'
            : data.disconnectReason === 'logged_out'
              ? 'Logged Out \uD83D\uDEAB'
              : 'Disconnected \u274C';
    }
    const discReason = document.getElementById('disconnect-reason');
    if (discReason) {
      discReason.textContent = data.currentQR
        ? ''
        : data.disconnectReason
          ? 'Reason: ' + data.disconnectReason
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
      whStatus.textContent = data.webhookEnabled ? 'Enabled ✅' : 'Disabled ❌';
      whStatus.style.color = data.webhookEnabled ? 'var(--primary)' : 'var(--danger)';
    }
    setElText('webhook-url', data.webhookUrl || 'Not Configured');

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
                '<span class="history-target">To: ' +
                esc(m.target) +
                '</span>' +
                '<div class="history-msg">' +
                esc(m.message) +
                '</div>' +
                '</div>'
            )
            .join('')
        : '<div class="empty-state">No messages sent recently</div>'
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
                '<span class="history-sender">From: ' +
                esc(m.sender) +
                '</span>' +
                '<div class="history-msg">' +
                esc(m.message) +
                '</div>' +
                '</div>'
            )
            .join('')
        : '<div class="empty-state">No messages received recently</div>'
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
                '<span class="history-target">Target: ' +
                esc(m.target) +
                '</span>' +
                '<div class="history-msg">' +
                esc(m.message) +
                '</div>' +
                '<div class="history-reason">Error: ' +
                esc(m.reason) +
                '</div>' +
                '</div>'
            )
            .join('')
        : '<div class="empty-state">No failures recorded</div>'
    );
  } catch (e) {
    console.error('❌ updateDashboard error:', e);
    const badge = document.getElementById('status-badge');
    if (badge) {
      badge.className = 'status-badge disconnected';
      badge.textContent = 'UI Render Error ⚠️';
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
        : '<div class="log-entry">No logs yet</div>';
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
    showToast('Debug info downloaded successfully', 'success');
  } catch (e) {
    showToast('Failed to download debug bundle', 'danger');
  }
}

async function restartSession() {
  const ok = await showConfirm(
    'Restart WhatsApp Daemon?',
    'Are you sure you want to trigger a soft restart on this session daemon?'
  );
  if (!ok) return;

  showToast('Restarting session...', 'warning');
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
      showToast('Restart command acknowledged', 'success');
      setTimeout(updateDashboard, 1500);
    }
  } catch (e) {
    showToast('Restart request failed', 'danger');
  }
}

async function logoutSession() {
  const ok = await showConfirm(
    'WARNING: Hard Reset Session?',
    'This will logout WhatsApp from your mobile client and delete all credentials. You will need to scan the QR code to pair again.'
  );
  if (!ok) return;

  showToast('Deleting credentials...', 'warning');
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
      showToast('Session logged out and reset completed', 'success');
      updateDashboard();
    }
  } catch (e) {
    showToast('Reset request failed', 'danger');
  }
}

async function purgeSessions() {
  const ok = await showConfirm(
    'Clean Disconnected Sessions?',
    'This will delete all inactive or stale session directories and free up resources.'
  );
  if (!ok) return;

  showToast('Purging disconnected sessions...', 'info');
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
      showToast(`Purged ${resData.purgedCount || 0} disconnected session(s)`, 'success');
      updateDashboard();
    } else {
      showToast('Purge request failed', 'danger');
    }
  } catch (e) {
    showToast('Purge request failed: ' + e.message, 'danger');
  }
}

async function clearLogs() {
  const ok = await showConfirm('Clear Connection Logs?', 'Do you want to purge connection logs?');
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
      showToast('Logs database cleared', 'success');
      updateDashboard();
    }
  } catch (e) {
    showToast('Failed to clear logs', 'danger');
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

  if (title) title.textContent = isNewer ? `${compName} Update Available` : `${compName} Info`;
  if (currVer) currVer.textContent = currentVersion;
  if (newVer) newVer.textContent = latestVersion || 'Up to date';

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
      actionBtn.innerHTML = '<i class="fas fa-download"></i> Update Now';
      actionBtn.style.display = 'inline-flex';
    } else {
      actionBtn.href = repoUrl;
      actionBtn.innerHTML = '<i class="fab fa-github"></i> View Repository';
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
      role: 'WhatsApp Web Protocol Engine',
    },
    'Node.js': {
      repo: 'https://github.com/nodejs/node',
      releases: 'https://github.com/nodejs/node/releases',
      version: data.nodeVersion || 'N/A',
      role: 'JavaScript Runtime Environment',
    },
    Express: {
      repo: 'https://github.com/expressjs/express',
      releases: 'https://github.com/expressjs/express/releases',
      version: data.expressVersion || 'N/A',
      role: 'REST API & Web UI Framework',
    },
    'Alpine Linux': {
      repo: 'https://alpinelinux.org',
      releases: 'https://alpinelinux.org/releases/',
      version: data.alpineVersion || 'N/A',
      role: 'Base Docker Operating System',
    },
  };

  const info = depInfo[depName] || {
    repo: 'https://github.com',
    releases: 'https://github.com',
    version: 'N/A',
    role: 'Core Gateway Component',
  };

  const hasAddonUpdate =
    typeof window.isNewerVersion === 'function'
      ? window.isNewerVersion(data.addonVersion, data.latestAddonVersion)
      : false;

  if (title) title.textContent = `${depName} Dependency Info`;
  if (currVer) currVer.textContent = info.version;
  if (roleDesc) roleDesc.textContent = info.role;

  if (addonStatus) {
    addonStatus.textContent = hasAddonUpdate
      ? `Update Available (${data.latestAddonVersion})`
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
      rationaleTitle.textContent = 'Addon Update Pending';
      rationaleDesc.textContent = `A newer Addon release (${data.latestAddonVersion}) is ready! Updating your Addon will automatically upgrade ${depName}.`;
    } else {
      rationaleBox.className = 'update-rationale-box warning';
      rationaleIcon.className = 'fas fa-info-circle rationale-icon';
      rationaleIcon.style.color = 'var(--warning)';
      rationaleTitle.textContent = 'Bundled Dependency Management';
      rationaleDesc.textContent = `${depName} is bundled inside the WhatsApp Addon container and is updated with each Addon release.`;
    }
  }

  if (repoBtn) repoBtn.href = info.repo;
  if (releasesBtn) releasesBtn.href = info.releases;

  if (actionBtn) {
    if (hasAddonUpdate) {
      actionBtn.className = 'btn btn-primary btn-sm';
      actionBtn.innerHTML = '<i class="fas fa-download"></i> Update Addon Now';
      actionBtn.href = data.isStandalone
        ? data.addonReleaseUrl || 'https://github.com/FaserF/hassio-addons/releases'
        : 'https://my.home-assistant.io/redirect/supervisor_addon/?addon=whatsapp';
      actionBtn.target = '_blank';
    } else {
      actionBtn.className = 'btn btn-secondary btn-sm';
      actionBtn.innerHTML = '<i class="fab fa-github"></i> Report Vulnerability / Issue';
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

async function loadModerationConfig() {
  try {
    const [modRes, chatsRes] = await Promise.all([
      fetch(basePath + 'api/moderation/config'),
      fetch(basePath + 'api/chats?session_id=' + currentSession),
    ]);

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
      let opts = '<option value="">Select a group...</option>';
      groups.forEach((g) => {
        opts += `<option value="${g.id}"${g.id === preserved ? ' selected' : ''}>${g.name}</option>`;
      });
      select.innerHTML = opts;
      if (preserved && groupMap.has(preserved)) {
        select.value = preserved;
      }
      selectModerationGroup(select.value);
    }
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
      showToast('Global default rules saved successfully! 🌐', 'success');
      loadModerationConfig();
    }
  } catch (e) {
    showToast('Failed to save global rules', 'danger');
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
      showToast('Global rules saved successfully! 🌐', 'success');
      closeGlobalRulesModal();
      loadModerationConfig();
    }
  } catch (e) {
    showToast('Failed to save global rules', 'danger');
  }
}

async function toggleGlobalModeration(enabled) {
  try {
    const res = await fetch(basePath + 'api/moderation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_enabled: enabled }),
    });
    if (res.ok) {
      showToast(enabled ? 'Global Moderation Enabled 🛡️' : 'Global Moderation Disabled', 'info');
      loadModerationConfig();
    }
  } catch (e) {
    showToast('Failed to toggle global moderation', 'danger');
  }
}

function selectModerationGroup(groupId) {
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

  if (!modStoreCache) return;
  const config = modStoreCache.groups?.[groupId] || {};

  const titleEl = document.getElementById('mod-active-group-title');
  if (titleEl) {
    const groupSelect = document.getElementById('mod-group-select');
    const selectedOpt = groupSelect ? groupSelect.options[groupSelect.selectedIndex] : null;
    const name = selectedOpt ? selectedOpt.text : groupId;
    titleEl.innerHTML = `<i class="fas fa-users-cog"></i> ${name}`;
  }

  const toggle = document.getElementById('mod-group-toggle');
  if (toggle) toggle.checked = Boolean(config.enabled);

  // Rules
  const rulesText = document.getElementById('mod-rules-text');
  if (rulesText) rulesText.value = config.rules?.text || '';
  const rulesShow = document.getElementById('mod-rules-show-on-join');
  if (rulesShow) rulesShow.checked = Boolean(config.rules?.show_on_join);

  // Greetings
  const welcE = document.getElementById('mod-welcome-enabled');
  if (welcE) welcE.checked = Boolean(config.greetings?.welcome_enabled);
  const welcM = document.getElementById('mod-welcome-msg');
  if (welcM) welcM.value = config.greetings?.welcome_message || '';
  const goodE = document.getElementById('mod-goodbye-enabled');
  if (goodE) goodE.checked = Boolean(config.greetings?.goodbye_enabled);
  const goodM =
    document.getElementById('mod-goodbye-msg') || document.getElementById('mod-goodbye-message');
  if (goodM)
    goodM.value = config.greetings?.goodbye_message || config.greetings?.goodbye_text || '';

  // Captcha
  const capE = document.getElementById('mod-captcha-enabled');
  if (capE) capE.checked = Boolean(config.greetings?.captcha_enabled);
  const capMode = document.getElementById('mod-captcha-mode');
  if (capMode) capMode.value = config.greetings?.captcha_mode || 'button';
  const capTime = document.getElementById('mod-captcha-timeout');
  if (capTime) capTime.value = config.greetings?.captcha_timeout_seconds || 120;

  // Warnings
  const maxW = document.getElementById('mod-max-warns');
  if (maxW) maxW.value = config.warnings?.max_warnings || 3;
  const wAct = document.getElementById('mod-warn-action');
  if (wAct) wAct.value = config.warnings?.action || 'mute';

  // Warns List UI
  const warnList = document.getElementById('mod-warns-list');
  if (warnList) {
    const userWarns = config.warnings?.user_warns || {};
    const entries = Object.keys(userWarns).filter((u) => userWarns[u]?.length);
    if (!entries.length) {
      warnList.innerHTML = '<div class="empty-state">No active user warnings</div>';
    } else {
      warnList.innerHTML = entries
        .map(
          (u) => `
        <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;">
          <div><strong>@${u}</strong>: ${userWarns[u].length} warning(s)</div>
          <button class="btn btn-secondary btn-sm" onclick="clearUserWarnInUi('${u}')">Clear</button>
        </div>`
        )
        .join('');
    }
  }

  // Commands
  const cmdsEnabled = document.getElementById('mod-cmds-enabled');
  if (cmdsEnabled) cmdsEnabled.checked = Boolean(config.commands?.enabled);
  const cmdsPrefix = document.getElementById('mod-cmds-prefix');
  if (cmdsPrefix) cmdsPrefix.value = config.commands?.prefix || '!';
  const cmdsMute = document.getElementById('mod-cmds-mute-action');
  if (cmdsMute) cmdsMute.value = config.commands?.mute_action || 'delete';

  // AI & Translation
  const aiEnabled = document.getElementById('mod-ai-enabled');
  if (aiEnabled) aiEnabled.checked = Boolean(config.ai?.enabled);
  const aiFaq = document.getElementById('mod-ai-faq');
  if (aiFaq) aiFaq.checked = Boolean(config.ai?.faq_auto_reply);
  const aiSentiment = document.getElementById('mod-ai-sentiment');
  if (aiSentiment) aiSentiment.checked = Boolean(config.ai?.sentiment_moderation);
  const aiPrompt = document.getElementById('mod-ai-prompt');
  if (aiPrompt)
    aiPrompt.value = config.ai?.system_prompt || 'You are a helpful group moderator AI assistant.';
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

  // Blacklist Tag Cloud
  const blTags = document.getElementById('mod-blacklist-tags');
  if (blTags) {
    const words = config.blacklist?.words || [];
    if (!words.length) {
      blTags.innerHTML =
        '<span style="color:var(--text-muted);font-size:12px;">No blacklisted words or patterns yet</span>';
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
      filtersList.innerHTML =
        '<div class="empty-state" style="color:var(--text-muted);font-size:12px;padding:8px 0;">No filter rules configured yet</div>';
    } else {
      filtersList.innerHTML = filters
        .map(
          (f, idx) => `
        <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:6px;">
          <div>
            <strong style="color:var(--primary);">${escapeHtml(f.trigger)}</strong> &rarr; <span style="color:var(--text-main);">${escapeHtml(f.response)}</span>
          </div>
          <button class="btn btn-secondary btn-sm" style="color:#e74c3c;padding:2px 8px;" onclick="removeFilterRule(${idx})"><i class="fas fa-trash"></i></button>
        </div>`
        )
        .join('');
    }
  }

  // Federation Select & Shared Blacklist Tags
  const fedSelect = document.getElementById('mod-fed-select');
  if (fedSelect) fedSelect.value = config.federation_id || 'fed_global_default';

  const fedTags = document.getElementById('mod-fed-blacklist-tags');
  if (fedTags && modStoreCache?.federations) {
    const fedId = config.federation_id || 'fed_global_default';
    const fed =
      modStoreCache.federations.find((f) => f.id === fedId) || modStoreCache.federations[0];
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
}

async function toggleGroupModeration(enabled) {
  if (!currentModGroup) return;
  const url =
    basePath +
    `api/moderation/groups/${encodeURIComponent(currentModGroup)}/${enabled ? 'enable' : 'disable'}`;
  try {
    const res = await fetch(url, { method: 'POST' });
    if (res.ok) {
      showToast(enabled ? 'Group Moderation Enabled' : 'Group Moderation Disabled', 'success');
      loadModerationConfig();
    }
  } catch (e) {
    showToast('Failed to update group moderation', 'danger');
  }
}

function switchModSubTab(subTab) {
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

async function saveGroupRules() {
  if (!currentModGroup) return showToast('Please select a group', 'warning');
  const text = document.getElementById('mod-rules-text')?.value || '';
  const showOnJoin = Boolean(document.getElementById('mod-rules-show-on-join')?.checked);

  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.rules = { text, show_on_join: showOnJoin };

  await saveGroupConfig(groupConfig);
  showToast('Group rules saved!', 'success');
}

async function saveGroupGreetings() {
  if (!currentModGroup) return showToast('Please select a group', 'warning');
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.greetings = {
    welcome_enabled: Boolean(document.getElementById('mod-welcome-enabled')?.checked),
    welcome_message: document.getElementById('mod-welcome-msg')?.value || '',
    goodbye_enabled: Boolean(document.getElementById('mod-goodbye-enabled')?.checked),
    goodbye_message: document.getElementById('mod-goodbye-msg')?.value || '',
    captcha_enabled: Boolean(document.getElementById('mod-captcha-enabled')?.checked),
    captcha_mode: document.getElementById('mod-captcha-mode')?.value || 'button',
    captcha_timeout_seconds:
      parseInt(document.getElementById('mod-captcha-timeout')?.value, 10) || 120,
  };
  await saveGroupConfig(groupConfig);
  showToast('Greetings & Captcha saved!', 'success');
}

async function saveGroupWarnings() {
  if (!currentModGroup) return showToast('Please select a group', 'warning');
  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.warnings = {
    ...(groupConfig.warnings || {}),
    max_warnings: parseInt(document.getElementById('mod-max-warns')?.value, 10) || 3,
    action: document.getElementById('mod-warn-action')?.value || 'mute',
  };
  await saveGroupConfig(groupConfig);
  showToast('Warnings config saved!', 'success');
}

async function saveGroupCommands() {
  if (!currentModGroup) return showToast('Please select a group', 'warning');

  const enabled = Boolean(document.getElementById('mod-cmds-enabled')?.checked);
  const prefix = document.getElementById('mod-cmds-prefix')?.value || '!';
  const mute_action = document.getElementById('mod-cmds-mute-action')?.value || 'delete';

  const groupConfig = modStoreCache?.groups?.[currentModGroup] || {};
  groupConfig.commands = { enabled, prefix, mute_action };

  await saveGroupConfig(groupConfig);
  showToast('Commands configuration saved!', 'success');
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
      showToast(`Warnings cleared for @${userId}`, 'success');
      loadModerationConfig();
      setTimeout(() => selectModerationGroup(currentModGroup), 200);
    }
  } catch (e) {
    showToast('Failed to clear warnings', 'danger');
  }
}

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
  await saveGroupConfig(groupConfig);
  showToast('Anti-Spam & Anti-Raid saved!', 'success');
}

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
      'You are a helpful group moderator AI assistant.',
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
      showToast('AI & Translation Settings Saved!', 'success');
      loadModerationConfig();
    }
  } catch (e) {
    showToast('Failed to save AI settings', 'danger');
  }
}

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

// Global Window Exports
window.isNewerVersion = isNewerVersion;
window._latestReleaseData = data;
window.loadLogs = loadLogs;
window.URL.revokeObjectURL(url);
window.history.replaceState({}, '', url);
window.updateRawLogsLink();
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
window.selectModerationGroup = selectModerationGroup;
window.toggleGroupModeration = toggleGroupModeration;
window.switchModSubTab = switchModSubTab;
window.saveGroupRules = saveGroupRules;
window.saveGroupGreetings = saveGroupGreetings;
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
