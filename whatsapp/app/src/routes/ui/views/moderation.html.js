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
                            <span class="mod-toggle-label"><i class="fas fa-power-off"></i> Global</span>
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
                <div id="mod-no-group-placeholder" class="card mod-settings-card" style="margin-top: 16px;">
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
                        <button class="btn btn-primary btn-sm" onclick="saveGlobalRulesInline()"><i class="fas fa-save"></i> Save Global Default Rules</button>
                    </div>
                </div>

                <!-- Group Settings Card (Hidden until group selected) -->
                <div id="mod-group-content" class="card mod-settings-card" style="display:none;">
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
                            <button class="mod-pill" data-subtab="greetings" onclick="switchModSubTab('greetings')"><i class="fas fa-user-plus"></i> Greetings</button>
                            <button class="mod-pill" data-subtab="warnings" onclick="switchModSubTab('warnings')"><i class="fas fa-exclamation-triangle"></i> Warnings</button>
                            <button class="mod-pill" data-subtab="locks" onclick="switchModSubTab('locks')"><i class="fas fa-lock"></i> Locks</button>
                            <button class="mod-pill" data-subtab="blacklist" onclick="switchModSubTab('blacklist')"><i class="fas fa-ban"></i> Blacklist</button>
                            <button class="mod-pill" data-subtab="filters" onclick="switchModSubTab('filters')"><i class="fas fa-robot"></i> Filters</button>
                            <button class="mod-pill" data-subtab="antispam" onclick="switchModSubTab('antispam')"><i class="fas fa-bolt"></i> Anti-Spam</button>
                            <button class="mod-pill" data-subtab="federation" onclick="switchModSubTab('federation')"><i class="fas fa-network-wired"></i> Federation</button>
                            <button class="mod-pill" data-subtab="commands" onclick="switchModSubTab('commands')"><i class="fas fa-terminal"></i> Commands</button>
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
                            <div class="mod-feature-icon-wrap mod-color-info"><i class="fas fa-user-plus"></i></div>
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
                            <div class="mod-feature-icon-wrap mod-color-warning"><i class="fas fa-user-shield"></i></div>
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
                            <div><div class="mod-feature-title">Word &amp; Pattern Blacklist</div><div class="mod-feature-desc">Auto-delete messages containing blocked words or regex patterns.</div></div>
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
                            <div><div class="mod-feature-title">Auto-Responder Filters</div><div class="mod-feature-desc">Trigger automatic replies on specific keywords.</div></div>
                        </div>
                        <div class="mod-two-col mod-two-col-tight">
                            <input type="text" id="mod-filter-trigger" class="mod-input" placeholder="Trigger (e.g. !help)" onkeydown="if(event.key==='Enter'){event.preventDefault();addFilterRule();}">
                            <input type="text" id="mod-filter-response" class="mod-input" placeholder="Response text" onkeydown="if(event.key==='Enter'){event.preventDefault();addFilterRule();}">
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
                            <div><div class="mod-feature-title">Global Security Federation</div><div class="mod-feature-desc">Cross-group security shield for automatic spam prevention, botnet bans, and prohibited link filtering.</div></div>
                        </div>
                        <div class="mod-field-group" style="max-width:450px; margin-bottom:16px;">
                            <label class="mod-field-label">Active Federation Network</label>
                            <select id="mod-fed-select" class="mod-select"><option value="">No Federation Joined</option><option value="fed_global_default" selected>Global Default Security Federation</option></select>
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
                            <label class="mod-field-label"><i class="fas fa-ban"></i> Shared Federation Blacklist (Predefined Patterns)</label>
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
                        <div class="mod-field-group" style="margin-bottom:16px;"><label class="mod-field-label">AI System Persona Prompt</label><textarea id="mod-ai-prompt" class="mod-textarea" style="height:80px;" placeholder="You are a helpful group moderator AI assistant."></textarea></div>
                        
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
                            <div><div class="mod-feature-title">Bot Commands (Rose/AegisBot)</div><div class="mod-feature-desc">Allow members and admins to interact with the bot via group commands.</div></div>
                        </div>
                        <div class="mod-option-row" style="margin-bottom:10px;">
                            <label class="mod-toggle-switch mod-toggle-sm"><input type="checkbox" id="mod-cmds-enabled"><span class="mod-toggle-track"><span class="mod-toggle-thumb"></span></span></label>
                            <span class="mod-option-label">Enable group commands (!help, !warn, !ban, etc.)</span>
                        </div>
                        <div class="mod-field-group" style="max-width:200px;">
                            <label class="mod-field-label">Command Prefix</label>
                            <input type="text" id="mod-cmds-prefix" class="mod-input" value="!" maxlength="3">
                        </div>
                        <div class="mod-field-group" style="max-width:300px;">
                            <label class="mod-field-label">Mute Action (WhatsApp API Limit)</label>
                            <select id="mod-cmds-mute-action" class="mod-select mod-select-sm">
                                <option value="delete">Delete user's messages</option>
                            </select>
                            <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">WhatsApp does not support user-specific mutes. This defines how mutes are enforced.</p>
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

                </div>

                <!-- Global Rules Modal -->
                <div id="global-rules-modal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:9999; align-items:center; justify-content:center;">
                    <div class="modal-content card" style="max-width:550px; width:90%; padding:24px;">
                        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                            <h3 class="modal-title" style="margin:0; font-size:16px; font-weight:600;"><i class="fas fa-globe" style="color:var(--primary);"></i> Global Default Rules &amp; Settings</h3>
                            <button class="modal-close btn btn-sm btn-secondary" onclick="closeGlobalRulesModal()" style="padding:2px 8px;">&times;</button>
                        </div>
                        <div class="modal-body">
                            <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px; line-height:1.4;">
                                Configure fallback rules for all WhatsApp groups. Groups that do not have custom rules set will automatically inherit these global default rules.
                            </p>
                            <div class="mod-field-group" style="margin-bottom:16px;">
                                <label class="mod-field-label">Global Default Rules</label>
                                <textarea id="mod-global-rules-input" class="mod-textarea" style="height:120px;" placeholder="1. Be respectful to all members.&#10;2. No spam or unauthorized links.&#10;3. Follow group topic."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:8px;">
                            <button class="btn btn-secondary btn-sm" onclick="closeGlobalRulesModal()">Cancel</button>
                            <button class="btn btn-primary btn-sm" onclick="saveGlobalRulesFromModal()"><i class="fas fa-save"></i> Save Global Settings</button>
                        </div>
                    </div>
                </div>

            </section>
`;
