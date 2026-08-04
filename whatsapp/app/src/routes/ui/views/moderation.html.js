export default () => `
<section id="tab-moderation" class="tab-panel">

                <!-- Hero Header -->
                <div class="mod-hero">
                    <div class="mod-hero-left">
                        <div class="mod-hero-icon"><i class="fas fa-shield-alt"></i></div>
                        <div>
                            <h2 class="mod-hero-title">Group Moderation Engine</h2>
                            <p class="mod-hero-sub">Group defender &middot; Rules enforcement &middot; Anti-raid shield &middot; Automated moderation</p>
                        </div>
                    </div>
                    <div class="mod-hero-controls">
                        <div class="mod-toggle-row">
                            <span class="mod-toggle-label"><i class="fas fa-globe"></i> Global</span>
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

                <!-- Group Settings Card -->
                <div id="mod-group-content" class="card mod-settings-card">
                    <!-- Card Header -->
                    <div class="mod-card-header">
                        <div class="mod-card-title-row">
                            <h3 id="mod-active-group-title" class="mod-card-title"><i class="fas fa-users-cog"></i> Group Settings</h3>
                            <div class="mod-toggle-row">
                                <span class="mod-toggle-label">Enable for this group</span>
                                <label class="mod-toggle-switch">
                                    <input type="checkbox" id="mod-group-toggle" onchange="toggleGroupModeration(this.checked)">
                                    <span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span>
                                </label>
                            </div>
                        </div>
                        <!-- Subtab Pills -->
                        <div class="mod-subtab-bar">
                            <button class="mod-pill active" data-subtab="rules" onclick="switchModSubTab('rules')"><i class="fas fa-scroll"></i> Rules</button>
                            <button class="mod-pill" data-subtab="greetings" onclick="switchModSubTab('greetings')"><i class="fas fa-hand-wave"></i> Greetings</button>
                            <button class="mod-pill" data-subtab="warnings" onclick="switchModSubTab('warnings')"><i class="fas fa-exclamation-triangle"></i> Warnings</button>
                            <button class="mod-pill" data-subtab="locks" onclick="switchModSubTab('locks')"><i class="fas fa-lock"></i> Locks</button>
                            <button class="mod-pill" data-subtab="blacklist" onclick="switchModSubTab('blacklist')"><i class="fas fa-ban"></i> Blacklist</button>
                            <button class="mod-pill" data-subtab="filters" onclick="switchModSubTab('filters')"><i class="fas fa-robot"></i> Filters</button>
                            <button class="mod-pill" data-subtab="antispam" onclick="switchModSubTab('antispam')"><i class="fas fa-bolt"></i> Anti-Spam</button>
                            <button class="mod-pill" data-subtab="federation" onclick="switchModSubTab('federation')"><i class="fas fa-network-wired"></i> Federation</button>
                            <button class="mod-pill" data-subtab="ai" onclick="switchModSubTab('ai')"><i class="fas fa-brain"></i> Gemini AI</button>
                            <button class="mod-pill" data-subtab="migration" onclick="switchModSubTab('migration')"><i class="fas fa-file-export"></i> Import/Export</button>
                        </div>
                    </div>

                    <!-- RULES -->
                    <div id="mod-subpanel-rules" class="mod-subpanel">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-primary"><i class="fas fa-scroll"></i></div>
                            <div><div class="mod-feature-title">Group Rules</div><div class="mod-feature-desc">Define and auto-post rules when new members join.</div></div>
                        </div>
                        <textarea id="mod-rules-text" class="mod-textarea" placeholder="1. Be respectful&#10;2. No spam&#10;3. No NSFW content"></textarea>
                        <div class="mod-option-row">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-rules-show-on-join"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label">Auto-post rules when a new member joins</span>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupRules()"><i class="fas fa-save"></i> Save Rules</button></div>
                    </div>

                    <!-- GREETINGS -->
                    <div id="mod-subpanel-greetings" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-info"><i class="fas fa-hand-wave"></i></div>
                            <div><div class="mod-feature-title">Greetings &amp; Captcha</div><div class="mod-feature-desc">Welcome and farewell messages plus join verification.</div></div>
                        </div>
                        <div class="mod-two-col">
                            <div class="mod-feature-block">
                                <div class="mod-block-label"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-welcome-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span>Welcome Message</span></div>
                                <input type="text" id="mod-welcome-msg" class="mod-input" placeholder="Welcome {user} to {group}!">
                            </div>
                            <div class="mod-feature-block">
                                <div class="mod-block-label"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-goodbye-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span>Goodbye Message</span></div>
                                <input type="text" id="mod-goodbye-msg" class="mod-input" placeholder="Goodbye {user}!">
                            </div>
                        </div>
                        <div class="mod-divider"></div>
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-warning"><i class="fas fa-shield-check"></i></div>
                            <div><div class="mod-feature-title">Join Captcha Verification</div><div class="mod-feature-desc">Challenge new members before they can post.</div></div>
                        </div>
                        <div class="mod-inline-controls">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-captcha-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label">Require captcha on join</span>
                            <select id="mod-captcha-mode" class="mod-select mod-select-sm"><option value="button">Button challenge</option><option value="math">Math problem</option></select>
                            <div class="mod-number-group"><input type="number" id="mod-captcha-timeout" class="mod-number-input" value="120" min="30" max="600"><span class="mod-number-unit">s timeout</span></div>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupGreetings()"><i class="fas fa-save"></i> Save Greetings &amp; Captcha</button></div>
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
                        <div id="mod-warns-list" class="mod-list-container"><div class="empty-state">No active user warnings</div></div>
                    </div>

                    <!-- LOCKS -->
                    <div id="mod-subpanel-locks" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-lock"></i></div>
                            <div><div class="mod-feature-title">Content Locks</div><div class="mod-feature-desc">Prevent specific content types from being posted.</div></div>
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
                            <label class="mod-lock-card"><div class="mod-lock-icon"><i class="fas fa-language"></i></div><span>RTL Text</span><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-lock-rtl"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label></label>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupLocks()"><i class="fas fa-save"></i> Save Locks</button></div>
                    </div>

                    <!-- BLACKLIST -->
                    <div id="mod-subpanel-blacklist" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-ban"></i></div>
                            <div><div class="mod-feature-title">Word &amp; Pattern Blacklist</div><div class="mod-feature-desc">Auto-delete messages containing blocked words or regex patterns.</div></div>
                        </div>
                        <div class="mod-add-row">
                            <input type="text" id="mod-blacklist-new" class="mod-input mod-input-flex" placeholder="Add word or /regex/ pattern…">
                            <button class="btn btn-secondary btn-sm" onclick="addBlacklistWord()"><i class="fas fa-plus"></i> Add</button>
                        </div>
                        <div id="mod-blacklist-tags" class="mod-tag-cloud"></div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupBlacklist()"><i class="fas fa-save"></i> Save Blacklist</button></div>
                    </div>

                    <!-- FILTERS -->
                    <div id="mod-subpanel-filters" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-info"><i class="fas fa-robot"></i></div>
                            <div><div class="mod-feature-title">Auto-Responder Filters</div><div class="mod-feature-desc">Trigger automatic replies on specific keywords.</div></div>
                        </div>
                        <div class="mod-two-col mod-two-col-tight">
                            <input type="text" id="mod-filter-trigger" class="mod-input" placeholder="Trigger (e.g. !help)">
                            <input type="text" id="mod-filter-response" class="mod-input" placeholder="Response text">
                        </div>
                        <div class="mod-actions mod-actions-split">
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
                                    <div><div class="mod-feature-title">Flood Protection</div><div class="mod-feature-desc">Mute users sending too many messages too fast.</div></div>
                                </div>
                                <div class="mod-option-row"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-flood-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Enable flood protection</span></div>
                                <div class="mod-rate-row"><span class="mod-rate-label">Max</span><input type="number" id="mod-flood-max" class="mod-number-input" value="5" min="1" max="100"><span class="mod-rate-label">messages in</span><input type="number" id="mod-flood-win" class="mod-number-input" value="5" min="1" max="300"><span class="mod-rate-label">seconds</span></div>
                            </div>
                            <div class="mod-feature-block mod-feature-block-full">
                                <div class="mod-feature-header">
                                    <div class="mod-feature-icon-wrap mod-color-danger"><i class="fas fa-shield-alt"></i></div>
                                    <div><div class="mod-feature-title">Anti-Raid Shield</div><div class="mod-feature-desc">Lock group when too many users join in short time.</div></div>
                                </div>
                                <div class="mod-option-row"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-antiraid-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Enable anti-raid shield</span></div>
                                <div class="mod-rate-row"><span class="mod-rate-label">Max</span><input type="number" id="mod-antiraid-max" class="mod-number-input" value="5" min="1" max="100"><span class="mod-rate-label">joins in</span><input type="number" id="mod-antiraid-win" class="mod-number-input" value="10" min="1" max="300"><span class="mod-rate-label">seconds</span></div>
                            </div>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupAntispam()"><i class="fas fa-save"></i> Save Anti-Spam Config</button></div>
                    </div>

                    <!-- FEDERATION -->
                    <div id="mod-subpanel-federation" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap mod-color-info"><i class="fas fa-network-wired"></i></div>
                            <div><div class="mod-feature-title">Ban Federation</div><div class="mod-feature-desc">Sync global ban lists across a cluster of groups.</div></div>
                        </div>
                        <div class="mod-field-group" style="max-width:400px;">
                            <label class="mod-field-label">Active Federation</label>
                            <select id="mod-fed-select" class="mod-select"><option value="">No Federation Joined</option><option value="fed_global_default">Global Default Federation</option></select>
                        </div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupFederation()"><i class="fas fa-save"></i> Save Federation Link</button></div>
                    </div>

                    <!-- GEMINI AI -->
                    <div id="mod-subpanel-ai" class="mod-subpanel" style="display:none;">
                        <div class="mod-feature-header">
                            <div class="mod-feature-icon-wrap" style="background:linear-gradient(135deg,rgba(0,168,132,0.2),rgba(52,152,219,0.2));color:var(--primary);"><i class="fas fa-brain"></i></div>
                            <div><div class="mod-feature-title">Gemini AI Assistant</div><div class="mod-feature-desc">Let AI help moderate the group and answer member questions.</div></div>
                        </div>
                        <div class="mod-option-row" style="margin-bottom:10px;"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-ai-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Enable Gemini AI assistance</span></div>
                        <div class="mod-option-row" style="margin-bottom:16px;"><label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-ai-faq"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label><span class="mod-option-label">Auto-reply to group FAQs</span></div>
                        <div class="mod-field-group"><label class="mod-field-label">AI System Prompt</label><textarea id="mod-ai-prompt" class="mod-textarea" style="height:100px;" placeholder="You are a helpful group moderator AI assistant."></textarea></div>
                        <div class="mod-actions"><button class="btn btn-primary btn-sm" onclick="saveGroupAiConfig()"><i class="fas fa-save"></i> Save AI Config</button></div>
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
            </section>
`;
