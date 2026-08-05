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
