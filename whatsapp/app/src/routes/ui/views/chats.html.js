module.exports = () => `
<section id="tab-chats" class="tab-panel">
                <div class="chat-container-layout">
                    <div class="chat-list-panel">
                        <div class="chat-list-header" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border-color);">
                            <div class="search-box-wrapper" style="flex:1;">
                                <i class="fas fa-search search-icon"></i>
                                <input type="text" id="chat-search" class="chat-search-input" placeholder="Search chats..." oninput="filterChatList()">
                            </div>
                            <button class="btn btn-primary btn-sm" style="border-radius:50%;width:36px;height:36px;padding:0;flex-shrink:0;display:flex;align-items:center;justify-content:center;" title="Start New Chat" onclick="openNewChatModal()">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <div class="chat-list-items" id="chat-list-items">
                            <div class="empty-state">No conversations active yet</div>
                        </div>
                    </div>

                    <div class="chat-thread-panel" id="chat-thread-panel">
                        <div class="chat-thread-empty" id="chat-thread-empty">
                            <div class="chat-thread-empty-icon"><i class="fab fa-whatsapp"></i></div>
                            <h3>Select a chat to view messages</h3>
                            <p>Select a contact or group from the left sidebar to start chatting.</p>
                        </div>

                        <div class="chat-thread-active" id="chat-thread-active" style="display: none;">
                            <div class="chat-thread-header" style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;min-height:62px;width:100%;border-bottom:1px solid var(--border-color);background-color:var(--bg-card);gap:16px;">
                                <div class="chat-thread-info" onclick="openChatInfoDrawer()" style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;cursor:pointer;" title="Click to view Contact / Group Details">
                                    <button class="chat-back-btn" onclick="event.stopPropagation();goBackToChatList(event)"><i class="fas fa-arrow-left"></i></button>
                                    <div class="chat-thread-avatar" id="active-chat-avatar" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;"></div>
                                    <div style="flex:1;min-width:0;">
                                        <h4 id="active-chat-name" style="margin:0;font-size:16px;font-weight:700;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Contact JID</h4>
                                        <p id="active-chat-jid" style="margin:2px 0 0;font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                            <span id="typing-indicator" style="display:none;color:var(--primary);font-style:italic;">typing…</span>
                                            <span id="active-chat-jid-text">JID details</span>
                                        </p>
                                    </div>
                                </div>
                                <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                                    <button class="btn btn-ghost chat-header-btn" id="chat-search-toggle" title="Search in chat" onclick="toggleChatSearch()"><i class="fas fa-search"></i></button>
                                    <button class="btn btn-ghost chat-header-btn" title="Contact / Group Info" onclick="openChatInfoDrawer()"><i class="fas fa-info-circle"></i></button>
                                </div>
                            </div>

                            <div id="chat-search-bar" style="display:none;padding:8px 16px;background:var(--bg-card);border-bottom:1px solid var(--border-color);">
                                <div class="search-box-wrapper" style="width:100%;">
                                    <i class="fas fa-search search-icon"></i>
                                    <input type="text" id="in-chat-search-input" class="chat-search-input" placeholder="Search in this conversation…" oninput="searchInActiveChat()">
                                    <button onclick="closeChatSearch()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;"><i class="fas fa-times"></i></button>
                                    <span id="chat-search-count" style="font-size:12px;color:var(--text-muted);margin-left:4px;white-space:nowrap;"></span>
                                </div>
                            </div>

                            <div class="chat-thread-messages" id="chat-thread-messages"></div>

                            <div id="reply-preview-bar" style="display:none;padding:8px 16px;background:var(--bg-card);border-top:1px solid var(--border-color);">
                                <div style="display:flex;align-items:center;gap:10px;background:var(--bg-input);border-left:3px solid var(--primary);border-radius:6px;padding:8px 12px;">
                                    <div style="flex:1;min-width:0;">
                                        <div style="font-size:11px;font-weight:700;color:var(--primary);margin-bottom:2px;" id="reply-sender-name"></div>
                                        <div style="font-size:13px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" id="reply-preview-text"></div>
                                    </div>
                                    <button onclick="cancelReply()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">&times;</button>
                                </div>
                            </div>

                            <div class="chat-thread-footer">
                                <div id="emoji-picker" class="emoji-picker" style="display:none;"></div>
                                <form id="chat-message-form" class="chat-message-form" onsubmit="sendChatMessage(event)">
                                    <button type="button" class="chat-icon-btn" title="Emoji" onclick="toggleEmojiPicker(event)"><i class="far fa-smile"></i></button>
                                    <label class="chat-icon-btn" title="Attach file">
                                        <i class="fas fa-paperclip"></i>
                                        <input type="file" id="chat-file-input" style="display:none;" onchange="sendFileMessage(this)">
                                    </label>
                                    <input type="text" id="chat-message-input" class="chat-message-input" placeholder="Type a message…" autocomplete="off">
                                    <button type="submit" class="chat-send-btn" title="Send"><i class="fas fa-paper-plane"></i></button>
                                </form>
                            </div>
                        </div>

                        <!-- Right Sidebar: Contact & Group Info Drawer -->
                        <div class="chat-info-drawer" id="chat-info-drawer" style="display:none;">
                            <div class="drawer-header">
                                <h4>Contact Info</h4>
                                <button class="btn btn-ghost btn-sm" onclick="closeChatInfoDrawer()"><i class="fas fa-times"></i></button>
                            </div>
                            <div class="drawer-body" id="drawer-body-content">
                                <div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading info…</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
`;
