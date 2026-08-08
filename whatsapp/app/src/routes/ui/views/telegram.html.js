export default () => `
<section id="tab-telegram" class="tab-panel">

    <!-- Hero Header -->
    <div class="mod-hero">
        <div class="mod-hero-left">
            <div class="mod-hero-icon" style="background:linear-gradient(135deg, #0088cc 0%, #006699 100%);color:#fff;">
                <i class="fab fa-telegram-plane"></i>
            </div>
            <div>
                <h2 class="mod-hero-title">WhatsApp &amp; Telegram Native Bridge</h2>
                <p class="mod-hero-sub">Bi-directional message mirroring &middot; Media sync &middot; Intelligent thread quotes</p>
            </div>
        </div>
        <div class="mod-hero-controls">
            <div class="mod-toggle-row">
                <span class="mod-toggle-label"><i class="fas fa-power-off"></i> Bridge Active</span>
                <label class="mod-toggle-switch">
                    <input type="checkbox" id="tg-global-toggle" onchange="toggleTelegramBridge(this.checked)">
                    <span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span>
                </label>
            </div>
        </div>
    </div>

    <!-- Bot Token Settings Card -->
    <div class="card mod-settings-card" style="margin-top: 16px;">
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
            <div style="font-size: 28px; color: #0088cc;"><i class="fab fa-telegram"></i></div>
            <div>
                <h3 style="margin: 0; font-weight: 600; font-size:16px;">Telegram Bot API Settings</h3>
                <p style="color: var(--text-muted); margin: 2px 0 0; font-size: 12px;">
                    Provide your Telegram Bot Token from <code>@BotFather</code>. On saving, available Telegram chats will be fetched automatically.
                </p>
            </div>
        </div>

        <div class="mod-field-group" style="margin-bottom:16px;">
            <label class="mod-field-label"><i class="fas fa-key"></i> Telegram Bot API Token</label>
            <div style="display:flex; gap:12px; margin-top:6px;">
                <input type="password" id="tg-bot-token-input" class="mod-textarea" style="height:38px; flex:1;" placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ">
                <button class="btn btn-primary btn-sm" onclick="saveTelegramBotToken()"><i class="fas fa-save"></i> Save &amp; Validate Token</button>
            </div>
        </div>

        <div id="tg-bot-status-badge" style="display:none; font-size:13px; font-weight:600; padding:8px 12px; border-radius:6px; background:rgba(0,136,204,0.1); color:#0088cc; display:flex; align-items:center; gap:8px;">
            <i class="fas fa-robot"></i> <span id="tg-bot-status-text">Bot Username: @NotConfigured</span>
        </div>
    </div>

    <!-- Mappings Section -->
    <div class="card mod-settings-card" style="margin-top: 16px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="font-size:22px; color:var(--primary);"><i class="fas fa-exchange-alt"></i></div>
                <div>
                    <h3 style="margin:0; font-weight:600; font-size:16px;">Chat &amp; Group Mappings</h3>
                    <p style="color:var(--text-muted); margin:2px 0 0; font-size:12px;">Create bi-directional or directional message sync bridges between WhatsApp and Telegram.</p>
                </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="openAddTelegramMappingModal()"><i class="fas fa-plus"></i> Add New Mapping</button>
        </div>

        <!-- Mappings Table -->
        <div class="table-responsive">
            <table class="data-table" id="tg-mappings-table">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>WhatsApp Target</th>
                        <th>Telegram Target</th>
                        <th>Sync Direction</th>
                        <th>Metadata Header</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="tg-mappings-tbody">
                    <tr>
                        <td colspan="6" style="text-align:center; color:var(--text-muted); padding:24px;">No active chat mappings configured. Click "Add New Mapping" to start bridging.</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Add/Edit Mapping Modal -->
    <div id="tg-mapping-modal" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999; align-items:center; justify-content:center;">
        <div class="card" style="width:520px; max-width:90%; max-height:90vh; overflow-y:auto; background:var(--bg-card); padding:24px; border-radius:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
                <h3 style="margin:0; font-size:16px; font-weight:600;"><i class="fas fa-link"></i> Add Telegram Chat Mapping</h3>
                <button class="btn btn-secondary btn-sm" onclick="closeTelegramMappingModal()"><i class="fas fa-times"></i></button>
            </div>

            <div style="display:flex; flex-direction:column; gap:14px;">
                <div>
                    <label class="mod-field-label">WhatsApp Target JID / Phone / Group</label>
                    <input type="text" id="tg-modal-wa-jid" class="mod-textarea" style="height:36px; width:100%;" placeholder="e.g. 1203630123456789@g.us or 491761234567@s.whatsapp.net">
                </div>

                <div>
                    <label class="mod-field-label">Telegram Chat / Channel ID</label>
                    <input type="text" id="tg-modal-tg-chat-id" class="mod-textarea" style="height:36px; width:100%;" placeholder="e.g. -1001234567890 or 123456789">
                </div>

                <div>
                    <label class="mod-field-label">Telegram Forum Topic ID (Optional)</label>
                    <input type="text" id="tg-modal-tg-thread-id" class="mod-textarea" style="height:36px; width:100%;" placeholder="e.g. 2 (Leave empty if not a Forum Topic)">
                </div>

                <div>
                    <label class="mod-field-label">Sync Direction Mode</label>
                    <select id="tg-modal-sync-mode" class="mod-select" style="width:100%;">
                        <option value="bidirectional">Bi-directional (WhatsApp &lt;-&gt; Telegram)</option>
                        <option value="outbound">Outbound only (WhatsApp -&gt; Telegram)</option>
                        <option value="inbound">Inbound only (Telegram -&gt; WhatsApp)</option>
                    </select>
                </div>

                <div>
                    <label class="mod-field-label">Ignore Command Prefixes (Optional)</label>
                    <input type="text" id="tg-modal-ignore-prefixes" class="mod-textarea" style="height:36px; width:100%;" placeholder="e.g. !, / (Comma separated)">
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:6px;">
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-inc-group"> Include Group Name
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-inc-sender" checked> Include Sender Name
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-sync-self"> Sync Own Self Messages
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-convert-formatting" checked> Convert Formatting
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-anonymize-phone"> Anonymize Phones
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-sync-reactions" checked> Sync Reactions
                    </label>
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid var(--border-color); padding-top:12px;">
                <button class="btn btn-secondary btn-sm" onclick="closeTelegramMappingModal()">Cancel</button>
                <button class="btn btn-primary btn-sm" onclick="saveTelegramMappingModal()"><i class="fas fa-save"></i> Save Mapping</button>
            </div>
        </div>
    </div>

</section>
`;
