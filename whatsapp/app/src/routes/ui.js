import os from 'os';
import { uiAuthMiddleware } from '../middleware.js';
import { sanitizeSessionId } from '../session.js';
import { API_TOKEN, PORT } from '../config.js';
import { logger } from '../logger.js';

export function registerUIRoutes(app) {
  // --- Dashboard ---
  app.get('/', uiAuthMiddleware, (req, res) => {
    const sessionId = sanitizeSessionId(req.query.session_id || 'default');
    res.send(renderDashboard(sessionId));
  });

  // Catch-all for other UI routes
  app.get(
    /^(?!\/(api|qr|status|events|logs|health|media|session\/start)).+/,
    uiAuthMiddleware,
    (req, res) => {
      if (req.path.includes('/api/')) {
        logger.warn(
          { path: req.path, url: req.url, headers: req.headers },
          'Catch-all hit for API path'
        );
        return res.status(404).json({ error: 'API route not found' });
      }
      const sessionId = sanitizeSessionId(req.query.session_id || 'default');
      res.send(renderDashboard(sessionId));
    }
  );
}

function renderDashboard(sessionId) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>WhatsApp Homeassistant App</title>
        <style>
            :root {
                --primary: #00a884;
                --primary-dark: #008f6f;
                --bg: #f0f2f5;
                --card-bg: #ffffff;
                --text: #111b21;
                --text-secondary: #667781;
                --danger: #ea0038;
                --warning: #ffbc00;
                --success: #d9fdd3;
                --border: #e9edef;
                --sidebar-bg: #111b21;
                --sidebar-text: #ffffff;
                --transition: all 0.2s ease;
                --qr-bg: #ffffff;
                --code-bg: #e9ecef;
                --token-bg: #fff8c5;
                --token-text: #9a6700;
                --token-border: #d4a017;
                --banner-bg: #fff8c5;
                --banner-border: #d4a017;
                --banner-text: #856404;
                --btn-secondary-bg: #e9edef;
                --btn-secondary-hover: #d1d7db;
                --btn-secondary-text: #111b21;
                --btn-danger-bg: #fee;
                --btn-danger-text: #ea0038;
                --log-time-color: #8696a0;
            }

            [data-theme="dark"] {
                --bg: #0b141a;
                --card-bg: #111b21;
                --text: #e9edef;
                --text-secondary: #8696a0;
                --border: #222d34;
                --sidebar-bg: #202c33;
                --success: #0b3d22;
                --primary: #00a884;
                --primary-dark: #00cc99;
                --warning: #ffbc00;
                --qr-bg: #ffffff;
                --code-bg: #202c33;
                --token-bg: #202c33;
                --token-text: #00a884;
                --token-border: #00a884;
                --banner-bg: #2a2106;
                --banner-border: #45370a;
                --banner-text: #ffbc00;
                --btn-secondary-bg: #222d34;
                --btn-secondary-hover: #313d45;
                --btn-secondary-text: #e9edef;
                --btn-danger-bg: #2a0a11;
                --btn-danger-text: #ea0038;
                --log-time-color: #8696a0;
            }
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); margin: 0; display: flex; min-height: 100vh; font-size: 14px; }

            .sidebar { width: 280px; background: var(--sidebar-bg); color: var(--sidebar-text); padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; transition: all 0.3s; }
            .sidebar h1 { font-size: 1.8rem; line-height: 1.2; margin: 0; color: var(--primary); }
            .sidebar-links { display: flex; flex-direction: column; gap: 10px; margin-top: 1rem; }
            .sidebar-link { color: #8696a0; text-decoration: none; padding: 10px; border-radius: 8px; transition: all 0.2s; display: flex; align-items: center; gap: 10px; border: 1px solid transparent; font-size: 0.95rem; }
            .sidebar-link:hover { background: #202c33; color: #fff; border-color: #313d45; }

            .main-content { flex: 1; padding: 2rem; overflow-y: auto; width: 100%; display: flex; flex-direction: column; gap: 2rem; }

            .warning-banner {
                background: var(--banner-bg);
                border: 1px solid var(--banner-border);
                color: var(--banner-text);
                padding: 12px 20px;
                border-radius: 8px;
                margin-bottom: 5px;
                display: none;
                align-items: center;
                gap: 15px;
                font-weight: 500;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            .warning-banner b { color: var(--banner-text); }
            .dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
            .header-actions { display: flex; align-items: center; gap: 1rem; }
            .theme-toggle {
                background: var(--card-bg);
                border: 1px solid var(--border);
                color: var(--text);
                cursor: pointer;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
                box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                transition: var(--transition);
                outline: none;
            }
            .theme-toggle:hover {
                background: var(--border);
            }
            .session-switcher { display: flex; align-items: center; gap: 10px; background: var(--card-bg); padding: 8px 16px; border-radius: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
            select { border: none; background: none; font-weight: 600; color: var(--text); cursor: pointer; outline: none; font-size: 0.9rem; }

            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; }
            .card { background: var(--card-bg); border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 1rem; }
            .card-title { font-weight: 700; font-size: 1.1rem; color: var(--text); display: flex; align-items: center; gap: 10px; }

            .status-section { display: flex; flex-direction: column; align-items: center; text-align: center; width: 100%; }
            .status-badge { padding: 10px 20px; border-radius: 30px; font-weight: 700; font-size: 1.1rem; margin: 10px 0; letter-spacing: 0.5px; width: fit-content; }
            .status-badge.connected { background: var(--success); color: var(--primary); }
            .status-badge.disconnected { background: rgba(234, 0, 56, 0.1); color: var(--danger); }
            .status-badge.waiting { background: rgba(255, 188, 0, 0.1); color: var(--warning); }

            .stats-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; text-align: center; margin-top: 10px; }
            .stat-box { background: var(--bg); padding: 10px; border-radius: 12px; }
            .stat-val { font-weight: 800; font-size: 1.2rem; color: var(--primary); }
            .stat-label { font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-top: 4px; }

            .qr-container { background: var(--qr-bg); border: 2px dashed var(--border); border-radius: 12px; padding: 20px; text-align: center; }
            .qr-code { max-width: 100%; height: auto; border-radius: 8px; }

            .history-list { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
            .history-item { background: var(--bg); padding: 10px; border-radius: 10px; position: relative; word-wrap: break-word; }
            .history-item.failure { border-left: 4px solid var(--danger); }
            .history-time { font-size: 0.7rem; color: var(--text-secondary); display: block; }
            .history-target, .history-sender { font-weight: 700; font-size: 0.85rem; margin: 4px 0; display: block; }
            .history-msg { font-size: 0.9rem; color: var(--text); white-space: pre-wrap; word-break: break-all; }
            .history-reason { color: var(--danger); font-size: 0.75rem; margin-top: 5px; font-style: italic; }
            .empty-state { color: var(--text-secondary); font-style: italic; text-align: center; padding: 20px; }

            .details-box { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 12px; font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 0.85rem; }
            code { background: var(--code-bg); color: var(--text); padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; word-break: break-all; text-decoration: none; }

            .logs-view { background: #111b21; color: #00ff41; padding: 15px; border-radius: 10px; font-family: monospace; font-size: 0.75rem; max-height: 250px; overflow-y: auto; }
            .log-entry { margin-bottom: 4px; border-bottom: 1px solid #202c33; padding-bottom: 2px; }

            .footer-info { margin-top: 2rem; color: var(--text-secondary); font-size: 0.75rem; text-align: center; border-top: 1px solid var(--border); padding-top: 1rem; width: 100%; }
            .log-time { color: var(--log-time-color); }
            .highlight-token { background: var(--token-bg); color: var(--token-text); padding: 4px 8px; border-radius: 6px; font-weight: 700; border: 1px solid var(--token-border); user-select: all; text-decoration: none; }
            .btn { cursor: pointer; padding: 10px 16px; border-radius: 8px; border: none; font-weight: 600; transition: transform 0.1s, background 0.2s; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.9rem; min-height: 44px; }
            .btn:active { transform: scale(0.98); }
            .btn-primary { background: var(--primary); color: white; }
            .btn-primary:hover { background: var(--primary-dark); }
            .btn-secondary { background: var(--btn-secondary-bg); color: var(--btn-secondary-text); }
            .btn-secondary:hover { background: var(--btn-secondary-hover); }
            .btn-danger { background: var(--btn-danger-bg); color: var(--btn-danger-text); }
            .btn-danger:hover { background: rgba(234, 0, 56, 0.2); }

            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .info-item { display: flex; flex-direction: column; }
            .info-label { font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; }
            .info-value { font-weight: 600; font-size: 0.9rem; }

            @media (max-width: 768px) {
                body { flex-direction: column; }
                .sidebar { width: 100%; padding: 1rem; border-bottom: 1px solid #202c33; height: auto; }
                .main-content { padding: 1.5rem; }
                .grid { grid-template-columns: 1fr; }
                .dashboard-header { flex-direction: column; align-items: flex-start; }
            }

            @media (max-width: 480px) {
                .main-content { padding: 1rem; }
                .card { padding: 1rem; }
                .stats-row { grid-template-columns: 1fr 1fr; }
                .info-grid { grid-template-columns: 1fr; }
            }
        </style>
    </head>
    <body>
        <div class="sidebar">
            <h1 id="ui-title">WhatsApp<br><span style="color: var(--sidebar-text); opacity: 0.8; font-size: 1.4rem;">HA-App</span></h1>
            <div class="sidebar-links">
                <a href="https://faserf.github.io/ha-whatsapp/" target="_blank" class="sidebar-link">📖 Documentation</a>
                <a href="https://github.com/FaserF/ha-whatsapp" target="_blank" class="sidebar-link">🧩 Integration Repo</a>
                <a href="https://github.com/FaserF/hassio-addons" target="_blank" class="sidebar-link">📦 HA App Repo</a>
                <a href="logs" target="_blank" class="sidebar-link">📄 Connection Logs</a>
                <a id="full-logs-link" href="#" target="_top" class="sidebar-link">📋 Full System Logs</a>
            </div>

            <div style="margin-top: auto; padding-top: 1rem;">
                <div class="stat-label">System Info</div>
                <div style="font-size: 0.8rem; color: #8696a0;">
                    Node: <span id="node-version">...</span><br>
                    HA App: <span id="addon-version-sidebar" style="color: var(--primary);">...</span><br>
                    Integration: <span id="int-version-sidebar" style="color: var(--primary);">...</span><br>
                    Baileys: <span id="baileys-version">...</span>
                </div>
            </div>
        </div>

        <div class="main-content">
            <div id="dev-banner" class="warning-banner">
                <span style="font-size: 1.5rem;">⚠️</span>
                <div>
                    <b>Experimental Version Active</b><br>
                    <span style="font-size: 0.85rem; opacity: 0.9;">You are running a development, edge, or beta version. Features may be unstable.</span>
                </div>
            </div>
            <div class="dashboard-header">
                <h2 style="margin:0;">Dashboard Overview</h2>
                <div class="header-actions">
                    <button id="theme-toggle" class="theme-toggle" title="Toggle Light/Dark Mode" onclick="toggleTheme()">
                        🌓
                    </button>
                    <div class="session-switcher">
                        <span>Session:</span>
                        <select id="session-select" onchange="switchSession(this.value)">
                            <!-- Populated dynamically -->
                        </select>
                    </div>
                </div>
            </div>

            <div class="grid">
                <!-- Status Card -->
                <div class="card">
                    <div class="card-title">🔌 Connection Status</div>
                    <div class="status-section">
                        <div id="status-badge" class="status-badge disconnected">Initializing...</div>
                        <div id="disconnect-reason" style="color:var(--danger); font-size:0.8rem; margin-bottom: 10px;"></div>
                    </div>

                    <div id="qr-container" class="qr-container" style="display:none;">
                        <span class="stat-label">Scan to Connect</span><br>
                        <img id="qr-code" class="qr-code" src="" alt="QR" />
                    </div>

                    <div id="init-placeholder" class="qr-container">
                        <i style="font-size:2rem; color:var(--text-secondary);">⌛</i><br>
                        <span class="stat-label">Initializing WhatsApp...</span>
                    </div>

                    <div class="stats-row">
                        <div class="stat-box"><div id="stat-sent" class="stat-val">0</div><div class="stat-label">Sent</div></div>
                        <div class="stat-box"><div id="stat-received" class="stat-val">0</div><div class="stat-label">Received</div></div>
                        <div class="stat-box"><div id="stat-failed" class="stat-val">0</div><div class="stat-label">Failed</div></div>
                    </div>
                    <div style="margin-top:10px; text-align:center;">
                        <span class="stat-label">Uptime:</span> <strong id="val-uptime">00:00:00</strong> •
                        <span class="stat-label">Reconnections:</span> <strong id="val-reconnects">0</strong>
                    </div>
                </div>

                <!-- Integration Card -->
                <div class="card">
                    <div class="card-title">🏠 Home Assistant Setup</div>
                    <div class="details-box">
                        <span class="stat-label">Addon Host (Auto-detected)</span><br>
                        <code>http://${os.hostname()}:${PORT}</code><br><br>

                        <span class="stat-label">API Token</span><br>
                        <code class="highlight-token" title="Click to select all">${API_TOKEN}</code><br><br>

                        <span class="stat-label">Static / Internal IP</span><br>
                        <code>http://${os.networkInterfaces().eth0?.[0]?.address || 'localhost'}:${PORT}</code>
                    </div>
                    <p style="font-size:0.75rem; color:var(--text-secondary);">
                        Enter one of the Host URLs in the Home Assistant integration config flow.
                    </p>
                </div>

                <!-- Webhook Status Card -->
                <div class="card">
                    <div class="card-title">🔗 Webhook Configuration</div>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Status</span>
                            <span id="webhook-status" class="info-value">...</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Host</span>
                            <span id="webhook-url" class="info-value">...</span>
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                        Webhook token is active and hidden for security.
                    </div>
                </div>

                <!-- Device Information Card -->
                <div class="card" id="device-card">
                    <div class="card-title">📱 Connected Device</div>
                    <div id="device-info-grid" class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Model</span>
                            <span id="device-model" class="info-value">...</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Platform</span>
                            <span id="device-platform" class="info-value">...</span>
                        </div>
                    </div>
                    <div id="no-device-msg" class="empty-state" style="display:none;">
                        Connect a device to see details.
                    </div>
                </div>

                <!-- Quick Actions Card -->
                <div class="card">
                    <div class="card-title">⚡ Quick Actions</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button class="btn btn-secondary" onclick="restartSession()">
                            🔄 Restart
                        </button>
                        <button class="btn btn-danger" onclick="clearLogs()">
                            🧹 Clear Logs
                        </button>
                    </div>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">
                        Restarting will attempt a fresh connection without deleting credentials.
                    </p>
                </div>

                <!-- Bug Report Widget -->
                <div class="card">
                    <div class="card-title">🐛 Integration Bug Report</div>
                    <p style="font-size:0.85rem; color:var(--text-secondary);">
                        Encountered an issue? Download an anonymized debug bundle and report it on GitHub.
                    </p>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button class="btn btn-primary" onclick="downloadDebugInfo()">
                            📥 Download Issue Debug Info
                        </button>
                        <a href="https://github.com/FaserF/ha-whatsapp/issues/new" target="_blank" class="btn btn-secondary">
                            🔗 Open GitHub Issue
                        </a>
                    </div>
                </div>

                <!-- System Diagnostics -->
                <div class="card" id="card-diagnostics" style="display:none; border: 2px solid var(--warning); background: #fffcf0; grid-column: 1 / -1; order: 999;">
                    <div class="card-title">🔍 System Diagnostics</div>
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
                    <p style="font-size:0.75rem; color:var(--text-secondary); margin:0;">
                      If you see 404 errors, please report these paths on GitHub.
                    </p>
                </div>

                <!-- Recent Sent -->
                <div class="card">
                    <div class="card-title">📤 Recent Outbound</div>
                    <div id="list-sent" class="history-list">
                        <div class="empty-state">Loading...</div>
                    </div>
                </div>

                <!-- Recent Received -->
                <div class="card">
                    <div class="card-title">📥 Recent Inbound</div>
                    <div id="list-received" class="history-list">
                        <div class="empty-state">Loading...</div>
                    </div>
                </div>

                <!-- Recent Failures -->
                <div class="card">
                    <div class="card-title">⚠️ Failed Actions</div>
                    <div id="list-failures" class="history-list">
                        <div class="empty-state">Loading...</div>
                    </div>
                </div>

                <!-- Live Logs -->
                <div class="card" style="grid-column: 1 / -1;">
                    <div class="card-title">📜 Connection Events</div>
                    <div id="list-logs" class="logs-view">
                        <div class="log-entry">Loading events...</div>
                    </div>
                </div>
            </div>
            <div class="footer-info">
                 WhatsApp Homeassistant App Dashboard • Session: <b id="footer-session-id">...</b> (<span id="footer-session-status">...</span>) • HA App: <span id="footer-addon-version">...</span> • Integration: <span id="footer-int-version">...</span>
            </div>
        </div>

        <script>
            let currentSession = ${JSON.stringify(sessionId)};

            // Robust base path detection for Home Assistant Ingress
            const getBasePath = () => {
                try {
                    // This is the cleanest way to get the folder path
                    const path = window.location.pathname;
                    const folder = path.substring(0, path.lastIndexOf('/') + 1);
                    return folder || '/';
                } catch (e) {
                    return '/';
                }
            };
            const basePath = getBasePath().replace(/[/]+/g, '/');
            console.log('Detected Base Path:', basePath);

            document.getElementById('diag-basepath').textContent = basePath;
            document.getElementById('diag-pathname').textContent = window.location.pathname;

            function switchSession(id) {
                currentSession = id;
                const url = new URL(window.location);
                url.searchParams.set('session_id', id);
                window.history.replaceState({}, '', url);
                updateDashboard();
            }

            async function downloadDebugInfo() {
                try {
                    const response = await fetch(basePath + 'api/debug/download?session_id=' + currentSession, {
                        headers: { 'Accept': 'application/json' }
                    });
                    if (!response.ok) throw new Error('Download failed');
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = 'whatsapp-debug-' + currentSession + '.json';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                } catch (e) {
                    alert('Failed to download debug info: ' + e.message);
                }
            }

            async function restartSession() {
                if (!confirm('Are you sure you want to restart this session?')) return;
                try {
                    const response = await fetch(basePath + 'api/session/restart', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ session_id: currentSession })
                    });
                    if (response.ok) {
                        alert('Restart command sent successfully.');
                        updateDashboard();
                    }
                } catch (e) {
                    alert('Failed to restart session: ' + e.message);
                }
            }

            async function clearLogs() {
                if (!confirm('Clear all connection logs for this session?')) return;
                try {
                    const response = await fetch(basePath + 'api/logs/clear', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ session_id: currentSession })
                    });
                    if (response.ok) {
                        updateDashboard();
                    }
                } catch (e) {
                    alert('Failed to clear logs: ' + e.message);
                }
            }

            async function updateDashboard() {
                try {
                    const response = await fetch(basePath + 'api/dashboard?session_id=' + currentSession, {
                        headers: { 'Accept': 'application/json' }
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('Update failed:', response.status, errorText);
                        document.getElementById('card-diagnostics').style.display = 'block';
                        // If we are getting 403 or 401, maybe show something helpful?
                        if (response.status === 403) {
                            document.getElementById('status-badge').textContent = 'Access Blocked (403) ⛔';
                        } else {
                            document.getElementById('status-badge').textContent = 'API Error (' + response.status + ') ⚠️';
                        }
                        throw new Error('API request failed with status: ' + response.status);
                    }
                    // Hide diagnostics if it was open from a previous error but now works
                    document.getElementById('card-diagnostics').style.display = 'none';
                    const data = await response.json();

                    // Update Version Info
                    const addonVer = data.addonVersion || 'Unknown';
                    const intVer = data.integrationVersion || 'Unknown';

                    document.getElementById('node-version').textContent = data.nodeVersion;
                    document.getElementById('addon-version-sidebar').textContent = addonVer;
                    document.getElementById('int-version-sidebar').textContent = intVer;
                    document.getElementById('baileys-version').textContent = data.baileysVersion;
                    document.getElementById('footer-addon-version').textContent = addonVer;
                    document.getElementById('footer-int-version').textContent = intVer;

                    // Show Banner if Dev/Beta
                    const isDev = addonVer.toLowerCase().includes('edge') ||
                                  addonVer.toLowerCase().includes('dev') ||
                                  intVer.toLowerCase().includes('dev') ||
                                  intVer.toLowerCase().includes('beta') ||
                                  intVer.toLowerCase().includes('pre');
                    document.getElementById('dev-banner').style.display = isDev ? 'flex' : 'none';

                    // Update dynamic links
                    const slug = data.addonSlug || 'unknown';
                    const fullLogsLink = document.getElementById('full-logs-link');
                    if (fullLogsLink) {
                        // Point to the native HA Addon logs page
                        fullLogsLink.href = '/config/app/' + slug + '/logs';
                    }

                    // Update Session Switcher
                    const select = document.getElementById('session-select');
                    let options = '';
                    data.sessionList.forEach(s => {
                        const isSelected = s.id === currentSession ? 'selected' : '';
                        const statusIcon = s.connected ? '\u2705' : '\u274C';
                        options += '<option value="' + s.id + '" ' + isSelected + '>' + s.id + ' (' + statusIcon + ')</option>';
                    });
                    select.innerHTML = options;

                    // Update Status Badge
                    const badge = document.getElementById('status-badge');
                    badge.className = 'status-badge ' + (data.isConnected ? 'connected' : (data.currentQR ? 'waiting' : 'disconnected'));
                    badge.textContent = data.isConnected ? 'Connected \u2705' : (data.currentQR ? 'Scan QR Code \uD83D\uDCF1' : (data.disconnectReason === 'logged_out' ? 'Logged Out \uD83D\uDEAB' : 'Disconnected \u274C'));

                    document.getElementById('disconnect-reason').textContent = data.disconnectReason ? 'Reason: ' + data.disconnectReason : '';

                    // QR Code logic
                    const qrContainer = document.getElementById('qr-container');
                    const initPlaceholder = document.getElementById('init-placeholder');
                    if (!data.isConnected && data.currentQR) {
                        qrContainer.style.display = 'block';
                        initPlaceholder.style.display = 'none';
                        document.getElementById('qr-code').src = data.currentQR;
                    } else if (!data.isConnected && !data.currentQR) {
                        qrContainer.style.display = 'none';
                        initPlaceholder.style.display = 'block';
                    } else {
                        qrContainer.style.display = 'none';
                        initPlaceholder.style.display = 'none';
                    }

                    // Debug info
                    document.getElementById('footer-session-id').textContent = data.sessionId;
                    document.getElementById('footer-session-status').textContent = data.isConnected ? 'Connected' : 'Disconnected';
                    document.getElementById('footer-session-status').style.color = data.isConnected ? 'var(--primary)' : 'var(--danger)';

                    // Webhook Status
                    document.getElementById('webhook-status').textContent = data.webhookEnabled ? 'Enabled ✅' : 'Disabled ❌';
                    document.getElementById('webhook-status').style.color = data.webhookEnabled ? 'var(--primary-dark)' : 'var(--danger)';
                    document.getElementById('webhook-url').textContent = data.webhookUrl || 'Not configured';

                    // Device Info
                    const hasDevice = data.deviceInfo && (data.deviceInfo.manufacturer || data.deviceInfo.model);
                    document.getElementById('device-info-grid').style.display = hasDevice ? 'grid' : 'none';
                    document.getElementById('no-device-msg').style.display = hasDevice ? 'none' : 'block';
                    if (hasDevice) {
                        document.getElementById('device-model').textContent = data.deviceInfo.model || 'N/A';
                        document.getElementById('device-platform').textContent = data.deviceInfo.platform || 'N/A';
                    }

                    // Update Stats
                    document.getElementById('stat-sent').textContent = data.stats.sent;
                    document.getElementById('stat-received').textContent = data.stats.received;
                    document.getElementById('stat-failed').textContent = data.stats.failed;
                    document.getElementById('val-uptime').textContent = data.uptime;
                    document.getElementById('val-reconnects').textContent = data.stats?.totalReconnects ?? data.reconnectAttempts ?? 0;

                    // Update Lists
                    document.getElementById('list-sent').innerHTML = data.recentSent.length ?
                        data.recentSent.map(m =>
                            '<div class="history-item">' +
                                '<span class="history-time">' + m.timestamp + '</span>' +
                                '<span class="history-target">To: ' + m.target + '</span>' +
                                '<div class="history-msg">' + m.message + '</div>' +
                            '</div>'
                        ).join('') : '<div class="empty-state">No messages sent recently</div>';

                    document.getElementById('list-received').innerHTML = data.recentReceived.length ?
                        data.recentReceived.map(m =>
                            '<div class="history-item">' +
                                '<span class="history-time">' + m.timestamp + '</span>' +
                                '<span class="history-sender">From: ' + m.sender + '</span>' +
                                '<div class="history-msg">' + m.message + '</div>' +
                            '</div>'
                        ).join('') : '<div class="empty-state">No messages received recently</div>';

                    document.getElementById('list-failures').innerHTML = data.recentFailures.length ?
                        data.recentFailures.map(m =>
                            '<div class="history-item failure">' +
                                '<span class="history-time">' + m.timestamp + '</span>' +
                                '<span class="history-target">Target: ' + m.target + '</span>' +
                                '<div class="history-msg">' + m.message + '</div>' +
                                '<div class="history-reason">Error: ' + m.reason + '</div>' +
                            '</div>'
                        ).join('') : '<div class="empty-state">No failures recorded</div>';

                    document.getElementById('list-logs').innerHTML = data.recentLogs.length ?
                        data.recentLogs.map(l =>
                            '<div class="log-entry"><span class="log-time" style="color: #8696a0; margin-right: 8px;">' + l.timestamp + '</span><span class="log-type-' + l.type + '">' + l.msg + '</span></div>'
                        ).join('') : '<div class="log-entry">No logs yet</div>';

                } catch (e) {
                    console.error('Fetch error:', e);
                }
            }

            // Theme Management
            const getInitialTheme = () => {
                const saved = localStorage.getItem('ha-whatsapp-theme');
                if (saved) return saved;
                
                // Check HA theme (if possible) or system preference
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    return 'dark';
                }
                return 'light';
            };

            const setTheme = (theme) => {
                document.documentElement.setAttribute('data-theme', theme);
                localStorage.setItem('ha-whatsapp-theme', theme);
                document.getElementById('theme-toggle').innerHTML = theme === 'dark' ? '☀️' : '🌙';
            };

            const toggleTheme = () => {
                const current = document.documentElement.getAttribute('data-theme');
                setTheme(current === 'dark' ? 'light' : 'dark');
            };

            // Initialize theme
            setTheme(getInitialTheme());

            // Initial load
            updateDashboard();
            // refresh loop
            setInterval(updateDashboard, 5000);
        </script>
    </body>
    </html>
  `;
}
