export default () => `
<section id="tab-logs" class="tab-panel">
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h2 class="card-title" style="color:var(--text-main);"><i class="fas fa-terminal"></i> <span data-i18n="logs.title">Connection Events</span></h2>
                            <p class="card-subtitle" style="margin-bottom:16px;" data-i18n="logs.subtitle">Real-time socket events from the underlying WhatsApp daemon service.</p>
                        </div>
                        <div class="logs-actions">
                            <button class="btn btn-secondary btn-sm" onclick="clearLogs()"><i class="fas fa-trash-alt"></i> <span data-i18n="logs.clear_logs">Clear Logs</span></button>
                            <button class="btn btn-secondary btn-sm" onclick="loadLogs()"><i class="fas fa-sync"></i> <span data-i18n="logs.refresh">Refresh</span></button>
                        </div>
                    </div>
                    <div id="list-logs" class="logs-view"><div class="log-entry" data-i18n="logs.loading">Loading events...</div></div>
                </div>
            </section>
`;
