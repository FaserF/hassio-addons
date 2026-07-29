// Dashboard logic & polling

async function updateDashboard() {
  try {
    const response = await fetch(basePath + 'api/dashboard?session_id=' + currentSession, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      document.getElementById('card-diagnostics').style.display = 'block';
      document.getElementById('status-badge').className = 'status-badge disconnected';
      if (response.status === 403) {
        document.getElementById('status-badge').textContent = 'Access Blocked (403) ⛔';
      } else {
        document.getElementById('status-badge').textContent =
          'API Error (' + response.status + ') ⚠️';
      }
      return;
    }

    document.getElementById('card-diagnostics').style.display = 'none';
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

    // Dev/Beta releases banner
    const addonVer = data.addonVersion || '';
    const intVer = data.integrationVersion || '';
    const isDev =
      addonVer.toLowerCase().includes('edge') ||
      addonVer.toLowerCase().includes('dev') ||
      intVer.toLowerCase().includes('dev') ||
      intVer.toLowerCase().includes('beta') ||
      intVer.toLowerCase().includes('pre');
    document.getElementById('dev-banner').style.display = isDev ? 'flex' : 'none';

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
    if (options) select.innerHTML = options;

    // Passkey notifications
    const pkBanner = document.getElementById('passkey-banner');
    if (pkBanner) pkBanner.style.display = data.passkeyDetected ? 'flex' : 'none';

    // Connection status details
    const badge = document.getElementById('status-badge');
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
    document.getElementById('disconnect-reason').textContent = data.disconnectReason
      ? 'Reason: ' + data.disconnectReason
      : '';

    // QR setup or visual spinner loader
    const qrContainer = document.getElementById('qr-container');
    const initPlaceholder = document.getElementById('init-placeholder');
    if (!data.isConnected && data.currentQR) {
      qrContainer.style.display = 'flex';
      initPlaceholder.style.display = 'none';
      document.getElementById('qr-code').src = data.currentQR;
    } else if (!data.isConnected && !data.currentQR) {
      qrContainer.style.display = 'none';
      initPlaceholder.style.display = 'flex';
      // Show recent connection log in the placeholder so user can see what is happening
      const logEl = document.getElementById('init-log-text');
      if (logEl && data.connectionLogs && data.connectionLogs.length > 0) {
        logEl.textContent = data.connectionLogs[0].msg || '';
      }
    } else {
      qrContainer.style.display = 'none';
      initPlaceholder.style.display = 'none';
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
window.switchSession = switchSession;
