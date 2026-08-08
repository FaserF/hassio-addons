import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { uiAuthMiddleware } from '../../middleware.js';
import { getSession, sanitizeSessionId, sessions, signalInterest } from '../../session.js';
import { API_TOKEN, PORT, DATA_DIR } from '../../config.js';
import { connectToWhatsApp } from '../../whatsapp/connection.js';

import dashboardView from './views/dashboard.html.js';
import logsView from './views/logs.html.js';
import chatsView from './views/chats.html.js';
import moderationView from './views/moderation.html.js';
import telegramView from './views/telegram.html.js';

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

export function renderDashboard(sessionId) {
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
    <link rel="stylesheet" href="ui-assets/styles/moderation.css">
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
            <button class="nav-item" data-tab="telegram" data-tooltip="Telegram Bridge" onclick="switchTab('telegram')">
                <i class="fab fa-telegram-plane nav-icon"></i>
                <span>Telegram Bridge</span>
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
                <div class="session-selector-container">
                    <span class="session-label">Session:</span>
                    <select id="session-select" class="session-select" onchange="switchSession(this.value)">
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

            ${dashboardView({ PORT, API_TOKEN, getLocalIP })}

            ${logsView()}

            ${chatsView()}

            ${moderationView()}

            ${telegramView()}

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
    ${fs
      .readdirSync(path.join(uiDir, 'dashboard'))
      .filter((f) => f.endsWith('.js'))
      .sort()
      .map((f) => fs.readFileSync(path.join(uiDir, 'dashboard', f), 'utf8'))
      .join('\n\n')}
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

    function _doSwitchTab(tabId) {
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
        } else if (tabId === 'telegram') {
            loadTelegramBridgeData();
        } else {
            document.body.classList.remove('chat-open');
        }
    }

    function switchTab(tabId) {
        // Check for unsaved moderation changes before switching away
        const guardFn = typeof _guardDirty === 'function' ? _guardDirty : null;
        if (guardFn && !guardFn(() => _doSwitchTab(tabId))) return;
        _doSwitchTab(tabId);
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
        if (target && target.classList && (target.classList.contains('modal-overlay') || target.classList.contains('modal'))) {
            if (target.id === 'confirm-modal' && typeof closeConfirm === 'function') {
                closeConfirm(false);
            } else if (target.id === 'tg-mapping-modal' && typeof closeTelegramMappingModal === 'function') {
                closeTelegramMappingModal();
            } else if (target.id === 'tg-bot-modal' && typeof closeTelegramBotModal === 'function') {
                closeTelegramBotModal();
            } else if (typeof target.style === 'object' && target.style.display && target.style.display !== 'none') {
                target.style.display = 'none';
            } else {
                target.classList.remove('show');
            }
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            var openModals = document.querySelectorAll('.modal-overlay.show, .modal-overlay[style*="display: block"], .modal-overlay[style*="display: flex"], .modal[style*="display: flex"], .modal[style*="display: block"]');
            openModals.forEach(function (m) {
                if (m.id === 'confirm-modal' && typeof closeConfirm === 'function') {
                    closeConfirm(false);
                } else if (m.id === 'tg-mapping-modal' && typeof closeTelegramMappingModal === 'function') {
                    closeTelegramMappingModal();
                } else if (m.id === 'tg-bot-modal' && typeof closeTelegramBotModal === 'function') {
                    closeTelegramBotModal();
                } else if (typeof m.style === 'object' && m.style.display && m.style.display !== 'none') {
                    m.style.display = 'none';
                } else {
                    m.classList.remove('show');
                }
            });
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
    // Ensure mouse-wheel always scrolls the content-body panel,
    // even in iFrame contexts where events may not propagate correctly
    (function() {
      const contentBody = document.querySelector('.content-body');
      if (!contentBody) return;
      document.addEventListener('wheel', function(e) {
        // Only forward if the event target is not already inside a scrollable child
        const target = e.target;
        let el = target;
        while (el && el !== contentBody) {
          const cs = getComputedStyle(el);
          const overflowY = cs.overflowY;
          const canScroll = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
          if (canScroll && el !== contentBody) return; // let the child scroll
          el = el.parentElement;
        }
        contentBody.scrollTop += e.deltaY;
        e.preventDefault();
      }, { passive: false });
    })();
  </script>
</body>
</html>`;
}
