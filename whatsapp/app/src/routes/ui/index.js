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
            <div class="logo">
                <i class="fab fa-whatsapp logo-icon"></i>
                <div class="logo-text">
                    <span class="logo-title">WhatsApp Gateway</span>
                    <span class="logo-subtitle" id="logo-subtitle">Home Assistant</span>
                </div>
            </div>
            <button class="sidebar-toggle-btn" id="sidebar-toggle-btn" title="Toggle sidebar" onclick="toggleSidebar()">
                <i class="fas fa-bars"></i>
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
                <a href="https://github.com/FaserF/hassio-addons/tree/master/whatsapp" target="_blank" class="sys-info-link">Addon: <span id="addon-version-sidebar" class="sys-info-val">...</span></a>
                <a href="https://github.com/FaserF/ha-whatsapp" target="_blank" class="sys-info-link">Integration: <span id="int-version-sidebar" class="sys-info-val">...</span></a>
                <a href="https://github.com/WhiskeySockets/Baileys" target="_blank" class="sys-info-link">Baileys: <span id="baileys-version" class="sys-info-val">...</span></a>
                <a href="https://github.com/nodejs/node" target="_blank" class="sys-info-link">Node: <span id="node-version" class="sys-info-val">...</span></a>
                <a href="https://github.com/expressjs/express" target="_blank" class="sys-info-link">Express: <span id="express-version" class="sys-info-val">...</span></a>
                <a href="https://alpinelinux.org" target="_blank" class="sys-info-link">Alpine: <span id="alpine-version" class="sys-info-val">...</span></a>
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
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <button class="btn btn-secondary" onclick="restartSession()"><i class="fas fa-sync-alt"></i> Restart Daemon</button>
                            <button class="btn btn-danger" onclick="logoutSession()"><i class="fas fa-sign-out-alt"></i> Hard Reset / Logout</button>
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
                            <p class="card-subtitle">Real-time socket events from the underlying WhatsApp daemon service.</p>
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
    let currentSession = ${JSON.stringify(sessionId)};
    const apiToken = ${JSON.stringify(API_TOKEN)};
    let isConnected = false;
    let lastLogText = '';
    let activeChatJid = null;
    let allChats = [];
    let isChatTabActive = false;

    const getBasePath = () => {
        try {
            // Remove hash/fragment or trailing slashes at the end for Ingress URLs
            let path = window.location.pathname.replace(/#.*$/, '');
            if (!path.endsWith('/')) {
                path += '/';
            }
            return path;
        } catch (e) {
            return '/';
        }
    };
    const basePath = getBasePath().replace(/[/]+/g, '/');
  </script>
  <script src="ui-assets/helpers.js"></script>
  <script src="ui-assets/dashboard.js"></script>
  <script src="ui-assets/chat.js"></script>
  <script>
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
        } else {
            document.body.classList.remove('chat-open');
        }
    }
    window.switchTab = switchTab;

    function showSystemPropertiesModal() {
        const badge = document.getElementById('sidebar-info-badge');
        const infoText = badge ? badge.getAttribute('data-tooltip') : 'System Information';
        alert('ℹ️ System Properties:\n\n' + infoText);
    }
    window.showSystemPropertiesModal = showSystemPropertiesModal;

    // ── Sidebar toggle ────────────────────────────────
    function toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;
        const isCollapsed = sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed ? '1' : '0');
    }
    window.toggleSidebar = toggleSidebar;

    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSidebar();
        });
    }

    // Restore sidebar state from last visit (default: expanded)
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && localStorage.getItem('sidebarCollapsed') === '1') {
        sidebar.classList.add('collapsed');
    }

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
    setInterval(loadLogs, 5000);
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
