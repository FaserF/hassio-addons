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
    document.getElementById('node-version').textContent = data.nodeVersion || 'N/A';
    document.getElementById('alpine-version').textContent = data.alpineVersion || 'N/A';
    document.getElementById('addon-version-sidebar').textContent = data.addonVersion || 'N/A';
    document.getElementById('int-version-sidebar').textContent = data.integrationVersion || 'N/A';
    document.getElementById('baileys-version').textContent = data.baileysVersion || 'N/A';
    document.getElementById('express-version').textContent = data.expressVersion || 'N/A';

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
    data.sessionList.forEach((s) => {
      const isSelected = s.id === currentSession ? 'selected' : '';
      const icon = s.connected ? '\u2705' : '\u274C';
      options +=
        '<option value="' + s.id + '" ' + isSelected + '>' + s.id + ' (' + icon + ')</option>';
    });
    select.innerHTML = options;

    // Passkey notifications
    const pkBanner = document.getElementById('passkey-banner');
    if (pkBanner) pkBanner.style.display = data.passkeyDetected ? 'flex' : 'none';

    // Connection status details
    const badge = document.getElementById('status-badge');
    badge.className =
      'status-badge ' +
      (data.isConnected ? 'connected' : data.currentQR ? 'waiting' : 'disconnected');
    badge.textContent = data.isConnected
      ? 'Connected \u2705'
      : data.currentQR
        ? 'Scan QR Code \uD83D\uDCF1'
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
    } else {
      qrContainer.style.display = 'none';
      initPlaceholder.style.display = 'none';
    }

    // Metadata details
    document.getElementById('webhook-status').textContent = data.webhookEnabled
      ? 'Enabled ✅'
      : 'Disabled ❌';
    document.getElementById('webhook-status').style.color = data.webhookEnabled
      ? 'var(--primary)'
      : 'var(--danger)';
    document.getElementById('webhook-url').textContent = data.webhookUrl || 'Not Configured';

    // Connected account fields
    const hasDevice = data.isConnected && data.deviceInfo && data.deviceInfo.number;
    document.getElementById('device-info-grid').style.display = hasDevice ? 'grid' : 'none';
    document.getElementById('no-device-msg').style.display = hasDevice ? 'none' : 'block';
    if (hasDevice) {
      document.getElementById('device-name').textContent = data.deviceInfo.name || '—';
      document.getElementById('device-number').textContent = '+' + data.deviceInfo.number;
      document.getElementById('device-session').textContent = data.sessionId || 'default';
      const statusEl = document.getElementById('device-status');
      if (statusEl) {
        statusEl.textContent = data.deviceInfo.status
          ? `"${data.deviceInfo.status}"`
          : 'No profile status set';
      }
    }

    // Stats properties
    document.getElementById('stat-sent').textContent = data.stats.sent;
    document.getElementById('stat-received').textContent = data.stats.received;
    document.getElementById('stat-failed').textContent = data.stats.failed;
    document.getElementById('val-uptime').textContent = data.uptime || '00:00:00';
    document.getElementById('val-reconnects').textContent =
      data.stats?.totalReconnects ?? data.reconnectAttempts ?? 0;

    // Render streams lists
    document.getElementById('list-sent').innerHTML = data.recentSent.length
      ? data.recentSent
          .map(
            (m) =>
              '<div class="history-item">' +
              '<span class="history-time">' +
              m.timestamp +
              '</span>' +
              '<span class="history-target">To: ' +
              m.target +
              '</span>' +
              '<div class="history-msg">' +
              m.message +
              '</div>' +
              '</div>'
          )
          .join('')
      : '<div class="empty-state">No messages sent recently</div>';

    document.getElementById('list-received').innerHTML = data.recentReceived.length
      ? data.recentReceived
          .map(
            (m) =>
              '<div class="history-item">' +
              '<span class="history-time">' +
              m.timestamp +
              '</span>' +
              '<span class="history-sender">From: ' +
              m.sender +
              '</span>' +
              '<div class="history-msg">' +
              m.message +
              '</div>' +
              '</div>'
          )
          .join('')
      : '<div class="empty-state">No messages received recently</div>';

    document.getElementById('list-failures').innerHTML = data.recentFailures.length
      ? data.recentFailures
          .map(
            (m) =>
              '<div class="history-item failure">' +
              '<span class="history-time">' +
              m.timestamp +
              '</span>' +
              '<span class="history-target">Target: ' +
              m.target +
              '</span>' +
              '<div class="history-msg">' +
              m.message +
              '</div>' +
              '<div class="history-reason">Error: ' +
              m.reason +
              '</div>' +
              '</div>'
          )
          .join('')
      : '<div class="empty-state">No failures recorded</div>';
  } catch (e) {
    console.error(e);
  }
}

async function loadLogs() {
  try {
    const response = await fetch(basePath + 'logs?session_id=' + currentSession);
    if (!response.ok) return;
    const logs = await response.json();

    document.getElementById('list-logs').innerHTML = logs.length
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
  updateDashboard();
}
