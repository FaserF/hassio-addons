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
                        <div class="mod-toggle-row">
                            <span class="mod-toggle-label"><i class="fas fa-power-off"></i> Global</span>
                            <label class="mod-toggle-switch">
                                <input type="checkbox" id="mod-global-toggle" onchange="toggleGlobalModeration(this.checked)">
                                <span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span>
                            </label>
                        </div>
                        <div class="mod-group-picker">
                            <i class="fas fa-users" style="color:var(--text-muted);font-size:13px;"></i>
                            <select id="mod-group-select" class="mod-select" onchange="selectModerationGroup(this.value)">
                                <option value="" data-i18n="moderation.select_group">Select a group…</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- No Group Selected & Global Settings Card -->
                <div id="mod-no-group-placeholder" class="card mod-settings-card" style="margin-top: 16px; padding: 24px;">
                    <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
                        <div style="font-size: 28px; color: var(--primary);"><i class="fas fa-globe"></i></div>
                        <div>
                            <h3 style="margin: 0; font-weight: 600; font-size:16px;">Global Default Rules &amp; Moderation Settings</h3>
                            <p style="color: var(--text-muted); margin: 2px 0 0; font-size: 12px;">
                                Configure global fallback rules applicable to all WhatsApp groups. Select a specific group from the dropdown menu above to customize per-group settings.
                            </p>
                        </div>
                    </div>

                    <div class="mod-field-group" style="margin-bottom:20px;">
                        <label class="mod-field-label"><i class="fas fa-scroll"></i> Global Default Rules (Fallback for all groups)</label>
                        <p class="mod-field-desc">These rules will be displayed via <code>!rules</code> for any group that does not have custom group rules configured.</p>
                        <textarea id="mod-global-rules-input" class="mod-textarea" style="height:140px;" placeholder="1. Be respectful to all members.&#10;2. No spam or unauthorized advertising.&#10;3. Follow group topic."></textarea>
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
                            <h3 id="mod-active-group-title" class="mod-card-title"><i class="fas fa-users-cog"></i> Group Settings</h3>
                            <div class="mod-toggle-row" style="display:flex;align-items:center;gap:12px;">
                                <button class="btn btn-secondary btn-sm" onclick="generateGroupTestCommandsModal()"><i class="fas fa-vial"></i> Generate Test Commands 🧪</button>
                                <span class="mod-toggle-label">Enable for this group</span>
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
                            <button class="mod-pill" data-subtab="warnings" onclick="switchModSubTab('warnings')"><i class="fas fa-exclamation-triangle"></i> Warnings</button>
                            <button class="mod-pill" data-subtab="reports" onclick="switchModSubTab('reports')"><i class="fas fa-flag"></i> Reports</button>
                            <button class="mod-pill" data-subtab="locks" onclick="switchModSubTab('locks')"><i class="fas fa-lock"></i> <span data-i18n="moderation.tabs.locks">Locks</span></button>
                            <button class="mod-pill" data-subtab="blacklist" onclick="switchModSubTab('blacklist')"><i class="fas fa-ban"></i> <span data-i18n="moderation.blacklist.title">Blacklist</span></button>
                            <button class="mod-pill" data-subtab="filters" onclick="switchModSubTab('filters')"><i class="fas fa-robot"></i> Filters</button>
                            <button class="mod-pill" data-subtab="antispam" onclick="switchModSubTab('antispam')"><i class="fas fa-bolt"></i> Anti-Spam</button>
                            <button class="mod-pill" data-subtab="federation" onclick="switchModSubTab('federation')"><i class="fas fa-network-wired"></i> Federation</button>
                            <button class="mod-pill" data-subtab="commands" onclick="switchModSubTab('commands')"><i class="fas fa-terminal"></i> <span data-i18n="moderation.tabs.commands">Commands</span></button>
                            <button class="mod-pill" data-subtab="ai" onclick="switchModSubTab('ai')"><i class="fas fa-brain"></i> <span data-i18n="moderation.tabs.intelligence">Gemini AI</span></button>
                            <button class="mod-pill" data-subtab="migration" onclick="switchModSubTab('migration')"><i class="fas fa-file-export"></i> Import/Export</button>
                        </div>
                    </div>

                    <!-- RULES -->
                    <div id="mod-subpanel-rules" class="mod-subpanel">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-primary"><i class="fas fa-scroll"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.rules.title">Group Rules</div><div class="mod-feature-desc" data-i18n="moderation.rules.desc">Define group rules for <code>!rules</code> and optionally append them to the welcome message on join.</div></div>
                        </div>
                        <textarea id="mod-rules-text" class="mod-textarea" placeholder="1. Be respectful&#10;2. No spam&#10;3. No NSFW content"></textarea>
                        <div class="mod-option-row">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-rules-show-on-join"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label">Include group rules inside the welcome message when a new member joins</span>
                        </div>
                        <div class="mod-option-row" style="margin-top:10px; display:flex; align-items:center; gap:10px;">
                            <i class="fas fa-language" style="color:var(--primary); font-size:16px;"></i>
                            <span class="mod-option-label" data-i18n="moderation.language_setting.title">Group Bot Response Language:</span>
                            <select id="mod-group-language-select" class="mod-select mod-select-sm" style="width:140px;">
                                <option value="en">🇬🇧 English (Default)</option>
                                <option value="de">🇩🇪 Deutsch</option>
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
                                <div class="mod-block-label"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-welcome-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span>Welcome Message</span></div>
                                <input type="text" id="mod-welcome-msg" class="mod-input" placeholder="Welcome {user} to {group}!" style="margin-bottom:8px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <label class="mod-field-label" style="margin:0; font-size:11px; white-space:nowrap;">Destination:</label>
                                    <select id="mod-welcome-target" class="mod-select mod-select-sm">
                                        <option value="private" selected>Private Chat (DM to joining user)</option>
                                        <option value="group">Group Chat</option>
                                    </select>
                                </div>
                            </div>
                            <div class="mod-feature-block">
                                <div class="mod-block-label"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-goodbye-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span>Goodbye Message</span></div>
                                <input type="text" id="mod-goodbye-msg" class="mod-input" placeholder="Goodbye {user}!" style="margin-bottom:8px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <label class="mod-field-label" style="margin:0; font-size:11px; white-space:nowrap;">Destination:</label>
                                    <select id="mod-goodbye-target" class="mod-select mod-select-sm">
                                        <option value="private" selected>Private Chat (DM to leaving user)</option>
                                        <option value="group">Group Chat</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- Variables Legend -->
                        <div style="margin-top:12px; padding:10px 12px; background:var(--card-bg); border:1px solid var(--border-color); border-radius:6px; font-size:12px;">
                            <strong style="color:var(--primary);"><i class="fas fa-code"></i> Available Message Variables:</strong>
                            <div style="display:flex; flex-wrap:wrap; gap:8px 16px; margin-top:6px; color:var(--text-main);">
                                <div><code>{user}</code> / <code>{mention}</code> &ndash; <span style="color:var(--text-muted);">Mentions the user (@phone)</span></div>
                                <div><code>{name}</code> &ndash; <span style="color:var(--text-muted);">User phone number / ID</span></div>
                                <div><code>{pushname}</code> &ndash; <span style="color:var(--text-muted);">User profile name</span></div>
                                <div><code>{group}</code> / <code>{subject}</code> / <code>{title}</code> &ndash; <span style="color:var(--text-muted);">Group name</span></div>
                                <div><code>{count}</code> / <code>{members}</code> &ndash; <span style="color:var(--text-muted);">Member count</span></div>
                                <div><code>{rules}</code> &ndash; <span style="color:var(--text-muted);">Group rules text</span></div>
                                <div><code>{date}</code> &ndash; <span style="color:var(--text-muted);">Current date (e.g. 06.08.2026)</span></div>
                                <div><code>{time}</code> &ndash; <span style="color:var(--text-muted);">Current time (e.g. 10:15)</span></div>
                            </div>
                        </div>

                        <div class="mod-divider"></div>
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-warning"><i class="fas fa-user-shield"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.captcha.title">Join Captcha Verification</div><div class="mod-feature-desc" data-i18n="moderation.captcha.desc">Challenge new members before they can post.</div></div>
                        </div>
                        <div class="mod-inline-controls">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-captcha-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label">Require captcha on join</span>
                            <select id="mod-captcha-mode" class="mod-select mod-select-sm"><option value="code">Security Code</option><option value="math">Math problem</option><option value="button">Button challenge</option></select>
                            <select id="mod-captcha-target" class="mod-select mod-select-sm"><option value="private">Private Chat (DM)</option><option value="group">Group Chat</option></select>
                            <div class="mod-number-group"><input type="number" id="mod-captcha-timeout" class="mod-number-input" value="240" min="30" max="600"><span class="mod-number-unit">s timeout</span></div>
                        </div>
                        <div class="mod-divider"></div>
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-primary"><i class="fas fa-id-card"></i></div>
                            <div><div class="mod-feature-title">User Addressing &amp; Name Format</div><div class="mod-feature-desc">Configure name resolution order and fallback when mentioning users in messages.</div></div>
                        </div>
                        <div class="mod-inline-controls" style="margin-bottom:12px;">
                            <label class="mod-field-label" style="margin:0; white-space:nowrap;">Name Priority:</label>
                            <select id="mod-name-priority" class="mod-select mod-select-sm">
                                <option value="name_push_phone">Contact Name &gt; Pushname &gt; Phone Number</option>
                                <option value="push_name_phone">Pushname &gt; Contact Name &gt; Phone Number</option>
                                <option value="phone_only">Phone Number Only (+49...)</option>
                            </select>
                            <label class="mod-field-label" style="margin:0; margin-left:12px; white-space:nowrap;">Fallback:</label>
                            <select id="mod-name-fallback" class="mod-select mod-select-sm">
                                <option value="phone">Phone Number (+49...)</option>
                                <option value="user">Generic (@User)</option>
                            </select>
                        </div>

                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupGreetings()"><i class="fas fa-save"></i> Save Greetings &amp; Captcha</button></div>

                        <div id="mod-captcha-users-container" style="display:none; margin-top:20px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                <p class="mod-section-label" style="margin-bottom:0;"><i class="fas fa-user-check"></i> Captcha Verification Overview</p>
                                <button class="btn btn-secondary btn-sm" onclick="loadCaptchaUsers()"><i class="fas fa-sync"></i> Refresh Users</button>
                            </div>
                            <div id="mod-captcha-users-list" class="mod-list-container"><div class="empty-state">Select a group to load captcha verification status</div></div>
                        </div>
                    </div>

                    <!-- WARNINGS -->
                    <div id="mod-subpanel-warnings" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-warning"><i class="fas fa-exclamation-triangle"></i></div>
                            <div><div class="mod-feature-title">Warning System</div><div class="mod-feature-desc">Issue warnings and auto-punish repeat offenders.</div></div>
                        </div>
                        <div class="mod-inline-controls">
                            <div class="mod-number-group"><span class="mod-number-unit">Max warnings</span><input type="number" id="mod-max-warns" class="mod-number-input" value="3" min="1" max="20"></div>
                            <div class="mod-field-group"><label class="mod-field-label">Penalty after max</label><select id="mod-warn-action" class="mod-select mod-select-sm"><option value="mute">Mute User</option><option value="kick">Kick User</option><option value="ban">Ban User</option></select></div>
                            <button class="btn btn-primary btn-sm" onclick="saveGroupWarnings()"><i class="fas fa-save"></i> Save</button>
                        </div>
                        <div class="mod-divider"></div>
                        <p class="mod-section-label"><i class="fas fa-list-ul"></i> Active Warnings</p>
                        <div id="mod-warns-list" class="mod-list-container" style="margin-bottom:20px;"><div class="empty-state">No active user warnings</div></div>

                        <div class="mod-divider"></div>
                        <p class="mod-section-label"><i class="fas fa-user-slash"></i> Banned Users (Auto-kicked on rejoin)</p>
                        <div id="mod-bans-list" class="mod-list-container" style="margin-bottom:20px;"><div class="empty-state">No banned users</div></div>

                        <div class="mod-divider"></div>
                        <p class="mod-section-label"><i class="fas fa-user-times"></i> Kick History Log</p>
                        <div id="mod-kicks-list" class="mod-list-container"><div class="empty-state">No kick history</div></div>
                    </div>

                    <!-- REPORTS -->
                    <div id="mod-subpanel-reports" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-flag"></i></div>
                            <div><div class="mod-feature-title">Group Reports Log</div><div class="mod-feature-desc">View all reported messages, reporter details, target users, and timestamps.</div></div>
                        </div>
                        <div id="mod-reports-list" class="mod-list-container"><div class="empty-state">No reports submitted yet</div></div>
                    </div>

                    <!-- LOCKS -->
                    <div id="mod-subpanel-locks" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-warning"><i class="fas fa-lock"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.content_locks.title">Content Locks</div><div class="mod-feature-desc" data-i18n="moderation.content_locks.description">Automatically delete specific message types when sent by non-admin members.</div></div>
                        </div>
                        <div class="mod-lock-grid">
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-image"></i></div><span>Images</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-image"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-video"></i></div><span>Videos</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-video"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-microphone"></i></div><span>Voice</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-audio"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-file-alt"></i></div><span>Documents</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-document"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-sticky-note"></i></div><span>Stickers</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-sticker"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-link"></i></div><span>URLs</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-url"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-user-plus"></i></div><span>Invites</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-invite"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-poll"></i></div><span>Polls</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-poll"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-address-card"></i></div><span>Contacts</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-contact"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-map-marker-alt"></i></div><span>Locations</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-location"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-share"></i></div><span>Forwarded</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-forwarded"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-language"></i></div><span>RTL Text</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-rtl"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupLocks()"><i class="fas fa-save"></i> Save Locks</button></div>
                    </div>

                    <!-- BLACKLIST -->
                    <div id="mod-subpanel-blacklist" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-ban"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.blacklist.title">Word &amp; Pattern Blacklist</div><div class="mod-feature-desc" data-i18n="moderation.blacklist.desc">Auto-delete messages containing blocked words or regex patterns.</div></div>
                        </div>
                        <div class="mod-field-group" style="max-width:320px; margin-bottom:12px;">
                            <label class="mod-field-label">Matching Mode</label>
                            <select id="mod-blacklist-mode" class="mod-select mod-select-sm">
                                <option value="exact">Exact Word Match (default - e.g. "badword")</option>
                                <option value="contains">Substring / Contains Match (e.g. "verybadwordtext")</option>
                            </select>
                            <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">Exact match checks standalone words. Substring match checks if the word appears anywhere in the message.</p>
                        </div>
                        <div class="mod-add-row">
                            <input type="text" id="mod-blacklist-new" class="mod-input mod-input-flex" placeholder="Add word or /regex/ pattern…" onkeydown="if(event.key==='Enter'){event.preventDefault();addBlacklistWord();}">
                            <button class="btn btn-secondary btn-sm" onclick="addBlacklistWord()"><i class="fas fa-plus"></i> Add</button>
                        </div>
                        <div id="mod-blacklist-tags" class="mod-tag-cloud"></div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupBlacklist()"><i class="fas fa-save"></i> Save Blacklist</button></div>
                    </div>

                    <!-- FILTERS -->
                    <div id="mod-subpanel-filters" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-info"><i class="fas fa-robot"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.filters.title">Auto-Responder &amp; FAQ Filters</div><div class="mod-feature-desc" data-i18n="moderation.filters.desc">Trigger automatic replies or FAQ hints on specific keywords.</div></div>
                        </div>
                        <div class="mod-two-col mod-two-col-tight">
                            <input type="text" id="mod-filter-trigger" class="mod-input" placeholder="Trigger (e.g. wlan, !help)" onkeydown="if(event.key==='Enter'){event.preventDefault();addFilterRule();}">
                            <select id="mod-filter-type" class="mod-select" style="max-width:140px;">
                                <option value="reply">Direct Reply</option>
                                <option value="faq">FAQ Hint 💡</option>
                            </select>
                        </div>
                        <div style="margin-top:8px;">
                            <input type="text" id="mod-filter-response" class="mod-input" placeholder="Response text or FAQ answer" onkeydown="if(event.key==='Enter'){event.preventDefault();addFilterRule();}">
                        </div>
                        <div class="mod-actions mod-actions-split" style="margin-top:10px;">
                            <button class="btn btn-secondary btn-sm" onclick="addFilterRule()"><i class="fas fa-plus"></i> Add Rule</button>
                            <button class="btn btn-primary btn-sm" onclick="saveGroupFilters()"><i class="fas fa-save"></i> Save Filters</button>
                        </div>
                        <div id="mod-filters-list" class="mod-list-container"></div>
                    </div>

                    <!-- ANTI-SPAM -->
                    <div id="mod-subpanel-antispam" class="mod-subpanel" style="display:none;">
                        <div class="mod-two-col">
                            <div class="mod-feature-block mod-feature-block-full">
                                <div class="mod-feature-header">
                                    <div class="mod-feature-icon-wrap mod-color-warning"><i class="fas fa-bolt"></i></div>
                                    <div><div class="mod-feature-title" data-i18n="moderation.flood.title">Flood Protection</div><div class="mod-feature-desc" data-i18n="moderation.flood.desc">Mute users sending too many messages too fast.</div></div>
                                </div>
                                <div class="mod-option-row"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-flood-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Enable flood protection</span></div>
                                <div class="mod-rate-row"><span class="mod-rate-label">Max</span><input type="number" id="mod-flood-max" class="mod-number-input" value="5" min="1" max="100"><span class="mod-rate-label">messages in</span><input type="number" id="mod-flood-win" class="mod-number-input" value="5" min="1" max="300"><span class="mod-rate-label">seconds</span></div>
                                <div style="margin-top:16px; border-top:1px dashed var(--border-color); padding-top:12px;">
                                    <label class="mod-field-label" style="font-size:12px; font-weight:600;"><i class="fas fa-volume-mute"></i> Currently Muted Users</label>
                                    <div id="mod-muted-users-list" style="margin-top:8px;"></div>
                                </div>
                            </div>
                            <div class="mod-feature-block mod-feature-block-full">
                                <div class="mod-feature-header">
                                    <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-shield-alt"></i></div>
                                    <div><div class="mod-feature-title" data-i18n="moderation.antiraid.title">Anti-Raid Shield</div><div class="mod-feature-desc" data-i18n="moderation.antiraid.desc">Lock group when too many users join in short time.</div></div>
                                </div>
                                <div class="mod-option-row"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-antiraid-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Enable anti-raid shield</span></div>
                                <div class="mod-rate-row"><span class="mod-rate-label">Max</span><input type="number" id="mod-antiraid-max" class="mod-number-input" value="5" min="1" max="100"><span class="mod-rate-label">joins in</span><input type="number" id="mod-antiraid-win" class="mod-number-input" value="10" min="1" max="300"><span class="mod-rate-label">seconds</span></div>
                            </div>
                            <div class="mod-feature-block mod-feature-block-full" style="margin-top:16px;">
                                <div class="mod-feature-header">
                                    <div class="mod-feature-icon-wrap mod-color-info"><i class="fas fa-link"></i></div>
                                    <div><div class="mod-feature-title" data-i18n="moderation.antispam_links.title">Anti-Spam Invite Links Removal</div><div class="mod-feature-desc" data-i18n="moderation.antispam_links.desc">Automatically delete t.me, wa.me, and unauthorized chat invite links.</div></div>
                                </div>
                                <div class="mod-option-row" style="margin-bottom:12px;"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-antispam-links-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Enable auto-removal of spam &amp; invite links</span></div>
                                <div class="mod-option-row" style="margin-bottom:12px;"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-notify-deleted-action" checked><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Send notification message with quote when a prohibited message is deleted (Default: Enabled)</span></div>
                                <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:6px; padding:10px; font-size:12px;">
                                    <div style="font-weight:600; color:var(--text-muted); margin-bottom:8px;"><i class="fas fa-filter"></i> Blocked Invite Link Platforms (Default: All Enabled):</div>
                                    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:8px;">
                                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="mod-invite-platform-whatsapp" checked> <span><i class="fab fa-whatsapp"></i> WhatsApp</span></label>
                                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="mod-invite-platform-telegram" checked> <span><i class="fab fa-telegram"></i> Telegram</span></label>
                                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="mod-invite-platform-signal" checked> <span><i class="fas fa-comment-dots"></i> Signal</span></label>
                                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="mod-invite-platform-instagram" checked> <span><i class="fab fa-instagram"></i> Instagram</span></label>
                                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="mod-invite-platform-discord" checked> <span><i class="fab fa-discord"></i> Discord</span></label>
                                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="mod-invite-platform-other" checked> <span><i class="fas fa-share-alt"></i> Others (Line, Snapchat, Viber, Matrix)</span></label>
                                    </div>
                                </div>
                            </div>
                            <div class="mod-feature-block mod-feature-block-full" style="margin-top:16px;">
                                <div class="mod-feature-header">
                                    <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-robot"></i></div>
                                    <div><div class="mod-feature-title">Bot Outbound Anti-Spam Shield 🛡️</div><div class="mod-feature-desc">Prevents bot loops and accidental message floods. Automatically mutes bot replies for <code>msgs_in_5s * group_members</code> seconds if the bot sends 5+ messages in 5 seconds in this chat. (Exempts Telegram Relay messages).</div></div>
                                </div>
                                <div class="mod-option-row"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-antispam-bot-enabled" checked><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Enable Bot Outbound Rate Limit &amp; Loop Protection (Enabled by Default)</span></div>
                            </div>
                            <div class="mod-feature-block mod-feature-block-full" style="margin-top:16px;">
                                <div class="mod-feature-header">
                                    <div class="mod-feature-icon-wrap mod-color-warning"><i class="fas fa-comment-slash"></i></div>
                                    <div><div class="mod-feature-title">Notify Bypassed Moderation Actions</div><div class="mod-feature-desc">Send an explanatory message in group when a moderation action (spam link, lock, blacklist) is intentionally skipped because the sender is a Group Admin.</div></div>
                                </div>
                                <div class="mod-option-row"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-notify-bypassed-actions"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Notify in group when moderation is bypassed for admins</span></div>
                            </div>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupAntispam()"><i class="fas fa-save"></i> Save Anti-Spam Config</button></div>

                    </div>

                    <!-- FEDERATION -->
                    <div id="mod-subpanel-federation" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-info"><i class="fas fa-network-wired"></i></div>
                            <div><div class="mod-feature-title" data-i18n="moderation.federation.title">Global Security Federation</div><div class="mod-feature-desc" data-i18n="moderation.federation.desc">Cross-group security shield for automatic spam prevention, botnet bans, and prohibited link filtering.</div></div>
                        </div>
                        <div class="mod-field-group" style="max-width:650px; margin-bottom:16px;">
                            <label class="mod-field-label">Active Federation Network</label>
                            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                                <select id="mod-fed-select" class="mod-select" style="min-width:220px;" onchange="updateFedBlacklistTagsInUi()"><option value="">No Federation Joined</option><option value="fed_global_default" selected>Global Default Security Federation</option></select>
                                <button type="button" class="btn btn-secondary btn-sm" style="white-space:nowrap;" onclick="openCreateFederationModal()"><i class="fas fa-plus-circle"></i> Create Custom Federation</button>
                                <button type="button" class="btn btn-secondary btn-sm" style="white-space:nowrap;" onclick="exportFederationConfig()"><i class="fas fa-file-export"></i> Share / Export (JSON)</button>
                                <button type="button" class="btn btn-secondary btn-sm" style="white-space:nowrap;" onclick="openImportFederationModal()"><i class="fas fa-file-import"></i> Import Federation</button>
                            </div>
                        </div>

                        <!-- Federation Security Shield Card -->
                        <div class="card" style="background:rgba(37,211,102,0.04); border:1px solid rgba(37,211,102,0.2); padding:16px; border-radius:8px; margin-bottom:20px;">
                            <h4 style="margin:0 0 10px; font-size:14px; font-weight:600; color:var(--primary);"><i class="fas fa-shield-alt"></i> Predefined Federation Rules &amp; Active Protection</h4>
                            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; font-size:12px;">
                                <div style="display:flex; align-items:center; gap:8px;"><i class="fas fa-check-circle" style="color:var(--primary);"></i> <span>Auto-Kick Fed-Banned Spammers</span></div>
                                <div style="display:flex; align-items:center; gap:8px;"><i class="fas fa-check-circle" style="color:var(--primary);"></i> <span>Cross-Group Botnet Protection</span></div>
                                <div style="display:flex; align-items:center; gap:8px;"><i class="fas fa-check-circle" style="color:var(--primary);"></i> <span>Shared Prohibited Links Filtering</span></div>
                            </div>
                        </div>

                        <!-- Shared Blacklist Patterns -->
                        <div class="mod-field-group" style="margin-bottom:20px;">
                            <label class="mod-field-label"><i class="fas fa-ban"></i> Shared Federation Blacklist (Predefined & Custom Patterns)</label>
                            <p class="mod-field-desc">Messages containing these links or patterns are automatically deleted across all groups linked to this Federation.</p>
                            <div id="mod-fed-blacklist-tags" class="mod-tag-cloud" style="margin-bottom:10px;"></div>
                            <div class="mod-add-row">
                                <input type="text" id="mod-fed-blacklist-new" class="mod-input mod-input-flex" placeholder="Add shared link pattern (e.g. t.me/joinchat)..." onkeydown="if(event.key==='Enter'){event.preventDefault();addFedBlacklistWord();}">
                                <button class="btn btn-secondary btn-sm" onclick="addFedBlacklistWord()"><i class="fas fa-plus"></i> Add Link Pattern</button>
                            </div>
                        </div>

                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupFederation()"><i class="fas fa-save"></i> Save Federation Settings</button></div>
                    </div>

                    <!-- GEMINI AI -->
                    <div id="mod-subpanel-ai" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap" style="background:linear-gradient(135deg,rgba(0,168,132,0.2),rgba(52,152,219,0.2));color:var(--primary);"><i class="fas fa-brain"></i></div>
                            <div><div class="mod-feature-title">Gemini AI Assistant &amp; Translation</div><div class="mod-feature-desc">Configure Gemini API Key, FAQ auto-responder, toxicity moderation, and language translation.</div></div>
                        </div>
                        <div class="mod-field-group" style="max-width:450px; margin-bottom:16px;">
                            <label class="mod-field-label"><i class="fas fa-key"></i> Gemini API Key (Global)</label>
                            <div style="display:flex; gap:8px;">
                                <input type="password" id="mod-ai-key" class="mod-input" placeholder="AIzaSy..." autocomplete="off">
                                <button type="button" class="btn btn-secondary btn-sm" onclick="const k=document.getElementById('mod-ai-key'); k.type=k.type==='password'?'text':'password';"><i class="fas fa-eye"></i></button>
                            </div>
                            <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">Get your free API key from Google AI Studio (aip.google.dev).</p>
                        </div>
                        <div class="mod-divider"></div>
                        <div class="mod-option-row" style="margin-bottom:10px;"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-ai-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Enable Gemini AI assistance for this group</span></div>
                        <div class="mod-option-row" style="margin-bottom:10px;"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-ai-faq"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Auto-reply to group FAQs</span></div>
                        <div class="mod-option-row" style="margin-bottom:16px;"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-ai-sentiment"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Automated Toxicity &amp; Sentiment Moderation</span></div>
                        <div class="mod-field-group" style="margin-bottom:16px;"><label class="mod-field-label">AI System Persona Prompt</label><textarea id="mod-ai-prompt" class="mod-textarea" style="height:80px;" placeholder="You are an intelligent, friendly, and professional WhatsApp Group Moderator AI. Your goals are to assist group members with accurate information, enforce group etiquette, keep responses concise, polite, and well-formatted for WhatsApp, and maintain a constructive community atmosphere."></textarea></div>
                        
                        <div class="mod-divider"></div>
                        <p class="mod-section-label"><i class="fas fa-language"></i> Translation Settings</p>
                        <div class="mod-inline-controls" style="margin-bottom:16px;">
                            <div class="mod-field-group">
                                <label class="mod-field-label">Target Language</label>
                                <input type="text" id="mod-trans-lang" class="mod-input mod-input-sm" value="en" style="width:80px;" placeholder="en, de...">
                            </div>
                            <div class="mod-field-group">
                                <label class="mod-field-label">Translation Mode</label>
                                <select id="mod-trans-mode" class="mod-select mod-select-sm">
                                    <option value="manual">Manual (via !translate command)</option>
                                    <option value="auto">Auto (Translate all incoming messages)</option>
                                </select>
                            </div>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupAiConfig()"><i class="fas fa-save"></i> Save AI &amp; Translation Settings</button></div>
                    </div>

                    <!-- COMMANDS -->
                    <div id="mod-subpanel-commands" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap" style="background:linear-gradient(135deg,rgba(0,168,132,0.2),rgba(52,152,219,0.2));color:var(--primary);"><i class="fas fa-terminal"></i></div>
                            <div><div class="mod-feature-title">Bot Commands &amp; Custom Mappings</div><div class="mod-feature-desc">Allow members and admins to interact with the bot via group commands and custom mapped shortcuts.</div></div>
                        </div>
                        <div class="mod-option-row" style="margin-bottom:10px;">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-cmds-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label">Enable group commands (!help, !warn, !ban, etc.)</span>
                        </div>
                        <div class="mod-option-row" style="margin-bottom:10px;">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-cmds-multi-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label">Process multiple commands in a single message (default: execute 1st command only)</span>
                        </div>
                        <div class="mod-field-group" style="max-width:200px; margin-bottom:12px;">
                            <label class="mod-field-label">Command Prefix</label>
                            <input type="text" id="mod-cmds-prefix" class="mod-input" value="!" maxlength="3">
                        </div>
                        <div class="mod-field-group" style="max-width:300px; margin-bottom:16px;">
                            <label class="mod-field-label">Mute Action (WhatsApp API Limit)</label>
                            <select id="mod-cmds-mute-action" class="mod-select mod-select-sm">
                                <option value="delete">Delete user's messages</option>
                            </select>
                            <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">WhatsApp does not support user-specific mutes. This defines how mutes are enforced.</p>
                        </div>

                        <!-- Default Built-in Commands Toggles -->
                        <div class="mod-field-group" style="margin-top:20px; margin-bottom:20px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <label class="mod-field-label" style="margin:0;"><i class="fas fa-toggle-on"></i> Enable/Disable Built-in Commands</label>
                                <div style="display:flex; gap:6px;">
                                    <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:11px;" onclick="toggleAllDefaultCommands(true)">Enable All</button>
                                    <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:11px;" onclick="toggleAllDefaultCommands(false)">Disable All</button>
                                </div>
                            </div>
                            <p class="mod-field-desc">Control which built-in commands are permitted in this group. When a disabled command is triggered, the bot will notify members that the command is disabled.</p>
                            <div style="position:relative; margin-bottom:8px; margin-top:10px;">
                                <i class="fas fa-search" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:12px; pointer-events:none;"></i>
                                <input type="text" id="mod-default-cmds-search" class="mod-input" placeholder="Search commands…" oninput="filterDefaultCommands(this.value)" style="padding-left:30px; font-size:12px; width:100%; box-sizing:border-box;">
                            </div>
                            <div id="mod-default-cmds-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:8px; padding:8px; border:1px solid var(--border-color); border-radius:6px; background:rgba(0,0,0,0.1);"></div>
                        </div>

                        <!-- Custom Mapped Commands -->
                        <div class="mod-field-group" style="margin-top:20px; margin-bottom:20px;">
                            <label class="mod-field-label"><i class="fas fa-terminal"></i> Custom Group Commands &amp; Mappings</label>
                            <p class="mod-field-desc">Create custom commands (e.g. <code>!wifi</code>, <code>!faq</code>) with three handler types:
                              <strong>Auto Reply</strong> — bot sends an instant text response;
                              <strong>HA / Webhook</strong> — forwarded to Home Assistant or Webhook (no auto-reply, still appears in <code>!help</code>);
                              <strong>Alias</strong> — executes another existing command.
                            </p>
                            <div id="mod-custom-cmds-list" style="margin-bottom:12px;"></div>
                            <div class="mod-add-row" style="display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap; padding:12px; background:var(--card-bg); border:1px solid var(--border-color); border-radius:8px;">
                                <div style="display:flex; flex-direction:column; gap:4px;">
                                    <label style="font-size:11px; color:var(--text-muted);">Command name</label>
                                    <input type="text" id="mod-cmd-name" class="mod-input" style="max-width:140px;" placeholder="e.g. wifi" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomCommandRule();}">
                                </div>
                                <div style="display:flex; flex-direction:column; gap:4px;">
                                    <label style="font-size:11px; color:var(--text-muted);">Handler type</label>
                                    <select id="mod-cmd-type" class="mod-select mod-select-sm" onchange="onCustomCmdTypeChange()" style="min-width:150px;">
                                        <option value="auto_reply">🤖 A: Auto Reply</option>
                                        <option value="webhook">🏠 B: HA / Webhook</option>
                                        <option value="alias">🔗 C: Alias of Command</option>
                                    </select>
                                </div>
                                <div id="mod-cmd-response-wrap" style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:180px;">
                                    <label style="font-size:11px; color:var(--text-muted);">Response text</label>
                                    <input type="text" id="mod-cmd-response" class="mod-input mod-input-flex" placeholder="e.g. SSID: GuestWifi | Pass: 12345" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomCommandRule();}">
                                </div>
                                <div id="mod-cmd-alias-wrap" style="display:none; flex-direction:column; gap:4px; min-width:160px;">
                                    <label style="font-size:11px; color:var(--text-muted);">Target command</label>
                                    <select id="mod-cmd-alias-target" class="mod-select mod-select-sm">
                                        <option value="">— select target —</option>
                                    </select>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:4px; min-width:160px;">
                                    <label style="font-size:11px; color:var(--text-muted);">Help description (optional)</label>
                                    <input type="text" id="mod-cmd-description" class="mod-input" style="min-width:160px;" placeholder="Shown in !help" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomCommandRule();}">
                                </div>
                                <div style="display:flex; flex-direction:column; gap:4px; justify-content:flex-end;">
                                    <label style="font-size:11px; color:transparent;">.</label>
                                    <label style="display:inline-flex; align-items:center; gap:4px; font-size:12px; white-space:nowrap; cursor:pointer; padding:6px 8px; background:var(--bg); border:1px solid var(--border-color); border-radius:6px;">
                                        <input type="checkbox" id="mod-cmd-admin-only"> Admin Only
                                    </label>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:4px; justify-content:flex-end;">
                                    <label style="font-size:11px; color:transparent;">.</label>
                                    <button class="btn btn-secondary btn-sm" onclick="addCustomCommandRule()"><i class="fas fa-plus"></i> Add</button>
                                </div>
                            </div>
                        </div>

                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupCommands()"><i class="fas fa-save"></i> Save Commands Config</button></div>
                    </div>

                    <!-- IMPORT / EXPORT -->
                    <div id="mod-subpanel-migration" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap" style="background:rgba(100,100,120,0.15);color:var(--text-muted);"><i class="fas fa-file-export"></i></div>
                            <div><div class="mod-feature-title">Import / Export Config</div><div class="mod-feature-desc">Back up or restore this group's full moderation settings as JSON.</div></div>
                        </div>
                        <div class="mod-actions mod-actions-split" style="margin-bottom:20px;"><button class="btn btn-secondary btn-sm" onclick="exportGroupModerationConfig()"><i class="fas fa-download"></i> Export Group Config (JSON)</button></div>
                        <div class="mod-divider"></div>
                        <div class="mod-field-group"><label class="mod-field-label">Import JSON Configuration</label><textarea id="mod-import-text" class="mod-textarea" style="height:100px;" placeholder="Paste moderation JSON configuration here…"></textarea></div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="importGroupModerationConfig()"><i class="fas fa-upload"></i> Import Config</button></div>
                    </div>
                </div>


                <!-- Global Default Rules Modal -->
                <div id="global-rules-modal" class="modal-overlay" style="display:none;">
                    <div class="modal-card">
                        <div class="modal-header">
                            <h3><i class="fas fa-globe" style="color:var(--primary);"></i> Global Default Rules &amp; Settings</h3>
                            <button class="modal-close-btn" onclick="closeGlobalRulesModal()"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="modal-body">
                            <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px; line-height:1.5;">
                                Configure fallback rules for all WhatsApp groups. Groups without custom rules will inherit these global defaults.
                            </p>
                            <div class="mod-field-group">
                                <label class="mod-field-label">Global Default Rules</label>
                                <textarea id="mod-global-rules-input" class="mod-textarea" style="height:120px;" placeholder="1. Be respectful to all members.&#10;2. No spam or unauthorized links.&#10;3. Follow group topic."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary btn-sm" onclick="closeGlobalRulesModal()">Cancel</button>
                            <button class="btn btn-primary btn-sm" onclick="saveGlobalRulesFromModal()"><i class="fas fa-save"></i> Save Global Settings</button>
                        </div>
                    </div>
                </div>

                <!-- Create Custom Federation Modal -->
                <div id="create-federation-modal" class="modal-overlay">
                    <div class="modal-card">
                        <div class="modal-header">
                            <h3><i class="fas fa-network-wired" style="color:var(--primary);"></i> Create Custom Federation</h3>
                            <button class="modal-close-btn" onclick="closeCreateFederationModal()"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="modal-body">
                            <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px; line-height:1.5;">
                                Create a custom local security federation. Cross-group rules and shared blacklist patterns will apply to all groups connected to this federation.
                            </p>
                            <div class="mod-field-group" style="margin-bottom:12px;">
                                <label class="mod-field-label">Federation Name</label>
                                <input type="text" id="mod-new-fed-name" class="mod-input" placeholder="e.g. Local Security Shield">
                            </div>
                            <div class="mod-field-group">
                                <label class="mod-field-label">Description</label>
                                <input type="text" id="mod-new-fed-desc" class="mod-input" placeholder="e.g. Custom local security federation for internal groups">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary btn-sm" onclick="closeCreateFederationModal()">Cancel</button>
                            <button class="btn btn-primary btn-sm" onclick="saveNewCustomFederation()"><i class="fas fa-plus"></i> Create Federation</button>
                        </div>
                    </div>
                </div>

                <!-- Import Custom Federation Modal -->
                <div id="import-federation-modal" class="modal-overlay">
                    <div class="modal-card modal-lg">
                        <div class="modal-header">
                            <h3><i class="fas fa-file-import" style="color:var(--primary);"></i> Import Security Federation</h3>
                            <button class="modal-close-btn" onclick="closeImportFederationModal()"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="modal-body">
                            <p style="font-size:12px; color:var(--text-muted); margin-bottom:20px; line-height:1.5;">
                                Import a federation configuration by entering a remote JSON URL or by uploading a local <code style="background:var(--bg-input); padding:1px 5px; border-radius:4px; font-size:11px;">.json</code> file.
                            </p>

                            <div class="mod-field-group" style="margin-bottom:4px;">
                                <label class="mod-field-label"><i class="fas fa-link"></i> Option A: Import from URL</label>
                                <input type="text" id="mod-import-fed-url" class="mod-input" placeholder="https://example.com/federation_config.json">
                            </div>

                            <div style="display:flex; align-items:center; gap:12px; margin:16px 0;">
                                <div style="flex:1; height:1px; background:var(--border-color);"></div>
                                <span style="font-size:11px; font-weight:600; color:var(--text-muted); letter-spacing:.5px;">OR</span>
                                <div style="flex:1; height:1px; background:var(--border-color);"></div>
                            </div>

                            <div class="mod-field-group">
                                <label class="mod-field-label"><i class="fas fa-file-upload"></i> Option B: Upload JSON File</label>
                                <label class="mod-file-upload-label" for="mod-import-fed-file">
                                    <i class="fas fa-cloud-upload-alt"></i>
                                    <span id="mod-import-fed-filename">Click to choose a .json file&hellip;</span>
                                    <input type="file" id="mod-import-fed-file" accept=".json" style="display:none;" onchange="document.getElementById('mod-import-fed-filename').textContent = this.files[0]?.name || 'Click to choose a .json file\u2026'">
                                </label>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary btn-sm" onclick="closeImportFederationModal()"><i class="fas fa-times"></i> Cancel</button>
                            <button class="btn btn-primary btn-sm" onclick="submitImportFederation()"><i class="fas fa-upload"></i> Import Federation</button>
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
                                Test Suite &amp; Commands Generator 🧪
                            </h3>
                            <button class="modal-close-btn" onclick="closeTestCommandsModal()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="modal-body" style="padding:20px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                            <!-- Autonomous Auto-Test Card -->
                            <div class="card" style="background:var(--bg-app); border:1px solid var(--border-color); padding:16px; border-radius:8px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <span style="font-weight:600; font-size:14px; color:var(--text-main);"><i class="fas fa-robot" style="color:var(--primary);"></i> Autonomous Auto-Test Engine</span>
                                        <label class="mod-toggle-switch mod-toggle-sm">
                                            <input type="checkbox" id="mod-autotest-toggle" checked onchange="toggleAutoTestModeUI(this.checked)">
                                            <span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span>
                                        </label>
                                    </div>
                                </div>

                                <div id="mod-autotest-options" style="display:flex; flex-direction:column; gap:12px; width:100%; border-top:1px solid var(--border-color); padding-top:12px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                                        <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
                                            <label style="display:flex; align-items:center; gap:6px; font-size:12px; cursor:pointer; font-weight:600;">
                                                <input type="checkbox" id="mod-autotest-safe-only" checked>
                                                <span><i class="fas fa-shield-alt" style="color:var(--success);"></i> Safe-Only Commands</span>
                                            </label>
                                            <div style="display:flex; align-items:center; gap:6px; font-size:12px;">
                                                <span style="font-weight:600;">Delay:</span>
                                                <input type="number" id="mod-autotest-delay" class="mod-number-input" value="500" min="50" max="10000" style="width:70px; height:32px; font-weight:600;">
                                                <span>ms</span>
                                            </div>
                                        </div>
                                        <button id="btn-run-autotest" class="btn btn-primary btn-sm" style="font-weight:700; padding:8px 18px; display:inline-flex; align-items:center; justify-content:center; gap:8px; white-space:nowrap; flex-shrink:0;" onclick="runAutonomousModerationTest()"><i class="fas fa-play"></i> Start Auto-Test</button>
                                    </div>
                                    
                                    <!-- Subtest Selection Matrix -->
                                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:6px; padding:12px;">
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                            <label class="mod-field-label" style="margin:0; font-size:11px; font-weight:700;"><i class="fas fa-list-check"></i> Select Moderation Features to Test</label>
                                            <div style="display:flex; gap:6px;">
                                                <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:10px;" onclick="selectAllModSubtests(true)">Select All</button>
                                                <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:10px;" onclick="selectAllModSubtests(false)">Select None</button>
                                            </div>
                                        </div>
                                        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:6px; font-size:11px;">
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="diagnostics" checked> <span>🛠️ Diagnostic Commands</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="addressing" checked> <span>👤 User Addressing</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="custom_cmds" checked> <span>🤖 Custom Commands</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="locks" checked> <span>🔒 Content Locks</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="blacklist" checked> <span>🚫 Word Blacklist</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="spam_links" checked> <span>🔗 Platform Spam Links</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="warnings" checked> <span>⚠️ Warnings &amp; Decay</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="captcha" checked> <span>👤 Welcome &amp; Captcha</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="antiraid" checked> <span>⚡ Anti-Raid &amp; Flood</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="federation" checked> <span>🌐 Global Federation</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="ai" checked> <span>🧠 Gemini AI Assistant</span></label>
                                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="mod-subtest-cb" value="bot_antispam" checked> <span>🛡️ Bot Outbound Rate Limit</span></label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Live Log Streaming Container -->
                            <div id="mod-autotest-log-stream" style="display:block; padding:12px; background:#111827; border:1px solid #374151; border-radius:8px; font-family:Consolas, Monaco, monospace; font-size:11px; color:#38bdf8; max-height:240px; overflow-y:auto; white-space:pre-wrap; line-height:1.5;">
                                <div style="display:flex; justify-content:space-between; align-items:center; color:#9ca3af; border-bottom:1px solid #374151; padding-bottom:6px; margin-bottom:8px; font-weight:600;">
                                    <span><i class="fas fa-terminal"></i> Live Moderation Auto-Test Stream</span>
                                    <div style="display:flex; gap:6px;">
                                        <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:10px;" onclick="copyAutoTestLogs()"><i class="fas fa-copy"></i> Copy All</button>
                                        <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:10px;" onclick="clearAutoTestLogs()"><i class="fas fa-eraser"></i> Clear</button>
                                        <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:10px;" onclick="exportAutoTestLogs()"><i class="fas fa-download"></i> Export Log</button>
                                    </div>
                                </div>
                                <div id="mod-autotest-progress-bar-container" style="display:none; height:4px; background:#374151; border-radius:2px; margin-bottom:8px; overflow:hidden;">
                                    <div id="mod-autotest-progress-bar" style="height:100%; width:0%; background:#38bdf8; transition:width 0.2s;"></div>
                                </div>
                                <div id="mod-autotest-log-content" style="color:#38bdf8;">Console Ready. Select features above and click "Start Auto-Test" to stream real-time logs.</div>
                            </div>

                            <p style="font-size:13px; color:var(--text-muted); margin:4px 0;">
                                Ready-to-use test commands and sample payload triggers customized specifically for the selected group. Copy and paste them into WhatsApp to test all features:
                            </p>
                            <div id="test-commands-modal-content"></div>
                        </div>
                        <div class="modal-footer" style="padding:12px 20px; border-top:1px solid var(--border-color); display:flex; justify-content:flex-end; flex-shrink:0;">
                            <button class="btn btn-secondary btn-sm" onclick="closeTestCommandsModal()">Close</button>
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
                                Unsaved Changes
                            </h3>
                            <button class="modal-close-btn" onclick="unsavedModalCancel()"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="modal-body">
                            <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin-bottom:6px;">
                                You have unsaved changes in <strong id="unsaved-panel-name" style="color:var(--primary);"></strong>.
                            </p>
                            <p style="font-size:13px; color:var(--text-muted); line-height:1.6;">
                                Would you like to save them before switching?
                            </p>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary btn-sm" onclick="unsavedModalCancel()"><i class="fas fa-arrow-left"></i> Stay</button>
                            <button class="btn btn-ghost btn-sm" onclick="unsavedModalDiscard()" style="color:var(--danger);"><i class="fas fa-trash-alt"></i> Discard</button>
                            <button class="btn btn-primary btn-sm" onclick="unsavedModalSaveAndSwitch()"><i class="fas fa-save"></i> Save &amp; Switch</button>
                        </div>
                    </div>
                </div>

            </section>
`;
