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
  const ok = await showConfirm(t('dashboard.clear_logs_confirm_title'), t('dashboard.clear_logs_confirm_msg'));
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
