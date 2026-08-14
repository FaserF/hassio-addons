export default () => `
<section id="tab-moderation" class="tab-panel">

                <!-- Hero Header -->
                <div class="mod-hero">
                    <div class="mod-hero-left">
                        <div class="mod-hero-icon"><i class="fas fa-shield-alt"></i></div>
                        <div>
                            <h2 class="mod-hero-title" data-i18n="moderation.title">Group Moderation Engine</h2>
                            <p class="mod-hero-sub" data-i18n="moderation.subtitle">Group defender &middot; Rules enforcement &middot; Anti-raid shield &middot; Automated moderation</p>
                        </div>
                    </div>
                    <div class="mod-hero-controls">
                        <div class="mod-hero-search" style="position:relative; width:220px;">
                            <i class="fas fa-search" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:12px; pointer-events:none;"></i>
                            <input type="text" id="mod-settings-search" class="mod-input" placeholder="Search settings..." data-i18n-placeholder="moderation.search_settings_ph" oninput="filterModerationSettings(this.value)" style="padding-left:30px; height:34px; font-size:12px; border-radius:8px; background:var(--bg-input, rgba(0,0,0,0.2)); width:100%; box-sizing:border-box;">
                        </div>
                        <div class="mod-toggle-row">
                            <span class="mod-toggle-label">
                                <i class="fas fa-power-off"></i> 
                                <span data-i18n="moderation.global">Global</span> 
                                <i class="fas fa-info-circle" style="color:var(--primary); cursor:pointer; font-size:13px; margin-left:4px;" data-i18n-title="moderation.global_toggle_tooltip" title="EIN: Moderation ist bei einzeln aktivierten Gruppen aktiv.&#10;AUS: Moderation ist global für ALLE Gruppen ausgeschaltet."></i>
                            </span>
                            <label class="mod-toggle-switch">
                                <input type="checkbox" id="mod-global-toggle" onchange="toggleGlobalModeration(this.checked)">
                                <span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span>
                            </label>
                        </div>
                        <div class="mod-group-picker">
                            <i class="fas fa-users" style="color:var(--text-muted);font-size:13px;"></i>
                            <select id="mod-group-select" class="mod-select" onchange="selectModerationGroup(this.value)">
                                <option value="">Select a group…</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- No Group Selected & Global Settings Card -->
                <div id="mod-no-group-placeholder" class="card mod-settings-card" style="margin-top: 16px; padding: 24px;">
                    <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
                        <div style="font-size: 28px; color: var(--primary);"><i class="fas fa-globe"></i></div>
                        <div>
                            <h3 style="margin: 0; font-weight: 600; font-size:16px;" data-i18n="moderation.global_default_rules_title">Global Default Rules &amp; Moderation Settings</h3>
                            <p style="color: var(--text-muted); margin: 2px 0 0; font-size: 12px;" data-i18n="moderation.global_default_rules_desc">
                                Configure global fallback rules applicable to all WhatsApp groups. Select a specific group from the dropdown menu above to customize per-group settings.
                            </p>
                        </div>
                    </div>

                    <div class="mod-field-group" style="margin-bottom:20px;">
                        <label class="mod-field-label"><i class="fas fa-scroll"></i> <span data-i18n="moderation.global_rules_label">Global Default Rules (Fallback for all groups)</span></label>
                        <p class="mod-field-desc" data-i18n="moderation.global_rules_desc">These rules will be displayed via <code>!rules</code> for any group that does not have custom group rules configured.</p>
                        <textarea id="mod-global-rules-input" class="mod-textarea" style="height:140px;" placeholder="1. Be respectful to all members.&#10;2. No spam or unauthorized advertising.&#10;3. Follow group topic." data-i18n-placeholder="moderation.global_rules_ph"></textarea>
                    </div>

                    <div class="mod-actions" style="display:flex; justify-content:flex-end;">
                        <button class="btn btn-primary btn-sm" onclick="saveGlobalRulesInline()"><i class="fas fa-save"></i> <span data-i18n="common.save">Save Settings</span></button>
                    </div>
                </div>

                <!-- Group Settings Card (Hidden until group selected) -->
                <div id="mod-group-content" class="card mod-settings-card" style="display:none;">
                    <!-- Card Header -->
                    <div class="mod-card-header">
                        <div class="mod-card-title-row">
                            <h3 id="mod-active-group-title" class="mod-card-title"><i class="fas fa-users-cog"></i> <span data-i18n="moderation.group_settings">Group Settings</span></h3>
                            <div class="mod-toggle-row" style="display:flex;align-items:center;gap:12px;">
                                <button class="btn btn-secondary btn-sm" onclick="generateGroupTestCommandsModal()"><i class="fas fa-vial"></i> <span data-i18n="moderation.generate_test_cmds">Generate Test Commands 🧪</span></button>
                                <span class="mod-toggle-label" data-i18n="moderation.enable_for_group">Enable for this group</span>
                                <label class="mod-toggle-switch">
                                    <input type="checkbox" id="mod-group-toggle" onchange="toggleGroupModeration(this.checked)">
                                    <span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span>
                                </label>
                            </div>
                        </div>
                        <!-- Subtab Pills -->
                        <div class="mod-subtab-bar">
                            <button class="mod-pill active" data-subtab="rules" onclick="switchModSubTab('rules')"><i class="fas fa-scroll"></i> <span data-i18n="moderation.tabs.core">Rules</span></button>
                            <button class="mod-pill" data-subtab="greetings" onclick="switchModSubTab('greetings')"><i class="fas fa-user-plus"></i> <span data-i18n="moderation.tabs.greetings">Greetings</span></button>
                            <button class="mod-pill" data-subtab="warnings" onclick="switchModSubTab('warnings')"><i class="fas fa-exclamation-triangle"></i> <span data-i18n="moderation.tabs.warnings">Warnings</span></button>
                            <button class="mod-pill" data-subtab="reports" onclick="switchModSubTab('reports')"><i class="fas fa-flag"></i> <span data-i18n="moderation.tabs.reports">Reports</span></button>
                            <button class="mod-pill" data-subtab="locks" onclick="switchModSubTab('locks')"><i class="fas fa-lock"></i> <span data-i18n="moderation.tabs.locks">Locks</span></button>
                            <button class="mod-pill" data-subtab="blacklist" onclick="switchModSubTab('blacklist')"><i class="fas fa-ban"></i> <span data-i18n="moderation.blacklist.title">Blacklist</span></button>
                            <button class="mod-pill" data-subtab="filters" onclick="switchModSubTab('filters')"><i class="fas fa-robot"></i> <span data-i18n="moderation.tabs.filters">Filters</span></button>
                            <button class="mod-pill" data-subtab="antispam" onclick="switchModSubTab('antispam')"><i class="fas fa-bolt"></i> <span data-i18n="moderation.tabs.antispam">Anti-Spam</span></button>
                            <button class="mod-pill" data-subtab="federation" onclick="switchModSubTab('federation')"><i class="fas fa-network-wired"></i> <span data-i18n="moderation.tabs.federation">Federation</span></button>
                            <button class="mod-pill" data-subtab="commands" onclick="switchModSubTab('commands')"><i class="fas fa-terminal"></i> <span data-i18n="moderation.tabs.commands">Commands</span></button>
                            <button class="mod-pill" data-subtab="ai" onclick="switchModSubTab('ai')"><i class="fas fa-brain"></i> <span data-i18n="moderation.tabs.intelligence">Gemini AI</span></button>
                            <button class="mod-pill" data-subtab="migration" onclick="switchModSubTab('migration')"><i class="fas fa-file-export"></i> <span data-i18n="moderation.tabs.migration">Import/Export</span></button>
                        </div>
                    </div>

                    <!-- RULES -->
                    <div id="mod-subpanel-rules" class="mod-subpanel">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-primary"><i class="fas fa-scroll"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.rules.title">Group Rules</div><div class="mod-feature-desc" data-i18n="moderation.rules.desc">Define group rules for <code>!rules</code> and optionally append them to the welcome message on join.</div></div>
                        </div>
                        <textarea id="mod-rules-text" class="mod-textarea" placeholder="1. Be respectful&#10;2. No spam&#10;3. No NSFW content" data-i18n-placeholder="moderation.rules_ph"></textarea>
                        <div class="mod-option-row">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-rules-show-on-join"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.include_rules_on_join">Include group rules inside the welcome message when a new member joins</span>
                        </div>
                        <div class="mod-option-row" style="margin-top:10px; display:flex; align-items:center; gap:10px;">
                            <i class="fas fa-language" style="color:var(--primary); font-size:16px;"></i>
                            <span class="mod-option-label" data-i18n="moderation.language_setting.title">Group Bot Response Language:</span>
                            <select id="mod-group-language-select" class="mod-select mod-select-sm" style="width:140px;">
                                <option value="en" data-i18n="moderation.lang_en">🇬🇧 English (Default)</option>
                                <option value="de" data-i18n="moderation.lang_de">🇩🇪 Deutsch</option>
                            </select>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupRules()"><i class="fas fa-save"></i> <span data-i18n="common.save">Save Rules</span></button></div>
                    </div>

                    <!-- GREETINGS -->
                    <div id="mod-subpanel-greetings" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-info"><i class="fas fa-user-plus"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.greetings.title">Greetings &amp; Captcha</div><div class="mod-feature-desc" data-i18n="moderation.greetings.desc">Welcome and farewell messages plus join verification.</div></div>
                        </div>
                        <div class="mod-two-col">
                            <div class="mod-feature-block">
                                <div class="mod-block-label"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-welcome-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span data-i18n="moderation.welcome_msg_title">Welcome Message</span></div>
                                <input type="text" id="mod-welcome-msg" class="mod-input" placeholder="Welcome {user} to {group}!" data-i18n-placeholder="moderation.welcome_msg_ph" style="margin-bottom:8px;">
                                <div style="display:flex; flex-direction:column; gap:4px; margin-top:6px;">
                                    <label class="mod-field-label" style="margin:0; font-size:11px;" data-i18n="moderation.destination_label">Destination:</label>
                                    <select id="mod-welcome-target" class="mod-select mod-select-sm" style="width:100%;">
                                        <option value="private" selected data-i18n="moderation.dest_private_join">Private Chat (DM to joining user)</option>
                                        <option value="group" data-i18n="moderation.dest_group">Group Chat</option>
                                    </select>
                                </div>
                            </div>
                            <div class="mod-feature-block">
                                <div class="mod-block-label"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-goodbye-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span data-i18n="moderation.goodbye_msg_title">Goodbye Message</span></div>
                                <input type="text" id="mod-goodbye-msg" class="mod-input" placeholder="Goodbye {user}!" data-i18n-placeholder="moderation.goodbye_msg_ph" style="margin-bottom:8px;">
                                <div style="display:flex; flex-direction:column; gap:4px; margin-top:6px;">
                                    <label class="mod-field-label" style="margin:0; font-size:11px;" data-i18n="moderation.destination_label">Destination:</label>
                                    <select id="mod-goodbye-target" class="mod-select mod-select-sm" style="width:100%;">
                                        <option value="private" selected data-i18n="moderation.dest_private_leave">Private Chat (DM to leaving user)</option>
                                        <option value="group" data-i18n="moderation.dest_group">Group Chat</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- Variables Legend -->
                        <div style="margin-top:12px; padding:10px 12px; background:var(--card-bg); border:1px solid var(--border-color); border-radius:6px; font-size:12px;">
                            <strong style="color:var(--primary);"><i class="fas fa-code"></i> <span data-i18n="moderation.available_variables">Available Message Variables:</span></strong>
                            <div style="display:flex; flex-wrap:wrap; gap:8px 16px; margin-top:6px; color:var(--text-main);">
                                <div><code>{user}</code> / <code>{mention}</code> &ndash; <span style="color:var(--text-muted);" data-i18n="moderation.var_mention_desc">Mentions the user (@phone)</span></div>
                                <div><code>{name}</code> &ndash; <span style="color:var(--text-muted);" data-i18n="moderation.var_name_desc">User phone number / ID</span></div>
                                <div><code>{pushname}</code> &ndash; <span style="color:var(--text-muted);" data-i18n="moderation.var_pushname_desc">User profile name</span></div>
                                <div><code>{group}</code> / <code>{subject}</code> / <code>{title}</code> &ndash; <span style="color:var(--text-muted);" data-i18n="moderation.var_group_desc">Group name</span></div>
                                <div><code>{count}</code> / <code>{members}</code> &ndash; <span style="color:var(--text-muted);" data-i18n="moderation.var_count_desc">Member count</span></div>
                                <div><code>{rules}</code> &ndash; <span style="color:var(--text-muted);" data-i18n="moderation.var_rules_desc">Group rules text</span></div>
                                <div><code>{date}</code> &ndash; <span style="color:var(--text-muted);" data-i18n="moderation.var_date_desc">Current date (e.g. 06.08.2026)</span></div>
                                <div><code>{time}</code> &ndash; <span style="color:var(--text-muted);" data-i18n="moderation.var_time_desc">Current time (e.g. 10:15)</span></div>
                            </div>
                        </div>

                        <div class="mod-divider"></div>
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-warning"><i class="fas fa-user-shield"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.captcha.title">Join Captcha Verification</div><div class="mod-feature-desc" data-i18n="moderation.captcha.desc">Challenge new members before they can post.</div></div>
                        </div>
                        <div class="mod-inline-controls">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-captcha-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.require_captcha">Require captcha on join</span>
                            <select id="mod-captcha-mode" class="mod-select mod-select-sm"><option value="code" data-i18n="moderation.captcha_code">Security Code</option><option value="math" data-i18n="moderation.captcha_math">Math problem</option><option value="button" data-i18n="moderation.captcha_button">Button challenge</option></select>
                            <select id="mod-captcha-target" class="mod-select mod-select-sm"><option value="private" data-i18n="moderation.captcha_dest_private">Private Chat (DM)</option><option value="group" data-i18n="moderation.captcha_dest_group">Group Chat</option></select>
                            <div class="mod-number-group"><input type="number" id="mod-captcha-timeout" class="mod-number-input" value="240" min="30" max="600"><span class="mod-number-unit" data-i18n="moderation.timeout_seconds">s timeout</span></div>
                        </div>
                        <div class="mod-divider"></div>
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-primary"><i class="fas fa-id-card"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.name_format_title">User Addressing &amp; Name Format</div><div class="mod-feature-desc" data-i18n="moderation.name_format_desc">Configure name resolution order and fallback when mentioning users in messages.</div></div>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:12px;">
                            <label class="mod-field-label" style="margin:0; white-space:nowrap;" data-i18n="moderation.name_priority">Name Priority:</label>
                            <select id="mod-name-priority" class="mod-select mod-select-sm">
                                <option value="name_push_phone" data-i18n="moderation.priority_contact_push_phone">Contact Name &gt; Pushname &gt; Phone Number</option>
                                <option value="push_name_phone" data-i18n="moderation.priority_push_contact_phone">Pushname &gt; Contact Name &gt; Phone Number</option>
                                <option value="phone_only" data-i18n="moderation.priority_phone_only">Phone Number Only (+49...)</option>
                            </select>
                            <label class="mod-field-label" style="margin:0; margin-left:12px; white-space:nowrap;" data-i18n="moderation.fallback_label">Fallback:</label>
                            <select id="mod-name-fallback" class="mod-select mod-select-sm">
                                <option value="phone" data-i18n="moderation.fallback_phone">Phone Number (+49...)</option>
                                <option value="user" data-i18n="moderation.fallback_user">Generic (@User)</option>
                            </select>
                        </div>

                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupGreetings()"><i class="fas fa-save"></i> <span data-i18n="moderation.save_greetings_captcha">Save Greetings &amp; Captcha</span></button></div>

                        <div id="mod-captcha-users-container" style="display:none; margin-top:20px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                <p class="mod-section-label" style="margin-bottom:0;"><i class="fas fa-user-check"></i> <span data-i18n="moderation.captcha_overview">Captcha Verification Overview</span></p>
                                <button class="btn btn-secondary btn-sm" onclick="loadCaptchaUsers()"><i class="fas fa-sync"></i> <span data-i18n="moderation.refresh_users">Refresh Users</span></button>
                            </div>
                            <div id="mod-captcha-users-list" class="mod-list-container"><div class="empty-state" data-i18n="moderation.select_group_captcha_hint">Select a group to load captcha verification status</div></div>
                        </div>
                    </div>

                    <!-- WARNINGS -->
                    <div id="mod-subpanel-warnings" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-warning"><i class="fas fa-exclamation-triangle"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.warn_system.title">Warning System</div><div class="mod-feature-desc" data-i18n="moderation.warn_system.desc">Issue warnings and auto-punish repeat offenders.</div></div>
                        </div>
                        <div class="mod-inline-controls" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
                            <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <label class="mod-field-label" style="margin:0; white-space:nowrap;" data-i18n="moderation.warn_system.max_warns">Max warnings:</label>
                                    <input type="number" id="mod-max-warns" class="mod-number-input" value="3" min="1" max="20" style="width:65px;">
                                </div>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <label class="mod-field-label" style="margin:0; white-space:nowrap;" data-i18n="moderation.warn_system.penalty">Penalty after max:</label>
                                    <select id="mod-warn-action" class="mod-select mod-select-sm" style="min-width:140px;">
                                        <option value="mute" data-i18n="moderation.warn_action_mute">Mute User</option>
                                        <option value="kick" data-i18n="moderation.warn_action_kick">Kick User</option>
                                        <option value="ban" data-i18n="moderation.warn_action_ban">Ban User</option>
                                    </select>
                                </div>
                            </div>
                            <button class="btn btn-primary btn-sm" style="height:36px; padding:0 14px; border-radius:8px; display:flex; align-items:center; gap:6px;" onclick="saveGroupWarnings()"><i class="fas fa-save"></i> <span data-i18n="common.save">Save Settings</span></button>
                        </div>
                        <div class="mod-divider"></div>
                        <p class="mod-section-label"><i class="fas fa-list-ul"></i> <span data-i18n="moderation.active_warnings">Active Warnings</span></p>
                        <div id="mod-warns-list" class="mod-list-container" style="margin-bottom:20px;"><div class="empty-state" data-i18n="moderation.no_active_warnings">No active user warnings</div></div>

                        <div class="mod-divider"></div>
                        <p class="mod-section-label"><i class="fas fa-user-slash"></i> <span data-i18n="moderation.banned_users">Banned Users (Auto-kicked on rejoin)</span></p>
                        <div id="mod-bans-list" class="mod-list-container" style="margin-bottom:20px;"><div class="empty-state" data-i18n="moderation.no_banned_users">No banned users</div></div>

                        <div class="mod-divider"></div>
                        <p class="mod-section-label"><i class="fas fa-user-times"></i> <span data-i18n="moderation.kick_history">Kick History Log</span></p>
                        <div id="mod-kicks-list" class="mod-list-container"><div class="empty-state" data-i18n="moderation.no_kick_history">No kick history</div></div>
                    </div>

                    <!-- REPORTS -->
                    <div id="mod-subpanel-reports" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-flag"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.reports_log">Group Reports Log</div><div class="mod-feature-desc" data-i18n="moderation.reports_desc">View all reported messages, reporter details, target users, and timestamps.</div></div>
                        </div>
                        <div id="mod-reports-list" class="mod-list-container"><div class="empty-state" data-i18n="moderation.no_reports">No reports submitted yet</div></div>
                    </div>

                    <!-- LOCKS -->
                    <div id="mod-subpanel-locks" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-warning"><i class="fas fa-lock"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.content_locks.title">Content Locks</div><div class="mod-feature-desc" data-i18n="moderation.content_locks.description">Automatically delete specific message types when sent by non-admin members.</div></div>
                        </div>
                        <div class="mod-lock-grid">
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-image"></i></div><span data-i18n="moderation.content_locks.image">Images</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-image"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-video"></i></div><span data-i18n="moderation.content_locks.video">Videos</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-video"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-microphone"></i></div><span data-i18n="moderation.content_locks.audio">Voice</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-audio"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-file-alt"></i></div><span data-i18n="moderation.content_locks.document">Documents</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-document"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-sticky-note"></i></div><span data-i18n="moderation.content_locks.sticker">Stickers</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-sticker"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-link"></i></div><span data-i18n="moderation.content_locks.url">URLs</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-url"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-user-plus"></i></div><span data-i18n="moderation.content_locks.invite">Invites</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-invite"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-poll"></i></div><span data-i18n="moderation.content_locks.poll">Polls</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-poll"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-address-card"></i></div><span data-i18n="moderation.content_locks.contact">Contacts</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-contact"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-map-marker-alt"></i></div><span data-i18n="moderation.content_locks.location">Locations</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-location"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-share"></i></div><span data-i18n="moderation.content_locks.forwarded">Forwarded</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-forwarded"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-language"></i></div><span data-i18n="moderation.content_locks.rtl">RTL Text</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-rtl"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupLocks()"><i class="fas fa-save"></i> <span data-i18n="moderation.save_locks">Save Locks</span></button></div>
                    </div>

                    <!-- BLACKLIST -->
                    <div id="mod-subpanel-blacklist" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-ban"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.blacklist.title">Word &amp; Pattern Blacklist</div><div class="mod-feature-desc" data-i18n="moderation.blacklist.desc">Auto-delete messages containing blocked words or regex patterns.</div></div>
                        </div>
                        <div class="mod-field-group" style="margin-bottom:12px;">
                            <label class="mod-field-label" data-i18n="moderation.matching_mode">Matching Mode</label>
                            <select id="mod-blacklist-mode" class="mod-select mod-select-sm" style="max-width:320px;">
                                <option value="exact" selected data-i18n="moderation.blacklist_exact">Exact Word Match (default - e.g. "badword")</option>
                                <option value="contains" data-i18n="moderation.blacklist_contains">Substring / Contains Match (e.g. "verybadwordtext")</option>
                            </select>
                            <p class="mod-field-desc" style="margin-top:4px;" data-i18n="moderation.blacklist_mode_hint">Exact match checks standalone words. Substring match checks if the word appears anywhere in the message.</p>
                        </div>
                        <div class="mod-input-row">
                            <input type="text" id="mod-blacklist-input" class="mod-input" placeholder="Add word or regex..." data-i18n-placeholder="moderation.blacklist.placeholder" onkeypress="if(event.key==='Enter')addBlacklistWord()">
                            <button class="btn btn-secondary btn-sm" onclick="addBlacklistWord()"><i class="fas fa-plus"></i> <span data-i18n="moderation.blacklist.add">Add</span></button>
                        </div>
                        <div id="mod-blacklist-tags" class="mod-tag-cloud"></div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupBlacklist()"><i class="fas fa-save"></i> <span data-i18n="moderation.save_blacklist">Save Blacklist</span></button></div>
                    </div>

                    <!-- FILTERS -->
                    <div id="mod-subpanel-filters" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-info"><i class="fas fa-robot"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.filters.title">Auto-Responder &amp; FAQ Filters</div><div class="mod-feature-desc" data-i18n="moderation.filters.desc">Trigger automatic replies or FAQ hints on specific keywords.</div></div>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:12px;">
                            <input type="text" id="mod-filter-trigger" class="mod-input mod-input-sm" placeholder="Trigger (e.g. wlan, !help)" data-i18n-placeholder="moderation.filter_trigger_ph" style="width:160px;">
                            <select id="mod-filter-type" class="mod-select mod-select-sm"><option value="reply" data-i18n="moderation.filter_type_reply">Direct Reply</option><option value="faq" data-i18n="moderation.filter_type_faq">FAQ Hint 💡</option></select>
                            <input type="text" id="mod-filter-response" class="mod-input mod-input-sm" placeholder="Response text or FAQ answer" data-i18n-placeholder="moderation.filter_response_ph" style="flex:1;">
                            <button class="btn btn-secondary btn-sm" onclick="addFilterRule()"><i class="fas fa-plus"></i> <span data-i18n="moderation.add_rule">Add Rule</span></button>
                        </div>
                        <div id="mod-filters-list" class="mod-list-container" style="margin-bottom:12px;"></div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupFilters()"><i class="fas fa-save"></i> <span data-i18n="moderation.save_filters">Save Filters</span></button></div>
                    </div>

                    <!-- ANTI-SPAM -->
                    <div id="mod-subpanel-antispam" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-bolt"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.flood.title">Flood Protection</div><div class="mod-feature-desc" data-i18n="moderation.flood.desc">Mute users sending too many messages too fast.</div></div>
                        </div>
                        <div class="mod-inline-controls">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-flood-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.enable_flood">Enable flood protection</span>
                            <div class="mod-number-group"><span class="mod-number-unit" data-i18n="moderation.flood_max">Max</span><input type="number" id="mod-flood-max" class="mod-number-input" value="5" min="2" max="50"><span class="mod-number-unit" data-i18n="moderation.flood_win">messages in</span><input type="number" id="mod-flood-window" class="mod-number-input" value="10" min="2" max="120"><span class="mod-number-unit" data-i18n="moderation.flood_sec">seconds</span></div>
                        </div>
                        <div id="mod-muted-users-container" style="margin-top:12px;">
                            <p class="mod-section-label" style="margin-top:12px; margin-bottom:8px;"><i class="fas fa-user-clock"></i> <span data-i18n="moderation.currently_muted">Currently Muted Users</span></p>
                            <div id="mod-mutes-list" class="mod-list-container"></div>
                        </div>
                        <div class="mod-divider"></div>
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-shield-alt"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.antiraid.title">Anti-Raid Shield</div><div class="mod-feature-desc" data-i18n="moderation.antiraid.desc">Lock group when too many users join in short time.</div></div>
                        </div>
                        <div class="mod-inline-controls">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-antiraid-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.enable_antiraid">Enable anti-raid shield</span>
                            <div class="mod-number-group"><span class="mod-number-unit" data-i18n="moderation.antiraid_max">Max</span><input type="number" id="mod-antiraid-joins" class="mod-number-input" value="10" min="3" max="100"><span class="mod-number-unit" data-i18n="moderation.antiraid_win">joins in</span><input type="number" id="mod-antiraid-window" class="mod-number-input" value="60" min="10" max="600"><span class="mod-number-unit" data-i18n="moderation.antiraid_sec">seconds</span></div>
                        </div>
                        <div class="mod-divider"></div>
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-link"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.antispam_links.title">Anti-Spam Invite Links Removal</div><div class="mod-feature-desc" data-i18n="moderation.antispam_links.desc">Automatically delete t.me, wa.me, and unauthorized chat invite links.</div></div>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:12px;">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-antispam-links-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.enable_antispam_links">Enable auto-removal of spam &amp; invite links</span>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:12px;">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-notify-deleted-action"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.notify_deleted_action">Send notification message with quote when a prohibited message is deleted (Default: Enabled)</span>
                        </div>
                        <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:6px; padding:12px; margin-bottom:12px;">
                            <div style="font-size:12px; font-weight:600; color:var(--text-main); margin-bottom:6px;" data-i18n="moderation.blocked_platforms">Blocked Invite Link Platforms (Default: All Enabled):</div>
                            <div class="mod-chip-group">
                                <label class="mod-chip-checkbox"><input type="checkbox" id="mod-invite-platform-whatsapp" checked> <span data-i18n="moderation.platform_whatsapp">WhatsApp</span></label>
                                <label class="mod-chip-checkbox"><input type="checkbox" id="mod-invite-platform-telegram" checked> <span data-i18n="moderation.platform_telegram">Telegram</span></label>
                                <label class="mod-chip-checkbox"><input type="checkbox" id="mod-invite-platform-signal" checked> <span data-i18n="moderation.platform_signal">Signal</span></label>
                                <label class="mod-chip-checkbox"><input type="checkbox" id="mod-invite-platform-instagram" checked> <span data-i18n="moderation.platform_instagram">Instagram</span></label>
                                <label class="mod-chip-checkbox"><input type="checkbox" id="mod-invite-platform-discord" checked> <span data-i18n="moderation.platform_discord">Discord</span></label>
                                <label class="mod-chip-checkbox"><input type="checkbox" id="mod-invite-platform-other" checked> <span data-i18n="moderation.platform_other">Others (Line, Snapchat, Viber, Matrix)</span></label>
                            </div>
                        </div>

                        <!-- Bot Outbound Anti-Spam Rate Limiter -->
                        <div class="mod-divider"></div>
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-robot"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.bot_antispam_title">Bot Outbound Anti-Spam Shield 🛡️</div><div class="mod-feature-desc" data-i18n="moderation.bot_antispam_desc">Prevents bot loops and accidental message floods. Automatically mutes bot replies for msgs_in_5s * group_members seconds if the bot sends 5+ messages in 5 seconds in this chat. (Exempts Telegram Relay messages).</div></div>
                        </div>
                        <div class="mod-inline-controls">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-antispam-bot-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.enable_bot_antispam">Enable Bot Outbound Rate Limit &amp; Loop Protection (Enabled by Default)</span>
                        </div>

                        <!-- Admin Bypass Notification Toggle -->
                        <div class="mod-divider"></div>
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-info"><i class="fas fa-user-shield"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.notify_bypassed_title">Notify Bypassed Moderation Actions</div><div class="mod-feature-desc" data-i18n="moderation.notify_bypassed_desc">Send an explanatory message in group when a moderation action (spam link, lock, blacklist) is intentionally skipped because the sender is a Group Admin.</div></div>
                        </div>
                        <div class="mod-inline-controls">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-notify-bypassed-actions"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.enable_notify_bypassed">Notify in group when moderation is bypassed for admins</span>
                        </div>

                        <!-- URL & File Security Scanner -->
                        <div class="mod-divider"></div>
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-shield-virus"></i></div>
                            <div>
                                <div class="mod-feature-title" data-i18n="moderation.sec_scan_title">URL &amp; File Security Scanner</div>
                                <div class="mod-feature-desc" data-i18n="moderation.sec_scan_desc">Scan links, documents, executables and attachments for malware, phishing, and threats.</div>
                            </div>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:12px;">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-sec-scan-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.enable_sec_scan">Enable Security Scanner for links &amp; files</span>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:12px;">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-sec-scan-files"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.enable_sec_files">Scan file attachments &amp; documents</span>
                        </div>
                        <div class="mod-inline-controls" style="flex-wrap:wrap; gap:16px; margin-bottom:12px;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <label class="mod-field-label" style="margin:0; white-space:nowrap;" data-i18n="moderation.sec_engine_label">Scan Engine:</label>
                                <select id="mod-sec-scan-engine" class="mod-select mod-select-sm">
                                    <option value="local" data-i18n="moderation.sec_engine_local">🛡️ Local Heuristics &amp; Signatures (Offline, Default)</option>
                                    <option value="virustotal" data-i18n="moderation.sec_engine_vt">🌐 VirusTotal Cloud API</option>
                                    <option value="hybrid" data-i18n="moderation.sec_engine_hybrid">⚡ Hybrid (Local Heuristics + VirusTotal Cloud)</option>
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <label class="mod-field-label" style="margin:0; white-space:nowrap;" data-i18n="moderation.sec_trigger_label">Scan Trigger:</label>
                                <select id="mod-sec-scan-trigger" class="mod-select mod-select-sm">
                                    <option value="auto" data-i18n="moderation.sec_trigger_auto">⚡ Every Message / Link / File (Default)</option>
                                    <option value="command" data-i18n="moderation.sec_trigger_command">🔍 On !scan Command Only</option>
                                </select>
                            </div>
                        </div>

                        <div class="mod-actions" style="margin-top:16px;"><button class="btn btn-primary btn-sm" onclick="saveGroupAntispam()"><i class="fas fa-save"></i> <span data-i18n="moderation.save_antispam">Save Anti-Spam Config</span></button></div>
                    </div>

                    <!-- FEDERATION -->
                    <div id="mod-subpanel-federation" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-primary"><i class="fas fa-network-wired"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.federation.title">Global Security Federation</div><div class="mod-feature-desc" data-i18n="moderation.federation.desc">Cross-group security shield for automatic spam prevention, botnet bans, and prohibited link filtering.</div></div>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:12px;">
                            <label class="mod-field-label" style="margin:0; white-space:nowrap;" data-i18n="moderation.active_fed_network">Active Federation Network:</label>
                            <select id="mod-federation-select" class="mod-select mod-select-sm" style="min-width:240px;">
                                <option value="" data-i18n="moderation.no_fed_joined">No Federation Joined</option>
                                <option value="global" selected data-i18n="moderation.global_default_fed">Global Default Security Federation</option>
                            </select>
                            <button class="btn btn-secondary btn-sm" onclick="openCreateFederationModal()"><i class="fas fa-plus"></i> <span data-i18n="moderation.create_custom_fed">Create Custom Federation</span></button>
                            <button class="btn btn-secondary btn-sm" onclick="exportFederationConfig()"><i class="fas fa-share-alt"></i> <span data-i18n="moderation.export_fed">Share / Export (JSON)</span></button>
                            <button class="btn btn-secondary btn-sm" onclick="openImportFederationModal()"><i class="fas fa-file-import"></i> <span data-i18n="moderation.import_fed">Import Federation</span></button>
                        </div>
                        <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:6px; padding:12px; margin-bottom:12px;">
                            <div style="font-size:12px; font-weight:600; color:var(--text-main); margin-bottom:8px;" data-i18n="moderation.fed_active_protection">Predefined Federation Rules &amp; Active Protection</div>
                            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:8px 16px; font-size:12px;">
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="mod-fed-autokick-spammers" checked> <span data-i18n="moderation.fed_feature_kick">Auto-Kick Fed-Banned Spammers</span></label>
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="mod-fed-botnet-shield" checked> <span data-i18n="moderation.fed_feature_botnet">Cross-Group Botnet Protection</span></label>
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="mod-fed-link-filter" checked> <span data-i18n="moderation.fed_feature_links">Shared Prohibited Links Filtering</span></label>
                            </div>
                        </div>
                        <div style="margin-top:12px;">
                            <div class="mod-feature-title" style="font-size:13px;" data-i18n="moderation.shared_fed_blacklist">Shared Federation Blacklist (Predefined &amp; Custom Patterns)</div>
                            <div class="mod-feature-desc" style="font-size:11px;" data-i18n="moderation.shared_fed_blacklist_desc">Messages containing these links or patterns are automatically deleted across all groups linked to this Federation.</div>
                            <div class="mod-inline-controls" style="margin-top:8px; margin-bottom:8px;">
                                <input type="text" id="mod-fed-blacklist-input" class="mod-input mod-input-sm" placeholder="Add shared link pattern (e.g. t.me/joinchat)..." data-i18n-placeholder="moderation.fed_blacklist_ph" style="flex:1;">
                                <button class="btn btn-secondary btn-sm" onclick="addFedBlacklistPattern()"><i class="fas fa-plus"></i> <span data-i18n="moderation.add_link_pattern">Add Link Pattern</span></button>
                            </div>
                            <div id="mod-fed-blacklist-tags" class="mod-tag-cloud"></div>
                        </div>
                        <div class="mod-actions" style="margin-top:16px;"><button class="btn btn-primary btn-sm" onclick="saveGroupFederation()"><i class="fas fa-save"></i> <span data-i18n="moderation.save_fed_settings">Save Federation Settings</span></button></div>
                    </div>

                    <!-- AI / GEMINI -->
                    <div id="mod-subpanel-ai" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-info"><i class="fas fa-brain"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.ai_title">Gemini AI Assistant &amp; Translation</div><div class="mod-feature-desc" data-i18n="moderation.ai_desc">Configure Gemini API Key, FAQ auto-responder, toxicity moderation, and language translation.</div></div>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:12px;">
                            <label class="mod-field-label" style="margin:0; white-space:nowrap;" data-i18n="moderation.ai_provider_label">AI Provider:</label>
                            <select id="mod-ai-provider" class="mod-select mod-select-sm" onchange="onAiProviderChange(this.value)">
                                <option value="gemini" data-i18n="moderation.ai_prov_gemini">✨ Google Gemini AI (Default)</option>
                                <option value="openai" data-i18n="moderation.ai_prov_openai">🤖 OpenAI (GPT-4o-mini / Whisper)</option>
                            </select>
                        </div>
                        <div class="mod-field-group" style="margin-bottom:12px;">
                            <label class="mod-field-label" id="mod-ai-key-label" data-i18n="moderation.ai_key_label">AI Provider API Key (Global)</label>
                            <input type="password" id="mod-ai-api-key" class="mod-input" placeholder="AIzaSy... / sk-proj-..." data-i18n-placeholder="moderation.ai_api_key_ph" style="max-width:400px;">
                            <p class="mod-field-desc" style="margin-top:4px;" id="mod-ai-key-hint" data-i18n="moderation.ai_key_hint">Get your free API key from Google AI Studio (aip.google.dev) or OpenAI Platform (platform.openai.com).</p>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:10px;">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-ai-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.enable_ai">Enable Gemini AI assistance for this group</span>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:10px;">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-ai-faq-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.enable_ai_faq">Auto-reply to group FAQs</span>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:12px;">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-ai-sentiment-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.enable_ai_sentiment">Automated Toxicity &amp; Sentiment Moderation</span>
                        </div>
                        <div class="mod-field-group" style="margin-bottom:16px;">
                            <label class="mod-field-label" data-i18n="moderation.ai_prompt_label">AI System Persona Prompt</label>
                            <textarea id="mod-ai-prompt" class="mod-textarea" style="height:80px;" placeholder="You are an intelligent, friendly, and professional WhatsApp Group Moderator AI..." data-i18n-placeholder="moderation.ai_prompt_ph"></textarea>
                        </div>
                        <div class="mod-divider"></div>
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-primary"><i class="fas fa-microphone"></i></div>
                            <div>
                                <div class="mod-feature-title" data-i18n="moderation.stt_settings_title">Speech-to-Text (STT) Voice Note Transcriber</div>
                                <div class="mod-feature-desc" data-i18n="moderation.stt_settings_desc">Automatically convert audio messages & voice notes into readable text.</div>
                            </div>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:12px;">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-stt-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.enable_stt">Enable Speech-to-Text (STT) for incoming voice messages</span>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:12px;">
                            <label class="mod-field-label" style="margin:0; white-space:nowrap;" data-i18n="moderation.stt_engine_label">STT Engine:</label>
                            <select id="mod-stt-engine" class="mod-select mod-select-sm" onchange="if(window.refreshModerationDiagnostics) refreshModerationDiagnostics()">
                                <option value="gemini" data-i18n="moderation.stt_engine_gemini">✨ Gemini 1.5 Multimodal Audio (Requires API Key, Default)</option>
                                <option value="openai" data-i18n="moderation.stt_engine_openai">🤖 OpenAI Whisper API (Requires API Key)</option>
                            </select>
                        </div>
                        <!-- STT Diagnostics / Active Provider & Error Info -->
                        <div id="mod-stt-diag-card" class="mod-diag-card" style="margin-bottom:16px;">
                            <div class="mod-diag-header">
                                <div class="mod-diag-title"><i class="fas fa-info-circle"></i> <span data-i18n="moderation.diag_stt_title">Speech-to-Text Status &amp; Engine Info</span></div>
                                <span id="mod-stt-status-badge" class="mod-diag-badge" data-i18n="moderation.status_loading">Loading...</span>
                            </div>
                            <div class="mod-diag-body">
                                <div class="mod-diag-row">
                                    <span class="mod-diag-label" data-i18n="moderation.diag_active_engine">Active Engine:</span>
                                    <span id="mod-stt-active-engine" class="mod-diag-val font-bold">...</span>
                                </div>
                                <div class="mod-diag-row">
                                    <span class="mod-diag-label" data-i18n="moderation.diag_reason_label">Selection Reason:</span>
                                    <span id="mod-stt-reason" class="mod-diag-val">...</span>
                                </div>
                                <div class="mod-diag-row" id="mod-stt-last-activity-row" style="display:none;">
                                    <span class="mod-diag-label" data-i18n="moderation.diag_last_activity">Last Activity:</span>
                                    <span id="mod-stt-last-activity" class="mod-diag-val">...</span>
                                </div>
                                <div id="mod-stt-errors-container" class="mod-diag-errors" style="display:none;">
                                    <div class="mod-diag-errors-title"><i class="fas fa-exclamation-triangle"></i> <span data-i18n="moderation.diag_recent_errors">Recent Errors &amp; Warnings:</span></div>
                                    <div id="mod-stt-errors-list" class="mod-diag-errors-list"></div>
                                </div>
                            </div>
                        </div>
                        <div class="mod-divider"></div>
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-primary"><i class="fas fa-language"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.trans_settings_title">Translation Settings</div></div>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:12px;">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-trans-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.enable_trans">Enable Language Translation for this group</span>
                        </div>
                        <div class="mod-inline-controls" style="flex-wrap:wrap; gap:12px;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <label class="mod-field-label" style="margin:0; white-space:nowrap;" data-i18n="moderation.target_lang_label">Target Language:</label>
                                <select id="mod-trans-target-lang" class="mod-select mod-select-sm"><option value="en" data-i18n="moderation.lang_en_opt">English</option><option value="de" data-i18n="moderation.lang_de_opt">German</option><option value="es" data-i18n="moderation.lang_es_opt">Spanish</option><option value="fr" data-i18n="moderation.lang_fr_opt">French</option><option value="it" data-i18n="moderation.lang_it_opt">Italian</option></select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <label class="mod-field-label" style="margin:0; white-space:nowrap;" data-i18n="moderation.trans_mode_label">Translation Mode:</label>
                                <select id="mod-trans-mode" class="mod-select mod-select-sm">
                                    <option value="manual" data-i18n="moderation.trans_mode_manual">Manual (via !translate command)</option>
                                    <option value="auto" data-i18n="moderation.trans_mode_auto">Auto (Translate all incoming messages)</option>
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <label class="mod-field-label" style="margin:0; white-space:nowrap;" data-i18n="moderation.trans_provider_label">Translation Engine:</label>
                                <select id="mod-trans-provider" class="mod-select mod-select-sm" onchange="if(window.refreshModerationDiagnostics) refreshModerationDiagnostics()">
                                    <option value="auto" data-i18n="moderation.trans_prov_auto">⚡ Gateway Auto-Failover (Google → Lingva → MyMemory)</option>
                                    <option value="google" data-i18n="moderation.trans_prov_google">🌐 Google Translate</option>
                                    <option value="lingva" data-i18n="moderation.trans_prov_lingva">🛡️ Lingva Translate</option>
                                    <option value="mymemory" data-i18n="moderation.trans_prov_mymemory">💾 MyMemory</option>
                                    <option value="ai" data-i18n="moderation.trans_prov_ai">🧠 Gemini / OpenAI Model (Requires API Key)</option>
                                </select>
                            </div>
                        </div>
                        <!-- Translation Diagnostics / Active Provider & Failover Info -->
                        <div id="mod-trans-diag-card" class="mod-diag-card" style="margin-top:14px; margin-bottom:8px;">
                            <div class="mod-diag-header">
                                <div class="mod-diag-title"><i class="fas fa-info-circle"></i> <span data-i18n="moderation.diag_trans_title">Translation Engine Status &amp; Failover Info</span></div>
                                <span id="mod-trans-status-badge" class="mod-diag-badge" data-i18n="moderation.status_loading">Loading...</span>
                            </div>
                            <div class="mod-diag-body">
                                <div class="mod-diag-row">
                                    <span class="mod-diag-label" data-i18n="moderation.diag_active_provider">Active Provider:</span>
                                    <span id="mod-trans-active-provider" class="mod-diag-val font-bold">...</span>
                                </div>
                                <div class="mod-diag-row">
                                    <span class="mod-diag-label" data-i18n="moderation.diag_reason_label">Selection Reason:</span>
                                    <span id="mod-trans-reason" class="mod-diag-val">...</span>
                                </div>
                                <div class="mod-diag-row">
                                    <span class="mod-diag-label" data-i18n="moderation.diag_provider_health">Provider Health:</span>
                                    <div id="mod-trans-providers-health" class="mod-diag-health-chips"></div>
                                </div>
                                <div class="mod-diag-row" id="mod-trans-last-activity-row" style="display:none;">
                                    <span class="mod-diag-label" data-i18n="moderation.diag_last_activity">Last Activity:</span>
                                    <span id="mod-trans-last-activity" class="mod-diag-val">...</span>
                                </div>
                                <div id="mod-trans-errors-container" class="mod-diag-errors" style="display:none;">
                                    <div class="mod-diag-errors-title"><i class="fas fa-exclamation-triangle"></i> <span data-i18n="moderation.diag_recent_errors">Recent Errors &amp; Warnings:</span></div>
                                    <div id="mod-trans-errors-list" class="mod-diag-errors-list"></div>
                                </div>
                            </div>
                        </div>
                        <div class="mod-actions" style="margin-top:16px;"><button class="btn btn-primary btn-sm" onclick="saveGroupAiConfig()"><i class="fas fa-save"></i> <span data-i18n="moderation.save_ai_settings">Save AI &amp; Translation Settings</span></button></div>
                    </div>
                    <!-- COMMANDS -->
                    <div id="mod-subpanel-commands" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap" style="background:linear-gradient(135deg,rgba(0,168,132,0.2),rgba(52,152,219,0.2));color:var(--primary);"><i class="fas fa-terminal"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.cmds_title">Bot Commands &amp; Custom Mappings</div><div class="mod-feature-desc" data-i18n="moderation.cmds_desc">Allow members and admins to interact with the bot via group commands and custom mapped shortcuts.</div></div>
                        </div>
                        <div class="mod-option-row" style="margin-bottom:10px;">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-cmds-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.enable_cmds">Enable group commands (!help, !warn, !ban, etc.)</span>
                        </div>
                        <div class="mod-option-row" style="margin-bottom:10px;">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-cmds-multi-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label" data-i18n="moderation.enable_multi_cmds">Process multiple commands in a single message (default: execute 1st command only)</span>
                        </div>
                        <div class="mod-field-group" style="max-width:200px; margin-bottom:12px;">
                            <label class="mod-field-label" data-i18n="moderation.cmd_prefix">Command Prefix</label>
                            <input type="text" id="mod-cmds-prefix" class="mod-input" value="!" maxlength="3">
                        </div>
                        <div class="mod-field-group" style="max-width:300px; margin-bottom:16px;">
                            <label class="mod-field-label" data-i18n="moderation.mute_action">Mute Action (WhatsApp API Limit)</label>
                            <select id="mod-cmds-mute-action" class="mod-select mod-select-sm">
                                <option value="delete" data-i18n="moderation.mute_action_delete">Delete user's messages</option>
                            </select>
                            <p style="font-size:11px; color:var(--text-muted); margin-top:4px;" data-i18n="moderation.mute_action_hint">WhatsApp does not support user-specific mutes. This defines how mutes are enforced.</p>
                        </div>

                        <!-- Default Built-in Commands Toggles -->
                        <div class="mod-field-group" style="margin-top:20px; margin-bottom:20px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <label class="mod-field-label" style="margin:0;"><i class="fas fa-toggle-on"></i> <span data-i18n="moderation.builtin_cmds_label">Enable/Disable Built-in Commands</span></label>
                                <div style="display:flex; gap:6px;">
                                    <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:11px;" onclick="toggleAllDefaultCommands(true)" data-i18n="common.select_all">Enable All</button>
                                    <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:11px;" onclick="toggleAllDefaultCommands(false)" data-i18n="common.select_none">Disable All</button>
                                </div>
                            </div>
                            <p class="mod-field-desc" data-i18n="moderation.builtin_cmds_desc">Control which built-in commands are permitted in this group. When a disabled command is triggered, the bot will notify members that the command is disabled.</p>
                            <div style="position:relative; margin-bottom:8px; margin-top:10px;">
                                <i class="fas fa-search" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:12px; pointer-events:none;"></i>
                                <input type="text" id="mod-default-cmds-search" class="mod-input" placeholder="Search commands…" data-i18n-placeholder="moderation.search_cmds_ph" oninput="filterDefaultCommands(this.value)" style="padding-left:30px; font-size:12px; width:100%; box-sizing:border-box;">
                            </div>
                            <div id="mod-default-cmds-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:8px; padding:8px; border:1px solid var(--border-color); border-radius:6px; background:rgba(0,0,0,0.1);"></div>
                        </div>

                        <!-- Custom Mapped Commands -->
                        <div class="mod-field-group" style="margin-top:20px; margin-bottom:20px;">
                            <label class="mod-field-label"><i class="fas fa-terminal"></i> <span data-i18n="moderation.custom_cmds_title">Custom Group Commands &amp; Mappings</span></label>
                            <p class="mod-field-desc" data-i18n="moderation.custom_cmds_desc">Create custom commands (e.g. <code>!wifi</code>, <code>!faq</code>) with three handler types:
                                <strong>Auto Reply</strong> &mdash; bot sends an instant text response;
                                <strong>HA / Webhook</strong> &mdash; forwarded to Home Assistant or Webhook;
                                <strong>Alias</strong> &mdash; executes another existing command.
                            </p>
                            <div id="mod-custom-cmds-list" style="margin-bottom:12px;"></div>
                            <div class="mod-add-row" style="display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap; padding:12px; background:var(--card-bg); border:1px solid var(--border-color); border-radius:8px;">
                                <div style="display:flex; flex-direction:column; gap:4px;">
                                    <label style="font-size:11px; color:var(--text-muted);" data-i18n="moderation.cmd_name">Command name</label>
                                    <input type="text" id="mod-cmd-name" class="mod-input" style="max-width:140px;" placeholder="e.g. wifi" data-i18n-placeholder="moderation.cmd_name_ph" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomCommandRule();}">
                                </div>
                                <div style="display:flex; flex-direction:column; gap:4px;">
                                    <label style="font-size:11px; color:var(--text-muted);" data-i18n="moderation.handler_type">Handler type</label>
                                    <select id="mod-cmd-type" class="mod-select mod-select-sm" onchange="onCustomCmdTypeChange()" style="min-width:150px;">
                                        <option value="auto_reply" data-i18n="moderation.type_auto_reply">🤖 A: Auto Reply</option>
                                        <option value="webhook" data-i18n="moderation.type_webhook">🏠 B: HA / Webhook</option>
                                        <option value="alias" data-i18n="moderation.type_alias">🔗 C: Alias of Command</option>
                                    </select>
                                </div>
                                <div id="mod-cmd-response-wrap" style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:180px;">
                                    <label style="font-size:11px; color:var(--text-muted);" data-i18n="moderation.response_text">Response text</label>
                                    <input type="text" id="mod-cmd-response" class="mod-input mod-input-flex" placeholder="e.g. SSID: GuestWifi | Pass: 12345" data-i18n-placeholder="moderation.response_text_ph" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomCommandRule();}">
                                </div>
                                <div id="mod-cmd-alias-wrap" style="display:none; flex-direction:column; gap:4px; min-width:160px;">
                                    <label style="font-size:11px; color:var(--text-muted);" data-i18n="moderation.target_cmd">Target command</label>
                                    <select id="mod-cmd-alias-target" class="mod-select mod-select-sm">
                                        <option value="" data-i18n="moderation.select_target">— select target —</option>
                                    </select>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:4px; min-width:160px;">
                                    <label style="font-size:11px; color:var(--text-muted);" data-i18n="moderation.help_desc">Help description (optional)</label>
                                    <input type="text" id="mod-cmd-description" class="mod-input" style="min-width:160px;" placeholder="Shown in !help" data-i18n-placeholder="moderation.help_desc_ph" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomCommandRule();}">
                                </div>
                                <div style="display:flex; flex-direction:column; gap:4px; justify-content:flex-end;">
                                    <label style="font-size:11px; color:transparent;">.</label>
                                    <label style="display:inline-flex; align-items:center; gap:4px; font-size:12px; white-space:nowrap; cursor:pointer; padding:6px 8px; background:var(--bg); border:1px solid var(--border-color); border-radius:6px;">
                                        <input type="checkbox" id="mod-cmd-admin-only"> <span data-i18n="moderation.admin_only">Admin Only</span>
                                    </label>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:4px; justify-content:flex-end;">
                                    <label style="font-size:11px; color:transparent;">.</label>
                                    <button class="btn btn-secondary btn-sm" onclick="addCustomCommandRule()"><i class="fas fa-plus"></i> <span data-i18n="common.add">Add</span></button>
                                </div>
                            </div>
                        </div>

                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupCommands()"><i class="fas fa-save"></i> <span data-i18n="moderation.save_cmds">Save Commands Config</span></button></div>
                    </div>

                    <!-- IMPORT / EXPORT -->
                    <div id="mod-subpanel-migration" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap" style="background:rgba(100,100,120,0.15);color:var(--text-muted);"><i class="fas fa-file-export"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.migration_title">Import / Export Config</div><div class="mod-feature-desc" data-i18n="moderation.migration_desc">Back up or restore this group's full moderation settings as JSON.</div></div>
                        </div>
                        <div class="mod-actions mod-actions-split" style="margin-bottom:20px;"><button class="btn btn-secondary btn-sm" onclick="exportGroupModerationConfig()"><i class="fas fa-download"></i> <span data-i18n="moderation.export_config">Export Group Config (JSON)</span></button></div>
                        <div class="mod-divider"></div>
                        <div class="mod-field-group">
                            <label class="mod-field-label" data-i18n="moderation.import_config_label">Import JSON Configuration</label>
                            <textarea id="mod-import-text" class="mod-textarea" style="height:100px;" placeholder="Paste moderation JSON configuration here…" data-i18n-placeholder="moderation.import_config_ph"></textarea>
                            <div style="display:flex; align-items:center; gap:12px; margin:12px 0;">
                                <div style="flex:1; height:1px; background:var(--border-color);"></div>
                                <span style="font-size:11px; font-weight:600; color:var(--text-muted); letter-spacing:.5px;" data-i18n="common.or">OR</span>
                                <div style="flex:1; height:1px; background:var(--border-color);"></div>
                            </div>
                            <label class="mod-file-upload-label" for="mod-import-config-file">
                                <i class="fas fa-cloud-upload-alt" style="font-size:18px;"></i>
                                <span id="mod-import-config-filename" data-i18n="moderation.choose_config_json_file">Click to upload or drag &amp; drop a .json file&hellip;</span>
                                <input type="file" id="mod-import-config-file" accept=".json" style="display:none;" onchange="handleModConfigFileUpload(this)">
                            </label>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="importGroupModerationConfig()"><i class="fas fa-upload"></i> <span data-i18n="moderation.import_config_btn">Import Config</span></button></div>
                    </div>
                </div>


                <!-- Global Default Rules Modal -->
                <div id="global-rules-modal" class="modal-overlay" style="display:none;">
                    <div class="modal-card">
                        <div class="modal-header">
                            <h3><i class="fas fa-globe" style="color:var(--primary);"></i> <span data-i18n="moderation.global_default_rules_modal_title">Global Default Rules &amp; Settings</span></h3>
                            <button class="modal-close-btn" onclick="closeGlobalRulesModal()"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="modal-body">
                            <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px; line-height:1.5;" data-i18n="moderation.global_rules_modal_desc">
                                Configure fallback rules for all WhatsApp groups. Groups without custom rules will inherit these global defaults.
                            </p>
                            <div class="mod-field-group">
                                <label class="mod-field-label" data-i18n="moderation.global_rules_label">Global Default Rules</label>
                                <textarea id="mod-global-rules-input-modal" class="mod-textarea" style="height:120px;" placeholder="1. Be respectful to all members.&#10;2. No spam or unauthorized links.&#10;3. Follow group topic." data-i18n-placeholder="moderation.global_rules_ph"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary btn-sm" onclick="closeGlobalRulesModal()" data-i18n="common.cancel">Cancel</button>
                            <button class="btn btn-primary btn-sm" onclick="saveGlobalRulesFromModal()"><i class="fas fa-save"></i> <span data-i18n="moderation.save_global_settings">Save Global Settings</span></button>
                        </div>
                    </div>
                </div>

                <!-- Create Custom Federation Modal -->
                <div id="create-federation-modal" class="modal-overlay">
                    <div class="modal-card">
                        <div class="modal-header">
                            <h3><i class="fas fa-network-wired" style="color:var(--primary);"></i> <span data-i18n="moderation.create_custom_fed_modal_title">Create Custom Federation</span></h3>
                            <button class="modal-close-btn" onclick="closeCreateFederationModal()"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="modal-body">
                            <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px; line-height:1.5;" data-i18n="moderation.create_fed_desc">
                                Create a custom local security federation. Cross-group rules and shared blacklist patterns will apply to all groups connected to this federation.
                            </p>
                            <div class="mod-field-group" style="margin-bottom:12px;">
                                <label class="mod-field-label" data-i18n="moderation.fed_name">Federation Name</label>
                                <input type="text" id="mod-new-fed-name" class="mod-input" placeholder="e.g. Local Security Shield" data-i18n-placeholder="moderation.fed_name_ph">
                            </div>
                            <div class="mod-field-group">
                                <label class="mod-field-label" data-i18n="moderation.fed_desc">Description</label>
                                <input type="text" id="mod-new-fed-desc" class="mod-input" placeholder="e.g. Custom local security federation for internal groups" data-i18n-placeholder="moderation.fed_desc_ph">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary btn-sm" onclick="closeCreateFederationModal()" data-i18n="common.cancel">Cancel</button>
                            <button class="btn btn-primary btn-sm" onclick="saveNewCustomFederation()"><i class="fas fa-plus"></i> <span data-i18n="moderation.create_fed_btn">Create Federation</span></button>
                        </div>
                    </div>
                </div>

                <!-- Import Custom Federation Modal -->
                <div id="import-federation-modal" class="modal-overlay">
                    <div class="modal-card modal-lg">
                        <div class="modal-header">
                            <h3><i class="fas fa-file-import" style="color:var(--primary);"></i> <span data-i18n="moderation.import_fed_modal_title">Import Security Federation</span></h3>
                            <button class="modal-close-btn" onclick="closeImportFederationModal()"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="modal-body">
                            <p style="font-size:12px; color:var(--text-muted); margin-bottom:20px; line-height:1.5;" data-i18n="moderation.import_fed_desc">
                                Import a federation configuration by entering a remote JSON URL or by uploading a local <code style="background:var(--bg-input); padding:1px 5px; border-radius:4px; font-size:11px;">.json</code> file.
                            </p>

                            <div class="mod-field-group" style="margin-bottom:4px;">
                                <label class="mod-field-label" data-i18n="moderation.import_from_url"><i class="fas fa-link"></i> Option A: Import from URL</label>
                                <input type="text" id="mod-import-fed-url" class="mod-input" placeholder="https://example.com/federation_config.json" data-i18n-placeholder="moderation.import_url_ph">
                            </div>

                            <div style="display:flex; align-items:center; gap:12px; margin:16px 0;">
                                <div style="flex:1; height:1px; background:var(--border-color);"></div>
                                <span style="font-size:11px; font-weight:600; color:var(--text-muted); letter-spacing:.5px;" data-i18n="common.or">OR</span>
                                <div style="flex:1; height:1px; background:var(--border-color);"></div>
                            </div>

                            <div class="mod-field-group">
                                <label class="mod-field-label" data-i18n="moderation.import_from_file"><i class="fas fa-file-upload"></i> Option B: Upload JSON File</label>
                                <label class="mod-file-upload-label" for="mod-import-fed-file">
                                    <i class="fas fa-cloud-upload-alt"></i>
                                    <span id="mod-import-fed-filename" data-i18n="moderation.choose_json_file">Click to choose a .json file&hellip;</span>
                                    <input type="file" id="mod-import-fed-file" accept=".json" style="display:none;" onchange="document.getElementById('mod-import-fed-filename').textContent = this.files[0]?.name || 'Click to choose a .json file\u2026'">
                                </label>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary btn-sm" onclick="closeImportFederationModal()"><i class="fas fa-times"></i> <span data-i18n="common.cancel">Cancel</span></button>
                            <button class="btn btn-primary btn-sm" onclick="submitImportFederation()"><i class="fas fa-upload"></i> <span data-i18n="moderation.import_fed_btn">Import Federation</span></button>
                        </div>
                    </div>
                </div>

                <!-- Test Commands Generator Modal -->
                <div id="test-commands-modal" class="modal-overlay">
                    <div class="modal-card" style="max-width:820px; width:90%; max-height:85vh; display:flex; flex-direction:column; background:var(--bg-card); border-radius:12px; overflow:hidden; border:1px solid var(--border-color);">
                        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--border-color); flex-shrink:0;">
                            <h3 style="display:flex;align-items:center;gap:10px; margin:0; font-size:16px; font-weight:600;">
                                <span style="width:32px;height:32px;border-radius:8px;background:rgba(41,182,246,0.15);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
                                    <i class="fas fa-vial" style="color:var(--info);font-size:14px;"></i>
                                </span>
                                <span data-i18n="moderation.autotest.test_suite_title">Test Suite &amp; Commands Generator 🧪</span>
                            </h3>
                            <button class="modal-close-btn" onclick="closeTestCommandsModal()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="modal-body" style="padding:20px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                            <!-- Autonomous Auto-Test Card -->
                            <div class="card" style="background:var(--bg-app); border:1px solid var(--border-color); padding:16px; border-radius:8px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <span style="font-weight:600; font-size:14px; color:var(--text-main);" data-i18n="moderation.autotest.engine_title"><i class="fas fa-robot" style="color:var(--primary);"></i> Autonomous Auto-Test Engine</span>
                                        <label class="mod-toggle-switch mod-toggle-sm">
                                            <input type="checkbox" id="mod-autotest-toggle" checked onchange="toggleAutoTestModeUI(this.checked)">
                                            <span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span>
                                        </label>
                                    </div>
                                </div>

                                <div id="mod-autotest-options" style="display:flex; flex-direction:column; gap:12px; width:100%; border-top:1px solid var(--border-color); padding-top:12px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                                        <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap; flex:1;">
                                            <div style="display:flex; align-items:center; gap:8px; background:var(--bg-card); padding:5px 10px; border-radius:6px; border:1px solid var(--border-color); flex-wrap:wrap; flex:1;">
                                                <label style="font-weight:600; white-space:nowrap; color:var(--text-main); font-size:12px;"><i class="fas fa-user-check" style="color:var(--primary);"></i> Target Test Member:</label>
                                                <select id="mod-autotest-member-select" class="mod-select mod-select-sm" style="flex:1; min-width:180px; background:var(--bg-input); padding:4px 8px; border-radius:6px; border:1px solid var(--border-color); font-size:12px;" onchange="onAutoTestMemberSelectChange(this.value)">
                                                    <option value="">Select Group Member (excluding Bot)...</option>
                                                </select>
                                                <input type="text" id="mod-autotest-target-input" class="mod-input" style="width:130px; padding:4px 8px; font-size:12px;" placeholder="@491761234567" oninput="onAutoTestTargetInput(this.value)">
                                            </div>
                                            <label style="display:flex; align-items:center; gap:6px; font-size:12px; cursor:pointer; font-weight:600; white-space:nowrap;">
                                                <input type="checkbox" id="mod-autotest-safe-only" checked>
                                                <span data-i18n="moderation.autotest.safe_only"><i class="fas fa-shield-alt" style="color:var(--success);"></i> Safe-Only Commands</span>
                                            </label>
                                            <div style="display:flex; align-items:center; gap:6px; font-size:12px; white-space:nowrap;">
                                                <span style="font-weight:600;" data-i18n="moderation.autotest.delay_label">Delay:</span>
                                                <input type="number" id="mod-autotest-delay" class="mod-number-input" value="500" min="50" max="10000" style="width:70px; height:32px; font-weight:600;">
                                                <span>ms</span>
                                            </div>
                                        </div>
                                        <button id="btn-run-autotest" class="btn btn-primary btn-sm" style="font-weight:700; padding:8px 18px; display:inline-flex; align-items:center; justify-content:center; gap:8px; white-space:nowrap; flex-shrink:0;" onclick="runAutonomousModerationTest()"><i class="fas fa-play"></i> <span data-i18n="moderation.autotest.start">Start Auto-Test</span></button>
                                    </div>
                                    
                                    <!-- Subtest Selection Matrix -->
                                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:6px; padding:12px;">
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                            <label class="mod-field-label" style="margin:0; font-size:11px; font-weight:700;" data-i18n="moderation.autotest.select_features"><i class="fas fa-list-check"></i> Select Moderation Features to Test</label>
                                            <div style="display:flex; gap:6px;">
                                                <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:10px;" onclick="selectAllModSubtests(true)" data-i18n="common.select_all">Select All</button>
                                                <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:10px;" onclick="selectAllModSubtests(false)" data-i18n="common.select_none">Select None</button>
                                            </div>
                                        </div>
                                        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:6px; font-size:11px;">
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="diagnostics" checked> <span data-i18n="moderation.autotest.feat_diagnostics">🛠️ Diagnostic Commands</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="addressing" checked> <span data-i18n="moderation.autotest.feat_addressing">👤 User Addressing</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="custom_cmds" checked> <span data-i18n="moderation.autotest.feat_custom_cmds">🤖 Custom Commands</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="locks" checked> <span data-i18n="moderation.autotest.feat_locks">🔒 Content Locks</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="blacklist" checked> <span data-i18n="moderation.autotest.feat_blacklist">🚫 Word Blacklist</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="spam_links" checked> <span data-i18n="moderation.autotest.feat_spam_links">🔗 Platform Spam Links</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="warnings" checked> <span data-i18n="moderation.autotest.feat_warnings">⚠️ Warnings &amp; Decay</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="captcha" checked> <span data-i18n="moderation.autotest.feat_captcha">👤 Welcome &amp; Captcha</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="antiraid" checked> <span data-i18n="moderation.autotest.feat_antiraid">⚡ Anti-Raid &amp; Flood</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="federation" checked> <span data-i18n="moderation.autotest.feat_federation">🌐 Global Federation</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="ai" checked> <span data-i18n="moderation.autotest.feat_ai">🧠 Gemini AI Assistant</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="bot_antispam" checked> <span data-i18n="moderation.autotest.feat_bot_antispam">🛡️ Bot Outbound Rate Limit</span></label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Live Log Streaming Container -->
                            <div id="mod-autotest-log-stream" style="display:block; padding:12px; background:#111827; border:1px solid #374151; border-radius:8px; font-family:Consolas, Monaco, monospace; font-size:11px; color:#38bdf8; max-height:240px; overflow-y:auto; white-space:pre-wrap; line-height:1.5;">
                                <div style="display:flex; justify-content:space-between; align-items:center; color:#9ca3af; border-bottom:1px solid #374151; padding-bottom:6px; margin-bottom:8px; font-weight:600;">
                                    <span data-i18n="moderation.autotest.live_stream"><i class="fas fa-terminal"></i> Live Moderation Auto-Test Stream</span>
                                    <div style="display:flex; gap:6px;">
                                        <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:10px;" onclick="copyAutoTestLogs()" data-i18n="common.copy_all"><i class="fas fa-copy"></i> Copy All</button>
                                        <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:10px;" onclick="clearAutoTestLogs()" data-i18n="common.clear"><i class="fas fa-eraser"></i> Clear</button>
                                        <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:10px;" onclick="exportAutoTestLogs()" data-i18n="moderation.autotest.export_log"><i class="fas fa-download"></i> Export Log</button>
                                    </div>
                                </div>
                                <div id="mod-autotest-progress-bar-container" style="display:none; height:4px; background:#374151; border-radius:2px; margin-bottom:8px; overflow:hidden;">
                                    <div id="mod-autotest-progress-bar" style="height:100%; width:0%; background:#38bdf8; transition:width 0.2s;"></div>
                                </div>
                                <div id="mod-autotest-log-content" style="color:#38bdf8;"><span data-i18n="moderation.autotest.console_ready">Console Ready. Select features above and click "Start Auto-Test" to stream real-time logs.</span></div>
                            </div>

                            <p style="font-size:13px; color:var(--text-muted); margin:4px 0;" data-i18n="moderation.autotest.ready_commands_desc">
                                Ready-to-use test commands and sample payload triggers customized specifically for the selected group. Copy and paste them into WhatsApp to test all features:
                            </p>
                            <div id="test-commands-modal-content"></div>
                        </div>
                        <div class="modal-footer" style="padding:12px 20px; border-top:1px solid var(--border-color); display:flex; justify-content:flex-end; flex-shrink:0;">
                            <button class="btn btn-secondary btn-sm" onclick="closeTestCommandsModal()" data-i18n="common.close">Close</button>
                        </div>
                    </div>
                </div>

                <!-- Unsaved Changes Warning Modal -->
                <div id="unsaved-changes-modal" class="modal-overlay">
                    <div class="modal-card">
                        <div class="modal-header">
                            <h3 style="display:flex;align-items:center;gap:10px;">
                                <span style="width:32px;height:32px;border-radius:8px;background:rgba(255,188,0,0.15);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
                                    <i class="fas fa-exclamation-triangle" style="color:var(--warning);font-size:14px;"></i>
                                </span>
                                <span data-i18n="telegram.unsaved_changes_title">Unsaved Changes</span>
                            </h3>
                            <button class="modal-close-btn" onclick="unsavedModalCancel()"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="modal-body">
                            <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin-bottom:6px;">
                                <span data-i18n="moderation.unsaved_changes_in">You have unsaved changes in</span> <strong id="unsaved-panel-name" style="color:var(--primary);"></strong>.
                            </p>
                            <p style="font-size:13px; color:var(--text-muted); line-height:1.6;" data-i18n="moderation.save_before_switch">
                                Would you like to save them before switching?
                            </p>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary btn-sm" onclick="unsavedModalCancel()"><i class="fas fa-arrow-left"></i> <span data-i18n="moderation.stay">Stay</span></button>
                            <button class="btn btn-ghost btn-sm" onclick="unsavedModalDiscard()" style="color:var(--danger);"><i class="fas fa-trash-alt"></i> <span data-i18n="moderation.discard">Discard</span></button>
                            <button class="btn btn-primary btn-sm" onclick="unsavedModalSaveAndSwitch()"><i class="fas fa-save"></i> <span data-i18n="moderation.save_and_switch">Save &amp; Switch</span></button>
                        </div>
                    </div>
                </div>

            </section>
`;
