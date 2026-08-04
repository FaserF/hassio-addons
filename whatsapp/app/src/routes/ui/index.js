import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { uiAuthMiddleware } from '../../middleware.js';
import { getSession, sanitizeSessionId, sessions, signalInterest } from '../../session.js';
import { API_TOKEN, PORT, DATA_DIR } from '../../config.js';
import { connectToWhatsApp } from '../../whatsapp/connection.js';

const uiDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

/**
 * Returns the best available local IPv4 address.
 * Prefers private ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x),
 * then any non-loopback IPv4, then hostname, then 127.0.0.1.
 */
function getLocalIP() {
  const nets = os.networkInterfaces();
  let fallback = null;
  const privateRanges = [/^192\.168\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./];
  for (const iface of Object.values(nets)) {
    for (const addr of iface || []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (addr.address.startsWith('169.254.')) continue; // link-local
      if (privateRanges.some((re) => re.test(addr.address))) return addr.address;
      if (!fallback) fallback = addr.address;
    }
  }
  return fallback || os.hostname() || '127.0.0.1';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function registerUIRoutes(app) {
  // Serve static assets for the UI with no-cache headers to prevent browser caching stale JS/CSS
  app.use(
    '/ui-assets',
    (req, res, next) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    },
    express.static(uiDir, { maxAge: 0, etag: false })
  );

  app.get('/', uiAuthMiddleware, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // Ensure all sessions from disk are loaded into memory map before resolving default active session
    const sessionsDir = path.join(path.dirname(uiDir), '../data', 'sessions');
    // Also check standard DATA_DIR path
    try {
      const dataSessionsDir = path.join(process.env.DATA_DIR || '/data', 'sessions');
      const targetDir = fs.existsSync(dataSessionsDir)
        ? dataSessionsDir
        : fs.existsSync(sessionsDir)
          ? sessionsDir
          : null;
      if (targetDir) {
        const sDirs = fs.readdirSync(targetDir);
        for (const sDir of sDirs) {
          const fullPath = path.join(targetDir, sDir);
          if (fs.statSync(fullPath).isDirectory()) {
            getSession(sDir);
          }
        }
      }
    } catch (e) {}

    let sessionId = req.query.session_id;
    if (!sessionId) {
      const connectedSession = Array.from(sessions.values()).find((s) => s.isConnected);
      if (connectedSession) {
        sessionId = connectedSession.id;
      } else if (sessions.has('default')) {
        sessionId = 'default';
      } else if (sessions.size > 0) {
        sessionId = Array.from(sessions.keys())[0];
      } else {
        sessionId = 'default';
      }
    }
    sessionId = sanitizeSessionId(sessionId);

    // Signal interest so the WhatsApp connection starts (QR code generation, reconnect, etc.)
    // Wrapped in try-catch so any error here never prevents the page from loading.
    try {
      signalInterest(sessionId, connectToWhatsApp);
    } catch (e) {
      // Non-fatal: page still renders, connection attempt is best-effort
    }

    res.send(renderDashboard(sessionId));
  });
}

function renderDashboard(sessionId) {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>WhatsApp Gateway - Home Assistant</title>
    <script>
      (function() {
        let p = window.location.pathname;
        if (!p.endsWith('/')) p += '/';
        let b = document.createElement('base');
        b.href = p;
        document.head.appendChild(b);
      })();
    </script>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💬</text></svg>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="ui-assets/styles.css">
</head>
<body>
  <div class="app-layout">
    <aside class="sidebar">
        <div class="sidebar-header">
            <div class="logo" style="cursor:pointer;" onclick="toggleSidebar(event)">
                <i class="fab fa-whatsapp logo-icon" id="sidebar-logo-icon"></i>
                <div class="logo-text">
                    <span class="logo-title">WhatsApp Gateway</span>
                    <span class="logo-subtitle" id="logo-subtitle">Home Assistant</span>
                </div>
            </div>
            <button class="sidebar-toggle-btn" id="sidebar-toggle-btn" title="Toggle sidebar" onclick="toggleSidebar(event)">
                <i class="fas fa-bars" style="pointer-events:none;"></i>
            </button>
        </div>
        
        <nav class="nav-menu">
            <button class="nav-item active" data-tab="dashboard" data-tooltip="Dashboard" onclick="switchTab('dashboard')">
                <i class="fas fa-chart-pie nav-icon"></i>
                <span>Dashboard</span>
            </button>
            <button class="nav-item" data-tab="logs" data-tooltip="Daemon Logs" onclick="switchTab('logs')">
                <i class="fas fa-terminal nav-icon"></i>
                <span>Daemon Logs</span>
            </button>
            <button class="nav-item" data-tab="chats" data-tooltip="Chats" onclick="switchTab('chats')">
                <i class="fas fa-comments nav-icon"></i>
                <span>Chats</span>
            </button>
            <button class="nav-item" data-tab="moderation" data-tooltip="Group Moderation" onclick="switchTab('moderation')">
                <i class="fas fa-shield-alt nav-icon"></i>
                <span>Moderation</span>
            </button>
            <a href="https://faserf.github.io/ha-whatsapp/" target="_blank" class="nav-item" data-tooltip="Documentation">
                <i class="fas fa-book nav-icon"></i>
                <span>Documentation</span>
            </a>
            <a href="https://github.com/FaserF/ha-whatsapp" target="_blank" class="nav-item" data-tooltip="Integration Repo">
                <i class="fas fa-puzzle-piece nav-icon"></i>
                <span>Integration Repo</span>
            </a>
            <a id="ha-repo-link" href="https://github.com/FaserF/hassio-addons" target="_blank" class="nav-item" data-tooltip="HA App Repo">
                <i class="fas fa-cubes nav-icon"></i>
                <span>HA App Repo</span>
            </a>
            <a id="raw-logs-link" href="#" target="_blank" class="nav-item" data-tooltip="Raw Connection Logs">
                <i class="fas fa-file-alt nav-icon"></i>
                <span>Raw Connection Logs</span>
            </a>
            <a id="full-logs-link" href="#" target="_top" class="nav-item" style="display:none;" data-tooltip="Full System Logs">
                <i class="fas fa-file-invoice nav-icon"></i>
                <span>Full System Logs</span>
            </a>
        </nav>
        
        <div class="sidebar-footer">
            <div class="sys-info-title">System Properties</div>
            <div class="sys-info-text">
                <a href="#" onclick="openUpdateModal('addon'); return false;" class="sys-info-link">Addon: <span id="addon-version-sidebar" class="sys-info-val">...</span><span id="addon-update-badge" class="update-badge" style="display:none;" title="Update Available!">⚡ Update</span></a>
                <a href="#" onclick="openUpdateModal('integration'); return false;" class="sys-info-link">Integration: <span id="int-version-sidebar" class="sys-info-val">...</span><span id="int-update-badge" class="update-badge" style="display:none;" title="Update Available!">⚡ Update</span></a>
                <a href="#" onclick="openDependencyModal('Baileys'); return false;" class="sys-info-link">Baileys: <span id="baileys-version" class="sys-info-val">...</span><span id="baileys-update-badge" class="update-badge dep-badge" style="display:none;" title="Updated via Addon update">⚡ Info</span></a>
                <a href="#" onclick="openDependencyModal('Node.js'); return false;" class="sys-info-link">Node: <span id="node-version" class="sys-info-val">...</span><span id="node-update-badge" class="update-badge dep-badge" style="display:none;" title="Updated via Addon update">⚡ Info</span></a>
                <a href="#" onclick="openDependencyModal('Express'); return false;" class="sys-info-link">Express: <span id="express-version" class="sys-info-val">...</span><span id="express-update-badge" class="update-badge dep-badge" style="display:none;" title="Updated via Addon update">⚡ Info</span></a>
                <a href="#" onclick="openDependencyModal('Alpine Linux'); return false;" class="sys-info-link">Alpine: <span id="alpine-version" class="sys-info-val">...</span><span id="alpine-update-badge" class="update-badge dep-badge" style="display:none;" title="Updated via Addon update">⚡ Info</span></a>
            </div>
            <div class="sidebar-info-badge" id="sidebar-info-badge" data-tooltip="System Info Loading..." title="Click for System Properties" onclick="showSystemPropertiesModal()">
                <i class="fas fa-info"></i>
            </div>
        </div>
    </aside>

    <main class="main-content">
        <header class="top-header">
            <div class="header-left" style="display:flex;align-items:center;gap:12px;">
                <h1 class="header-title" id="page-title">Dashboard</h1>
            </div>
            <div class="header-actions">
                <div class="session-switcher">
                    <span>Session:</span>
                    <select id="session-select" onchange="switchSession(this.value)">
                        <option value="${escapeHtml(sessionId)}">${escapeHtml(sessionId)}</option>
                    </select>
                </div>
                <button id="theme-toggle" class="theme-toggle" title="Toggle Light/Dark Mode" onclick="toggleTheme()">🌓</button>
            </div>
        </header>

        <div class="content-body">
            <div id="dev-banner" class="banner banner-warning" style="display:none;">
                <i class="fas fa-exclamation-triangle banner-warning-icon"></i>
                <div>
                    <strong>Development / Beta Release Active</strong><br>
                    You are running a beta or edge version of the gateway. Some settings may behave experimentally.
                </div>
            </div>

            <div id="passkey-banner" class="banner banner-warning" style="display:none;">
                <i class="fas fa-key banner-warning-icon"></i>
                <div>
                    <strong>WhatsApp Passkey Requirement Detected</strong><br>
                    Your account has passkeys active which restricts Baileys pairing. Open WhatsApp Settings &rarr; Account &rarr; Passkeys and remove them to pair this daemon. Click restart afterward.
                </div>
            </div>

            <section id="tab-dashboard" class="tab-panel active">
                <div class="grid">
                    <div class="card">
                        <div class="card-title"><i class="fas fa-plug"></i> Connection Status</div>
                        <div class="status-container">
                            <div id="status-badge" class="status-badge disconnected">Initializing...</div>
                            <div id="disconnect-reason" class="disconnect-reason"></div>
                        </div>
                        <div id="qr-container" class="qr-container" style="display:none;">
                            <img id="qr-code" class="qr-code" src="" alt="Pairing QR Code" />
                        </div>
                        <div id="init-placeholder" class="qr-container" style="flex-direction:column;gap:12px;background-color:var(--bg-app);border-color:var(--border-color);">
                            <div class="spinner"></div>
                            <span id="init-log-text" style="font-size:11px;color:var(--text-muted);text-align:center;max-width:200px;line-height:1.4;"></span>
                        </div>
                        <div class="stats-row">
                            <div class="stat-box"><div id="stat-sent" class="stat-val">0</div><div class="stat-label">Sent</div></div>
                            <div class="stat-box"><div id="stat-received" class="stat-val">0</div><div class="stat-label">Received</div></div>
                            <div class="stat-box"><div id="stat-failed" class="stat-val">0</div><div class="stat-label">Failed</div></div>
                        </div>
                        <div style="font-size:11px; text-align:center; color: var(--text-muted); font-weight:600;">
                            Uptime: <span id="val-uptime" style="color:var(--text-main);">00:00:00</span> &bull; 
                            Reconnections: <span id="val-reconnects" style="color:var(--text-main);">0</span>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-title" id="setup-card-title"><i class="fas fa-home"></i> Home Assistant Setup</div>
                        <div class="details-box">
                            <div class="details-item">
                                <span class="details-label" id="label-host-uri">Addon Host URI</span>
                                <code>http://${os.hostname()}:${PORT}</code>
                            </div>
                            <div class="details-item">
                                <span class="details-label">API Bearer Token</span>
                                <code class="highlight-token" title="Click to Select All">${API_TOKEN}</code>
                            </div>
                            <div class="details-item">
                                <span class="details-label">Static Local Address</span>
                                <code>http://${getLocalIP()}:${PORT}</code>
                            </div>
                        </div>
                        <p style="font-size:11px; color: var(--text-muted); line-height:1.4;">
                            Input either the Host URI or Static IP with the Bearer Token inside your Home Assistant integration setup window.
                        </p>
                    </div>

                    <div class="card">
                        <div class="card-title"><i class="fas fa-link"></i> Webhook Preferences</div>
                        <div class="details-box">
                            <div class="details-item">
                                <span class="details-label">Active Status</span>
                                <span id="webhook-status" class="sys-info-val">...</span>
                            </div>
                            <div class="details-item">
                                <span class="details-label">Destination URL</span>
                                <span id="webhook-url" class="sys-info-val" style="word-break:break-all;">...</span>
                            </div>
                        </div>
                    </div>

                    <div class="card" id="device-card">
                        <div class="card-title"><i class="fas fa-mobile-alt"></i> Connected Account</div>
                        <div id="device-info-grid" class="info-grid" style="display:none;">
                            <div class="info-item">
                                <span class="info-label">Account Name</span>
                                <span id="device-name" class="info-value">...</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Phone Number</span>
                                <span id="device-number" class="info-value">...</span>
                            </div>
                            <div class="info-item" style="grid-column: span 2;">
                                <span class="info-label">Profile Description (About)</span>
                                <span id="device-status" class="info-value" style="font-style:italic;color:var(--text-main);">—</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Session ID</span>
                                <span id="device-session" class="info-value">...</span>
                            </div>
                        </div>
                        <div id="no-device-msg" class="empty-state">
                            Connect a device to see details.
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-title"><i class="fas fa-sliders-h"></i> System Maintenance</div>
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 10px;">
                            <button class="btn btn-secondary" onclick="restartSession()" title="Restart Daemon"><i class="fas fa-sync-alt"></i> Restart Daemon</button>
                            <button class="btn btn-secondary" onclick="purgeSessions()" title="Clean Inactive Sessions"><i class="fas fa-broom"></i> Clean Sessions</button>
                            <button class="btn btn-danger" onclick="logoutSession()" title="Hard Reset / Logout"><i class="fas fa-sign-out-alt"></i> Hard Reset</button>
                        </div>
                        <p style="font-size:11px; color:var(--text-muted); margin:0;">Restarting will attempt a fresh connection without deleting credentials.</p>
                    </div>

                    <div class="card">
                        <div class="card-title"><i class="fas fa-bug"></i> Integration Bug Report</div>
                        <p style="font-size:12px; color:var(--text-muted); line-height:1.4; margin:0;">Encountered an issue? Download an anonymized debug bundle and report it on GitHub.</p>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: auto;">
                            <button class="btn btn-primary" onclick="downloadDebugInfo()"><i class="fas fa-download"></i> Anonymized Logs</button>
                            <a href="https://github.com/FaserF/ha-whatsapp/issues/new?template=bug_report.yml" target="_blank" class="btn btn-secondary"><i class="fas fa-external-link-alt"></i> Open GitHub Issue</a>
                        </div>
                    </div>

                    <div class="card" id="card-diagnostics" style="display:none; border: 2px solid var(--warning); grid-column: 1 / -1;">
                        <div class="card-title"><i class="fas fa-search-plus"></i> System Diagnostics</div>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Base Path</span>
                                <span id="diag-basepath" class="info-value" style="word-break: break-all; font-family: monospace;">...</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Actual URL</span>
                                <span id="diag-pathname" class="info-value" style="word-break: break-all; font-family: monospace;">...</span>
                            </div>
                        </div>
                        <p style="font-size:11px; color:var(--text-muted); margin:0;">If you see API errors, these values help diagnose Home Assistant Ingress URL translation failures.</p>
                    </div>
                </div>

                <div class="grid">
                    <div class="card">
                        <div class="card-title"><i class="fas fa-paper-plane"></i> Outbound Queue</div>
                        <div id="list-sent" class="history-list"><div class="empty-state">No messages sent...</div></div>
                    </div>
                    <div class="card">
                        <div class="card-title"><i class="fas fa-inbox"></i> Inbound Queue</div>
                        <div id="list-received" class="history-list"><div class="empty-state">No incoming messages...</div></div>
                    </div>
                    <div class="card" style="grid-column: 1 / -1;">
                        <div class="card-title"><i class="fas fa-exclamation-circle"></i> Pipeline Failures</div>
                        <div id="list-failures" class="history-list"><div class="empty-state">No failed messages...</div></div>
                    </div>
                </div>
            </section>

            <section id="tab-logs" class="tab-panel">
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h2 class="card-title" style="color:var(--text-main);"><i class="fas fa-terminal"></i> Connection Events</h2>
                            <p class="card-subtitle" style="margin-bottom:16px;">Real-time socket events from the underlying WhatsApp daemon service.</p>
                        </div>
                        <div class="logs-actions">
                            <button class="btn btn-secondary btn-sm" onclick="clearLogs()"><i class="fas fa-trash-alt"></i> Clear Logs</button>
                            <button class="btn btn-secondary btn-sm" onclick="loadLogs()"><i class="fas fa-sync"></i> Refresh</button>
                        </div>
                    </div>
                    <div id="list-logs" class="logs-view"><div class="log-entry">Loading events...</div></div>
                </div>
            </section>

            <section id="tab-chats" class="tab-panel">
                <div class="chat-container-layout">
                    <div class="chat-list-panel">
                        <div class="chat-list-header" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border-color);">
                            <div class="search-box-wrapper" style="flex:1;">
                                <i class="fas fa-search search-icon"></i>
                                <input type="text" id="chat-search" class="chat-search-input" placeholder="Search chats..." oninput="filterChatList()">
                            </div>
                            <button class="btn btn-primary btn-sm" style="border-radius:50%;width:36px;height:36px;padding:0;flex-shrink:0;display:flex;align-items:center;justify-content:center;" title="Start New Chat" onclick="openNewChatModal()">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <div class="chat-list-items" id="chat-list-items">
                            <div class="empty-state">No conversations active yet</div>
                        </div>
                    </div>

                    <div class="chat-thread-panel" id="chat-thread-panel">
                        <div class="chat-thread-empty" id="chat-thread-empty">
                            <div class="chat-thread-empty-icon"><i class="fab fa-whatsapp"></i></div>
                            <h3>Select a chat to view messages</h3>
                            <p>Select a contact or group from the left sidebar to start chatting.</p>
                        </div>

                        <div class="chat-thread-active" id="chat-thread-active" style="display: none;">
                            <div class="chat-thread-header" style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;min-height:62px;width:100%;border-bottom:1px solid var(--border-color);background-color:var(--bg-card);gap:16px;">
                                <div class="chat-thread-info" onclick="openChatInfoDrawer()" style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;cursor:pointer;" title="Click to view Contact / Group Details">
                                    <button class="chat-back-btn" onclick="event.stopPropagation();goBackToChatList(event)"><i class="fas fa-arrow-left"></i></button>
                                    <div class="chat-thread-avatar" id="active-chat-avatar" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;"></div>
                                    <div style="flex:1;min-width:0;">
                                        <h4 id="active-chat-name" style="margin:0;font-size:16px;font-weight:700;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Contact JID</h4>
                                        <p id="active-chat-jid" style="margin:2px 0 0;font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                            <span id="typing-indicator" style="display:none;color:var(--primary);font-style:italic;">typing…</span>
                                            <span id="active-chat-jid-text">JID details</span>
                                        </p>
                                    </div>
                                </div>
                                <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                                    <button class="btn btn-ghost chat-header-btn" id="chat-search-toggle" title="Search in chat" onclick="toggleChatSearch()"><i class="fas fa-search"></i></button>
                                    <button class="btn btn-ghost chat-header-btn" title="Contact / Group Info" onclick="openChatInfoDrawer()"><i class="fas fa-info-circle"></i></button>
                                </div>
                            </div>

                            <div id="chat-search-bar" style="display:none;padding:8px 16px;background:var(--bg-card);border-bottom:1px solid var(--border-color);">
                                <div class="search-box-wrapper" style="width:100%;">
                                    <i class="fas fa-search search-icon"></i>
                                    <input type="text" id="in-chat-search-input" class="chat-search-input" placeholder="Search in this conversation…" oninput="searchInActiveChat()">
                                    <button onclick="closeChatSearch()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;"><i class="fas fa-times"></i></button>
                                    <span id="chat-search-count" style="font-size:12px;color:var(--text-muted);margin-left:4px;white-space:nowrap;"></span>
                                </div>
                            </div>

                            <div class="chat-thread-messages" id="chat-thread-messages"></div>

                            <div id="reply-preview-bar" style="display:none;padding:8px 16px;background:var(--bg-card);border-top:1px solid var(--border-color);">
                                <div style="display:flex;align-items:center;gap:10px;background:var(--bg-input);border-left:3px solid var(--primary);border-radius:6px;padding:8px 12px;">
                                    <div style="flex:1;min-width:0;">
                                        <div style="font-size:11px;font-weight:700;color:var(--primary);margin-bottom:2px;" id="reply-sender-name"></div>
                                        <div style="font-size:13px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" id="reply-preview-text"></div>
                                    </div>
                                    <button onclick="cancelReply()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">&times;</button>
                                </div>
                            </div>

                            <div class="chat-thread-footer">
                                <div id="emoji-picker" class="emoji-picker" style="display:none;"></div>
                                <form id="chat-message-form" class="chat-message-form" onsubmit="sendChatMessage(event)">
                                    <button type="button" class="chat-icon-btn" title="Emoji" onclick="toggleEmojiPicker(event)"><i class="far fa-smile"></i></button>
                                    <label class="chat-icon-btn" title="Attach file">
                                        <i class="fas fa-paperclip"></i>
                                        <input type="file" id="chat-file-input" style="display:none;" onchange="sendFileMessage(this)">
                                    </label>
                                    <input type="text" id="chat-message-input" class="chat-message-input" placeholder="Type a message…" autocomplete="off">
                                    <button type="submit" class="chat-send-btn" title="Send"><i class="fas fa-paper-plane"></i></button>
                                </form>
                            </div>
                        </div>

                        <!-- Right Sidebar: Contact & Group Info Drawer -->
                        <div class="chat-info-drawer" id="chat-info-drawer" style="display:none;">
                            <div class="drawer-header">
                                <h4>Contact Info</h4>
                                <button class="btn btn-ghost btn-sm" onclick="closeChatInfoDrawer()"><i class="fas fa-times"></i></button>
                            </div>
                            <div class="drawer-body" id="drawer-body-content">
                                <div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading info…</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="tab-moderation" class="tab-panel">

                <!-- Hero Header -->
                <div class="mod-hero">
                    <div class="mod-hero-left">
                        <div class="mod-hero-icon"><i class="fas fa-shield-alt"></i></div>
                        <div>
                            <h2 class="mod-hero-title">Group Moderation Engine</h2>
                            <p class="mod-hero-sub">Group defender &middot; Rules enforcement &middot; Anti-raid shield &middot; Automated moderation</p>
                        </div>
                    </div>
                    <div class="mod-hero-controls">
                        <div class="mod-toggle-row">
                            <span class="mod-toggle-label"><i class="fas fa-globe"></i> Global</span>
                            <label class="mod-toggle-switch">
                                <input type="checkbox" id="mod-global-toggle" onchange="toggleGlobalModeration(this.checked)">
                                <span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span>
                            </label>
                        </div>
                        <div class="mod-group-picker">
                            <i class="fas fa-users" style="color:var(--text-muted);font-size:13px;"></i>
                            <select id="mod-group-select" class="mod-select" onchange="selectModerationGroup(this.value)">
                                <option value="">Select a group…</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Group Settings Card -->
                <div id="mod-group-content" class="card mod-settings-card">
                    <!-- Card Header -->
                    <div class="mod-card-header">
                        <div class="mod-card-title-row">
                            <h3 id="mod-active-group-title" class="mod-card-title"><i class="fas fa-users-cog"></i> Group Settings</h3>
                            <div class="mod-toggle-row">
                                <span class="mod-toggle-label">Enable for this group</span>
                                <label class="mod-toggle-switch">
                                    <input type="checkbox" id="mod-group-toggle" onchange="toggleGroupModeration(this.checked)">
                                    <span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span>
                                </label>
                            </div>
                        </div>
                        <!-- Subtab Pills -->
                        <div class="mod-subtab-bar">
                            <button class="mod-pill active" data-subtab="rules" onclick="switchModSubTab('rules')"><i class="fas fa-scroll"></i> Rules</button>
                            <button class="mod-pill" data-subtab="greetings" onclick="switchModSubTab('greetings')"><i class="fas fa-hand-wave"></i> Greetings</button>
                            <button class="mod-pill" data-subtab="warnings" onclick="switchModSubTab('warnings')"><i class="fas fa-exclamation-triangle"></i> Warnings</button>
                            <button class="mod-pill" data-subtab="locks" onclick="switchModSubTab('locks')"><i class="fas fa-lock"></i> Locks</button>
                            <button class="mod-pill" data-subtab="blacklist" onclick="switchModSubTab('blacklist')"><i class="fas fa-ban"></i> Blacklist</button>
                            <button class="mod-pill" data-subtab="filters" onclick="switchModSubTab('filters')"><i class="fas fa-robot"></i> Filters</button>
                            <button class="mod-pill" data-subtab="antispam" onclick="switchModSubTab('antispam')"><i class="fas fa-bolt"></i> Anti-Spam</button>
                            <button class="mod-pill" data-subtab="federation" onclick="switchModSubTab('federation')"><i class="fas fa-network-wired"></i> Federation</button>
                            <button class="mod-pill" data-subtab="ai" onclick="switchModSubTab('ai')"><i class="fas fa-brain"></i> Gemini AI</button>
                            <button class="mod-pill" data-subtab="migration" onclick="switchModSubTab('migration')"><i class="fas fa-file-export"></i> Import/Export</button>
                        </div>
                    </div>

                    <!-- RULES -->
                    <div id="mod-subpanel-rules" class="mod-subpanel">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-primary"><i class="fas fa-scroll"></i></div>
                            <div><div class="mod-feature-title">Group Rules</div><div class="mod-feature-desc">Define and auto-post rules when new members join.</div></div>
                        </div>
                        <textarea id="mod-rules-text" class="mod-textarea" placeholder="1. Be respectful&#10;2. No spam&#10;3. No NSFW content"></textarea>
                        <div class="mod-option-row">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-rules-show-on-join"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label">Auto-post rules when a new member joins</span>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupRules()"><i class="fas fa-save"></i> Save Rules</button></div>
                    </div>

                    <!-- GREETINGS -->
                    <div id="mod-subpanel-greetings" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-info"><i class="fas fa-hand-wave"></i></div>
                            <div><div class="mod-feature-title">Greetings &amp; Captcha</div><div class="mod-feature-desc">Welcome and farewell messages plus join verification.</div></div>
                        </div>
                        <div class="mod-two-col">
                            <div class="mod-feature-block">
                                <div class="mod-block-label"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-welcome-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span>Welcome Message</span></div>
                                <input type="text" id="mod-welcome-msg" class="mod-input" placeholder="Welcome {user} to {group}!">
                            </div>
                            <div class="mod-feature-block">
                                <div class="mod-block-label"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-goodbye-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span>Goodbye Message</span></div>
                                <input type="text" id="mod-goodbye-msg" class="mod-input" placeholder="Goodbye {user}!">
                            </div>
                        </div>
                        <div class="mod-divider"></div>
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-warning"><i class="fas fa-shield-check"></i></div>
                            <div><div class="mod-feature-title">Join Captcha Verification</div><div class="mod-feature-desc">Challenge new members before they can post.</div></div>
                        </div>
                        <div class="mod-inline-controls">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-captcha-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label">Require captcha on join</span>
                            <select id="mod-captcha-mode" class="mod-select mod-select-sm"><option value="button">Button challenge</option><option value="math">Math problem</option></select>
                            <div class="mod-number-group"><input type="number" id="mod-captcha-timeout" class="mod-number-input" value="120" min="30" max="600"><span class="mod-number-unit">s timeout</span></div>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupGreetings()"><i class="fas fa-save"></i> Save Greetings &amp; Captcha</button></div>
                    </div>

                    <!-- WARNINGS -->
                    <div id="mod-subpanel-warnings" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-warning"><i class="fas fa-exclamation-triangle"></i></div>
                            <div><div class="mod-feature-title">Warning System</div><div class="mod-feature-desc">Issue warnings and auto-punish repeat offenders.</div></div>
                        </div>
                        <div class="mod-inline-controls">
                            <div class="mod-number-group"><span class="mod-number-unit">Max warnings</span><input type="number" id="mod-max-warns" class="mod-number-input" value="3" min="1" max="20"></div>
                            <div class="mod-field-group"><label class="mod-field-label">Penalty after max</label><select id="mod-warn-action" class="mod-select mod-select-sm"><option value="mute">Mute User</option><option value="kick">Kick User</option><option value="ban">Ban User</option></select></div>
                            <button class="btn btn-primary btn-sm" onclick="saveGroupWarnings()"><i class="fas fa-save"></i> Save</button>
                        </div>
                        <div class="mod-divider"></div>
                        <p class="mod-section-label"><i class="fas fa-list-ul"></i> Active Warnings</p>
                        <div id="mod-warns-list" class="mod-list-container"><div class="empty-state">No active user warnings</div></div>
                    </div>

                    <!-- LOCKS -->
                    <div id="mod-subpanel-locks" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-lock"></i></div>
                            <div><div class="mod-feature-title">Content Locks</div><div class="mod-feature-desc">Prevent specific content types from being posted.</div></div>
                        </div>
                        <div class="mod-lock-grid">
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-image"></i></div><span>Images</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-image"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-video"></i></div><span>Videos</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-video"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-microphone"></i></div><span>Voice</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-audio"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-file-alt"></i></div><span>Documents</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-document"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-sticky-note"></i></div><span>Stickers</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-sticker"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-link"></i></div><span>URLs</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-url"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-user-plus"></i></div><span>Invites</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-invite"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-poll"></i></div><span>Polls</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-poll"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-language"></i></div><span>RTL Text</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-rtl"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupLocks()"><i class="fas fa-save"></i> Save Locks</button></div>
                    </div>

                    <!-- BLACKLIST -->
                    <div id="mod-subpanel-blacklist" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-ban"></i></div>
                            <div><div class="mod-feature-title">Word &amp; Pattern Blacklist</div><div class="mod-feature-desc">Auto-delete messages containing blocked words or regex patterns.</div></div>
                        </div>
                        <div class="mod-add-row">
                            <input type="text" id="mod-blacklist-new" class="mod-input mod-input-flex" placeholder="Add word or /regex/ pattern…">
                            <button class="btn btn-secondary btn-sm" onclick="addBlacklistWord()"><i class="fas fa-plus"></i> Add</button>
                        </div>
                        <div id="mod-blacklist-tags" class="mod-tag-cloud"></div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupBlacklist()"><i class="fas fa-save"></i> Save Blacklist</button></div>
                    </div>

                    <!-- FILTERS -->
                    <div id="mod-subpanel-filters" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-info"><i class="fas fa-robot"></i></div>
                            <div><div class="mod-feature-title">Auto-Responder Filters</div><div class="mod-feature-desc">Trigger automatic replies on specific keywords.</div></div>
                        </div>
                        <div class="mod-two-col mod-two-col-tight">
                            <input type="text" id="mod-filter-trigger" class="mod-input" placeholder="Trigger (e.g. !help)">
                            <input type="text" id="mod-filter-response" class="mod-input" placeholder="Response text">
                        </div>
                        <div class="mod-actions mod-actions-split">
                            <button class="btn btn-secondary btn-sm" onclick="addFilterRule()"><i class="fas fa-plus"></i> Add Rule</button>
                            <button class="btn btn-primary btn-sm" onclick="saveGroupFilters()"><i class="fas fa-save"></i> Save Filters</button>
                        </div>
                        <div id="mod-filters-list" class="mod-list-container"></div>
                    </div>

                    <!-- ANTI-SPAM -->
                    <div id="mod-subpanel-antispam" class="mod-subpanel" style="display:none;">
                        <div class="mod-two-col">
                            <div class="mod-feature-block mod-feature-block-full">
                                <div class="mod-feature-header">
                                    <div class="mod-feature-icon-wrap mod-color-warning"><i class="fas fa-bolt"></i></div>
                                    <div><div class="mod-feature-title">Flood Protection</div><div class="mod-feature-desc">Mute users sending too many messages too fast.</div></div>
                                </div>
                                <div class="mod-option-row"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-flood-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Enable flood protection</span></div>
                                <div class="mod-rate-row"><span class="mod-rate-label">Max</span><input type="number" id="mod-flood-max" class="mod-number-input" value="5" min="1" max="100"><span class="mod-rate-label">messages in</span><input type="number" id="mod-flood-win" class="mod-number-input" value="5" min="1" max="300"><span class="mod-rate-label">seconds</span></div>
                            </div>
                            <div class="mod-feature-block mod-feature-block-full">
                                <div class="mod-feature-header">
                                    <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-shield-alt"></i></div>
                                    <div><div class="mod-feature-title">Anti-Raid Shield</div><div class="mod-feature-desc">Lock group when too many users join in short time.</div></div>
                                </div>
                                <div class="mod-option-row"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-antiraid-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Enable anti-raid shield</span></div>
                                <div class="mod-rate-row"><span class="mod-rate-label">Max</span><input type="number" id="mod-antiraid-max" class="mod-number-input" value="5" min="1" max="100"><span class="mod-rate-label">joins in</span><input type="number" id="mod-antiraid-win" class="mod-number-input" value="10" min="1" max="300"><span class="mod-rate-label">seconds</span></div>
                            </div>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupAntispam()"><i class="fas fa-save"></i> Save Anti-Spam Config</button></div>
                    </div>

                    <!-- FEDERATION -->
                    <div id="mod-subpanel-federation" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-info"><i class="fas fa-network-wired"></i></div>
                            <div><div class="mod-feature-title">Ban Federation</div><div class="mod-feature-desc">Sync global ban lists across a cluster of groups.</div></div>
                        </div>
                        <div class="mod-field-group" style="max-width:400px;">
                            <label class="mod-field-label">Active Federation</label>
                            <select id="mod-fed-select" class="mod-select"><option value="">No Federation Joined</option><option value="fed_global_default">Global Default Federation</option></select>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupFederation()"><i class="fas fa-save"></i> Save Federation Link</button></div>
                    </div>

                    <!-- GEMINI AI -->
                    <div id="mod-subpanel-ai" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap" style="background:linear-gradient(135deg,rgba(0,168,132,0.2),rgba(52,152,219,0.2));color:var(--primary);"><i class="fas fa-brain"></i></div>
                            <div><div class="mod-feature-title">Gemini AI Assistant</div><div class="mod-feature-desc">Let AI help moderate the group and answer member questions.</div></div>
                        </div>
                        <div class="mod-option-row" style="margin-bottom:10px;"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-ai-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Enable Gemini AI assistance</span></div>
                        <div class="mod-option-row" style="margin-bottom:16px;"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-ai-faq"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Auto-reply to group FAQs</span></div>
                        <div class="mod-field-group"><label class="mod-field-label">AI System Prompt</label><textarea id="mod-ai-prompt" class="mod-textarea" style="height:100px;" placeholder="You are a helpful group moderator AI assistant."></textarea></div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupAiConfig()"><i class="fas fa-save"></i> Save AI Config</button></div>
                    </div>

                    <!-- IMPORT / EXPORT -->
                    <div id="mod-subpanel-migration" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap" style="background:rgba(100,100,120,0.15);color:var(--text-muted);"><i class="fas fa-file-export"></i></div>
                            <div><div class="mod-feature-title">Import / Export Config</div><div class="mod-feature-desc">Back up or restore this group's full moderation settings as JSON.</div></div>
                        </div>
                        <div class="mod-actions mod-actions-split" style="margin-bottom:20px;"><button class="btn btn-secondary btn-sm" onclick="exportGroupModerationConfig()"><i class="fas fa-download"></i> Export Group Config (JSON)</button></div>
                        <div class="mod-divider"></div>
                        <div class="mod-field-group"><label class="mod-field-label">Import JSON Configuration</label><textarea id="mod-import-text" class="mod-textarea" style="height:100px;" placeholder="Paste moderation JSON configuration here…"></textarea></div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="importGroupModerationConfig()"><i class="fas fa-upload"></i> Import Config</button></div>
                    </div>

                </div>
            </section>

            <footer class="footer-info">
                WhatsApp Gateway &bull; Session: <strong id="footer-session-id" style="color:var(--text-main);">...</strong> (<span id="footer-session-status">...</span>)
            </footer>
        </div>
    </main>
  </div>

  <div id="toast-container" class="toast-container"></div>

  <div class="modal-overlay" id="confirm-modal">
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="modal-title">Confirm Action</h3>
        <button class="modal-close-btn" id="modal-close"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <p id="modal-message">Are you sure you want to proceed?</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" id="modal-cancel-btn">Cancel</button>
        <button class="btn btn-danger btn-sm" id="modal-confirm-btn">Confirm</button>
      </div>
    </div>
  </div>

  <!-- Version Update Modal Dialog -->
  <div class="modal-overlay" id="version-update-modal">
    <div class="modal-card modal-lg">
      <div class="modal-header">
        <h3><i class="fas fa-arrow-alt-circle-up" style="color:var(--primary);margin-right:8px;"></i> <span id="update-modal-title">Update Information</span></h3>
        <button class="modal-close-btn" onclick="closeUpdateModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <div class="update-version-banner">
          <div class="ver-pill ver-current">Current: <strong id="update-curr-ver">...</strong></div>
          <i class="fas fa-arrow-right ver-arrow"></i>
          <div class="ver-pill ver-new" id="update-new-ver-pill">Latest: <strong id="update-new-ver">...</strong></div>
        </div>

        <div class="update-rationale-box">
          <i class="fas fa-shield-alt rationale-icon"></i>
          <div>
            <strong>Why should you keep your software updated?</strong>
            <p>Updates provide critical security patches, stability improvements, and protocol compatibility updates for WhatsApp Web (Baileys) and Home Assistant.</p>
          </div>
        </div>

        <div class="changelog-container">
          <div class="changelog-title"><i class="fas fa-list-ul"></i> Changelog / Release Notes</div>
          <div id="update-changelog-content" class="changelog-body">Loading changelog...</div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary btn-sm" onclick="closeUpdateModal()">Close</button>
        <a id="update-action-btn" href="#" target="_top" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Update Now</a>
      </div>
    </div>
  </div>

  <!-- Dependency Info Modal Dialog -->
  <div class="modal-overlay" id="dependency-info-modal">
    <div class="modal-card modal-lg">
      <div class="modal-header">
        <h3><i class="fas fa-cubes" style="color:var(--primary);margin-right:8px;"></i> <span id="dep-modal-title">Package Dependency</span></h3>
        <button class="modal-close-btn" onclick="closeDependencyModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <div class="update-version-banner">
          <div class="ver-pill ver-current">Installed: <strong id="dep-curr-ver">...</strong></div>
          <i class="fas fa-arrow-right ver-arrow"></i>
          <div class="ver-pill ver-new" id="dep-addon-status-pill">Addon Status: <strong id="dep-addon-status">...</strong></div>
        </div>

        <div class="update-rationale-box" id="dep-rationale-box">
          <i class="fas fa-info-circle rationale-icon" id="dep-rationale-icon"></i>
          <div>
            <strong id="dep-rationale-title">Bundled Dependency</strong>
            <p id="dep-rationale-desc">This component is bundled and managed directly inside the WhatsApp Addon image.</p>
          </div>
        </div>

        <div class="dep-details-grid">
          <div class="dep-detail-card">
            <span class="dep-detail-label">Role in Gateway</span>
            <span class="dep-detail-val" id="dep-role-desc">Core engine component</span>
          </div>
          <div class="dep-detail-card">
            <span class="dep-detail-label">Update Pipeline</span>
            <span class="dep-detail-val">Ships with Addon Releases</span>
          </div>
        </div>

        <p style="font-size:13px; color:var(--text-main); line-height:1.5; margin-top:12px;">
          Dependencies are regularly updated to ensure maximum security, protocol compatibility, and performance. If an addon update is pending, installing it will automatically upgrade this dependency.
        </p>
      </div>
      <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <div style="display:flex; gap:8px;">
          <a id="dep-repo-btn" href="#" target="_blank" class="btn btn-secondary btn-sm"><i class="fab fa-github"></i> Official Repo</a>
          <a id="dep-releases-btn" href="#" target="_blank" class="btn btn-secondary btn-sm"><i class="fas fa-tags"></i> Release Notes</a>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="closeDependencyModal()">Close</button>
          <a id="dep-action-btn" href="https://github.com/FaserF/hassio-addons/issues/new?template=bug_report.yml" target="_blank" class="btn btn-primary btn-sm"><i class="fas fa-exclamation-circle"></i> Open Issue</a>
        </div>
      </div>
    </div>
  </div>
  <!-- System Properties Overview Modal Dialog -->
  <div class="modal-overlay" id="system-properties-modal">
    <div class="modal-card modal-lg">
      <div class="modal-header">
        <h3><i class="fas fa-microchip" style="color:var(--primary);margin-right:8px;"></i> System Properties Overview</h3>
        <button class="modal-close-btn" onclick="closeSystemPropertiesModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <div class="dep-details-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          <div class="dep-detail-card" style="cursor:pointer;" onclick="closeSystemPropertiesModal(); openUpdateModal('addon');">
            <span class="dep-detail-label">Addon Version</span>
            <span class="dep-detail-val" id="sys-modal-addon">...</span>
          </div>
          <div class="dep-detail-card" style="cursor:pointer;" onclick="closeSystemPropertiesModal(); openUpdateModal('integration');">
            <span class="dep-detail-label">Integration Version</span>
            <span class="dep-detail-val" id="sys-modal-int">...</span>
          </div>
          <div class="dep-detail-card" style="cursor:pointer;" onclick="closeSystemPropertiesModal(); openDependencyModal('Baileys');">
            <span class="dep-detail-label">Baileys Library</span>
            <span class="dep-detail-val" id="sys-modal-baileys">...</span>
          </div>
          <div class="dep-detail-card" style="cursor:pointer;" onclick="closeSystemPropertiesModal(); openDependencyModal('Node.js');">
            <span class="dep-detail-label">Node.js Engine</span>
            <span class="dep-detail-val" id="sys-modal-node">...</span>
          </div>
          <div class="dep-detail-card" style="cursor:pointer;" onclick="closeSystemPropertiesModal(); openDependencyModal('Express');">
            <span class="dep-detail-label">Express Framework</span>
            <span class="dep-detail-val" id="sys-modal-express">...</span>
          </div>
          <div class="dep-detail-card" style="cursor:pointer;" onclick="closeSystemPropertiesModal(); openDependencyModal('Alpine Linux');">
            <span class="dep-detail-label">Alpine Base OS</span>
            <span class="dep-detail-val" id="sys-modal-alpine">...</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary btn-sm" onclick="closeSystemPropertiesModal()">Close</button>
      </div>
    </div>
  </div>

  <!-- New Chat Modal Dialog -->
  <div class="modal-overlay" id="new-chat-modal">
    <div class="modal-card">
      <div class="modal-header">
        <h3><i class="fas fa-comment-medical" style="color:var(--primary);margin-right:8px;"></i> Start New Chat</h3>
        <button class="modal-close-btn" onclick="closeNewChatModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <form onsubmit="startNewChatSubmit(event)">
          <div class="form-group" style="margin-bottom:16px;">
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px;">Phone Number or Chat JID</label>
            <input type="text" id="new-chat-number" class="chat-message-input" placeholder="e.g. 4917612345678 or 4917612345678@s.whatsapp.net" style="width:100%;border:1px solid var(--border-color);padding:10px 14px;border-radius:8px;background:var(--bg-input);" required>
            <p style="font-size:11px;color:var(--text-muted);margin-top:6px;">Include country code without + or spaces (e.g. 49... for Germany).</p>
          </div>
          <div class="modal-footer" style="margin-top:16px;padding:0;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="closeNewChatModal()">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm"><i class="fas fa-paper-plane"></i> Open Chat</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Context Menu & Reaction Picker -->
  <div id="msg-context-menu" class="msg-context-menu" style="display:none;">
      <div class="ctx-reactions-row" style="display:flex;gap:6px;padding:4px 8px;border-bottom:1px solid var(--border-color);margin-bottom:4px;justify-content:space-between;">
          <span onclick="sendReaction('👍')" style="cursor:pointer;font-size:18px;transition:transform 0.15s;" onmouseenter="this.style.transform='scale(1.3)'" onmouseleave="this.style.transform='scale(1)'">👍</span>
          <span onclick="sendReaction('❤️')" style="cursor:pointer;font-size:18px;transition:transform 0.15s;" onmouseenter="this.style.transform='scale(1.3)'" onmouseleave="this.style.transform='scale(1)'">❤️</span>
          <span onclick="sendReaction('😂')" style="cursor:pointer;font-size:18px;transition:transform 0.15s;" onmouseenter="this.style.transform='scale(1.3)'" onmouseleave="this.style.transform='scale(1)'">😂</span>
          <span onclick="sendReaction('😮')" style="cursor:pointer;font-size:18px;transition:transform 0.15s;" onmouseenter="this.style.transform='scale(1.3)'" onmouseleave="this.style.transform='scale(1)'">😮</span>
          <span onclick="sendReaction('😢')" style="cursor:pointer;font-size:18px;transition:transform 0.15s;" onmouseenter="this.style.transform='scale(1.3)'" onmouseleave="this.style.transform='scale(1)'">😢</span>
          <span onclick="sendReaction('🙏')" style="cursor:pointer;font-size:18px;transition:transform 0.15s;" onmouseenter="this.style.transform='scale(1.3)'" onmouseleave="this.style.transform='scale(1)'">🙏</span>
      </div>
      <button onclick="sendReaction('')" style="color:var(--text-muted);"><i class="fas fa-ban"></i> Remove Reaction</button>
      <button onclick="ctxReact(event)"><i class="far fa-smile"></i> More Reactions</button>
      <button onclick="ctxReply()"><i class="fas fa-reply"></i> Reply</button>
      <button onclick="ctxCopy()"><i class="fas fa-copy"></i> Copy</button>
      <button onclick="ctxForward()"><i class="fas fa-share"></i> Forward</button>
      <hr style="border-color:var(--border-color);margin:4px 0;">
      <button onclick="ctxDelete()" style="color:var(--danger);"><i class="fas fa-trash"></i> Delete for me</button>
  </div>

  <div id="reaction-picker" class="reaction-picker" style="display:none;">
      <span onclick="sendReaction('👍')">👍</span>
      <span onclick="sendReaction('❤️')">❤️</span>
      <span onclick="sendReaction('😂')">😂</span>
      <span onclick="sendReaction('😮')">😮</span>
      <span onclick="sendReaction('😢')">😢</span>
      <span onclick="sendReaction('🙏')">🙏</span>
  </div>

  <script>
    var currentSession = ${JSON.stringify(sessionId)};
    var apiToken = ${JSON.stringify(API_TOKEN)};
    var isConnected = false;
    var lastLogText = '';
    var activeChatJid = null;
    var allChats = [];
    var isChatTabActive = false;

    const getBasePath = () => {
        try {
            let path = window.location.pathname.replace(/#.*$/, '');
            if (!path.endsWith('/')) {
                path += '/';
            }
            return path;
        } catch (e) {
            return '/';
        }
    };
    var basePath = getBasePath();

    ${fs.readFileSync(path.join(uiDir, 'helpers.js'), 'utf8')}
    ${fs.readFileSync(path.join(uiDir, 'dashboard.js'), 'utf8')}
    ${fs.readFileSync(path.join(uiDir, 'chat.js'), 'utf8')}

    const navItems = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(item => {
        if (item.getAttribute('data-tab')) {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.getAttribute('data-tab');
                switchTab(tab);
            });
        }
    });

    function switchTab(tabId) {
        navItems.forEach(nav => nav.classList.remove('active'));
        tabPanels.forEach(panel => panel.classList.remove('active'));
        
        const activeNav = document.querySelector('.nav-item[data-tab="' + tabId + '"]');
        const activePanel = document.getElementById('tab-' + tabId);
        
        if (activeNav && activePanel) {
            activeNav.classList.add('active');
            activePanel.classList.add('active');
            if (pageTitle) pageTitle.innerText = tabId.charAt(0).toUpperCase() + tabId.slice(1);
        }

        isChatTabActive = (tabId === 'chats');
        if (isChatTabActive) {
            loadChats();
        } else if (tabId === 'moderation') {
            loadModerationConfig();
        } else {
            document.body.classList.remove('chat-open');
        }
    }
    window.switchTab = switchTab;

    function showSystemPropertiesModal() {
        const data = window._latestReleaseData || {};
        const modal = document.getElementById('system-properties-modal');
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val || 'N/A';
        };
        setVal('sys-modal-addon', data.addonVersion);
        setVal('sys-modal-int', data.integrationVersion);
        setVal('sys-modal-baileys', data.baileysVersion);
        setVal('sys-modal-node', data.nodeVersion);
        setVal('sys-modal-express', data.expressVersion);
        setVal('sys-modal-alpine', data.alpineVersion);

        if (modal) modal.classList.add('show');
    }
    function closeSystemPropertiesModal() {
        const modal = document.getElementById('system-properties-modal');
        if (modal) modal.classList.remove('show');
    }
    window.showSystemPropertiesModal = showSystemPropertiesModal;
    window.closeSystemPropertiesModal = closeSystemPropertiesModal;

    function toggleSidebar(e) {
        if (e) {
            try {
                if (typeof e.preventDefault === 'function') e.preventDefault();
                if (typeof e.stopPropagation === 'function') e.stopPropagation();
            } catch (err) {}
        }
        var sb = document.querySelector('.sidebar');
        if (!sb) return;
        var isCollapsed = sb.classList.toggle('collapsed');
        if (isCollapsed) {
            sb.style.setProperty('width', '72px', 'important');
            sb.style.setProperty('min-width', '72px', 'important');
            sb.style.setProperty('max-width', '72px', 'important');
        } else {
            sb.style.removeProperty('width');
            sb.style.removeProperty('min-width');
            sb.style.removeProperty('max-width');
        }
        try {
            localStorage.setItem('sidebarCollapsed', isCollapsed ? '1' : '0');
        } catch (err) {}
    }
    window.toggleSidebar = toggleSidebar;

    document.addEventListener('click', function (e) {
        var target = e.target;
        if (target && (target.id === 'sidebar-toggle-btn' || (target.closest && target.closest('#sidebar-toggle-btn')))) {
            toggleSidebar(e);
        }
        if (target && target.classList && target.classList.contains('modal-overlay')) {
            if (target.id === 'confirm-modal' && typeof closeConfirm === 'function') {
                closeConfirm(false);
            } else {
                target.classList.remove('show');
            }
        }
    });

    // Restore sidebar state from last visit (default: expanded)
    var sidebar = document.querySelector('.sidebar');
    try {
        if (sidebar && localStorage.getItem('sidebarCollapsed') === '1') {
            sidebar.classList.add('collapsed');
            sidebar.style.width = '72px';
        }
    } catch (e) {}

    function updateRawLogsLink() {
        const rawLogsLink = document.getElementById('raw-logs-link');
        if (rawLogsLink) {
            const cleanBase = basePath.endsWith('/') ? basePath : basePath + '/';
            rawLogsLink.href = cleanBase + 'logs?session_id=' + encodeURIComponent(currentSession);
        }
    }
    window.updateRawLogsLink = updateRawLogsLink;

    const diagBasepath = document.getElementById('diag-basepath');
    const diagPathname = document.getElementById('diag-pathname');
    if (diagBasepath) diagBasepath.textContent = basePath;
    if (diagPathname) diagPathname.textContent = window.location.pathname;
    updateRawLogsLink();

    updateDashboard();
    setInterval(updateDashboard, 10000);
    setInterval(() => {
        if (typeof loadLogs === 'function') loadLogs();
    }, 5000);
    setInterval(() => {
        if (isChatTabActive) {
            loadChats();
            if (activeChatJid) {
                loadChatMessages(activeChatJid);
            }
        }
    }, 8000);
  </script>
</body>
</html>`;
}
