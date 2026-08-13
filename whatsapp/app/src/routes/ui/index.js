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

import loginView from './views/login.html.js';

export function registerUIRoutes(app) {
  app.get('/login', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(loginView());
  });

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
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
    <link rel="stylesheet" href="ui-assets/styles.css">
    <link rel="stylesheet" href="ui-assets/styles/moderation.css">
</head>
<body>
  <div class="app-layout">
    <aside class="sidebar">
        <div class="sidebar-header">
            <div class="logo">
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
                <span data-i18n="nav.status">Dashboard</span>
            </button>
            <button class="nav-item" data-tab="logs" data-tooltip="Daemon Logs" onclick="switchTab('logs')">
                <i class="fas fa-terminal nav-icon"></i>
                <span data-i18n="nav.logs">Daemon Logs</span>
            </button>
            <button class="nav-item" data-tab="chats" data-tooltip="Chats" onclick="switchTab('chats')">
                <i class="fas fa-comments nav-icon"></i>
                <span data-i18n="nav.chats">Chats</span>
            </button>
            <button class="nav-item" data-tab="moderation" data-tooltip="Group Moderation" onclick="switchTab('moderation')">
                <i class="fas fa-shield-alt nav-icon"></i>
                <span data-i18n="nav.moderation">Moderation</span>
            </button>
            <button class="nav-item" data-tab="telegram" data-tooltip="Telegram Bridge" onclick="switchTab('telegram')">
                <i class="fab fa-telegram-plane nav-icon"></i>
                <span data-i18n="nav.telegram">Telegram Bridge</span>
            </button>
            <a href="https://faserf.github.io/ha-whatsapp/" target="_blank" class="nav-item" data-tooltip="Documentation">
                <i class="fas fa-book nav-icon"></i>
                <span data-i18n="nav.docs">Documentation</span>
            </a>
            <a href="https://github.com/FaserF/ha-whatsapp" target="_blank" class="nav-item" data-tooltip="Integration Repo">
                <i class="fas fa-puzzle-piece nav-icon"></i>
                <span data-i18n="shell.integration_repo">Integration Repo</span>
            </a>
            <a id="ha-repo-link" href="https://github.com/FaserF/hassio-addons" target="_blank" class="nav-item" data-tooltip="HA App Repo">
                <i class="fas fa-cubes nav-icon"></i>
                <span data-i18n="shell.ha_app_repo">HA App Repo</span>
            </a>
            <a id="raw-logs-link" href="#" target="_blank" class="nav-item" data-tooltip="Raw Connection Logs">
                <i class="fas fa-file-alt nav-icon"></i>
                <span data-i18n="shell.raw_connection_logs">Raw Connection Logs</span>
            </a>
            <a id="full-logs-link" href="#" target="_top" class="nav-item" style="display:none;" data-tooltip="Full System Logs">
                <i class="fas fa-file-invoice nav-icon"></i>
                <span data-i18n="shell.full_system_logs">Full System Logs</span>
            </a>
        </nav>
        
        <div class="sidebar-footer">
            <div class="sys-info-title" data-i18n="shell.system_properties">System Properties</div>
            <div class="sys-info-text">
                <a href="#" onclick="openUpdateModal('addon'); return false;" class="sys-info-link">Addon: <span id="addon-version-sidebar" class="sys-info-val">...</span><span id="addon-update-badge" class="update-badge" style="display:none;" title="Update Available!" data-i18n-title="shell.update_available">⚡ Update</span></a>
                <a href="#" onclick="openUpdateModal('integration'); return false;" class="sys-info-link">Integration: <span id="int-version-sidebar" class="sys-info-val">...</span><span id="int-update-badge" class="update-badge" style="display:none;" title="Update Available!" data-i18n-title="shell.update_available">⚡ Update</span></a>
                <a href="#" onclick="openDependencyModal('Baileys'); return false;" class="sys-info-link">Baileys: <span id="baileys-version" class="sys-info-val">...</span><span id="baileys-update-badge" class="update-badge dep-badge" style="display:none;" title="Updated via Addon update" data-i18n-title="shell.updated_via_addon">⚡ Info</span></a>
                <a href="#" onclick="openDependencyModal('Node.js'); return false;" class="sys-info-link">Node: <span id="node-version" class="sys-info-val">...</span><span id="node-update-badge" class="update-badge dep-badge" style="display:none;" title="Updated via Addon update" data-i18n-title="shell.updated_via_addon">⚡ Info</span></a>
                <a href="#" onclick="openDependencyModal('Express'); return false;" class="sys-info-link">Express: <span id="express-version" class="sys-info-val">...</span><span id="express-update-badge" class="update-badge dep-badge" style="display:none;" title="Updated via Addon update" data-i18n-title="shell.updated_via_addon">⚡ Info</span></a>
                <a href="#" onclick="openDependencyModal('Alpine Linux'); return false;" class="sys-info-link">Alpine: <span id="alpine-version" class="sys-info-val">...</span><span id="alpine-update-badge" class="update-badge dep-badge" style="display:none;" title="Updated via Addon update" data-i18n-title="shell.updated_via_addon">⚡ Info</span></a>
            </div>
            <div class="sidebar-info-badge" id="sidebar-info-badge" data-tooltip="System Info Loading..." title="Click for System Properties" data-i18n-title="shell.system_properties_title" onclick="showSystemPropertiesModal()">
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
                    <span class="session-label" data-i18n="shell.session_label">Session:</span>
                    <select id="session-select" class="session-select" onchange="switchSession(this.value)">
                        <option value="${escapeHtml(sessionId)}">${escapeHtml(sessionId)}</option>
                    </select>
                </div>
                <div class="language-selector-container" style="display:flex;align-items:center;gap:6px;">
                    <i class="fas fa-globe" style="color:var(--text-muted);font-size:14px;"></i>
                    <select id="language-select" class="session-select" style="min-width:85px;" onchange="setAppLanguage(this.value)">
                        <option value="de" data-i18n="languages.de">🇩🇪 DE</option>
                        <option value="en" data-i18n="languages.en">🇬🇧 EN</option>
                    </select>
                </div>
                <button id="theme-toggle" class="theme-toggle" title="Toggle Light/Dark Mode" data-i18n-title="shell.toggle_theme_title" onclick="toggleTheme()">🌓</button>
            </div>
        </header>

        <div class="content-body">
            <div id="dev-banner" class="banner banner-warning" style="display:none;">
                <i class="fas fa-exclamation-triangle banner-warning-icon"></i>
                <div>
                    <strong data-i18n="shell.dev_banner_title">Development / Beta Release Active</strong><br>
                    <span data-i18n="shell.dev_banner_desc">You are running a beta or edge version of the gateway. Some settings may behave experimentally.</span>
                </div>
            </div>

            <div id="passkey-banner" class="banner banner-warning" style="display:none;">
                <i class="fas fa-key banner-warning-icon"></i>
                <div>
                    <strong data-i18n="shell.passkey_req_title">WhatsApp Passkey Requirement Detected</strong><br>
                    <span data-i18n="shell.passkey_req_desc">Your account has passkeys active which restricts Baileys pairing. Open WhatsApp Settings &rarr; Account &rarr; Passkeys and remove them to pair this daemon. Click restart afterward.</span>
                </div>
            </div>

            ${dashboardView({ PORT, API_TOKEN, getLocalIP })}

            ${logsView()}

            ${chatsView()}

            ${moderationView()}

            ${telegramView()}

            <footer class="footer-info">
                <span data-i18n="shell.footer_gateway">WhatsApp Gateway</span> &bull; <span data-i18n="shell.session_label">Session:</span> <strong id="footer-session-id" style="color:var(--text-main);">...</strong> (<span id="footer-session-status">...</span>)
            </footer>
        </div>
    </main>
  </div>

  <div id="toast-container" class="toast-container"></div>

  <div class="modal-overlay" id="confirm-modal">
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="modal-title" data-i18n="shell.confirm_action">Confirm Action</h3>
        <button class="modal-close-btn" id="modal-close"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <p id="modal-message" data-i18n="shell.confirm_proceed">Are you sure you want to proceed?</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" id="modal-cancel-btn" data-i18n="common.cancel">Cancel</button>
        <button class="btn btn-danger btn-sm" id="modal-confirm-btn" data-i18n="common.confirm">Confirm</button>
      </div>
    </div>
  </div>

  <!-- Version Update Modal Dialog -->
  <div class="modal-overlay" id="version-update-modal">
    <div class="modal-card modal-lg">
      <div class="modal-header">
        <h3><i class="fas fa-arrow-alt-circle-up" style="color:var(--primary);margin-right:8px;"></i> <span id="update-modal-title" data-i18n="shell.update_info">Update Information</span></h3>
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
            <strong data-i18n="shell.why_keep_updated">Why should you keep your software updated?</strong>
            <p data-i18n="shell.why_keep_updated_desc">Updates provide critical security patches, stability improvements, and protocol compatibility updates for WhatsApp Web (Baileys) and Home Assistant.</p>
          </div>
        </div>

        <div class="changelog-container">
          <div class="changelog-title"><i class="fas fa-list-ul"></i> <span data-i18n="shell.changelog_title">Changelog / Release Notes</span></div>
          <div id="update-changelog-content" class="changelog-body" data-i18n="shell.loading_changelog">Loading changelog...</div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary btn-sm" onclick="closeUpdateModal()" data-i18n="common.close">Close</button>
        <a id="update-action-btn" href="#" target="_top" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> <span data-i18n="shell.update_now">Update Now</span></a>
      </div>
    </div>
  </div>

  <!-- Dependency Info Modal Dialog -->
  <div class="modal-overlay" id="dependency-info-modal">
    <div class="modal-card modal-lg">
      <div class="modal-header">
        <h3><i class="fas fa-cubes" style="color:var(--primary);margin-right:8px;"></i> <span id="dep-modal-title" data-i18n="shell.pkg_dependency">Package Dependency</span></h3>
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
            <strong id="dep-rationale-title" data-i18n="shell.bundled_dep">Bundled Dependency</strong>
            <p id="dep-rationale-desc" data-i18n="shell.bundled_dep_desc">This component is bundled and managed directly inside the WhatsApp Addon image.</p>
          </div>
        </div>

        <div class="dep-details-grid">
          <div class="dep-detail-card">
            <span class="dep-detail-label" data-i18n="shell.role_in_gateway">Role in Gateway</span>
            <span class="dep-detail-val" id="dep-role-desc">Core engine component</span>
          </div>
          <div class="dep-detail-card">
            <span class="dep-detail-label" data-i18n="shell.update_pipeline">Update Pipeline</span>
            <span class="dep-detail-val" data-i18n="shell.ships_with_addon">Ships with Addon Releases</span>
          </div>
        </div>

        <p style="font-size:13px; color:var(--text-main); line-height:1.5; margin-top:12px;" data-i18n="shell.dep_note">
          Dependencies are regularly updated to ensure maximum security, protocol compatibility, and performance. If an addon update is pending, installing it will automatically upgrade this dependency.
        </p>
      </div>
      <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <div style="display:flex; gap:8px;">
          <a id="dep-repo-btn" href="#" target="_blank" class="btn btn-secondary btn-sm"><i class="fab fa-github"></i> <span data-i18n="shell.official_repo">Official Repo</span></a>
          <a id="dep-releases-btn" href="#" target="_blank" class="btn btn-secondary btn-sm"><i class="fas fa-tags"></i> <span data-i18n="shell.release_notes">Release Notes</span></a>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="closeDependencyModal()" data-i18n="common.close">Close</button>
          <a id="dep-action-btn" href="https://github.com/FaserF/hassio-addons/issues/new?template=bug_report.yml" target="_blank" class="btn btn-primary btn-sm"><i class="fas fa-exclamation-circle"></i> <span data-i18n="shell.open_issue">Open Issue</span></a>
        </div>
      </div>
    </div>
  </div>
  <!-- System Properties Overview Modal Dialog -->
  <div class="modal-overlay" id="system-properties-modal">
    <div class="modal-card modal-lg">
      <div class="modal-header">
        <h3><i class="fas fa-microchip" style="color:var(--primary);margin-right:8px;"></i> <span data-i18n="shell.system_properties_overview">System Properties Overview</span></h3>
        <button class="modal-close-btn" onclick="closeSystemPropertiesModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <div class="dep-details-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          <div class="dep-detail-card" style="cursor:pointer;" onclick="closeSystemPropertiesModal(); openUpdateModal('addon');">
            <span class="dep-detail-label" data-i18n="shell.addon_version">Addon Version</span>
            <span class="dep-detail-val" id="sys-modal-addon">...</span>
          </div>
          <div class="dep-detail-card" style="cursor:pointer;" onclick="closeSystemPropertiesModal(); openUpdateModal('integration');">
            <span class="dep-detail-label" data-i18n="shell.int_version">Integration Version</span>
            <span class="dep-detail-val" id="sys-modal-int">...</span>
          </div>
          <div class="dep-detail-card" style="cursor:pointer;" onclick="closeSystemPropertiesModal(); openDependencyModal('Baileys');">
            <span class="dep-detail-label" data-i18n="shell.baileys_lib">Baileys Library</span>
            <span class="dep-detail-val" id="sys-modal-baileys">...</span>
          </div>
          <div class="dep-detail-card" style="cursor:pointer;" onclick="closeSystemPropertiesModal(); openDependencyModal('Node.js');">
            <span class="dep-detail-label" data-i18n="shell.node_engine">Node.js Engine</span>
            <span class="dep-detail-val" id="sys-modal-node">...</span>
          </div>
          <div class="dep-detail-card" style="cursor:pointer;" onclick="closeSystemPropertiesModal(); openDependencyModal('Express');">
            <span class="dep-detail-label" data-i18n="shell.express_framework">Express Framework</span>
            <span class="dep-detail-val" id="sys-modal-express">...</span>
          </div>
          <div class="dep-detail-card" style="cursor:pointer;" onclick="closeSystemPropertiesModal(); openDependencyModal('Alpine Linux');">
            <span class="dep-detail-label" data-i18n="shell.alpine_os">Alpine Base OS</span>
            <span class="dep-detail-val" id="sys-modal-alpine">...</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary btn-sm" onclick="closeSystemPropertiesModal()" data-i18n="common.close">Close</button>
      </div>
    </div>
  </div>

  <!-- New Chat / Create Group Modal Dialog -->
  <div class="modal-overlay" id="new-chat-modal">
    <div class="modal-card">
      <div class="modal-header">
        <h3><i class="fas fa-comment-medical" style="color:var(--primary);margin-right:8px;"></i> <span data-i18n="shell.new_conversation">New Conversation</span></h3>
        <button class="modal-close-btn" onclick="closeNewChatModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <!-- Mode Switcher Tabs -->
        <div style="display:flex;gap:8px;margin-bottom:18px;border-bottom:1px solid var(--border-color);padding-bottom:12px;">
          <button type="button" id="tab-btn-direct-chat" class="btn btn-primary btn-sm" onclick="switchNewChatTab('direct')" style="flex:1;">
            <i class="fas fa-user" style="margin-right:6px;"></i> <span data-i18n="shell.direct_chat">Direct Chat</span>
          </button>
          <button type="button" id="tab-btn-group-chat" class="btn btn-secondary btn-sm" onclick="switchNewChatTab('group')" style="flex:1;">
            <i class="fas fa-users" style="margin-right:6px;"></i> <span data-i18n="shell.create_group">Create Group</span>
          </button>
        </div>

        <!-- Mode 1: Direct Chat Form -->
        <form id="new-direct-chat-form" onsubmit="startNewChatSubmit(event)">
          <div class="form-group" style="margin-bottom:16px;">
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px;" data-i18n="shell.phone_or_jid">Phone Number or Chat JID</label>
            <input type="text" id="new-chat-number" class="chat-message-input" placeholder="e.g. 4917612345678 or 4917612345678@s.whatsapp.net" data-i18n-placeholder="shell.phone_or_jid_ph" style="width:100%;border:1px solid var(--border-color);padding:10px 14px;border-radius:8px;background:var(--bg-input);">
            <p style="font-size:11px;color:var(--text-muted);margin-top:6px;" data-i18n="shell.phone_hint">Include country code without + or spaces (e.g. 49... for Germany).</p>
          </div>
          <div class="modal-footer" style="margin-top:16px;padding:0;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="closeNewChatModal()" data-i18n="common.cancel">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm"><i class="fas fa-paper-plane"></i> <span data-i18n="shell.open_chat">Open Chat</span></button>
          </div>
        </form>

        <!-- Mode 2: Create Group Form -->
        <form id="new-group-chat-form" onsubmit="createNewGroupSubmit(event)" style="display:none;">
          <div class="form-group" style="margin-bottom:12px;">
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px;" data-i18n="shell.group_subject">Group Subject / Name</label>
            <input type="text" id="new-group-subject" class="chat-message-input" placeholder="e.g. Project Team Chat" data-i18n-placeholder="shell.group_subject_ph" style="width:100%;border:1px solid var(--border-color);padding:10px 14px;border-radius:8px;background:var(--bg-input);">
          </div>
          <div class="form-group" style="margin-bottom:16px;">
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px;" data-i18n="shell.participant_numbers">Participant Phone Numbers (comma separated)</label>
            <input type="text" id="new-group-participants" class="chat-message-input" placeholder="e.g. 491761234567, 491769876543" data-i18n-placeholder="shell.participant_numbers_ph" style="width:100%;border:1px solid var(--border-color);padding:10px 14px;border-radius:8px;background:var(--bg-input);">
            <p style="font-size:11px;color:var(--text-muted);margin-top:6px;" data-i18n="shell.participant_hint">At least 1 participant number required. Country code without +.</p>
          </div>
          <div class="modal-footer" style="margin-top:16px;padding:0;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="closeNewChatModal()" data-i18n="common.cancel">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm"><i class="fas fa-users"></i> <span data-i18n="shell.create_open_group">Create &amp; Open Group</span></button>
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

    const validTabs = ['dashboard', 'logs', 'chats', 'moderation', 'telegram'];

    function parseUrlState() {
        const rawHash = (window.location.hash || '').replace(/^#/, '').trim();
        let tabPart = rawHash;
        let queryPart = '';

        if (rawHash.includes('?')) {
            const parts = rawHash.split('?');
            tabPart = parts[0];
            queryPart = parts.slice(1).join('?');
        } else if (rawHash.includes('/')) {
            const parts = rawHash.split('/');
            tabPart = parts[0];
            queryPart = 'jid=' + encodeURIComponent(parts.slice(1).join('/'));
        }

        tabPart = tabPart.toLowerCase();
        let tab = validTabs.includes(tabPart) ? tabPart : null;

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const queryTab = (urlParams.get('tab') || '').toLowerCase().trim();
            if (validTabs.includes(queryTab)) tab = queryTab;
        } catch (e) {}

        const params = {};
        if (queryPart) {
            try {
                const sp = new URLSearchParams(queryPart);
                for (const [k, v] of sp.entries()) {
                    params[k] = v;
                }
            } catch (e) {}
        }
        try {
            const urlParams = new URLSearchParams(window.location.search);
            for (const [k, v] of urlParams.entries()) {
                if (k !== 'tab' && !params[k]) params[k] = v;
            }
        } catch (e) {}

        return { tab, params };
    }

    const initialUrlState = parseUrlState();
    window.initialUrlState = initialUrlState;

    function getTabFromUrl() {
        const st = parseUrlState();
        return st.tab || null;
    }

    function updateUrlState(tabId, paramsObj = {}) {
        const queryParts = [];
        for (const [k, v] of Object.entries(paramsObj)) {
            if (v) queryParts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
        }
        const queryString = queryParts.length > 0 ? '?' + queryParts.join('&') : '';
        const newHash = '#' + tabId + queryString;

        try {
            if (decodeURIComponent(window.location.hash || '') === decodeURIComponent(newHash)) return;
        } catch (e) {
            if (window.location.hash === newHash) return;
        }

        if (window.history && typeof window.history.replaceState === 'function') {
            try {
                window.history.replaceState(null, '', newHash);
            } catch (e) {}
        }
    }
    window.updateUrlState = updateUrlState;
    window.parseUrlState = parseUrlState;

    var _isSwitchingTab = false;
    function _doSwitchTab(tabId, updateHistory = true) {
        if (_isSwitchingTab) return;
        _isSwitchingTab = true;
        try {
            if (!validTabs.includes(tabId)) tabId = 'dashboard';

            navItems.forEach(nav => nav.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            
            const activeNav = document.querySelector('.nav-item[data-tab="' + tabId + '"]');
            const activePanel = document.getElementById('tab-' + tabId);
            
            if (activeNav && activePanel) {
                activeNav.classList.add('active');
                activePanel.classList.add('active');
                if (pageTitle) pageTitle.innerText = tabId.charAt(0).toUpperCase() + tabId.slice(1);
            }

            const contentBody = document.querySelector('.content-body');
            if (contentBody) contentBody.scrollTop = 0;

            if (updateHistory) {
                const currentState = parseUrlState();
                if (currentState.tab !== tabId) {
                    updateUrlState(tabId, {});
                }
            }

            isChatTabActive = (tabId === 'chats');
            document.body.classList.toggle('tab-chats-active', isChatTabActive);
            if (isChatTabActive) {
                loadChats();
            } else if (tabId === 'moderation') {
                loadModerationConfig();
            } else if (tabId === 'telegram') {
                loadTelegramBridgeData();
            } else {
                document.body.classList.remove('chat-open');
            }

            if (typeof window.applyI18nDOM === 'function') {
                window.applyI18nDOM();
            }
        } finally {
            _isSwitchingTab = false;
        }
    }

    function switchTab(tabId) {
        const guardFn = typeof _guardDirty === 'function' ? _guardDirty : null;
        if (guardFn && !guardFn(() => _doSwitchTab(tabId))) return;
        _doSwitchTab(tabId);
    }
    window.switchTab = switchTab;

    window.addEventListener('hashchange', () => {
        const tab = getTabFromUrl();
        if (tab) _doSwitchTab(tab, false);
    });

    const initialTab = getTabFromUrl() || 'dashboard';
    _doSwitchTab(initialTab, true);

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
        var isMobile = window.innerWidth <= 768;
        var isCollapsed = sb.classList.toggle('collapsed');
        if (isCollapsed && !isMobile) {
            sb.style.setProperty('width', '72px', 'important');
            sb.style.setProperty('min-width', '72px', 'important');
            sb.style.setProperty('max-width', '72px', 'important');
        } else {
            sb.style.removeProperty('width');
            sb.style.removeProperty('min-width');
            sb.style.removeProperty('max-width');
        }
        try {
            if (!isMobile) localStorage.setItem('sidebarCollapsed', isCollapsed ? '1' : '0');
        } catch (err) {}
    }
    window.toggleSidebar = toggleSidebar;

    document.addEventListener('click', function (e) {
        var target = e.target;
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
            // 1. Close open modals / overlays
            var openModals = document.querySelectorAll('.modal-overlay.show, .modal-overlay[style*="display: block"], .modal-overlay[style*="display: flex"], .modal.show, .modal[style*="display: flex"], .modal[style*="display: block"]');
            var handledModal = false;
            openModals.forEach(function (m) {
                handledModal = true;
                if (m.id === 'confirm-modal' && typeof closeConfirm === 'function') {
                    closeConfirm(false);
                } else if (m.id === 'tg-mapping-modal' && typeof closeTelegramMappingModal === 'function') {
                    closeTelegramMappingModal();
                } else if (m.id === 'tg-bot-modal' && typeof closeTelegramBotModal === 'function') {
                    closeTelegramBotModal();
                } else if (m.id === 'system-properties-modal' && typeof closeSystemPropertiesModal === 'function') {
                    closeSystemPropertiesModal();
                } else if (m.id === 'update-modal' && typeof closeUpdateModal === 'function') {
                    closeUpdateModal();
                } else if (typeof m.style === 'object' && m.style.display && m.style.display !== 'none') {
                    m.style.display = 'none';
                } else {
                    m.classList.remove('show');
                }
            });
            if (handledModal) return;

            // 2. Close drawers (e.g. Chat Info Drawer)
            var infoDrawer = document.getElementById('chat-info-drawer');
            if (infoDrawer && infoDrawer.style.display !== 'none') {
                if (typeof closeChatInfoDrawer === 'function') closeChatInfoDrawer();
                else infoDrawer.style.display = 'none';
                return;
            }

            // 3. Close active Emoji picker or context menus
            var emojiPicker = document.getElementById('emoji-picker');
            if (emojiPicker && emojiPicker.style.display !== 'none') {
                emojiPicker.style.display = 'none';
                return;
            }

            // 4. Close In-Chat Search Bar
            var inChatSearch = document.getElementById('chat-search-bar');
            if (inChatSearch && inChatSearch.style.display !== 'none') {
                if (typeof closeChatSearch === 'function') closeChatSearch();
                else inChatSearch.style.display = 'none';
                return;
            }

            // 5. Cancel Reply Preview Bar in Chat
            var replyBar = document.getElementById('reply-preview-bar');
            if (replyBar && replyBar.style.display !== 'none') {
                if (typeof cancelReply === 'function') cancelReply();
                else replyBar.style.display = 'none';
                return;
            }

            // 6. On Mobile: If inside active chat thread view, ESC goes back to chat list
            if (document.body.classList.contains('chat-open')) {
                if (typeof goBackToChatList === 'function') {
                    goBackToChatList(e);
                } else {
                    document.body.classList.remove('chat-open');
                }
            }
        }
    });

    // Restore sidebar state from last visit (default: expanded on desktop)
    var sidebar = document.querySelector('.sidebar');
    try {
        if (sidebar && window.innerWidth > 768 && localStorage.getItem('sidebarCollapsed') === '1') {
            sidebar.classList.add('collapsed');
            sidebar.style.setProperty('width', '72px', 'important');
            sidebar.style.setProperty('min-width', '72px', 'important');
            sidebar.style.setProperty('max-width', '72px', 'important');
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

    // Check initial active tab and trigger instant load if on chats tab
    const initialNav = document.querySelector('.nav-item.active');
    if (initialNav && initialNav.getAttribute('data-tab') === 'chats') {
        isChatTabActive = true;
        loadChats();
    }

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
