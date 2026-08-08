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

</section>
`;
