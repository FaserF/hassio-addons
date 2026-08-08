export default () => `
<section id="tab-telegram" class="tab-panel" style="padding-bottom: 40px;">

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
    <div class="card mod-settings-card" style="margin-top: 16px; padding: 20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
            <div style="display:flex; align-items:center; gap:14px;">
                <div style="font-size: 26px; color: #0088cc; background: rgba(0, 136, 204, 0.12); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <i class="fab fa-telegram-plane"></i>
                </div>
                <div>
                    <h3 style="margin: 0; font-weight: 600; font-size:16px;">Telegram Bot API Configuration</h3>
                    <p style="color: var(--text-muted); margin: 2px 0 0; font-size: 13px;">
                        Connect your Telegram Bot Token from <code style="background:var(--bg-card); padding:2px 6px; border-radius:4px; color:#0088cc;">@BotFather</code> to enable live chat fetching &amp; auto-sync.
                    </p>
                </div>
            </div>
            <div id="tg-bot-status-badge" style="display:none; font-size:13px; font-weight:600; padding:6px 14px; border-radius:20px; background:rgba(0,136,204,0.15); color:#0088cc; border:1px solid rgba(0,136,204,0.3); display:flex; align-items:center; gap:8px;">
                <i class="fas fa-robot"></i> <span id="tg-bot-status-text">Bot Username: @NotConfigured</span>
            </div>
        </div>

        <div class="mod-field-group" style="margin-bottom:0;">
            <label class="mod-field-label" style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); margin-bottom:8px; display:block;">
                <i class="fas fa-key"></i> Telegram Bot Token
            </label>
            <div style="display:flex; gap:12px;">
                <input type="password" id="tg-bot-token-input" class="mod-textarea" style="height:40px; flex:1; font-family:monospace; padding:8px 14px; border-radius:8px;" placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ">
                <button class="btn btn-primary btn-sm" style="padding:0 18px; height:40px; border-radius:8px; font-weight:600; display:flex; align-items:center; gap:8px;" onclick="saveTelegramBotToken()">
                    <i class="fas fa-check-circle"></i> Save &amp; Connect Bot
                </button>
            </div>
        </div>
    </div>

    <!-- Mappings Section -->
    <div class="card mod-settings-card" style="margin-top: 20px; padding: 20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
            <div style="display:flex; align-items:center; gap:14px;">
                <div style="font-size: 22px; color: var(--primary); background: rgba(37, 211, 102, 0.12); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-exchange-alt"></i>
                </div>
                <div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h3 style="margin:0; font-weight:600; font-size:16px;">Active Chat &amp; Group Mappings</h3>
                        <a href="https://faserf.github.io/ha-whatsapp/telegram.html" target="_blank" class="btn btn-secondary btn-sm" style="padding: 2px 8px; border-radius: 12px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;" title="View Telegram Bridge Documentation">
                            <i class="fas fa-info-circle"></i> Docs
                        </a>
                    </div>
                    <p style="color:var(--text-muted); margin:2px 0 0; font-size:13px;">Manage active message synchronization routes between WhatsApp &amp; Telegram chats.</p>
                </div>
            </div>
            <button class="btn btn-primary btn-sm" style="height:38px; padding:0 16px; border-radius:8px; font-weight:600; display:flex; align-items:center; gap:8px;" onclick="openAddTelegramMappingModal()">
                <i class="fas fa-plus-circle"></i> Add New Mapping
            </button>
        </div>

        <!-- Mappings Table -->
        <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
            <table class="data-table" id="tg-mappings-table" style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:var(--bg-body); text-align:left;">
                        <th style="padding:12px 16px; width:70px;">Status</th>
                        <th style="padding:12px 16px;">Mapping Name</th>
                        <th style="padding:12px 16px;"><i class="fab fa-whatsapp" style="color:#25d366;"></i> WhatsApp Chat</th>
                        <th style="padding:12px 16px;"><i class="fab fa-telegram" style="color:#0088cc;"></i> Telegram Target</th>
                        <th style="padding:12px 16px;">Direction</th>
                        <th style="padding:12px 16px;">Settings &amp; Options</th>
                        <th style="padding:12px 16px; text-align:right;">Actions</th>
                    </tr>
                </thead>
                <tbody id="tg-mappings-tbody">
                    <tr>
                        <td colspan="7" style="text-align:center; color:var(--text-muted); padding:32px;">
                            <i class="fas fa-link" style="font-size:32px; opacity:0.3; margin-bottom:8px; display:block;"></i>
                            No active chat mappings configured. Click "Add New Mapping" to start bridging.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Add/Edit Mapping Modal -->
    <div id="tg-mapping-modal" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999; align-items:center; justify-content:center;">
        <div class="card" style="width:520px; max-width:90%; max-height:90vh; overflow-y:auto; background:var(--bg-card); padding:24px; border-radius:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <h3 style="margin:0; font-size:16px; font-weight:600;" id="tg-modal-title"><i class="fas fa-link"></i> Add Telegram Chat Mapping</h3>
                    <a href="https://faserf.github.io/ha-whatsapp/telegram.html" target="_blank" style="color:var(--text-muted); font-size:14px;" title="View Telegram Bridge documentation">
                        <i class="fas fa-info-circle"></i>
                    </a>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="closeTelegramMappingModal()"><i class="fas fa-times"></i></button>
            </div>

            <div style="display:flex; flex-direction:column; gap:14px;">
                <input type="hidden" id="tg-modal-id">
                <div>
                    <label class="mod-field-label">Mapping Name (Optional)</label>
                    <input type="text" id="tg-modal-mapping-name" class="mod-textarea" style="height:36px; width:100%;" placeholder="e.g. Family Chat Bridge (Auto-generated if empty)">
                </div>
                <div>
                    <label class="mod-field-label">Select WhatsApp Chat / Group</label>
                    <select id="tg-modal-wa-select" class="mod-select" style="width:100%; margin-bottom:6px;" onchange="onTgWaSelectChange(this.value)">
                        <option value="">Loading WhatsApp chats...</option>
                    </select>
                    <input type="text" id="tg-modal-wa-jid" class="mod-textarea" style="height:36px; width:100%; display:none;" placeholder="Or enter manual WhatsApp JID (e.g. 1203630123456789@g.us)">
                </div>

                <div>
                    <label class="mod-field-label">Select Telegram Chat / Group</label>
                    <select id="tg-modal-tg-select" class="mod-select" style="width:100%; margin-bottom:6px;" onchange="onTgTgSelectChange(this.value)">
                        <option value="">Loading Telegram chats...</option>
                    </select>
                    <input type="text" id="tg-modal-tg-chat-id" class="mod-textarea" style="height:36px; width:100%; display:none;" placeholder="Or enter manual Telegram Chat ID (e.g. -1001234567890)">
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
