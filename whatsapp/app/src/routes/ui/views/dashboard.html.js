export default () => `
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
`;
