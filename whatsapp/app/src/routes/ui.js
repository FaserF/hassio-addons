import os from 'os';
import { uiAuthMiddleware } from '../middleware.js';
import { sanitizeSessionId, sessions } from '../session.js';
import { API_TOKEN, PORT } from '../config.js';

export function registerUIRoutes(app) {
  // --- Dashboard ---
  app.get('/', uiAuthMiddleware, (req, res) => {
    let sessionId = req.query.session_id;
    if (!sessionId) {
      // Preference: 1. Connected session, 2. 'default' session, 3. First available session
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
    res.send(renderDashboard(sessionId));
  });
}

function renderDashboard(sessionId) {
  return `
    <!DOCTYPE html>
    <html lang="en" data-theme="dark">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>WhatsApp Gateway - Home Assistant</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💬</text></svg>">
        <!-- Google Font Plus Jakarta Sans -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <!-- FontAwesome Premium Icons -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            :root {
                --primary: #00a884;
                --primary-dark: #008f6f;
                --bg-app: #0b141a;
                --bg-sidebar: #111b21;
                --bg-card: #202c33;
                --bg-input: #2a3942;
                --text-main: #e9edef;
                --text-muted: #8696a0;
                --border-color: #222d34;
                --danger: #ea0038;
                --danger-hover: #c2002f;
                --warning: #ffbc00;
                --success: #d9fdd3;
                --info: #3498db;
                
                --sidebar-width: 280px;
                --header-height: 70px;
                --border-radius: 16px;
                --border-radius-sm: 8px;
                --transition-speed: 0.2s;
                --shadow-premium: 0 8px 32px 0 rgba(0, 0, 0, 0.25);
                --font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }

            [data-theme="light"] {
                --bg-app: #f0f2f5;
                --bg-sidebar: #ffffff;
                --bg-card: #ffffff;
                --bg-input: #f0f2f5;
                --text-main: #111b21;
                --text-muted: #667781;
                --border-color: #e9edef;
                --success: #d9fdd3;
                --shadow-premium: 0 4px 16px rgba(0,0,0,0.06);
            }

            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: var(--font-family);
                background-color: var(--bg-app);
                color: var(--text-main);
                overflow: hidden;
                height: 100vh;
                width: 100vw;
                -webkit-font-smoothing: antialiased;
                display: flex;
            }

            .app-layout {
                display: flex;
                width: 100%;
                height: 100vh;
            }

            /* Sidebar */
            .sidebar {
                width: var(--sidebar-width);
                background-color: var(--bg-sidebar);
                border-right: 1px solid var(--border-color);
                display: flex;
                flex-direction: column;
                flex-shrink: 0;
                height: 100vh;
                transition: var(--transition-speed) ease;
            }

            .sidebar-header {
                height: var(--header-height);
                padding: 0 24px;
                display: flex;
                align-items: center;
                border-bottom: 1px solid var(--border-color);
            }

            .logo {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .logo-icon {
                font-size: 28px;
                color: var(--primary);
                filter: drop-shadow(0 0 6px rgba(0, 168, 132, 0.4));
            }

            .logo-text {
                display: flex;
                flex-direction: column;
            }

            .logo-title {
                font-weight: 700;
                font-size: 16px;
                color: var(--text-main);
                letter-spacing: 0.5px;
            }

            .logo-subtitle {
                font-size: 11px;
                color: var(--text-muted);
                font-weight: 500;
            }

            .nav-menu {
                padding: 24px 16px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                flex-grow: 1;
                overflow-y: auto;
            }

            .nav-item {
                display: flex;
                align-items: center;
                gap: 14px;
                background: none;
                border: none;
                padding: 12px 16px;
                color: var(--text-muted);
                font-family: inherit;
                font-size: 14px;
                font-weight: 500;
                border-radius: var(--border-radius-sm);
                cursor: pointer;
                text-align: left;
                transition: all var(--transition-speed) ease;
                width: 100%;
                text-decoration: none;
            }

            .nav-item:hover {
                color: var(--text-main);
                background-color: rgba(0, 168, 132, 0.05);
            }

            .nav-item.active {
                color: var(--text-main);
                background-color: rgba(0, 168, 132, 0.15);
                font-weight: 600;
            }

            .nav-item.active .nav-icon {
                color: var(--primary);
            }

            .nav-icon {
                font-size: 16px;
                width: 20px;
                text-align: center;
                transition: color var(--transition-speed);
            }

            .sidebar-footer {
                padding: 20px 24px;
                border-top: 1px solid var(--border-color);
            }

            .sys-info-title {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: var(--text-muted);
                margin-bottom: 8px;
            }

            .sys-info-text {
                font-size: 12px;
                color: var(--text-muted);
                line-height: 1.6;
            }

            .sys-info-val {
                color: var(--text-main);
                font-weight: 500;
            }

            /* Main Content Area */
            .main-content {
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                background-color: var(--bg-app);
                height: 100vh;
                overflow: hidden;
            }

            .top-header {
                height: var(--header-height);
                padding: 0 32px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--border-color);
                background-color: var(--bg-sidebar);
            }

            .header-left {
                display: flex;
                align-items: center;
                gap: 16px;
            }

            .header-title {
                font-size: 18px;
                font-weight: 700;
            }

            .header-actions {
                display: flex;
                align-items: center;
                gap: 14px;
            }

            .session-switcher {
                display: flex;
                align-items: center;
                gap: 8px;
                background-color: var(--bg-input);
                border: 1px solid var(--border-color);
                padding: 6px 14px;
                border-radius: 20px;
            }

            .session-switcher span {
                font-size: 12px;
                color: var(--text-muted);
            }

            .session-switcher select {
                background: none;
                border: none;
                color: var(--text-main);
                font-family: inherit;
                font-weight: 600;
                font-size: 13px;
                outline: none;
                cursor: pointer;
            }

            .theme-toggle {
                background: none;
                border: 1px solid var(--border-color);
                color: var(--text-main);
                cursor: pointer;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: var(--transition-speed);
                background-color: var(--bg-sidebar);
            }

            .theme-toggle:hover {
                background-color: var(--bg-input);
            }

            /* Scrollable Content Body */
            .content-body {
                padding: 32px;
                overflow-y: auto;
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                gap: 24px;
            }

            /* Banner System */
            .banner {
                padding: 16px 20px;
                border-radius: var(--border-radius-sm);
                display: flex;
                align-items: flex-start;
                gap: 14px;
                font-size: 13px;
                line-height: 1.5;
                box-shadow: var(--shadow-premium);
            }

            .banner-warning {
                background-color: rgba(255, 188, 0, 0.1);
                border: 1px solid rgba(255, 188, 0, 0.3);
                color: #ffe699;
            }

            .banner-warning-icon {
                color: var(--warning);
                font-size: 20px;
            }

            .banner-info {
                background-color: rgba(0, 168, 132, 0.1);
                border: 1px solid rgba(0, 168, 132, 0.3);
                color: #d4f8e3;
            }

            .banner-info-icon {
                color: var(--primary);
                font-size: 20px;
            }

            /* Tab Panels */
            .tab-panel {
                display: none;
                flex-direction: column;
                gap: 24px;
                animation: fadeIn var(--transition-speed) ease-in-out forwards;
            }

            .tab-panel.active {
                display: flex;
            }

            /* Grid Layouts */
            .grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
                gap: 24px;
            }

            .card {
                background-color: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                padding: 24px;
                box-shadow: var(--shadow-premium);
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .card-title {
                font-size: 15px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: var(--text-muted);
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .card-title i {
                color: var(--primary);
                font-size: 16px;
            }

            /* Status visual styles */
            .status-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                padding: 16px 0;
            }

            .status-badge {
                padding: 8px 18px;
                border-radius: 20px;
                font-weight: 700;
                font-size: 14px;
                margin-bottom: 8px;
                letter-spacing: 0.5px;
            }

            .status-badge.connected {
                background-color: rgba(0, 168, 132, 0.15);
                color: var(--primary);
            }

            .status-badge.disconnected {
                background-color: rgba(234, 0, 56, 0.15);
                color: var(--danger);
            }

            .status-badge.waiting {
                background-color: rgba(255, 188, 0, 0.15);
                color: var(--warning);
            }

            .disconnect-reason {
                font-size: 12px;
                color: var(--danger);
                font-weight: 500;
            }

            /* Stats Columns */
            .stats-row {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 12px;
                margin-top: 10px;
            }

            .stat-box {
                background-color: var(--bg-app);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                padding: 12px 8px;
                text-align: center;
            }

            .stat-val {
                font-size: 20px;
                font-weight: 800;
                color: var(--primary);
            }

            .stat-label {
                font-size: 10px;
                color: var(--text-muted);
                text-transform: uppercase;
                margin-top: 4px;
                font-weight: 600;
            }

            /* QR Container styling */
            .qr-container {
                background-color: #ffffff;
                border: 2px dashed var(--border-color);
                border-radius: var(--border-radius-sm);
                padding: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 180px;
            }

            .qr-code {
                max-width: 160px;
                height: auto;
                image-rendering: pixelated;
            }

            /* History Lists */
            .history-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-height: 320px;
                overflow-y: auto;
                padding-right: 4px;
            }

            .history-item {
                background-color: var(--bg-app);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                padding: 12px;
                position: relative;
            }

            .history-item.failure {
                border-left: 4px solid var(--danger);
            }

            .history-time {
                font-size: 11px;
                color: var(--text-muted);
                display: block;
                margin-bottom: 4px;
            }

            .history-target, .history-sender {
                font-size: 12px;
                font-weight: 700;
                color: var(--text-main);
                margin-bottom: 4px;
                display: block;
            }

            .history-msg {
                font-size: 13px;
                color: var(--text-main);
                white-space: pre-wrap;
                word-break: break-all;
            }

            .history-reason {
                color: var(--danger);
                font-size: 11px;
                margin-top: 6px;
                font-style: italic;
                font-weight: 500;
            }

            .empty-state {
                color: var(--text-muted);
                font-style: italic;
                text-align: center;
                padding: 24px;
                font-size: 13px;
            }

            /* Structured Details / Diagnostic Lists */
            .details-box {
                background-color: var(--bg-app);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .details-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .details-label {
                font-size: 11px;
                color: var(--text-muted);
                text-transform: uppercase;
                font-weight: 600;
            }

            code {
                background-color: var(--bg-input);
                color: var(--text-main);
                padding: 8px 12px;
                border-radius: 6px;
                font-family: 'JetBrains Mono', 'Courier New', monospace;
                font-size: 12px;
                word-break: break-all;
                border: 1px solid var(--border-color);
            }

            .highlight-token {
                background-color: rgba(0, 168, 132, 0.08);
                border: 1px solid rgba(0, 168, 132, 0.3);
                color: var(--primary);
                font-weight: 600;
                cursor: pointer;
                user-select: all;
            }

            /* Log Viewer */
            .logs-view {
                background-color: #090e11;
                color: #aebbc4;
                padding: 16px;
                border-radius: var(--border-radius-sm);
                font-family: 'Courier New', Courier, monospace;
                font-size: 12px;
                line-height: 1.5;
                max-height: 400px;
                overflow-y: auto;
                border: 1px solid var(--border-color);
            }

            .log-entry {
                margin-bottom: 6px;
                padding-bottom: 4px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            }

            .log-time {
                color: var(--text-muted);
                margin-right: 10px;
            }

            .log-type-error {
                color: var(--danger);
            }

            .log-type-warning {
                color: var(--warning);
            }

            /* Buttons */
            .btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 10px 18px;
                border-radius: var(--border-radius-sm);
                font-family: inherit;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                border: none;
                transition: all var(--transition-speed) ease;
                min-height: 40px;
                text-decoration: none;
            }

            .btn:active {
                transform: scale(0.98);
            }

            .btn-primary {
                background-color: var(--primary);
                color: #000;
            }

            .btn-primary:hover {
                background-color: #34e073;
            }

            .btn-secondary {
                background-color: rgba(255, 255, 255, 0.05);
                color: var(--text-main);
                border: 1px solid var(--border-color);
            }

            .btn-secondary:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }

            .btn-danger {
                background-color: rgba(234, 0, 56, 0.1);
                color: var(--danger);
                border: 1px solid rgba(234, 0, 56, 0.2);
            }

            .btn-danger:hover {
                background-color: rgba(234, 0, 56, 0.2);
            }

            .btn-sm {
                padding: 6px 12px;
                font-size: 11px;
                min-height: 30px;
            }

            .btn-ghost {
                background: none;
                color: var(--text-muted);
                padding: 8px;
                border-radius: 50%;
                min-height: auto;
            }

            .btn-ghost:hover {
                background-color: rgba(255, 255, 255, 0.05);
                color: var(--text-main);
            }

            /* Info grid */
            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }

            .info-item {
                display: flex;
                flex-direction: column;
            }

            .info-label {
                font-size: 11px;
                color: var(--text-muted);
                text-transform: uppercase;
                font-weight: 600;
            }

            .info-value {
                font-weight: 700;
                font-size: 13px;
                margin-top: 4px;
            }

            /* Modal overlay */
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.6);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(4px);
                opacity: 0;
                transition: opacity var(--transition-speed) ease;
            }

            .modal-overlay.show {
                display: flex;
                opacity: 1;
            }

            .modal-card {
                background-color: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                width: 90%;
                max-width: 440px;
                padding: 24px;
                box-shadow: var(--shadow-premium);
                transform: scale(0.95);
                transition: transform var(--transition-speed) cubic-bezier(0.16, 1, 0.3, 1);
            }

            .modal-overlay.show .modal-card {
                transform: scale(1);
            }

            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }

            .modal-header h3 {
                font-size: 16px;
                font-weight: 700;
            }

            .modal-close-btn {
                background: none;
                border: none;
                color: var(--text-muted);
                font-size: 16px;
                cursor: pointer;
            }

            .modal-close-btn:hover {
                color: var(--text-main);
            }

            .modal-body {
                margin-bottom: 24px;
                font-size: 13px;
                color: var(--text-muted);
                line-height: 1.5;
            }

            .modal-footer {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }

            /* Toast container */
            .toast-container {
                position: fixed;
                bottom: 24px;
                right: 24px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                z-index: 9999;
            }

            .toast {
                background-color: var(--bg-card);
                border-left: 4px solid var(--info);
                color: var(--text-main);
                padding: 14px 20px;
                border-radius: var(--border-radius-sm);
                box-shadow: var(--shadow-premium);
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 13px;
                font-weight: 600;
                min-width: 280px;
                max-width: 400px;
                animation: slideIn var(--transition-speed) cubic-bezier(0.16, 1, 0.3, 1) forwards;
                transition: opacity var(--transition-speed);
            }

            .toast.success { border-left-color: var(--success); }
            .toast.danger { border-left-color: var(--danger); }
            .toast.warning { border-left-color: var(--warning); }

            .toast-icon { font-size: 16px; }
            .toast.success .toast-icon { color: var(--primary); }
            .toast.danger .toast-icon { color: var(--danger); }
            .toast.warning .toast-icon { color: var(--warning); }

            .footer-info {
                margin-top: auto;
                color: var(--text-muted);
                font-size: 11px;
                text-align: center;
                border-top: 1px solid var(--border-color);
                padding: 16px;
            }

            /* Steps guide list */
            .steps-list {
                padding-left: 20px;
                font-size: 12px;
                color: var(--text-muted);
                line-height: 1.6;
            }

            .steps-list li {
                margin-bottom: 6px;
            }

            .steps-list strong {
                color: var(--text-main);
            }

            .spinner {
                width: 28px;
                height: 28px;
                border: 3px solid rgba(0, 0, 0, 0.1);
                border-top-color: var(--primary);
                border-radius: 50%;
                animation: spin 1s infinite linear;
            }

            /* Animations */
            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            @keyframes pulse {
                0% { opacity: 0.6; }
                100% { opacity: 1; }
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: translateY(0); }
            }

            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }

            /* Chats tab layout classes */
            .chat-container-layout {
                display: flex;
                height: calc(100vh - 180px);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                overflow: hidden;
                background-color: var(--card-bg);
            }
            .chat-list-panel {
                width: 320px;
                border-right: 1px solid var(--border-color);
                display: flex;
                flex-direction: column;
                background-color: var(--bg-main);
            }
            .chat-list-header {
                padding: 16px;
                border-bottom: 1px solid var(--border-color);
            }
            .search-box-wrapper {
                display: flex;
                align-items: center;
                background: var(--card-bg);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 8px 12px;
                gap: 8px;
            }
            .search-icon {
                color: var(--text-muted);
                font-size: 14px;
            }
            .chat-search-input {
                border: none;
                background: transparent;
                outline: none;
                width: 100%;
                font-size: 14px;
                color: var(--text-main);
            }
            .chat-list-items {
                flex: 1;
                overflow-y: auto;
            }
            .chat-item {
                display: flex;
                padding: 12px 16px;
                align-items: center;
                border-bottom: 1px solid var(--border-color);
                cursor: pointer;
                transition: background-color var(--transition-speed);
                gap: 12px;
            }
            .chat-item:hover, .chat-item.active {
                background-color: var(--card-bg-hover);
            }
            .chat-avatar {
                font-size: 32px;
                color: var(--primary);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .chat-info {
                flex: 1;
                min-width: 0;
            }
            .chat-meta {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                margin-bottom: 4px;
            }
            .chat-name {
                font-weight: 600;
                color: var(--text-main);
                font-size: 14px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .chat-time {
                font-size: 11px;
                color: var(--text-muted);
            }
            .chat-last-msg {
                font-size: 13px;
                color: var(--text-muted);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .chat-thread-panel {
                flex: 1;
                display: flex;
                flex-direction: column;
                background-color: var(--card-bg);
            }
            .chat-thread-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 32px;
                color: var(--text-muted);
            }
            .chat-thread-empty-icon {
                font-size: 64px;
                color: var(--primary);
                opacity: 0.8;
                margin-bottom: 16px;
            }
            .chat-thread-active {
                flex: 1;
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            .chat-thread-header {
                display: flex;
                align-items: center;
                padding: 16px 24px;
                border-bottom: 1px solid var(--border-color);
                background-color: var(--bg-main);
                gap: 12px;
            }
            .chat-header-avatar {
                font-size: 36px;
                color: var(--primary);
            }
            .chat-header-info h4 {
                margin: 0;
                font-size: 15px;
                color: var(--text-main);
            }
            .chat-header-info p {
                margin: 2px 0 0;
                font-size: 12px;
                color: var(--text-muted);
            }
            .chat-thread-messages {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                background-image: radial-gradient(var(--border-color) 1px, transparent 0);
                background-size: 16px 16px;
            }
            .msg-bubble-row {
                display: flex;
                width: 100%;
            }
            .msg-bubble-row.outbound {
                justify-content: flex-end;
            }
            .msg-bubble-row.inbound {
                justify-content: flex-start;
            }
            .msg-bubble {
                max-width: 65%;
                padding: 10px 14px;
                border-radius: 12px;
                position: relative;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            }
            .msg-bubble-row.outbound .msg-bubble {
                background-color: var(--primary);
                color: #ffffff;
                border-top-right-radius: 0;
            }
            .msg-bubble-row.inbound .msg-bubble {
                background-color: var(--bg-main);
                color: var(--text-main);
                border-top-left-radius: 0;
                border: 1px solid var(--border-color);
            }
            .msg-bubble-text {
                font-size: 14px;
                line-height: 1.4;
                word-break: break-word;
            }
            .msg-bubble-time {
                font-size: 10px;
                margin-top: 4px;
                text-align: right;
                opacity: 0.7;
            }
            .chat-thread-footer {
                padding: 16px 24px;
                border-top: 1px solid var(--border-color);
                background-color: var(--bg-main);
            }
            .chat-message-form {
                display: flex;
                gap: 12px;
            }
            .chat-message-input {
                flex: 1;
                border: 1px solid var(--border-color);
                background: var(--card-bg);
                border-radius: 8px;
                padding: 10px 16px;
                font-size: 14px;
                color: var(--text-main);
                outline: none;
            }
            .chat-message-input:focus {
                border-color: var(--primary);
            }
            .chat-send-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 42px;
                height: 42px;
                padding: 0;
                border-radius: 8px;
            }

            @media (max-width: 768px) {
                body { flex-direction: column; }
                .sidebar { width: 100%; height: auto; border-bottom: 1px solid var(--border-color); }
                .main-content { height: auto; overflow: visible; }
                .content-body { padding: 16px; }
            }
        </style>
    </head>
    <body>
      <div class="app-layout">
        <!-- Sidebar Navigation -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <div class="logo">
                    <i class="fab fa-whatsapp logo-icon"></i>
                    <div class="logo-text">
                        <span class="logo-title">WhatsApp Gateway</span>
                        <span class="logo-subtitle">Home Assistant</span>
                    </div>
                </div>
            </div>
            
            <nav class="nav-menu">
                <button class="nav-item active" data-tab="dashboard">
                    <i class="fas fa-chart-pie nav-icon"></i>
                    <span>Dashboard</span>
                </button>
                <button class="nav-item" data-tab="logs">
                    <i class="fas fa-terminal nav-icon"></i>
                    <span>Daemon Logs</span>
                </button>
                <button class="nav-item" data-tab="chats">
                    <i class="fas fa-comments nav-icon"></i>
                    <span>Chats</span>
                </button>
                <a href="https://faserf.github.io/ha-whatsapp/" target="_blank" class="nav-item">
                    <i class="fas fa-book nav-icon"></i>
                    <span>Documentation</span>
                </a>
                <a href="https://github.com/FaserF/ha-whatsapp" target="_blank" class="nav-item">
                    <i class="fas fa-puzzle-piece nav-icon"></i>
                    <span>Integration Repo</span>
                </a>
                <a href="https://github.com/FaserF/hassio-addons" target="_blank" class="nav-item">
                    <i class="fas fa-cubes nav-icon"></i>
                    <span>HA App Repo</span>
                </a>
                <a id="raw-logs-link" href="#" target="_blank" class="nav-item">
                    <i class="fas fa-file-alt nav-icon"></i>
                    <span>Raw Connection Logs</span>
                </a>
                <a id="full-logs-link" href="#" target="_top" class="nav-item" style="display:none;">
                    <i class="fas fa-file-invoice nav-icon"></i>
                    <span>Full System Logs</span>
                </a>
            </nav>
            
            <div class="sidebar-footer">
                <div class="sys-info-title">System Properties</div>
                <div class="sys-info-text">
                    Node: <span id="node-version" class="sys-info-val">...</span><br>
                    Addon: <span id="addon-version-sidebar" class="sys-info-val">...</span><br>
                    Integration: <span id="int-version-sidebar" class="sys-info-val">...</span><br>
                    Baileys: <span id="baileys-version" class="sys-info-val">...</span>
                </div>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="main-content">
            <header class="top-header">
                <div class="header-left">
                    <h1 class="header-title" id="page-title">Dashboard</h1>
                </div>
                <div class="header-actions">
                    <div class="session-switcher">
                        <span>Session:</span>
                        <select id="session-select" onchange="switchSession(this.value)">
                            <!-- Populated dynamically -->
                        </select>
                    </div>
                    <button id="theme-toggle" class="theme-toggle" title="Toggle Light/Dark Mode" onclick="toggleTheme()">
                        🌓
                    </button>
                </div>
            </header>

            <div class="content-body">
                <!-- Warnings & Notices -->
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

                <!-- Tab: Dashboard -->
                <section id="tab-dashboard" class="tab-panel active">
                    <div class="grid">
                        
                        <!-- Connection & QR -->
                        <div class="card">
                            <div class="card-title"><i class="fas fa-plug"></i> Connection Status</div>
                            <div class="status-container">
                                <div id="status-badge" class="status-badge disconnected">Initializing...</div>
                                <div id="disconnect-reason" class="disconnect-reason"></div>
                            </div>

                            <div id="qr-container" class="qr-container" style="display:none;">
                                <img id="qr-code" class="qr-code" src="" alt="Pairing QR Code" />
                            </div>

                            <div id="init-placeholder" class="qr-container">
                                <div class="spinner"></div>
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

                        <!-- HA Credentials -->
                        <div class="card">
                            <div class="card-title"><i class="fas fa-home"></i> Home Assistant Setup</div>
                            <div class="details-box">
                                <div class="details-item">
                                    <span class="details-label">Addon Host URI</span>
                                    <code>http://${os.hostname()}:${PORT}</code>
                                </div>
                                <div class="details-item">
                                    <span class="details-label">API Bearer Token</span>
                                    <code class="highlight-token" title="Click to Select All">${API_TOKEN}</code>
                                </div>
                                <div class="details-item">
                                    <span class="details-label">Static Local Address</span>
                                    <code>http://${os.networkInterfaces().eth0?.[0]?.address || '127.0.0.1'}:${PORT}</code>
                                </div>
                            </div>
                            <p style="font-size:11px; color: var(--text-muted); line-height:1.4;">
                                Input either the Host URI or Static IP with the Bearer Token inside your Home Assistant integration setup window.
                            </p>
                        </div>

                        <!-- Webhook Configurations -->
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

                        <!-- Device Properties -->
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
                                <div class="info-item">
                                    <span class="info-label">Session ID</span>
                                    <span id="device-session" class="info-value">...</span>
                                </div>
                            </div>
                            <div id="no-device-msg" class="empty-state">
                                Connect a device to see details.
                            </div>
                        </div>

                        <!-- Actions Console -->
                        <div class="card">
                            <div class="card-title"><i class="fas fa-sliders-h"></i> System Maintenance</div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <button class="btn btn-secondary" onclick="restartSession()">
                                    <i class="fas fa-sync-alt"></i> Restart Daemon
                                </button>
                                <button class="btn btn-danger" onclick="logoutSession()">
                                    <i class="fas fa-sign-out-alt"></i> Hard Reset / Logout
                                </button>
                            </div>
                            <p style="font-size:11px; color:var(--text-muted); margin:0;">
                                Restarting will attempt a fresh connection without deleting credentials.
                            </p>
                        </div>

                        <!-- Bug Report Widget -->
                        <div class="card">
                            <div class="card-title"><i class="fas fa-bug"></i> Integration Bug Report</div>
                            <p style="font-size:12px; color:var(--text-muted); line-height:1.4; margin:0;">
                                Encountered an issue? Download an anonymized debug bundle and report it on GitHub.
                            </p>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: auto;">
                                <button class="btn btn-primary" onclick="downloadDebugInfo()">
                                    <i class="fas fa-download"></i> Anonymized Logs
                                </button>
                                <a href="https://github.com/FaserF/ha-whatsapp/issues/new?template=bug_report.yml" target="_blank" class="btn btn-secondary">
                                    <i class="fas fa-external-link-alt"></i> Open GitHub Issue
                                </a>
                            </div>
                        </div>

                        <!-- System Diagnostics -->
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
                            <p style="font-size:11px; color:var(--text-muted); margin:0;">
                                If you see API errors, these values help diagnose Home Assistant Ingress URL translation failures.
                            </p>
                        </div>

                    </div>

                    <!-- Outbound / Inbound Streams -->
                    <div class="grid">
                        <div class="card">
                            <div class="card-title"><i class="fas fa-paper-plane"></i> Outbound Queue</div>
                            <div id="list-sent" class="history-list">
                                <div class="empty-state">No messages sent...</div>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-title"><i class="fas fa-inbox"></i> Inbound Queue</div>
                            <div id="list-received" class="history-list">
                                <div class="empty-state">No incoming messages...</div>
                            </div>
                        </div>
                        <div class="card" style="grid-column: 1 / -1;">
                            <div class="card-title"><i class="fas fa-exclamation-circle"></i> Pipeline Failures</div>
                            <div id="list-failures" class="history-list">
                                <div class="empty-state">No failed messages...</div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Tab: Logs -->
                <section id="tab-logs" class="tab-panel">
                    <div class="card">
                        <div class="card-header">
                            <div>
                                <h2 class="card-title" style="color:var(--text-main);"><i class="fas fa-terminal"></i> Connection Events</h2>
                                <p class="card-subtitle">Real-time socket events from the underlying WhatsApp daemon service.</p>
                            </div>
                            <div class="logs-actions">
                                <button class="btn btn-secondary btn-sm" onclick="clearLogs()">
                                    <i class="fas fa-trash-alt"></i> Clear Logs
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="loadLogs()">
                                    <i class="fas fa-sync"></i> Refresh
                                </button>
                            </div>
                        </div>
                        <div id="list-logs" class="logs-view">
                            <div class="log-entry">Loading events...</div>
                        </div>
                    </div>
                </section>

                <!-- Tab: Chats (WhatsApp Web style) -->
                <section id="tab-chats" class="tab-panel">
                    <div class="chat-container-layout">
                        <!-- Left Panel: Chat List -->
                        <div class="chat-list-panel">
                            <div class="chat-list-header">
                                <div class="search-box-wrapper">
                                    <i class="fas fa-search search-icon"></i>
                                    <input type="text" id="chat-search" class="chat-search-input" placeholder="Search or start new chat..." oninput="filterChatList()">
                                </div>
                            </div>
                            <div class="chat-list-items" id="chat-list-items">
                                <div class="empty-state">No conversations active yet</div>
                            </div>
                        </div>

                        <!-- Right Panel: Message Thread -->
                        <div class="chat-thread-panel" id="chat-thread-panel">
                            <!-- No chat selected state -->
                            <div class="chat-thread-empty" id="chat-thread-empty">
                                <div class="chat-thread-empty-icon">
                                    <i class="fab fa-whatsapp"></i>
                                </div>
                                <h3>Select a chat to view messages</h3>
                                <p>Select a contact or group from the left sidebar to start chatting.</p>
                            </div>

                            <!-- Active chat state -->
                            <div class="chat-thread-active" id="chat-thread-active" style="display: none;">
                                <div class="chat-thread-header">
                                    <div class="chat-header-avatar">
                                        <i class="fas fa-user-circle"></i>
                                    </div>
                                    <div class="chat-header-info">
                                        <h4 id="active-chat-name">Contact JID</h4>
                                        <p id="active-chat-jid">JID details</p>
                                    </div>
                                </div>
                                
                                <div class="chat-thread-messages" id="chat-thread-messages">
                                    <!-- Messages populate dynamically -->
                                </div>

                                <div class="chat-thread-footer">
                                    <form id="chat-message-form" class="chat-message-form" onsubmit="sendChatMessage(event)">
                                        <input type="text" id="chat-message-input" class="chat-message-input" placeholder="Type a message..." autocomplete="off">
                                        <button type="submit" class="btn btn-primary chat-send-btn">
                                            <i class="fas fa-paper-plane"></i>
                                        </button>
                                    </form>
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

      <!-- Toast Alerts Container -->
      <div id="toast-container" class="toast-container"></div>

      <!-- Custom Confirmation Modal Dialog -->
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

      <script>
        let currentSession = ${JSON.stringify(sessionId)};
        let isConnected = false;
        let lastLogText = '';
        let activeChatJid = null;
        let allChats = [];
        let isChatTabActive = false;

        // Tab Switching
        const navItems = document.querySelectorAll('.nav-item');
        const tabPanels = document.querySelectorAll('.tab-panel');
        const pageTitle = document.getElementById('page-title');

            navItems.forEach(item => {
                if (item.getAttribute('data-tab')) {
                    item.addEventListener('click', () => {
                        const tab = item.getAttribute('data-tab');
                        switchTab(tab);
                    });
                }
            });

            function switchTab(tabId) {
                navItems.forEach(nav => nav.classList.remove('active'));
                tabPanels.forEach(panel => panel.classList.remove('active'));

                const activeNav = document.querySelector(\`.nav-item[data-tab="\${tabId}"]\`);
                const activePanel = document.getElementById(\`tab-\${tabId}\`);
                
                if (activeNav && activePanel) {
                    activeNav.classList.add('active');
                    activePanel.classList.add('active');
                    pageTitle.innerText = tabId.charAt(0).toUpperCase() + tabId.slice(1);
                    
                    isChatTabActive = (tabId === 'chats');
                    if (isChatTabActive) {
                        loadChats();
                    }
                }
            }

            // Host Utilities
            const getBasePath = () => {
                try {
                    const path = window.location.pathname;
                    const folder = path.substring(0, path.lastIndexOf('/') + 1);
                    return folder || '/';
                } catch (e) {
                    return '/';
                }
            };
            const basePath = getBasePath().replace(/[/]+/g, '/');

            document.getElementById('diag-basepath').textContent = basePath;
            document.getElementById('diag-pathname').textContent = window.location.pathname;

            // Update raw log link href dynamically
            document.getElementById('raw-logs-link').href = basePath + 'logs';

            function switchSession(id) {
                currentSession = id;
                const url = new URL(window.location);
                url.searchParams.set('session_id', id);
                window.history.replaceState({}, '', url);
                updateDashboard();
            }

            // Toasts
            function showToast(message, type = 'info') {
                const container = document.getElementById('toast-container');
                const toast = document.createElement('div');
                toast.className = \`toast \${type}\`;
                let icon = 'fa-info-circle';
                if (type === 'success') icon = 'fa-check-circle';
                if (type === 'danger') icon = 'fa-exclamation-circle';
                if (type === 'warning') icon = 'fa-exclamation-triangle';

                toast.innerHTML = \`<i class="fas \${icon} toast-icon"></i><span>\${message}</span>\`;
                container.appendChild(toast);

                setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 200);
                }, 3500);
            }

            // Confirmation Modal
            const confirmModal = document.getElementById('confirm-modal');
            const modalTitle = document.getElementById('modal-title');
            const modalMessage = document.getElementById('modal-message');
            const modalConfirmBtn = document.getElementById('modal-confirm-btn');
            const modalCancelBtn = document.getElementById('modal-cancel-btn');
            const modalClose = document.getElementById('modal-close');
            let modalResolver = null;

            function showConfirm(title, msg) {
                modalTitle.innerText = title;
                modalMessage.innerText = msg;
                confirmModal.classList.add('show');
                return new Promise((resolve) => {
                    modalResolver = resolve;
                });
            }

            function closeConfirm(result) {
                confirmModal.classList.remove('show');
                if (modalResolver) {
                    modalResolver(result);
                    modalResolver = null;
                }
            }

            modalConfirmBtn.addEventListener('click', () => closeConfirm(true));
            modalCancelBtn.addEventListener('click', () => closeConfirm(false));
            modalClose.addEventListener('click', () => closeConfirm(false));

            // API interactions
            async function downloadDebugInfo() {
                try {
                    const response = await fetch(basePath + 'api/debug/download?session_id=' + currentSession, {
                        headers: { 'Accept': 'application/json' }
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
                const ok = await showConfirm('Restart WhatsApp Daemon?', 'Are you sure you want to trigger a soft restart on this session daemon?');
                if (!ok) return;

                showToast('Restarting session...', 'warning');
                try {
                    const response = await fetch(basePath + 'api/session/restart', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ session_id: currentSession })
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
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ session_id: currentSession })
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
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ session_id: currentSession })
                    });
                    if (response.ok) {
                        showToast('Logs database cleared', 'success');
                        updateDashboard();
                    }
                } catch (e) {
                    showToast('Failed to clear logs', 'danger');
                }
            }

            // Live Log Polling
            async function loadLogs() {
                try {
                    const response = await fetch(basePath + 'logs?session_id=' + currentSession);
                    if (!response.ok) return;
                    const logs = await response.json();
                    
                    document.getElementById('list-logs').innerHTML = logs.length ?
                        logs.map(l =>
                            '<div class="log-entry"><span class="log-time">' + l.timestamp + '</span><span class="log-type-' + l.type + '">' + l.msg + '</span></div>'
                        ).join('') : '<div class="log-entry">No logs yet</div>';
                } catch (err) {
                    console.error(err);
                }
            }

            // Chat Client Functions
            async function loadChats() {
                if (!isChatTabActive) return;
                try {
                    const response = await fetch(basePath + 'api/chats?session_id=' + currentSession);
                    if (!response.ok) return;
                    allChats = await response.json();
                    renderChatList(allChats);
                } catch (e) {
                    console.error("Failed to load chats:", e);
                }
            }

            function renderChatList(chats) {
                const container = document.getElementById('chat-list-items');
                if (!chats || chats.length === 0) {
                    container.innerHTML = '<div class="empty-state">No conversations active yet</div>';
                    return;
                }

                const searchVal = document.getElementById('chat-search').value.toLowerCase();
                const filtered = chats.filter(c => 
                    c.name.toLowerCase().includes(searchVal) || 
                    c.jid.toLowerCase().includes(searchVal)
                );

                if (filtered.length === 0) {
                    container.innerHTML = '<div class="empty-state">No matching chats found</div>';
                    return;
                }

                container.innerHTML = filtered.map(c => {
                    const isActive = c.jid === activeChatJid ? 'active' : '';
                    const timeStr = c.timestamp ? new Date(c.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                    const avatarIcon = c.jid.endsWith('@g.us') ? 'fa-users' : 'fa-user';
                    
                    return \`
                        <div class="chat-item \${isActive}" onclick="selectChat('\${c.jid}', '\${escapeHtml(c.name)}')">
                            <div class="chat-avatar">
                                <i class="fas \${avatarIcon}"></i>
                            </div>
                            <div class="chat-info">
                                <div class="chat-meta">
                                    <span class="chat-name">\${escapeHtml(c.name)}</span>
                                    <span class="chat-time">\${timeStr}</span>
                                </div>
                                <div class="chat-last-msg">\${escapeHtml(c.preview || 'No messages')}</div>
                            </div>
                        </div>
                    \`;
                }).join('');
            }

            function filterChatList() {
                renderChatList(allChats);
            }

            function selectChat(jid, name) {
                activeChatJid = jid;
                
                document.getElementById('chat-thread-empty').style.display = 'none';
                document.getElementById('chat-thread-active').style.display = 'flex';
                
                document.getElementById('active-chat-name').textContent = name;
                document.getElementById('active-chat-jid').textContent = jid;
                
                document.getElementById('chat-thread-messages').innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>';
                
                const items = document.querySelectorAll('.chat-item');
                items.forEach(item => {
                    item.classList.remove('active');
                });

                loadChatMessages(jid);
            }

            async function loadChatMessages(jid) {
                if (!isChatTabActive || activeChatJid !== jid) return;
                try {
                    const response = await fetch(basePath + 'api/messages?session_id=' + currentSession + '&jid=' + encodeURIComponent(jid));
                    if (!response.ok) return;
                    const messages = await response.json();
                    
                    const container = document.getElementById('chat-thread-messages');
                    const wasScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;

                    if (messages.length === 0) {
                        container.innerHTML = '<div class="empty-state">No messages in this conversation yet</div>';
                        return;
                    }

                    container.innerHTML = messages.map(m => {
                        const direction = m.fromMe ? 'outbound' : 'inbound';
                        const timeStr = new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        return \`
                            <div class="msg-bubble-row \${direction}">
                                <div class="msg-bubble">
                                    <div class="msg-bubble-text">\${escapeHtml(m.text)}</div>
                                    <div class="msg-bubble-time">\${timeStr}</div>
                                </div>
                            </div>
                        \`;
                    }).join('');

                    if (wasScrolledToBottom) {
                        container.scrollTop = container.scrollHeight;
                    }
                } catch (e) {
                    console.error("Failed to load chat messages:", e);
                }
            }

            async function sendChatMessage(event) {
                event.preventDefault();
                if (!activeChatJid) return;

                const input = document.getElementById('chat-message-input');
                const message = input.value.trim();
                if (!message) return;

                input.value = '';
                showToast('Sending message...', 'info');

                try {
                    const rawNumber = activeChatJid.split('@')[0];
                    const response = await fetch(basePath + 'send_message', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            number: rawNumber,
                            message: message
                        })
                    });

                    if (response.ok) {
                        showToast('Message sent', 'success');
                        loadChatMessages(activeChatJid);
                        loadChats();
                    } else {
                        const errData = await response.json();
                        showToast(errData.detail || 'Failed to send message', 'danger');
                    }
                } catch (e) {
                    showToast('Failed to send message', 'danger');
                }
            }

            function escapeHtml(str) {
                if (!str) return '';
                return str
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }

            async function updateDashboard() {
                try {
                    const response = await fetch(basePath + 'api/dashboard?session_id=' + currentSession, {
                        headers: { 'Accept': 'application/json' }
                    });
                    if (!response.ok) {
                        document.getElementById('card-diagnostics').style.display = 'block';
                        document.getElementById('status-badge').className = 'status-badge disconnected';
                        if (response.status === 403) {
                            document.getElementById('status-badge').textContent = 'Access Blocked (403) ⛔';
                        } else {
                            document.getElementById('status-badge').textContent = 'API Error (' + response.status + ') ⚠️';
                        }
                        return;
                    }
                    
                    document.getElementById('card-diagnostics').style.display = 'none';
                    const data = await response.json();
                    isConnected = data.isConnected;

                    // Version elements
                    document.getElementById('node-version').textContent = data.nodeVersion || 'N/A';
                    document.getElementById('addon-version-sidebar').textContent = data.addonVersion || 'N/A';
                    document.getElementById('int-version-sidebar').textContent = data.integrationVersion || 'N/A';
                    document.getElementById('baileys-version').textContent = data.baileysVersion || 'N/A';

                    // Dev/Beta releases banner
                    const addonVer = data.addonVersion || '';
                    const intVer = data.integrationVersion || '';
                    const isDev = addonVer.toLowerCase().includes('edge') ||
                                  addonVer.toLowerCase().includes('dev') ||
                                  intVer.toLowerCase().includes('dev') ||
                                  intVer.toLowerCase().includes('beta') ||
                                  intVer.toLowerCase().includes('pre');
                    document.getElementById('dev-banner').style.display = isDev ? 'flex' : 'none';

                    // Ingress config logs link
                    const slug = data.addonSlug || 'unknown';
                    const fullLogsLink = document.getElementById('full-logs-link');
                    if (fullLogsLink) {
                        const isIngress = window.location.pathname.includes('/api/hassio_ingress/');
                        if (isIngress) {
                            fullLogsLink.style.display = 'flex';
                            fullLogsLink.href = '/config/app/' + slug + '/logs';
                        } else {
                            fullLogsLink.style.display = 'none';
                        }
                    }

                    // Session drop-down list
                    const select = document.getElementById('session-select');
                    let options = '';
                    data.sessionList.forEach(s => {
                        const isSelected = s.id === currentSession ? 'selected' : '';
                        const icon = s.connected ? '\u2705' : '\u274C';
                        options += '<option value="' + s.id + '" ' + isSelected + '>' + s.id + ' (' + icon + ')</option>';
                    });
                    select.innerHTML = options;

                    // Passkey notifications
                    const pkBanner = document.getElementById('passkey-banner');
                    if (pkBanner) pkBanner.style.display = data.passkeyDetected ? 'flex' : 'none';

                    // Connection status details
                    const badge = document.getElementById('status-badge');
                    badge.className = 'status-badge ' + (data.isConnected ? 'connected' : (data.currentQR ? 'waiting' : 'disconnected'));
                    badge.textContent = data.isConnected ? 'Connected \u2705' : (data.currentQR ? 'Scan QR Code \uD83D\uDCF1' : (data.disconnectReason === 'logged_out' ? 'Logged Out \uD83D\uDEAB' : 'Disconnected \u274C'));
                    document.getElementById('disconnect-reason').textContent = data.disconnectReason ? 'Reason: ' + data.disconnectReason : '';

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
                    document.getElementById('webhook-status').textContent = data.webhookEnabled ? 'Enabled ✅' : 'Disabled ❌';
                    document.getElementById('webhook-status').style.color = data.webhookEnabled ? 'var(--primary)' : 'var(--danger)';
                    document.getElementById('webhook-url').textContent = data.webhookUrl || 'Not Configured';

                    // Connected account fields
                    const hasDevice = data.isConnected && data.deviceInfo && data.deviceInfo.number;
                    document.getElementById('device-info-grid').style.display = hasDevice ? 'grid' : 'none';
                    document.getElementById('no-device-msg').style.display = hasDevice ? 'none' : 'block';
                    if (hasDevice) {
                        document.getElementById('device-name').textContent = data.deviceInfo.name || '—';
                        document.getElementById('device-number').textContent = '+' + data.deviceInfo.number;
                        document.getElementById('device-session').textContent = data.sessionId || 'default';
                    }

                    // Stats properties
                    document.getElementById('stat-sent').textContent = data.stats.sent;
                    document.getElementById('stat-received').textContent = data.stats.received;
                    document.getElementById('stat-failed').textContent = data.stats.failed;
                    document.getElementById('val-uptime').textContent = data.uptime || '00:00:00';
                    document.getElementById('val-reconnects').textContent = data.stats?.totalReconnects ?? data.reconnectAttempts ?? 0;

                    // Render streams lists
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



                } catch (e) {
                    console.error(e);
                }
            }

        // Theme management
        const getInitialTheme = () => {
            const saved = localStorage.getItem('ha-whatsapp-theme');
            if (saved) return saved;
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
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

        setTheme(getInitialTheme());

        // Polling loop
        updateDashboard();
        setInterval(updateDashboard, 5000);
        setInterval(loadLogs, 3000);
        setInterval(() => {
            if (isChatTabActive) {
                loadChats();
                if (activeChatJid) {
                    loadChatMessages(activeChatJid);
                }
            }
        }, 4000);

        // Global full data refresh every 60 seconds
        setInterval(() => {
            updateDashboard();
            loadLogs();
            if (isChatTabActive) {
                loadChats();
                if (activeChatJid) {
                    loadChatMessages(activeChatJid);
                }
            }
        }, 60000);
      </script>
    </body>
    </html>
  `;
}
