// Dashboard logic & polling

async function updateDashboard() {
  try {
    const response = await fetch(basePath + 'api/dashboard?session_id=' + currentSession, {
      headers: { Accept: 'application/json' },
    });
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

    // Semantic version comparison (returns true if latest > curr)
    const isNewerVersion = (curr, latest) => {
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
    };

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
    if (devBanner) devBanner.style.display = isDev ? 'flex' : 'none';

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
window.loadLogs = loadLogs;

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

function openUpdateModal(type) {
  const data = window._latestReleaseData || {};
  const modal = document.getElementById('version-update-modal');
  const title = document.getElementById('update-modal-title');
  const currVer = document.getElementById('update-curr-ver');
  const newVer = document.getElementById('update-new-ver');
  const changelog = document.getElementById('update-changelog-content');
  const actionBtn = document.getElementById('update-action-btn');

  if (type === 'addon') {
    if (title) title.textContent = 'WhatsApp Addon Update Verfügbar';
    if (currVer) currVer.textContent = data.addonVersion || 'N/A';
    if (newVer) newVer.textContent = data.latestAddonVersion || 'Neu';
    if (changelog)
      changelog.innerHTML = escapeHtml(data.addonChangelog || 'Kein Changelog verfügbar.');
    if (actionBtn) {
      actionBtn.href = data.isStandalone
        ? data.addonReleaseUrl || 'https://github.com/FaserF/hassio-addons/releases'
        : 'https://my.home-assistant.io/redirect/supervisor_addon/?addon=whatsapp';
      actionBtn.target = '_blank';
    }
  } else if (type === 'integration') {
    if (title) title.textContent = 'WhatsApp Integration Update Verfügbar';
    if (currVer) currVer.textContent = data.integrationVersion || 'N/A';
    if (newVer) newVer.textContent = data.latestIntegrationVersion || 'Neu';
    if (changelog)
      changelog.innerHTML = escapeHtml(data.integrationChangelog || 'Kein Changelog verfügbar.');
    if (actionBtn) {
      actionBtn.href =
        'https://my.home-assistant.io/redirect/hacs_repository/?owner=FaserF&repository=ha-whatsapp&category=integration';
      actionBtn.target = '_blank';
    }
  }

  if (modal) modal.classList.add('show');
}

function closeUpdateModal() {
  const modal = document.getElementById('version-update-modal');
  if (modal) modal.classList.remove('show');
}

function openDependencyModal(depName) {
  const modal = document.getElementById('dependency-info-modal');
  const title = document.getElementById('dep-modal-title');
  const placeholder = document.getElementById('dep-name-placeholder');

  if (title) title.textContent = `${depName} Paket-Abhängigkeit`;
  if (placeholder) placeholder.textContent = depName;

  if (modal) modal.classList.add('show');
}

function closeDependencyModal() {
  const modal = document.getElementById('dependency-info-modal');
  if (modal) modal.classList.remove('show');
}

window.updateDashboard = updateDashboard;
window.downloadDebugInfo = downloadDebugInfo;
window.restartSession = restartSession;
window.logoutSession = logoutSession;
window.clearLogs = clearLogs;
window.switchSession = switchSession;
window.openUpdateModal = openUpdateModal;
window.closeUpdateModal = closeUpdateModal;
window.openDependencyModal = openDependencyModal;
window.closeDependencyModal = closeDependencyModal;
