import os from 'os';
export default ({ PORT, API_TOKEN, getLocalIP }) => `
<section id="tab-dashboard" class="tab-panel active">
                <div class="dashboard-grid">
                    <div class="card">
                        <div class="card-title"><i class="fas fa-plug"></i> <span data-i18n="dashboard.connection_status">Connection Status</span></div>
                        <div class="status-container">
                            <div id="status-badge" class="status-badge disconnected" data-i18n="dashboard.initializing">Initializing...</div>
                            <div id="disconnect-reason" class="disconnect-reason"></div>
                        </div>
                        <div id="qr-container" class="qr-container" style="display:none;">
                            <img id="qr-code" class="qr-code" src="" alt="Pairing QR Code" data-i18n-title="dashboard.pairing_qr_code" />
                        </div>
                        <div id="init-placeholder" class="qr-container" style="flex-direction:column;gap:12px;background-color:var(--bg-app);border-color:var(--border-color);">
                            <div class="spinner"></div>
                            <span id="init-log-text" style="font-size:11px;color:var(--text-muted);text-align:center;max-width:200px;line-height:1.4;"></span>
                        </div>
                        <div class="stats-row">
                            <div class="stat-box"><div id="stat-sent" class="stat-val">0</div><div class="stat-label" data-i18n="dashboard.sent">Sent</div></div>
                            <div class="stat-box"><div id="stat-received" class="stat-val">0</div><div class="stat-label" data-i18n="dashboard.received">Received</div></div>
                            <div class="stat-box"><div id="stat-failed" class="stat-val">0</div><div class="stat-label" data-i18n="dashboard.failed">Failed</div></div>
                        </div>
                        <div style="font-size:11px; text-align:center; color: var(--text-muted); font-weight:600;">
                            <span data-i18n="dashboard.uptime">Uptime</span>: <span id="val-uptime" style="color:var(--text-main);">00:00:00</span> &bull; 
                            <span data-i18n="dashboard.reconnections">Reconnections</span>: <span id="val-reconnects" style="color:var(--text-main);">0</span>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-title" id="setup-card-title"><i class="fas fa-home"></i> <span data-i18n="dashboard.ha_setup">Home Assistant Setup</span></div>
                        <div class="details-box">
                            <div class="details-item">
                                <span class="details-label" id="label-host-uri" data-i18n="dashboard.addon_host_uri">Addon Host URI</span>
                                <code>http://${os.hostname()}:${PORT}</code>
                            </div>
                            <div class="details-item">
                                <span class="details-label" data-i18n="dashboard.api_bearer_token">API Bearer Token</span>
                                <code class="highlight-token" title="Click to Select All" data-i18n-title="dashboard.click_to_select_all">${API_TOKEN}</code>
                            </div>
                            <div class="details-item">
                                <span class="details-label" data-i18n="dashboard.static_local_address">Static Local Address</span>
                                <code>http://${getLocalIP()}:${PORT}</code>
                            </div>
                        </div>
                        <p style="font-size:11px; color: var(--text-muted); line-height:1.4;">
                            <span data-i18n="dashboard.ha_setup_hint">Input either the Host URI or Static IP with the Bearer Token inside your Home Assistant integration setup window.</span>
                        </p>
                    </div>

                    <div class="card" id="device-card">
                        <div class="card-title"><i class="fas fa-mobile-alt"></i> <span data-i18n="dashboard.connected_account">Connected Account</span></div>
                        <div id="device-info-grid" class="info-grid" style="display:none;">
                            <div class="info-item">
                                <span class="info-label" data-i18n="dashboard.account_name">Account Name</span>
                                <span id="device-name" class="info-value">...</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label" data-i18n="dashboard.phone_number">Phone Number</span>
                                <span id="device-number" class="info-value">...</span>
                            </div>
                            <div class="info-item" style="grid-column: span 2;">
                                <span class="info-label" data-i18n="dashboard.profile_description">Profile Description (About)</span>
                                <span id="device-status" class="info-value" style="font-style:italic;color:var(--text-main);">—</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label" data-i18n="dashboard.session_id">Session ID</span>
                                <span id="device-session" class="info-value">...</span>
                            </div>
                        </div>
                        <div id="no-device-msg" class="empty-state">
                            <span data-i18n="dashboard.connect_device_hint">Connect a device to see details.</span>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-title"><i class="fas fa-link"></i> <span data-i18n="dashboard.webhook">Webhook Preferences</span></div>
                        <div class="details-box">
                            <div class="details-item">
                                <span class="details-label" data-i18n="dashboard.webhook_active">Active Status</span>
                                <span id="webhook-status" class="sys-info-val">...</span>
                            </div>
                            <div class="details-item">
                                <span class="details-label" data-i18n="dashboard.webhook_url">Destination URL</span>
                                <span id="webhook-url" class="sys-info-val" style="word-break:break-all;">...</span>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-title"><i class="fas fa-sliders-h"></i> <span data-i18n="dashboard.system_maintenance">System Maintenance</span></div>
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 10px;">
                            <button class="btn btn-secondary" onclick="restartSession()" title="Restart Daemon" data-i18n-title="dashboard.restart_daemon_title"><i class="fas fa-sync-alt"></i> <span data-i18n="dashboard.restart_daemon">Restart Daemon</span></button>
                            <button class="btn btn-secondary" onclick="purgeSessions()" title="Clean Inactive Sessions" data-i18n-title="dashboard.clean_sessions_title"><i class="fas fa-broom"></i> <span data-i18n="dashboard.clean_sessions">Clean Sessions</span></button>
                            <button class="btn btn-danger" onclick="logoutSession()" title="Hard Reset / Logout" data-i18n-title="dashboard.hard_reset_title"><i class="fas fa-sign-out-alt"></i> <span data-i18n="dashboard.hard_reset">Hard Reset</span></button>
                        </div>
                        <p style="font-size:11px; color:var(--text-muted); margin:0;"><span data-i18n="dashboard.restart_hint">Restarting will attempt a fresh connection without deleting credentials.</span></p>
                    </div>

                    <div class="card">
                        <div class="card-title"><i class="fas fa-bug"></i> <span data-i18n="dashboard.bug_report">Integration Bug Report</span></div>
                        <p style="font-size:12px; color:var(--text-muted); line-height:1.4; margin:0;"><span data-i18n="dashboard.bug_report_desc">Encountered an issue? Download an anonymized debug bundle and report it on GitHub.</span></p>
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: auto;">
                            <button class="btn btn-primary" onclick="downloadDebugInfo()"><i class="fas fa-download"></i> <span data-i18n="dashboard.download_logs">Anonymized Logs</span></button>
                            <a href="https://github.com/FaserF/ha-whatsapp/issues/new?template=bug_report.yml" target="_blank" class="btn btn-secondary"><i class="fas fa-external-link-alt"></i> <span data-i18n="dashboard.open_issue">Open GitHub Issue</span></a>
                        </div>
                    </div>

                    <div class="card" id="card-diagnostics" style="display:none; border: 2px solid var(--warning); grid-column: 1 / -1;">
                        <div class="card-title"><i class="fas fa-search-plus"></i> <span data-i18n="dashboard.diagnostics">System Diagnostics</span></div>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label" data-i18n="dashboard.base_path">Base Path</span>
                                <span id="diag-basepath" class="info-value" style="word-break: break-all; font-family: monospace;">...</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label" data-i18n="dashboard.actual_url">Actual URL</span>
                                <span id="diag-pathname" class="info-value" style="word-break: break-all; font-family: monospace;">...</span>
                            </div>
                        </div>
                        <p style="font-size:11px; color:var(--text-muted); margin:0;"><span data-i18n="dashboard.diagnostics_hint">If you see API errors, these values help diagnose Home Assistant Ingress URL translation failures.</span></p>
                    </div>
                </div>

                <div class="dashboard-queues-grid">
                    <div class="card">
                        <div class="card-title"><i class="fas fa-paper-plane"></i> <span data-i18n="dashboard.outbound_queue">Outbound Queue</span></div>
                        <div id="list-sent" class="history-list"><div class="empty-state" data-i18n="dashboard.no_sent">No messages sent...</div></div>
                    </div>
                    <div class="card">
                        <div class="card-title"><i class="fas fa-inbox"></i> <span data-i18n="dashboard.inbound_queue">Inbound Queue</span></div>
                        <div id="list-received" class="history-list"><div class="empty-state" data-i18n="dashboard.no_received">No incoming messages...</div></div>
                    </div>
                    <div class="card" style="grid-column: 1 / -1;">
                        <div class="card-title"><i class="fas fa-exclamation-circle"></i> <span data-i18n="dashboard.pipeline_failures">Pipeline Failures</span></div>
                        <div id="list-failures" class="history-list"><div class="empty-state" data-i18n="dashboard.no_failures">No failed messages...</div></div>
                    </div>
                </div>
            </section>
`;
