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

let _isUpdatingDashboard = false;
async function updateDashboard() {
  if (_isUpdatingDashboard) return;
  _isUpdatingDashboard = true;
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
    const lifetimeSent = stats.lifetime_sent != null ? stats.lifetime_sent : stats.sent || 0;
    const lifetimeReceived =
      stats.lifetime_received != null ? stats.lifetime_received : stats.received || 0;
    const lifetimeFailed =
      stats.lifetime_failed != null ? stats.lifetime_failed : stats.failed || 0;
    const lifetimeReconnects =
      stats.lifetime_reconnects != null
        ? stats.lifetime_reconnects
        : (stats.totalReconnects ?? data.reconnectAttempts ?? 0);

    setElText('stat-sent', lifetimeSent);
    setElText('stat-received', lifetimeReceived);
    setElText('stat-failed', lifetimeFailed);

    setElText('stat-sent-sub', stats.sent || 0);
    setElText('stat-received-sub', stats.received || 0);
    setElText('stat-failed-sub', stats.failed || 0);

    const updateBadge = (id, lifetime, sessionCount) => {
      const el = document.getElementById(id);
      if (el) {
        if (lifetime > sessionCount) {
          el.style.display = 'inline-block';
          el.textContent = window.t
            ? window.t('dashboard.total_label', { count: lifetime })
            : `Total: ${lifetime}`;
        } else {
          el.style.display = 'none';
        }
      }
    };
    updateBadge('stat-sent-total', lifetimeSent, stats.sent || 0);
    updateBadge('stat-received-total', lifetimeReceived, stats.received || 0);
    updateBadge('stat-failed-total', lifetimeFailed, stats.failed || 0);

    // Uptime: prefer start_time from stats (epoch ms), fall back to server process uptime
    let uptimeStr = '00:00:00';
    let startTimeMs = stats.start_time || 0;
    if (startTimeMs > 0) {
      const diffSec = Math.max(0, Math.floor((Date.now() - startTimeMs) / 1000));
      const hrs = String(Math.floor(diffSec / 3600)).padStart(2, '0');
      const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
      const secs = String(diffSec % 60).padStart(2, '0');
      uptimeStr = `${hrs}:${mins}:${secs}`;
    } else if (data.uptimeSeconds > 0) {
      const diffSec = data.uptimeSeconds;
      startTimeMs = Date.now() - diffSec * 1000;
      const hrs = String(Math.floor(diffSec / 3600)).padStart(2, '0');
      const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
      const secs = String(diffSec % 60).padStart(2, '0');
      uptimeStr = `${hrs}:${mins}:${secs}`;
    }
    setElText('val-uptime', uptimeStr);

    const sessionReconnects = stats.totalReconnects ?? data.reconnectAttempts ?? 0;
    setElText(
      'val-reconnects',
      lifetimeReconnects > sessionReconnects
        ? `${lifetimeReconnects} (${sessionReconnects} ${sinceRestartText})`
        : `${sessionReconnects}`
    );

    const startedAtEl = document.getElementById('val-started-at');
    if (startedAtEl && startTimeMs > 0) {
      const d = new Date(startTimeMs);
      const dateStr = d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const timeStr = d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const formattedTime = `${dateStr} ${timeStr}`;
      startedAtEl.textContent = window.t
        ? window.t('dashboard.addon_started_at', { time: formattedTime })
        : `Addon started on ${formattedTime}`;
    }

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

    // Update Auto Responder Card Status
    if (typeof loadAutoResponderConfig === 'function') {
      loadAutoResponderConfig();
    }
  } catch (e) {
    console.error('❌ updateDashboard error:', e);
    const badge = document.getElementById('status-badge');
    if (badge) {
      badge.className = 'status-badge disconnected';
      badge.textContent = window.t ? window.t('dashboard.ui_render_error') : 'UI Render Error ⚠️';
    }
  } finally {
    _isUpdatingDashboard = false;
  }
}

let _isLoadingAutoResponder = false;
async function loadAutoResponderConfig() {
  if (_isLoadingAutoResponder) return;
  const card = document.getElementById('card-autoresponder');
  if (!card) return;

  _isLoadingAutoResponder = true;
  try {
    const res = await fetch(basePath + 'api/autoresponder/config');
    if (!res.ok) return;
    const json = await res.json();
    if (!json.success || !json.data) return;

    const data = json.data;
    const now = Date.now();
    let isExpired = false;
    if (data.end_time) {
      const endMs = new Date(data.end_time).getTime();
      if (!isNaN(endMs) && now > endMs) {
        isExpired = true;
      }
    }

    const enabledInput = document.getElementById('ar-enabled');
    if (enabledInput && document.activeElement !== enabledInput) {
      enabledInput.checked = Boolean(data.enabled) && !isExpired;
    }

    const startTimeInput = document.getElementById('ar-start-time');
    if (startTimeInput && document.activeElement !== startTimeInput) {
      startTimeInput.value = data.start_time || '';
    }

    const endTimeInput = document.getElementById('ar-end-time');
    if (endTimeInput && document.activeElement !== endTimeInput) {
      endTimeInput.value = data.end_time || '';
    }

    const directOnlyInput = document.getElementById('ar-direct-only');
    if (directOnlyInput && document.activeElement !== directOnlyInput) {
      directOnlyInput.value = String(data.direct_only !== false);
    }

    const onceInput = document.getElementById('ar-once-per-contact');
    if (onceInput && document.activeElement !== onceInput) {
      onceInput.value = String(data.once_per_contact !== false);
    }

    const templateInput = document.getElementById('ar-message-template');
    if (templateInput && document.activeElement !== templateInput) {
      templateInput.value = data.message_template || '';
    }

    const badge = document.getElementById('ar-status-badge');
    if (badge) {
      // Calculate is_active client-side as well to guarantee instant real-time status with user's local clock
      const now = Date.now();
      let isClientActive = Boolean(data.enabled);
      let isFutureStart = false;
      let isPastEnd = false;

      if (data.start_time) {
        const startMs = new Date(data.start_time).getTime();
        if (!isNaN(startMs) && now < startMs) {
          isClientActive = false;
          isFutureStart = true;
        }
      }
      if (data.end_time) {
        const endMs = new Date(data.end_time).getTime();
        if (!isNaN(endMs) && now > endMs) {
          isClientActive = false;
          isPastEnd = true;
        }
      }

      if (!data.enabled) {
        badge.className = 'badge';
        badge.style.background = 'var(--bg-app)';
        badge.style.color = 'var(--text-muted)';
        badge.textContent = window.t ? window.t('autoresponder.inactive_status') : 'Disabled';
      } else if (isClientActive || (data.is_active && !isPastEnd)) {
        badge.className = 'badge';
        badge.style.background = 'rgba(16, 185, 129, 0.15)';
        badge.style.color = 'var(--primary)';
        badge.textContent = window.t ? window.t('autoresponder.active_status') : 'Active Now 🌴';
      } else if (isPastEnd) {
        badge.className = 'badge';
        badge.style.background = 'rgba(239, 68, 68, 0.15)';
        badge.style.color = 'var(--danger)';
        badge.textContent = window.t ? window.t('autoresponder.expired_status') : 'Expired ⏰';
      } else if (isFutureStart) {
        badge.className = 'badge';
        badge.style.background = 'rgba(245, 158, 11, 0.15)';
        badge.style.color = 'var(--warning)';
        badge.textContent = window.t ? window.t('autoresponder.scheduled_status') : 'Scheduled ⏳';
      } else {
        badge.className = 'badge';
        badge.style.background = 'var(--bg-app)';
        badge.style.color = 'var(--text-muted)';
        badge.textContent = window.t ? window.t('autoresponder.inactive_status') : 'Disabled';
      }
    }

    const seenCountEl = document.getElementById('ar-seen-count');
    if (seenCountEl) {
      const count = data.seen_count || 0;
      seenCountEl.textContent = window.t
        ? window.t('autoresponder.seen_count_label', { count })
        : `${count} contact(s) received an auto-reply`;
    }

    updateAutoResponderPreview();
  } catch (err) {
    console.debug('Failed to load auto responder config', err);
  } finally {
    _isLoadingAutoResponder = false;
  }
}

function formatPreviewDateTime(isoStr) {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return String(isoStr);

  const lang = window.currentLang || (window.t ? window.t('meta.code') : 'en') || 'en';
  try {
    const localeCode = lang.startsWith('de') ? 'de-DE' : 'en-US';
    return date.toLocaleString(localeCode, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch (_e) {
    return date.toLocaleString();
  }
}

function updateAutoResponderPreview() {
  const tpl = document.getElementById('ar-message-template')?.value || '';
  const rawStart = document.getElementById('ar-start-time')?.value || '';
  const rawEnd = document.getElementById('ar-end-time')?.value || '';
  const oncePerContact = document.getElementById('ar-once-per-contact')?.value === 'true';

  let isDe = (window.currentLang || (window.t ? window.t('meta.code') : 'en') || 'en').startsWith('de');
  const lowerTpl = (tpl || '').toLowerCase();
  if (
    lowerTpl.includes('hallo') ||
    lowerTpl.includes('vielen dank') ||
    lowerTpl.includes('urlaub') ||
    lowerTpl.includes('abwesend') ||
    lowerTpl.includes('nachricht')
  ) {
    isDe = true;
  } else if (
    lowerTpl.includes('hello') ||
    lowerTpl.includes('thank you') ||
    lowerTpl.includes('vacation') ||
    lowerTpl.includes('automated reply')
  ) {
    isDe = false;
  }

  const senderName = isDe ? 'Max Mustermann' : 'John Doe';
  const startTimeFormatted = rawStart ? formatPreviewDateTime(rawStart) : '';
  const endTimeFormatted = rawEnd ? formatPreviewDateTime(rawEnd) : '';

  let endTimeText = '';
  if (endTimeFormatted) {
    endTimeText = isDe ? ` (bis ${endTimeFormatted})` : ` (until ${endTimeFormatted})`;
  }

  let onceNotice = '';
  if (oncePerContact) {
    onceNotice = isDe
      ? 'ℹ️ *Hinweis:* Du erhältst diese automatische Antwort nur einmalig.'
      : 'ℹ️ *Note:* You will only receive this automated reply once.';
  }

  // Update live resolution table values
  const setEl = (id, val, emptyPlaceholder = '—') => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || emptyPlaceholder;
  };
  setEl('ar-val-sender', senderName);
  setEl('ar-val-start', startTimeFormatted);
  setEl('ar-val-end', endTimeFormatted);
  setEl('ar-val-end-text', endTimeText);
  setEl('ar-val-once', onceNotice);

  // Update live message preview bubble
  const bubble = document.getElementById('ar-live-preview-bubble');
  if (bubble) {
    if (!tpl.trim()) {
      bubble.textContent = window.t
        ? window.t('autoresponder.live_preview_empty')
        : '(Enter a template message above to see preview)';
      bubble.style.opacity = '0.6';
      bubble.style.fontStyle = 'italic';
    } else {
      bubble.style.opacity = '1';
      bubble.style.fontStyle = 'normal';
      const resolved = tpl
        .replace(/\{sender_name\}/g, senderName)
        .replace(/\{start_time\}/g, startTimeFormatted || (rawStart ? String(rawStart) : ''))
        .replace(/\{end_time\}/g, endTimeFormatted || (rawEnd ? String(rawEnd) : ''))
        .replace(/\{end_time_text\}/g, endTimeText)
        .replace(/\{once_notice\}/g, onceNotice);
      bubble.textContent = resolved;
    }
  }
}

async function saveAutoResponderConfig() {
  const enabled = document.getElementById('ar-enabled')?.checked ?? false;
  const start_time = document.getElementById('ar-start-time')?.value || null;
  const end_time = document.getElementById('ar-end-time')?.value || null;
  const direct_only = document.getElementById('ar-direct-only')?.value === 'true';
  const once_per_contact = document.getElementById('ar-once-per-contact')?.value === 'true';
  const message_template = document.getElementById('ar-message-template')?.value || '';

  updateAutoResponderPreview();

  try {
    const res = await fetch(basePath + 'api/autoresponder/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled,
        start_time,
        end_time,
        direct_only,
        once_per_contact,
        message_template,
      }),
    });
    if (res.ok) {
      if (typeof showToast === 'function') {
        showToast(
          window.t
            ? window.t('autoresponder.save_success')
            : 'Auto Responder settings saved successfully! ✅',
          'success'
        );
      }
      loadAutoResponderConfig();
    }
  } catch (err) {
    console.error('Failed to save auto responder config', err);
  }
}

async function resetAutoResponderTemplate() {
  const defaultTpl = window.t
    ? window.t('autoresponder.default_template')
    : 'Hello {sender_name},\n\n' +
      'Thank you for your message! 🌴\n' +
      'This is an automated reply: I am currently away / on vacation{end_time_text} and have limited or no access to WhatsApp.\n\n' +
      '{once_notice}';

  const tplInput = document.getElementById('ar-message-template');
  if (tplInput) {
    tplInput.value = defaultTpl;
    updateAutoResponderPreview();
    saveAutoResponderConfig();
  }
}

async function resetAutoResponderSeen() {
  try {
    const res = await fetch(basePath + 'api/autoresponder/reset-seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      if (typeof showToast === 'function') {
        showToast(
          window.t
            ? window.t('autoresponder.reset_seen_success')
            : 'Replied contacts list reset successfully! ✅',
          'success'
        );
      }
      loadAutoResponderConfig();
    }
  } catch (err) {
    console.error('Failed to reset auto responder seen contacts', err);
  }
}

window.loadAutoResponderConfig = loadAutoResponderConfig;
window.saveAutoResponderConfig = saveAutoResponderConfig;
window.resetAutoResponderTemplate = resetAutoResponderTemplate;
window.resetAutoResponderSeen = resetAutoResponderSeen;
window.updateAutoResponderPreview = updateAutoResponderPreview;
