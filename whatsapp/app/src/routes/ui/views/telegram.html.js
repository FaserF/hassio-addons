export default () => `
<section id="tab-telegram" class="tab-panel">

    <!-- Hero Header -->
    <div class="mod-hero">
        <div class="mod-hero-left">
            <div class="mod-hero-icon" style="background:linear-gradient(135deg, #0088cc 0%, #006699 100%);color:#fff;">
                <i class="fab fa-telegram-plane"></i>
            </div>
            <div>
                <h2 class="mod-hero-title" data-i18n="telegram.title">WhatsApp &amp; Telegram Native Bridge</h2>
                <p class="mod-hero-sub" data-i18n="telegram.subtitle">Bi-directional message mirroring &middot; Media sync &middot; Intelligent thread quotes</p>
            </div>
        </div>
        <div class="mod-hero-controls">
            <div class="mod-toggle-row">
                <span class="mod-toggle-label"><i class="fas fa-power-off"></i> <span data-i18n="telegram.bridge_active">Bridge Active</span></span>
                <label class="mod-toggle-switch">
                    <input type="checkbox" id="tg-global-toggle" onchange="toggleTelegramBridge(this.checked)">
                    <span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span>
                </label>
            </div>
        </div>
    </div>



    <!-- Bot Token / Multi-Bot Management Card -->
    <div class="card mod-settings-card" style="margin-top: 16px; padding: 20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
            <div style="display:flex; align-items:center; gap:14px; min-width:220px; flex:1;">
                <div style="font-size: 26px; color: #0088cc; background: rgba(0, 136, 204, 0.12); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink:0;">
                    <i class="fab fa-telegram-plane"></i>
                </div>
                <div>
                    <h3 style="margin: 0; font-weight: 600; font-size:16px;" data-i18n="telegram.bot_config">Telegram Bots Configuration</h3>
                    <p style="color: var(--text-muted); margin: 2px 0 0; font-size: 13px;" data-i18n="telegram.bot_desc">
                        Manage multiple Telegram Bots (from <code style="background:var(--bg-card); padding:2px 6px; border-radius:4px; color:#0088cc;">@BotFather</code>) to route chats across different bots.
                    </p>
                </div>
            </div>
            <button class="btn btn-primary btn-sm" style="height:36px; padding:0 14px; border-radius:8px; font-weight:600; display:flex; align-items:center; gap:6px; white-space:nowrap; flex-shrink:0;" onclick="openAddTelegramBotModal()">
                <i class="fas fa-plus"></i> <span data-i18n="telegram.add_bot">Add Telegram Bot</span>
            </button>
        </div>

        <div id="tg-bots-list-container" style="display:flex; flex-direction:column; gap:10px;">
            <!-- Rendered dynamically in 80_telegram.js -->
        </div>
    </div>

    <!-- Mappings Section -->
    <div class="card mod-settings-card" style="margin-top: 20px; padding: 20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
            <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:260px; margin-right:12px;">
                <div style="font-size: 22px; color: var(--primary); background: rgba(37, 211, 102, 0.12); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink:0;">
                    <i class="fas fa-exchange-alt"></i>
                </div>
                <div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h3 style="margin:0; font-weight:600; font-size:16px;" data-i18n="telegram.mappings">Active Chat &amp; Group Mappings</h3>
                        <a href="https://faserf.github.io/ha-whatsapp/telegram.html" target="_blank" class="btn btn-secondary btn-sm" style="padding: 2px 8px; border-radius: 12px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;" title="View Telegram Bridge Documentation" data-i18n-title="telegram.docs_title">
                            <i class="fas fa-info-circle"></i> Docs
                        </a>
                    </div>
                    <p style="color:var(--text-muted); margin:2px 0 0; font-size:13px;" data-i18n="telegram.mappings_desc">Manage active message synchronization routes between WhatsApp &amp; Telegram chats.</p>
                </div>
            </div>
            <button class="btn btn-primary btn-sm" style="height:38px; padding:0 16px; border-radius:8px; font-weight:600; display:flex; align-items:center; gap:8px; flex-shrink:0; white-space:nowrap;" onclick="openAddTelegramMappingModal()">
                <i class="fas fa-plus-circle"></i> <span data-i18n="telegram.add_mapping">Add New Mapping</span>
            </button>
        </div>

        <!-- Mappings Table -->
        <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: 8px; overflow-x: auto;">
            <table class="data-table" id="tg-mappings-table" style="width:100%; min-width:850px;">
                <thead>
                    <tr>
                        <th style="width:70px;" data-i18n="common.status">Status</th>
                        <th data-i18n="telegram.mapping_name">Mapping Name</th>
                        <th><i class="fab fa-whatsapp" style="color:#25d366;"></i> <span data-i18n="telegram.wa_chat_col">WhatsApp Chat</span></th>
                        <th><i class="fab fa-telegram" style="color:#0088cc;"></i> <span data-i18n="telegram.tg_target_col">Telegram Target</span></th>
                        <th data-i18n="telegram.direction">Direction</th>
                        <th data-i18n="telegram.settings_options">Settings &amp; Options</th>
                        <th style="text-align:right;" data-i18n="common.actions">Actions</th>
                    </tr>
                </thead>
                <tbody id="tg-mappings-tbody">
                    <tr>
                        <td colspan="7" style="text-align:center; color:var(--text-muted); padding:32px;">
                            <i class="fas fa-link" style="font-size:32px; opacity:0.3; margin-bottom:8px; display:block;"></i>
                            <span data-i18n="telegram.no_mappings_hint">No active chat mappings configured. Click "Add New Mapping" to start bridging.</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Bridge Integration Test Card (Collapsed by default, subtle footer panel) -->
    <div class="card mod-settings-card" style="margin-top: 24px; padding: 14px 18px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px;">
        <div style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="toggleTgTestSuiteUI()">
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fas fa-vial" style="color: var(--text-muted); font-size:14px;"></i>
                <span style="font-weight: 600; font-size: 13px; color: var(--text-main);" data-i18n="telegram.test_suite">Bridge Integration Test</span>
                <span class="badge" style="background:var(--card-bg); color:var(--text-muted); font-size:10px; padding:1px 6px; border:1px solid var(--border-color);" data-i18n="telegram.dev_tools">Developer Tools</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <button type="button" class="btn btn-secondary btn-sm" style="padding:3px 10px; font-size:11px; display:flex; align-items:center; gap:6px;" id="tg-run-test-btn" onclick="event.stopPropagation(); runTelegramBridgeTest();">
                    <i class="fas fa-play"></i> <span data-i18n="telegram.run_test">Run Test</span>
                </button>
                <i class="fas fa-chevron-down" id="tg-test-suite-chevron" style="color:var(--text-muted); font-size:12px; transition:transform 0.2s;"></i>
            </div>
        </div>

        <div id="tg-test-suite-body" style="display:none; margin-top:14px; border-top:1px solid var(--border-color); padding-top:14px;">
            <p style="color: var(--text-muted); margin: 0 0 12px; font-size: 12px;" data-i18n="telegram.test_desc">
                Run comprehensive end-to-end verification of ALL 16 message &amp; media types (text, polls, votes, location, events, photos, audio, video, docs, stickers, contacts, reactions, edits, deletions, reply chains, system events).
            </p>

            <!-- Controls Row: Target Mapping + Direction -->
            <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; margin-bottom:12px; background:var(--bg-app); border:1px solid var(--border-color); padding:12px; border-radius:6px;">
                <div style="flex:1; min-width:220px;">
                    <label class="mod-field-label" style="font-size:11px; font-weight:600;"><i class="fas fa-link"></i> <span data-i18n="telegram.test_mapping">Select Target Chat / Group Mapping to Test</span></label>
                    <select id="tg-test-mapping-select" class="mod-select mod-select-sm" style="width:100%;">
                        <option value="" data-i18n="telegram.loading_mappings">Loading active mappings...</option>
                    </select>
                </div>
                <div style="flex:1; min-width:200px;">
                    <label class="mod-field-label" style="font-size:11px; font-weight:600;"><i class="fas fa-exchange-alt"></i> <span data-i18n="telegram.test_direction">Sync Direction</span></label>
                    <select id="tg-test-direction-select" class="mod-select mod-select-sm" style="width:100%;">
                        <option value="bidirectional" selected data-i18n="telegram.direction_both">Bi-directional (WhatsApp ↔ Telegram)</option>
                        <option value="wa_to_tg" data-i18n="telegram.direction_wa_to_tg">Outbound Only (WhatsApp ➔ Telegram)</option>
                        <option value="tg_to_wa" data-i18n="telegram.direction_tg_to_wa">Inbound Only (Telegram ➔ WhatsApp)</option>
                    </select>
                </div>
            </div>

            <!-- Subtest Selection Matrix -->
            <div style="margin-bottom:12px; background:var(--bg-app); border:1px solid var(--border-color); border-radius:6px; padding:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <label class="mod-field-label" style="margin:0; font-size:11px; font-weight:600;" data-i18n="telegram.select_subtests_title"><i class="fas fa-tasks"></i> Select Subtests to Execute (Message &amp; Media Types)</label>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:10px;" onclick="selectAllTgSubtests(true)" data-i18n="common.select_all">Select All</button>
                        <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:10px;" onclick="selectAllTgSubtests(false)" data-i18n="common.select_none">Select None</button>
                    </div>
                </div>
                <div class="mod-chip-group">
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="text" checked> <span data-i18n="telegram.subtest_text">💬 Text &amp; Formatting</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="poll" checked> <span data-i18n="telegram.subtest_poll">📊 Native Polls</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="poll_vote" checked> <span data-i18n="telegram.subtest_poll_vote">🗳️ Poll Vote Sync</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="location" checked> <span data-i18n="telegram.subtest_location">📍 Location Pins</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="event" checked> <span data-i18n="telegram.subtest_event">📅 Event Cards</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="image" checked> <span data-i18n="telegram.subtest_image">🖼️ Images &amp; Captions</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="voice" checked> <span data-i18n="telegram.subtest_voice">🎙️ Voice Notes (PTT)</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="video" checked> <span data-i18n="telegram.subtest_video">🎥 Video &amp; Notes</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="document" checked> <span data-i18n="telegram.subtest_document">📁 Documents &amp; Files</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="sticker" checked> <span data-i18n="telegram.subtest_sticker">🏷️ WebP Stickers</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="contact" checked> <span data-i18n="telegram.subtest_contact">📇 Contact Cards</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="reaction" checked> <span data-i18n="telegram.subtest_reaction">😀 Emoji Reactions</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="edit" checked> <span data-i18n="telegram.subtest_edit">✏️ Message Edits</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="delete" checked> <span data-i18n="telegram.subtest_delete">🗑️ Message Deletions</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="reply" checked> <span data-i18n="telegram.subtest_reply">💬 Quoted Replies</span></label>
                    <label class="mod-chip-checkbox"><input type="checkbox" class="tg-subtest-cb" value="system_event" checked> <span data-i18n="telegram.subtest_system_event">🔔 System Events</span></label>
                </div>
            </div>

            <!-- Live Log Output Panel (Terminal Console) -->
            <div id="tg-test-results-panel" style="display:block; background:#111827; border:1px solid #374151; border-radius:6px; padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid #374151; padding-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span id="tg-test-status-badge" class="badge" style="background:#4b5563; color:#fff; font-size:11px; padding:2px 8px; border-radius:10px;" data-i18n="common.ready">READY</span>
                        <strong id="tg-test-progress-text" style="font-size:12px; color:#e5e7eb;"><span data-i18n="telegram.test_progress_label">Progress</span>: <span data-i18n="telegram.test_ready">Ready to execute</span></strong>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:10px;" onclick="copyTgTestLogs()"><i class="fas fa-copy"></i> <span data-i18n="telegram.copy_log">Copy All</span></button>
                        <div style="font-size:11px; color:#9ca3af;" id="tg-test-run-id"><i class="fas fa-terminal"></i> <span data-i18n="telegram.live_console_title">Live Bridge Test Console</span></div>
                    </div>
                </div>
                <pre id="tg-test-log-output" style="background:#030712; color:#38bdf8; font-family:Consolas, Monaco, monospace; font-size:11px; padding:10px; border-radius:6px; max-height:220px; overflow-y:auto; margin:0; white-space:pre-wrap; word-break:break-word; border:1px solid #1f2937; line-height:1.4;" data-i18n="telegram.test_console_ready">Console Ready. Select a target chat mapping above and click "Run Test" to stream live logs.</pre>
            </div>
        </div>
    </div>



    <!-- Add/Edit Mapping Modal -->
    <div id="tg-mapping-modal" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999; align-items:center; justify-content:center; padding:20px; box-sizing:border-box;">
        <div class="card" style="width:520px; max-width:100%; max-height:calc(100vh - 40px); display:flex; flex-direction:column; overflow:hidden; background:var(--bg-card); padding:24px; border-radius:12px; box-sizing:border-box;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:12px; flex-shrink:0;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <h3 style="margin:0; font-size:16px; font-weight:600;" id="tg-modal-title"><i class="fas fa-link"></i> <span data-i18n="telegram.add_mapping_modal_title">Add Telegram Chat Mapping</span></h3>
                    <a href="https://faserf.github.io/ha-whatsapp/telegram.html" target="_blank" style="color:var(--text-muted); font-size:14px;" title="View Telegram Bridge documentation" data-i18n-title="telegram.docs_title">
                        <i class="fas fa-info-circle"></i>
                    </a>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="closeTelegramMappingModal()"><i class="fas fa-times"></i></button>
            </div>

            <div style="display:flex; flex-direction:column; gap:14px; overflow-y:auto; padding-right:4px;">
                <input type="hidden" id="tg-modal-id">
                <div>
                    <label class="mod-field-label"><i class="fas fa-robot"></i> <span data-i18n="telegram.modal.assigned_bot">Assigned Telegram Bot</span></label>
                    <select id="tg-modal-bot-select" class="mod-select" style="width:100%;" onchange="onTgBotSelectChange(this.value)">
                        <option value="" data-i18n="telegram.modal.loading_bots">Loading bots...</option>
                    </select>
                </div>
                <div>
                    <label class="mod-field-label"><span data-i18n="telegram.modal.mapping_name">Mapping Name (Optional)</span></label>
                    <input type="text" id="tg-modal-mapping-name" class="mod-textarea" style="height:36px; width:100%;" placeholder="e.g. Family Chat Bridge (Auto-generated if empty)" data-i18n-placeholder="telegram.modal.mapping_name_ph">
                </div>
                <div>
                    <label class="mod-field-label"><span data-i18n="telegram.modal.select_wa_chat">Select WhatsApp Chat / Group</span></label>
                    <select id="tg-modal-wa-select" class="mod-select" style="width:100%; margin-bottom:6px;" onchange="onTgWaSelectChange(this.value)">
                        <option value="" data-i18n="telegram.modal.loading_wa_chats">Loading WhatsApp chats...</option>
                    </select>
                    <input type="text" id="tg-modal-wa-jid" class="mod-textarea" style="height:36px; width:100%; display:none;" placeholder="Or enter manual WhatsApp JID (e.g. 1203630123456789@g.us)" data-i18n-placeholder="telegram.modal.manual_wa_jid_ph">
                </div>

                <div>
                    <label class="mod-field-label"><span data-i18n="telegram.modal.select_tg_chat">Select Telegram Chat / Group</span></label>
                    <select id="tg-modal-tg-select" class="mod-select" style="width:100%; margin-bottom:6px;" onchange="onTgTgSelectChange(this.value)">
                        <option value="" data-i18n="telegram.modal.loading_tg_chats">Loading Telegram chats...</option>
                    </select>
                    <input type="text" id="tg-modal-tg-chat-id" class="mod-textarea" style="height:36px; width:100%; display:none;" placeholder="Or enter manual Telegram Chat ID (e.g. -1001234567890)" data-i18n-placeholder="telegram.modal.manual_tg_chat_ph">
                </div>

                <div id="tg-modal-conflict-warning" style="display:none; background:rgba(239,68,68,0.15); border:1px solid #ef4444; border-radius:8px; padding:12px; font-size:12px; color:var(--text-color);">
                    <div style="display:flex; align-items:center; gap:8px; color:#ef4444; font-weight:bold; margin-bottom:4px;">
                        <i class="fas fa-exclamation-triangle"></i> <span data-i18n="telegram.modal.conflict_title">Security &amp; Spam Warning: Multi-Source Destination Conflict</span>
                    </div>
                    <div id="tg-modal-conflict-text" style="margin-bottom:8px; line-height:1.4;"></div>
                    <label style="display:flex; align-items:center; gap:8px; font-weight:600; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-confirm-conflict"> <span data-i18n="telegram.modal.confirm_conflict">I understand the risk of message loops / spam and confirm this configuration.</span>
                    </label>
                </div>

                <div>
                    <label class="mod-field-label"><span data-i18n="telegram.modal.forum_topic_id">Telegram Forum Topic ID (Optional)</span></label>
                    <input type="text" id="tg-modal-tg-thread-id" class="mod-textarea" style="height:36px; width:100%;" placeholder="e.g. 2 (Leave empty if not a Forum Topic)" data-i18n-placeholder="telegram.modal.forum_topic_id_ph">
                </div>

                <div>
                    <label class="mod-field-label"><span data-i18n="telegram.modal.sync_mode">Sync Direction Mode</span></label>
                    <select id="tg-modal-sync-mode" class="mod-select" style="width:100%;">
                        <option value="bidirectional" data-i18n="telegram.direction_both">Bi-directional (WhatsApp &lt;-&gt; Telegram)</option>
                        <option value="outbound" data-i18n="telegram.direction_wa_to_tg">Outbound only (WhatsApp -&gt; Telegram)</option>
                        <option value="inbound" data-i18n="telegram.direction_tg_to_wa">Inbound only (Telegram -&gt; WhatsApp)</option>
                    </select>
                </div>

                <div>
                    <label class="mod-field-label"><span data-i18n="telegram.modal.ignore_prefixes">Ignore Command Prefixes (Optional)</span></label>
                    <input type="text" id="tg-modal-ignore-prefixes" class="mod-textarea" style="height:36px; width:100%;" placeholder="e.g. !, / (Comma separated)" data-i18n-placeholder="telegram.modal.ignore_prefixes_ph">
                </div>

                <div style="background:var(--bg-app); border:1px solid var(--border-color); border-radius:8px; padding:10px; margin-top:4px;">
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; cursor:pointer; color:var(--primary);">
                        <input type="checkbox" id="tg-modal-direct-mirror" onchange="onTgDirectMirrorToggle(this.checked)"> 💬 <span data-i18n="telegram.modal.direct_mirror">1:1 Direct Chat Mirror Mode</span>
                    </label>
                    <p style="margin:2px 0 0 24px; font-size:11px; color:var(--text-muted);" data-i18n="telegram.modal.direct_mirror_desc">
                        Suppresses sender/group headers for clean 1-to-1 private chat mirroring and enables self-message syncing.
                    </p>
                </div>

                <div>
                    <label class="mod-field-label"><i class="fas fa-poll"></i> <span data-i18n="telegram.poll_sync_mode">Poll Sync Mode (WhatsApp &amp; Telegram)</span></label>
                    <select id="tg-modal-poll-sync-mode" class="mod-select" style="width:100%;">
                        <option value="native_sync" selected data-i18n="telegram.poll_option_native_sync">Native Poll Sync &amp; Auto-Vote (Default: Send poll to target + vote for current winner)</option>
                        <option value="native_no_vote" data-i18n="telegram.poll_option_native_no_vote">Native Poll Sync (Send poll to target without voting)</option>
                        <option value="buttons" data-i18n="telegram.poll_option_buttons">Inline Buttons Keyboard (Send as clickable Telegram buttons)</option>
                        <option value="text_diagram" data-i18n="telegram.poll_option_text_diagram">Text Diagram &amp; Updates (Status text diagram + update messages)</option>
                        <option value="once_no_update" data-i18n="telegram.poll_option_once">Single Notification Only (Send initial info once, no updates/votes)</option>
                    </select>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-top:6px;">
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-inc-group"> <span data-i18n="telegram.opt_inc_group">Include Group Name</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-inc-sender" checked> <span data-i18n="telegram.opt_inc_sender">Include Sender Name</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-poll-diagram-text" checked> <span data-i18n="telegram.opt_poll_diagram_text">Poll Text Diagram</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-poll-update-msg" checked> <span data-i18n="telegram.opt_poll_update_msg">Poll Chat Updates</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-poll-delete-old" checked> <span data-i18n="telegram.opt_poll_delete_old">Delete Old Poll Msg</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-sync-self"> <span data-i18n="telegram.opt_sync_self">Sync Own Self Messages</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-convert-formatting" checked> <span data-i18n="telegram.opt_convert_formatting">Convert Formatting</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-anonymize-phone"> <span data-i18n="telegram.opt_anonymize_phone">Anonymize Phones</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-sync-reactions" checked> <span data-i18n="telegram.opt_sync_reactions">Sync Reactions</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-sync-edits" checked> <span data-i18n="telegram.opt_sync_edits">Sync Message Edits</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-sync-deletions" checked> <span data-i18n="telegram.opt_sync_deletions">Sync Message Deletions</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-sync-system-events" checked> <span data-i18n="telegram.opt_sync_system_events">Sync System Events</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="tg-modal-sync-pins" checked> <span data-i18n="telegram.opt_sync_pins">Sync Pinned Messages</span>
                    </label>
                    <div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">
                        <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                            <input type="checkbox" id="tg-modal-translate-tg-to-wa"> <span data-i18n="telegram.opt_translate_tg_to_wa">Translate TG -&gt; WA</span>
                        </label>
                        <div id="tg-modal-trans-tg-wa-box" style="display:flex; align-items:center; gap:8px; margin-left:22px; margin-top:4px;">
                            <label class="text-xs text-muted" style="margin:0; font-size:12px; white-space:nowrap;" data-i18n="moderation.target_lang_label">Target Language:</label>
                            <select id="tg-modal-trans-tg-wa-lang" class="mod-select mod-select-sm" style="min-width:130px; height:32px;">
                                <option value="de" data-i18n="moderation.lang_de_opt">German</option>
                                <option value="en" data-i18n="moderation.lang_en_opt">English</option>
                                <option value="es" data-i18n="moderation.lang_es_opt">Spanish</option>
                                <option value="fr" data-i18n="moderation.lang_fr_opt">French</option>
                                <option value="it" data-i18n="moderation.lang_it_opt">Italian</option>
                            </select>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">
                        <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                            <input type="checkbox" id="tg-modal-translate-wa-to-tg"> <span data-i18n="telegram.opt_translate_wa_to_tg">Translate WA -&gt; TG</span>
                        </label>
                        <div id="tg-modal-trans-wa-tg-box" style="display:flex; align-items:center; gap:8px; margin-left:22px; margin-top:4px;">
                            <label class="text-xs text-muted" style="margin:0; font-size:12px; white-space:nowrap;" data-i18n="moderation.target_lang_label">Target Language:</label>
                            <select id="tg-modal-trans-wa-tg-lang" class="mod-select mod-select-sm" style="min-width:130px; height:32px;">
                                <option value="en" data-i18n="moderation.lang_en_opt">English</option>
                                <option value="de" data-i18n="moderation.lang_de_opt">German</option>
                                <option value="es" data-i18n="moderation.lang_es_opt">Spanish</option>
                                <option value="fr" data-i18n="moderation.lang_fr_opt">French</option>
                                <option value="it" data-i18n="moderation.lang_it_opt">Italian</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px; border-top:1px solid var(--border-color); padding-top:12px; flex-shrink:0;">
                <button class="btn btn-secondary btn-sm" onclick="closeTelegramMappingModal()" data-i18n="common.cancel">Cancel</button>
                <button class="btn btn-primary btn-sm" onclick="saveTelegramMappingModal()"><i class="fas fa-save"></i> <span data-i18n="telegram.save_mapping">Save Mapping</span></button>
            </div>
        </div>
    </div>

    <!-- Add/Edit Telegram Bot Modal -->
    <div id="tg-bot-modal" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999; align-items:center; justify-content:center;">
        <div class="card" style="width:460px; max-width:90%; background:var(--bg-card); padding:24px; border-radius:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
                <h3 style="margin:0; font-size:16px; font-weight:600;" id="tg-bot-modal-title"><i class="fas fa-robot"></i> <span data-i18n="telegram.add_bot_modal_title">Add Telegram Bot</span></h3>
                <button class="btn btn-secondary btn-sm" onclick="closeTelegramBotModal()"><i class="fas fa-times"></i></button>
            </div>

            <div style="display:flex; flex-direction:column; gap:14px;">
                <input type="hidden" id="tg-bot-modal-id">
                <div>
                    <label class="mod-field-label"><span data-i18n="telegram.modal.friendly_bot_name">Friendly Bot Name (Optional)</span></label>
                    <input type="text" id="tg-bot-modal-name" class="mod-textarea" style="height:36px; width:100%;" placeholder="e.g. Work Notifications Bot (Auto @username if empty)" data-i18n-placeholder="telegram.modal.friendly_bot_name_ph">
                </div>
                <div>
                    <label class="mod-field-label"><span data-i18n="telegram.modal.bot_token">Telegram Bot Token (from @BotFather)</span></label>
                    <input type="password" id="tg-bot-modal-token" class="mod-textarea" style="height:40px; width:100%; font-family:monospace;" placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ" data-i18n-placeholder="telegram.modal.bot_token_ph">
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid var(--border-color); padding-top:12px;">
                <button class="btn btn-secondary btn-sm" onclick="closeTelegramBotModal()" data-i18n="common.cancel">Cancel</button>
                <button class="btn btn-primary btn-sm" onclick="saveTelegramBotModal()"><i class="fas fa-check-circle"></i> <span data-i18n="telegram.save_bot">Save Bot</span></button>
            </div>
        </div>
    </div>

</section>
`;
