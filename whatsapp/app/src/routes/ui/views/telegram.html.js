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

    <!-- Bot Token / Multi-Bot Management Card -->
    <div class="card mod-settings-card" style="margin-top: 16px; padding: 20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
            <div style="display:flex; align-items:center; gap:14px;">
                <div style="font-size: 26px; color: #0088cc; background: rgba(0, 136, 204, 0.12); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <i class="fab fa-telegram-plane"></i>
                </div>
                <div>
                    <h3 style="margin: 0; font-weight: 600; font-size:16px;">Telegram Bots Configuration</h3>
                    <p style="color: var(--text-muted); margin: 2px 0 0; font-size: 13px;">
                        Manage multiple Telegram Bots (from <code style="background:var(--bg-card); padding:2px 6px; border-radius:4px; color:#0088cc;">@BotFather</code>) to route chats across different bots.
                    </p>
                </div>
            </div>
            <button class="btn btn-primary btn-sm" style="height:36px; padding:0 14px; border-radius:8px; font-weight:600; display:flex; align-items:center; gap:6px;" onclick="openAddTelegramBotModal()">
                <i class="fas fa-plus"></i> Add Telegram Bot
            </button>
        </div>

        <div id="tg-bots-list-container" style="display:flex; flex-direction:column; gap:10px;">
            <!-- Rendered dynamically in 80_telegram.js -->
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
        <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: 8px; overflow-x: auto;">
            <table class="data-table" id="tg-mappings-table" style="width:100%; min-width:850px;">
                <thead>
                    <tr>
                        <th style="width:70px;">Status</th>
                        <th>Mapping Name</th>
                        <th><i class="fab fa-whatsapp" style="color:#25d366;"></i> WhatsApp Chat</th>
                        <th><i class="fab fa-telegram" style="color:#0088cc;"></i> Telegram Target</th>
                        <th>Direction</th>
                        <th>Settings &amp; Options</th>
                        <th style="text-align:right;">Actions</th>
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

    <!-- Bridge Integration Test Collapsible Card (At the bottom, default collapsed) -->
    <details class="card mod-settings-card" style="margin-top: 20px; padding: 20px;">
        <summary style="display:flex; align-items:center; justify-content:space-between; list-style:none; outline:none; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:14px;">
                <div style="font-size: 22px; color: #ff9800; background: rgba(255, 152, 0, 0.12); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink:0;">
                    <i class="fas fa-vial"></i>
                </div>
                <div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h3 style="margin: 0; font-weight: 600; font-size:16px; display:inline;">Bridge Integration Test</h3>
                        <span class="badge" style="background:rgba(255,152,0,0.15); color:#ff9800; font-size:11px; padding:2px 8px; border-radius:10px;">End-to-End Suite</span>
                    </div>
                    <p style="color: var(--text-muted); margin: 2px 0 0; font-size: 13px;">
                        Click to expand end-to-end automated verification for ALL 16 message &amp; media types.
                    </p>
                </div>
            </div>
            <span style="font-size:13px; font-weight:600; color:var(--primary); white-space:nowrap; display:flex; align-items:center; gap:6px;">
                <i class="fas fa-chevron-down"></i> Expand Test Panel
            </span>
        </summary>

        <div style="margin-top:20px; border-top:1px solid var(--border-color); padding-top:16px;">
            <!-- Controls Row: Target Mapping + Direction + RUN BUTTON -->
            <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; margin-bottom:16px; background:rgba(255,152,0,0.05); border:1px solid rgba(255,152,0,0.2); padding:16px; border-radius:8px;">
                <div style="flex:1; min-width:220px;">
                    <label class="mod-field-label" style="font-weight:600;"><i class="fas fa-link"></i> Target Mapping</label>
                    <select id="tg-test-mapping-select" class="mod-select" style="width:100%; height:38px;">
                        <option value="">Loading mappings...</option>
                    </select>
                </div>
                <div style="flex:1; min-width:200px;">
                    <label class="mod-field-label" style="font-weight:600;"><i class="fas fa-exchange-alt"></i> Test Direction</label>
                    <select id="tg-test-direction-select" class="mod-select" style="width:100%; height:38px;">
                        <option value="wa_to_tg">WhatsApp ➔ Telegram (WA to TG)</option>
                        <option value="tg_to_wa">Telegram ➔ WhatsApp (TG to WA)</option>
                    </select>
                </div>
                <div>
                    <button class="btn btn-primary" style="height:38px; padding:0 24px; font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px; background:linear-gradient(135deg, #ff9800 0%, #f57c00 100%); border:none;" id="tg-run-test-btn" onclick="runTelegramBridgeTest()">
                        <i class="fas fa-play"></i> Run Integration Test
                    </button>
                </div>
            </div>

            <!-- Subtest Selection Matrix -->
            <div style="margin-bottom:16px; background:var(--bg-app); border:1px solid var(--border-color); border-radius:8px; padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <label class="mod-field-label" style="margin:0;"><i class="fas fa-tasks"></i> Select Subtests to Execute (Message &amp; Media Types)</label>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:11px;" onclick="selectAllTgSubtests(true)">Select All</button>
                        <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:11px;" onclick="selectAllTgSubtests(false)">Select None</button>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:6px; font-size:12px;">
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="text" checked> <span>💬 Text &amp; Formatting</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="poll" checked> <span>📊 Native Polls</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="poll_vote" checked> <span>🗳️ Poll Vote Sync</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="location" checked> <span>📍 Location Pins</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="event" checked> <span>📅 Event Cards</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="image" checked> <span>🖼️ Images &amp; Captions</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="voice" checked> <span>🎙️ Voice Notes (PTT)</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="video" checked> <span>🎥 Video &amp; Notes</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="document" checked> <span>📁 Documents &amp; Files</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="sticker" checked> <span>🏷️ WebP Stickers</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="contact" checked> <span>📇 Contact Cards</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="reaction" checked> <span>😀 Emoji Reactions</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="edit" checked> <span>✏️ Message Edits</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="delete" checked> <span>🗑️ Message Deletions</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="reply" checked> <span>💬 Quoted Replies</span></label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="tg-subtest-cb" value="system_event" checked> <span>🔔 System Events</span></label>
                </div>
            </div>

            <!-- Live Log Output Panel (Always visible terminal console) -->
            <div id="tg-test-results-panel" style="display:block; background:var(--bg-app); border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-top:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span id="tg-test-status-badge" class="badge" style="background:#777; color:#fff; font-size:12px; padding:4px 10px; border-radius:12px;">READY</span>
                        <strong id="tg-test-progress-text" style="font-size:14px;">Progress: Ready to execute</strong>
                    </div>
                    <div style="font-size:12px; color:var(--text-muted);" id="tg-test-run-id"><i class="fas fa-terminal"></i> Integration Test Console</div>
                </div>
                <pre id="tg-test-log-output" style="background:var(--bg-input); color:#0088cc; font-family:Consolas, monospace; font-size:12px; padding:12px; border-radius:6px; max-height:280px; overflow-y:auto; margin:0; white-space:pre-wrap; word-break:break-word; border:1px solid var(--border-color);">Ready. Select a target mapping above and click "Run Integration Test" to stream real-time logs.</pre>
            </div>
        </div>
    </details>



    <!-- Add/Edit Mapping Modal -->
    <div id="tg-mapping-modal" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999; align-items:center; justify-content:center; padding:20px; box-sizing:border-box;">
        <div class="card" style="width:520px; max-width:100%; max-height:calc(100vh - 40px); display:flex; flex-direction:column; overflow:hidden; background:var(--bg-card); padding:24px; border-radius:12px; box-sizing:border-box;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:12px; flex-shrink:0;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <h3 style="margin:0; font-size:16px; font-weight:600;" id="tg-modal-title"><i class="fas fa-link"></i> Add Telegram Chat Mapping</h3>
                    <a href="https://faserf.github.io/ha-whatsapp/telegram.html" target="_blank" style="color:var(--text-muted); font-size:14px;" title="View Telegram Bridge documentation">
                        <i class="fas fa-info-circle"></i>
                    </a>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="closeTelegramMappingModal()"><i class="fas fa-times"></i></button>
            </div>

            <div style="display:flex; flex-direction:column; gap:14px; overflow-y:auto; padding-right:4px;">
                <input type="hidden" id="tg-modal-id">
                <div>
                    <label class="mod-field-label"><i class="fas fa-robot"></i> Assigned Telegram Bot</label>
                    <select id="tg-modal-bot-select" class="mod-select" style="width:100%;" onchange="onTgBotSelectChange(this.value)">
                        <option value="">Loading bots...</option>
                    </select>
                </div>
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

                <div id="tg-modal-conflict-warning" style="display:none; background:rgba(239,68,68,0.15); border:1px solid #ef4444; border-radius:8px; padding:12px; font-size:12px; color:var(--text-color);">
                    <div style="display:flex; align-items:center; gap:8px; color:#ef4444; font-weight:bold; margin-bottom:4px;">
                        <i class="fas fa-exclamation-triangle"></i> Security & Spam Warning: Multi-Source Destination Conflict
                    </div>
                    <div id="tg-modal-conflict-text" style="margin-bottom:8px; line-height:1.4;"></div>
                    <label style="display:flex; align-items:center; gap:8px; font-weight:600; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-confirm-conflict"> I understand the risk of message loops / spam and confirm this configuration.
                    </label>
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

                <div style="background:var(--bg-app); border:1px solid var(--border-color); border-radius:8px; padding:10px; margin-top:4px;">
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; cursor:pointer; color:var(--primary);">
                        <input type="checkbox" id="tg-modal-direct-mirror" onchange="onTgDirectMirrorToggle(this.checked)"> 💬 1:1 Direct Chat Mirror Mode
                    </label>
                    <p style="margin:2px 0 0 24px; font-size:11px; color:var(--text-muted);">
                        Suppresses sender/group headers for clean 1-to-1 private chat mirroring and enables self-message syncing.
                    </p>
                </div>

                <div>
                    <label class="mod-field-label"><i class="fas fa-poll"></i> Poll Sync Mode (WhatsApp &amp; Telegram)</label>
                    <select id="tg-modal-poll-sync-mode" class="mod-select" style="width:100%;">
                        <option value="text_diagram">Text Diagram &amp; Updates (Default: Status text diagram + update messages)</option>
                        <option value="native_sync">Native Poll Sync &amp; Auto-Vote (Send poll to target + vote for current winner)</option>
                        <option value="native_no_vote">Native Poll Sync (Send poll to target without voting)</option>
                        <option value="once_no_update">Single Notification Only (Send initial info once, no updates/votes)</option>
                    </select>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:6px;">
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-inc-group"> Include Group Name
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-inc-sender" checked> Include Sender Name
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-poll-diagram-text" checked> Poll Text Diagram
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-poll-update-msg" checked> Poll Chat Updates
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-poll-delete-old" checked> Delete Old Poll Msg
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
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-sync-edits" checked> Sync Message Edits
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-sync-deletions" checked> Sync Message Deletions
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-sync-system-events" checked> Sync System Events
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-sync-pins" checked> Sync Pinned Messages
                    </label>
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px; border-top:1px solid var(--border-color); padding-top:12px; flex-shrink:0;">
                <button class="btn btn-secondary btn-sm" onclick="closeTelegramMappingModal()">Cancel</button>
                <button class="btn btn-primary btn-sm" onclick="saveTelegramMappingModal()"><i class="fas fa-save"></i> Save Mapping</button>
            </div>
        </div>
    </div>

    <!-- Add/Edit Telegram Bot Modal -->
    <div id="tg-bot-modal" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999; align-items:center; justify-content:center;">
        <div class="card" style="width:460px; max-width:90%; background:var(--bg-card); padding:24px; border-radius:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
                <h3 style="margin:0; font-size:16px; font-weight:600;" id="tg-bot-modal-title"><i class="fas fa-robot"></i> Add Telegram Bot</h3>
                <button class="btn btn-secondary btn-sm" onclick="closeTelegramBotModal()"><i class="fas fa-times"></i></button>
            </div>

            <div style="display:flex; flex-direction:column; gap:14px;">
                <input type="hidden" id="tg-bot-modal-id">
                <div>
                    <label class="mod-field-label">Friendly Bot Name (Optional)</label>
                    <input type="text" id="tg-bot-modal-name" class="mod-textarea" style="height:36px; width:100%;" placeholder="e.g. Work Notifications Bot (Auto @username if empty)">
                </div>
                <div>
                    <label class="mod-field-label">Telegram Bot Token (from @BotFather)</label>
                    <input type="password" id="tg-bot-modal-token" class="mod-textarea" style="height:40px; width:100%; font-family:monospace;" placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ">
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid var(--border-color); padding-top:12px;">
                <button class="btn btn-secondary btn-sm" onclick="closeTelegramBotModal()">Cancel</button>
                <button class="btn btn-primary btn-sm" onclick="saveTelegramBotModal()"><i class="fas fa-check-circle"></i> Save Bot</button>
            </div>
        </div>
    </div>

</section>
`;
