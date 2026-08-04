export default () => `
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
`;
