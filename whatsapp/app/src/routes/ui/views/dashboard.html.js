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
                            <div class="stat-box">
                                <div id="stat-sent" class="stat-val">0</div>
                                <div id="stat-sent-sub" class="stat-subval">0 <span data-i18n="dashboard.since_restart">since restart</span></div>
                                <div class="stat-label">
                                    <span data-i18n="dashboard.sent">Sent</span>
                                    <i class="fas fa-info-circle info-tooltip-icon" data-i18n-title="dashboard.tooltip_sent" title="Total outbound WhatsApp messages successfully transmitted."></i>
                                </div>
                            </div>
                            <div class="stat-box">
                                <div id="stat-received" class="stat-val">0</div>
                                <div id="stat-received-sub" class="stat-subval">0 <span data-i18n="dashboard.since_restart">since restart</span></div>
                                <div class="stat-label">
                                    <span data-i18n="dashboard.received">Received</span>
                                    <i class="fas fa-info-circle info-tooltip-icon" data-i18n-title="dashboard.tooltip_received" title="Total incoming WhatsApp messages processed over the connection."></i>
                                </div>
                            </div>
                            <div class="stat-box">
                                <div id="stat-failed" class="stat-val">0</div>
                                <div id="stat-failed-sub" class="stat-subval">0 <span data-i18n="dashboard.since_restart">since restart</span></div>
                                <div class="stat-label">
                                    <span data-i18n="dashboard.failed">Failed</span>
                                    <i class="fas fa-info-circle info-tooltip-icon" data-i18n-title="dashboard.tooltip_failed" title="Failed message dispatch attempts."></i>
                                </div>
                            </div>
                        </div>
                        <div style="font-size:11px; text-align:center; color: var(--text-muted); font-weight:600; line-height:1.6; margin-top:8px;">
                            <div>
                                <span data-i18n="dashboard.uptime">Uptime</span>: <span id="val-uptime" style="color:var(--text-main);">00:00:00</span>
                                <i class="fas fa-info-circle info-tooltip-icon" data-i18n-title="dashboard.tooltip_uptime" title="Time elapsed since this addon was last started."></i>
                                &bull; 
                                <span data-i18n="dashboard.reconnections">Reconnections</span>: <span id="val-reconnects" style="color:var(--text-main);">0</span>
                                <i class="fas fa-info-circle info-tooltip-icon" data-i18n-title="dashboard.tooltip_reconnections" title="Count of automatic reconnect attempts to WhatsApp servers."></i>
                            </div>
                            <div id="val-started-at" style="font-size:10px; color:var(--text-muted); font-weight:500;"></div>
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

                    <!-- Auto Responder Card -->
                    <div class="card" id="card-autoresponder">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div class="card-title" style="margin-bottom:0;"><i class="fas fa-umbrella-beach"></i> <span data-i18n="autoresponder.title">Auto Responder (Away / Vacation)</span></div>
                            <span id="ar-status-badge" class="badge" style="font-size:11px; text-transform:uppercase; font-weight:700; letter-spacing:0.5px; padding:4px 8px; border-radius:6px; background:rgba(255,255,255,0.06); color:var(--text-muted);" data-i18n="autoresponder.inactive_status">Disabled</span>
                        </div>
                        <p style="font-size:12px; color:var(--text-muted); margin:0 0 16px 0;" data-i18n="autoresponder.subtitle">Automatically reply to incoming WhatsApp messages during vacations, off-hours, or phone-free times.</p>

                        <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(37, 211, 102, 0.05); border:1px solid rgba(37, 211, 102, 0.2); border-radius:12px; padding:14px 16px; margin-bottom:16px;">
                            <div>
                                <div style="font-size:13px; font-weight:600; color:var(--text-main); margin-bottom:2px;" data-i18n="autoresponder.master_switch">Enable Auto Responder</div>
                                <div style="font-size:11px; color:var(--text-muted);" data-i18n="autoresponder.master_switch_hint">When enabled, incoming messages receive an automatic reply.</div>
                            </div>
                            <label class="mod-toggle-switch">
                                <input type="checkbox" id="ar-enabled" onchange="saveAutoResponderConfig()">
                                <div class="mod-toggle-track">
                                    <div class="mod-toggle-thumb"></div>
                                </div>
                            </label>
                        </div>

                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:16px;">
                            <div>
                                <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:6px;" data-i18n="autoresponder.start_time_label">Start Time (Optional)</label>
                                <input type="datetime-local" id="ar-start-time" class="mod-input" style="width:100%;" onchange="saveAutoResponderConfig()">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:6px;" data-i18n="autoresponder.end_time_label">End Time (Optional)</label>
                                <input type="datetime-local" id="ar-end-time" class="mod-input" style="width:100%;" onchange="saveAutoResponderConfig()">
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:16px;">
                            <div>
                                <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:6px;" data-i18n="autoresponder.scope_title">Scope</label>
                                <select id="ar-direct-only" class="mod-select" style="width:100%;" onchange="saveAutoResponderConfig()">
                                    <option value="true" data-i18n="autoresponder.direct_only">Direct Messages Only (1:1)</option>
                                    <option value="false" data-i18n="autoresponder.all_chats">Direct Messages & Groups</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:6px;" data-i18n="autoresponder.frequency_title">Frequency</label>
                                <select id="ar-once-per-contact" class="mod-select" style="width:100%;" onchange="saveAutoResponderConfig()">
                                    <option value="true" data-i18n="autoresponder.once_per_contact">Once per contact (Recommended)</option>
                                    <option value="false" data-i18n="autoresponder.every_message">Every message</option>
                                </select>
                            </div>
                        </div>

                        <div style="margin-bottom:16px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;" data-i18n="autoresponder.template_title">Message Template</label>
                                <button type="button" class="btn btn-secondary btn-xs" onclick="resetAutoResponderTemplate()" style="font-size:11px; padding:4px 8px;"><i class="fas fa-undo"></i> <span data-i18n="autoresponder.reset_template_btn">Reset Template</span></button>
                            </div>
                            <textarea id="ar-message-template" class="mod-textarea" rows="4" style="min-height:90px; width:100%;" oninput="updateAutoResponderPreview()" onchange="saveAutoResponderConfig()"></textarea>
                        </div>

                        <!-- Placeholders Guide & Live Resolution Table -->
                        <div style="margin-bottom:16px; background:rgba(0, 0, 0, 0.1); border:1px solid var(--border-color); border-radius:10px; padding:12px 14px;">
                            <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;"><i class="fas fa-code"></i> <span data-i18n="autoresponder.placeholders_guide_title">Available Placeholders & Live Resolution</span></div>
                            <div style="display:flex; flex-direction:column; gap:6px; font-size:12px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.04); padding-bottom:4px;">
                                    <div><code style="color:var(--primary); font-weight:600;">{sender_name}</code> <span style="color:var(--text-muted); font-size:11px;" data-i18n="autoresponder.placeholder_sender_name">Sender name or phone number</span></div>
                                    <div id="ar-val-sender" style="color:var(--text-main); font-weight:500; font-family:monospace; font-size:11px;">-</div>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.04); padding-bottom:4px;">
                                    <div><code style="color:var(--primary); font-weight:600;">{start_time}</code> <span style="color:var(--text-muted); font-size:11px;" data-i18n="autoresponder.placeholder_start_time">Formatted start datetime</span></div>
                                    <div id="ar-val-start" style="color:var(--text-main); font-weight:500; font-family:monospace; font-size:11px;">—</div>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.04); padding-bottom:4px;">
                                    <div><code style="color:var(--primary); font-weight:600;">{end_time}</code> <span style="color:var(--text-muted); font-size:11px;" data-i18n="autoresponder.placeholder_end_time">Formatted end datetime</span></div>
                                    <div id="ar-val-end" style="color:var(--text-main); font-weight:500; font-family:monospace; font-size:11px;">—</div>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.04); padding-bottom:4px;">
                                    <div><code style="color:var(--primary); font-weight:600;">{end_time_text}</code> <span style="color:var(--text-muted); font-size:11px;" data-i18n="autoresponder.placeholder_end_time_text">Localized clause (until ...)</span></div>
                                    <div id="ar-val-end-text" style="color:var(--text-main); font-weight:500; font-family:monospace; font-size:11px;">—</div>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div><code style="color:var(--primary); font-weight:600;">{once_notice}</code> <span style="color:var(--text-muted); font-size:11px;" data-i18n="autoresponder.placeholder_once_notice">Single-reply notice</span></div>
                                    <div id="ar-val-once" style="color:var(--text-main); font-weight:500; font-size:11px; max-width:50%; text-align:right; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">-</div>
                                </div>
                            </div>
                        </div>

                        <!-- Live Message Bubble Preview -->
                        <div style="margin-bottom:16px;">
                            <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:6px;"><i class="fas fa-eye"></i> <span data-i18n="autoresponder.live_preview_title">Live Message Preview (How contacts see it)</span></label>
                            <div style="background:var(--bg-app); border:1px solid var(--border-color); border-radius:12px; padding:14px 16px; position:relative;">
                                <div style="background:var(--primary-glow); border:1px solid rgba(37, 211, 102, 0.25); color:var(--text-main); border-radius:10px 10px 2px 10px; padding:10px 14px; font-size:13px; line-height:1.5; white-space:pre-wrap; word-break:break-word;" id="ar-live-preview-bubble">...</div>
                            </div>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0, 0, 0, 0.15); border:1px solid var(--border-color); padding:10px 14px; border-radius:10px;">
                            <span id="ar-seen-count" style="font-size:12px; color:var(--text-muted); font-weight:500;"><span data-i18n="autoresponder.seen_count_label">0 contacts replied</span></span>
                            <button type="button" class="btn btn-secondary btn-xs" onclick="resetAutoResponderSeen()" style="font-size:12px; padding:6px 12px;"><i class="fas fa-redo"></i> <span data-i18n="autoresponder.reset_seen_btn">Reset Contacts</span></button>
                        </div>
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
