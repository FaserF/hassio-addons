// Chat client UI logic

let lastLoadedMessagesCache = {};
let lastChatsCache = '';

function openNewChatModal() {
  const modal = document.getElementById('new-chat-modal');
  if (modal) {
    modal.classList.add('show');
    const inp = document.getElementById('new-chat-number');
    if (inp) {
      inp.value = '';
      inp.focus();
    }
  }
}

function closeNewChatModal() {
  const modal = document.getElementById('new-chat-modal');
  if (modal) modal.classList.remove('show');
}

function startNewChatSubmit(e) {
  e.preventDefault();
  const inp = document.getElementById('new-chat-number');
  if (!inp || !inp.value.trim()) return;

  let raw = inp.value.trim();
  let jid = raw;
  if (!jid.includes('@')) {
    const cleanNum = jid.replace(/[^0-9]/g, '');
    if (!cleanNum) {
      showToast('Invalid phone number', 'danger');
      return;
    }
    jid = `${cleanNum}@s.whatsapp.net`;
  }

  closeNewChatModal();
  const displayName = jid.split('@')[0];
  selectChat(jid, displayName);
  showToast(`Chat initialized for ${displayName}`, 'success');
}

async function loadChats() {
  if (!isChatTabActive) return;
  try {
    const response = await fetch(basePath + 'api/chats?session_id=' + currentSession);
    if (!response.ok) return;
    allChats = await response.json();
    const chatsKey = JSON.stringify(allChats);
    if (chatsKey !== lastChatsCache) {
      lastChatsCache = chatsKey;
      renderChatList(allChats);
    }
  } catch (e) {
    console.error('Failed to load chats:', e);
  }
}

function renderChatList(chats) {
  const container = document.getElementById('chat-list-items');
  if (!chats || chats.length === 0) {
    container.innerHTML = '<div class="empty-state">No conversations active yet</div>';
    return;
  }

  const searchVal = document.getElementById('chat-search').value.toLowerCase();
  const filtered = chats.filter(
    (c) => c.name.toLowerCase().includes(searchVal) || c.jid.toLowerCase().includes(searchVal)
  );

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No matching chats found</div>';
    return;
  }

  container.innerHTML = filtered
    .map((c) => {
      const isActive = c.jid === activeChatJid ? 'active' : '';
      const timeStr = c.timestamp
        ? new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      const avatarIcon = c.jid.endsWith('@g.us') ? 'fa-users' : 'fa-user';
      const cachedUrl = avatarCache[c.jid];
      const avatarHtml = cachedUrl
        ? `<img src="${cachedUrl}" class="avatar-img" alt="Avatar">`
        : `<i class="fas ${avatarIcon}"></i>`;

      if (!cachedUrl && avatarCache[c.jid] === undefined) {
        fetchAvatar(c.jid);
      }

      return `
            <div class="chat-item ${isActive}" onclick="selectChat('${c.jid}', '${escapeHtml(c.name)}')">
                <div class="chat-avatar" data-avatar-jid="${c.jid}">
                    ${avatarHtml}
                </div>
                <div class="chat-info">
                    <div class="chat-meta">
                        <span class="chat-name">${escapeHtml(c.name)}</span>
                        <span class="chat-time">${timeStr}</span>
                    </div>
                    <div class="chat-last-msg">${escapeHtml(c.preview || 'No messages')}</div>
                </div>
            </div>
        `;
    })
    .join('');
}

function filterChatList() {
  lastChatsCache = '';
  renderChatList(allChats);
}

function goBackToChatList(event) {
  if (event) event.preventDefault();
  activeChatJid = null;
  document.getElementById('chat-thread-active').style.display = 'none';
  document.getElementById('chat-thread-empty').style.display = 'flex';
  document.body.classList.remove('chat-open');
  loadChats();
}

const avatarCache = {};

async function fetchAvatar(jid) {
  if (avatarCache[jid] !== undefined) return avatarCache[jid];
  try {
    const res = await fetch(
      basePath + 'api/avatar?session_id=' + currentSession + '&jid=' + encodeURIComponent(jid)
    );
    if (res.ok) {
      const data = await res.json();
      avatarCache[jid] = data.url;
      updateAvatarElements(jid, data.url);
      return data.url;
    }
  } catch (e) {}
  avatarCache[jid] = null;
  return null;
}

function updateAvatarElements(jid, url) {
  if (!url) return;
  const safeJid = jid.replace(/"/g, '\\"');
  const els = document.querySelectorAll(`[data-avatar-jid="${safeJid}"]`);
  els.forEach((el) => {
    el.innerHTML = `<img src="${url}" class="avatar-img" alt="Avatar">`;
  });

  if (activeChatJid === jid) {
    const headerAvatar = document.getElementById('active-chat-avatar');
    if (headerAvatar) {
      headerAvatar.innerHTML = `<img src="${url}" class="avatar-img" alt="Avatar">`;
    }
  }
}

function selectChat(jid, name) {
  activeChatJid = jid;
  delete lastLoadedMessagesCache[jid];
  document.body.classList.add('chat-open');
  cancelReply();
  closeAllOverlays();

  document.getElementById('chat-thread-empty').style.display = 'none';
  document.getElementById('chat-thread-active').style.display = 'flex';

  document.getElementById('active-chat-name').textContent = name;
  const jidText = document.getElementById('active-chat-jid-text');
  if (jidText) jidText.textContent = jid;

  const avatar = document.getElementById('active-chat-avatar');
  if (avatar) {
    const cachedUrl = avatarCache[jid];
    if (cachedUrl) {
      avatar.innerHTML = `<img src="${cachedUrl}" class="avatar-img" alt="Avatar">`;
    } else {
      avatar.innerHTML = `<i class="fas ${jid.endsWith('@g.us') ? 'fa-users' : 'fa-user'}"></i>`;
      fetchAvatar(jid);
    }
  }

  document.getElementById('chat-thread-messages').innerHTML =
    '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';

  const items = document.querySelectorAll('.chat-item');
  items.forEach((item) => item.classList.remove('active'));

  fetch(basePath + 'mark_as_read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': apiToken },
    body: JSON.stringify({ number: jid, session_id: currentSession }),
  }).catch(() => {});

  fetch(basePath + 'subscribe_presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': apiToken },
    body: JSON.stringify({ number: jid, session_id: currentSession }),
  }).catch(() => {});

  loadChatMessages(jid);

  if (window._typingPollInterval) clearInterval(window._typingPollInterval);
  window._typingPollInterval = setInterval(async () => {
    if (activeChatJid !== jid) {
      clearInterval(window._typingPollInterval);
      return;
    }
    try {
      const r = await fetch(
        basePath + 'api/presence?session_id=' + currentSession + '&jid=' + encodeURIComponent(jid)
      );
      if (!r.ok) return;
      const p = await r.json();
      const ti = document.getElementById('typing-indicator');
      if (ti) ti.style.display = p.typing ? 'inline' : 'none';
    } catch {}
  }, 3000);
}

let ctxTargetMsg = null;
let replyToMsg = null;

function renderMediaBlock(m) {
  if (!m.mediaUrl) return '';
  const url = m.mediaUrl;
  if (m.mediaType === 'image' || (m.mediaMime && m.mediaMime.startsWith('image/'))) {
    return `<img class="msg-media msg-media-img" src="${url}" alt="${escapeHtml(m.caption || 'Image')}" onclick="window.open('${url}','_blank')" loading="lazy">`;
  }
  if (m.mediaType === 'video' || (m.mediaMime && m.mediaMime.startsWith('video/'))) {
    return `<video class="msg-media msg-media-video" controls><source src="${url}" type="${escapeHtml(m.mediaMime || 'video/mp4')}"></video>`;
  }
  if (m.mediaType === 'audio' || (m.mediaMime && m.mediaMime.startsWith('audio/'))) {
    return `<audio class="msg-media msg-media-audio" controls><source src="${url}" type="${escapeHtml(m.mediaMime || 'audio/ogg')}"></audio>`;
  }
  const icon = m.mediaType === 'sticker' ? 'fa-sticky-note' : 'fa-file-alt';
  const fname = url.split('/').pop();
  return `<a class="msg-media msg-media-doc" href="${url}" target="_blank" download>
                <i class="fas ${icon} msg-media-doc-icon"></i>
                <span class="msg-media-doc-name">${escapeHtml(m.caption || fname)}</span>
                <i class="fas fa-download" style="margin-left:auto;opacity:0.6;"></i>
            </a>`;
}

function renderAck(m) {
  if (!m.fromMe || m.ack == null) return '';
  const levels = {
    0: ['ack-pending', '&#xf00c;'],
    1: ['ack-sent', '&#xf00c;'],
    2: ['ack-delivered', '&#xf560;'],
    3: ['ack-read', '&#xf560;'],
    4: ['ack-played', '&#xf560;'],
  };
  const [cls] = levels[m.ack] || levels[1];
  return `<span class="msg-ack ${cls}"><i class="fas fa-check-double" style="font-size:11px;"></i></span>`;
}

function renderQuote(m) {
  if (!m.quotedId || !m.quotedText) return '';
  return `<div class="msg-quote">
                <div class="msg-quote-sender">${escapeHtml(m.quotedSender ? m.quotedSender.split('@')[0] : '…')}</div>
                <div class="msg-quote-text">${escapeHtml(m.quotedText)}</div>
            </div>`;
}

function renderReactions(m) {
  if (!m.reactions || m.reactions.length === 0) return '';
  const grouped = {};
  for (const r of m.reactions) {
    grouped[r.emoji] = (grouped[r.emoji] || 0) + 1;
  }
  const chips = Object.entries(grouped)
    .map(
      ([emoji, count]) =>
        `<span class="msg-reaction-chip" title="React" onclick="showReactionPicker(event,'${m.id}')">${emoji}${count > 1 ? `<span class="msg-reaction-count">${count}</span>` : ''}</span>`
    )
    .join('');
  return `<div class="msg-reactions">${chips}</div>`;
}

async function loadChatMessages(jid) {
  if (!isChatTabActive || activeChatJid !== jid) return;
  try {
    const response = await fetch(
      basePath + 'api/messages?session_id=' + currentSession + '&jid=' + encodeURIComponent(jid)
    );
    if (!response.ok) return;
    const messages = await response.json();

    const cacheKey = JSON.stringify(messages);
    if (lastLoadedMessagesCache[jid] === cacheKey) {
      // Content has not changed -> Skip DOM update to avoid flicker
      return;
    }
    lastLoadedMessagesCache[jid] = cacheKey;

    const container = document.getElementById('chat-thread-messages');
    const wasScrolledToBottom =
      container.scrollHeight - container.clientHeight <= container.scrollTop + 80;

    if (messages.length === 0) {
      container.innerHTML =
        '<div class="empty-state">No messages in this conversation yet</div>';
      return;
    }

    const isGroup = jid.endsWith('@g.us');

    container.innerHTML = messages
      .map((m) => {
        const direction = m.fromMe ? 'outbound' : 'inbound';
        const timeStr = new Date(m.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const senderLabel =
          !m.fromMe && isGroup && m.senderName
            ? `<div class="msg-sender-name">${escapeHtml(m.senderName)}</div>`
            : '';

        const quoteBlock = renderQuote(m);
        const mediaBlock = renderMediaBlock(m);
        const textBlock =
          m.text && !(m.mediaType && !m.caption)
            ? `<div class="msg-bubble-text">${escapeHtml(m.text)}</div>`
            : '';
        const captionBlock =
          m.caption && m.mediaType
            ? `<div class="msg-bubble-text" style="margin-top:4px;">${escapeHtml(m.caption)}</div>`
            : '';
        const ackBlock = renderAck(m);
        const reactBlock = renderReactions(m);

        return `<div class="msg-bubble-row ${direction}" data-msg-id="${m.id}" data-msg-text="${escapeAttr(m.text || m.caption || '')}" data-sender="${escapeAttr(m.senderName || '')}"
                         oncontextmenu="showContextMenu(event,'${m.id}')" onmouseenter="showReactionBtn(event,'${m.id}')">
                        <div class="msg-bubble">
                            ${senderLabel}
                            ${quoteBlock}
                            ${mediaBlock}
                            ${textBlock}
                            ${captionBlock}
                            <div class="msg-bubble-time">${timeStr}${ackBlock}</div>
                        </div>
                        ${reactBlock}
                    </div>`;
      })
      .join('');

    if (wasScrolledToBottom) {
      container.scrollTop = container.scrollHeight;
    }
  } catch (e) {
    console.error('Failed to load chat messages:', e);
  }
}

function showContextMenu(e, msgId) {
  e.preventDefault();
  closeAllOverlays();
  ctxTargetMsg = document.querySelector(`[data-msg-id="${msgId}"]`);
  const menu = document.getElementById('msg-context-menu');
  menu.style.display = 'block';

  const menuWidth = menu.offsetWidth || 180;
  const menuHeight = menu.offsetHeight || 220;

  let left = e.clientX;
  let top = e.clientY;

  if (left + menuWidth > window.innerWidth - 10) {
    left = Math.max(10, e.clientX - menuWidth);
  }
  if (top + menuHeight > window.innerHeight - 10) {
    top = Math.max(10, e.clientY - menuHeight);
  }

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

function ctxReply() {
  closeAllOverlays();
  if (!ctxTargetMsg) return;
  const text = ctxTargetMsg.dataset.msgText || '';
  const sender = ctxTargetMsg.dataset.sender || '';
  const id = ctxTargetMsg.dataset.msgId || '';
  startReply(id, sender, text);
}

function ctxCopy() {
  closeAllOverlays();
  if (!ctxTargetMsg) return;
  navigator.clipboard.writeText(ctxTargetMsg.dataset.msgText || '').catch(() => {});
  showToast('Copied to clipboard', 'success');
}

function ctxForward() {
  closeAllOverlays();
  showToast('Forward: select a chat (coming soon)', 'info');
}

function ctxReact(e) {
  if (e) e.stopPropagation();
  closeAllOverlays();
  if (!ctxTargetMsg) return;
  const msgId = ctxTargetMsg.dataset.msgId;
  if (!msgId) return;

  reactionTargetMsgId = msgId;
  const rect = ctxTargetMsg.getBoundingClientRect();
  const picker = document.getElementById('reaction-picker');
  picker.style.display = 'flex';

  const pickerWidth = picker.offsetWidth || 240;
  let left = rect.left + 20;
  if (left + pickerWidth > window.innerWidth - 10) {
    left = Math.max(10, window.innerWidth - pickerWidth - 20);
  }
  let top = rect.top - 45;
  if (top < 10) top = rect.bottom + 10;

  picker.style.left = left + 'px';
  picker.style.top = top + 'px';
}

function ctxDelete() {
  closeAllOverlays();
  showToast('Deleted for you', 'info');
}

function startReply(msgId, senderName, text) {
  replyToMsg = { id: msgId, senderName, text };
  document.getElementById('reply-sender-name').textContent = senderName || 'Message';
  document.getElementById('reply-preview-text').textContent = text || '';
  const bar = document.getElementById('reply-preview-bar');
  bar.style.display = 'block';
  document.getElementById('chat-message-input').focus();
}

function cancelReply() {
  replyToMsg = null;
  const bar = document.getElementById('reply-preview-bar');
  if (bar) bar.style.display = 'none';
}

let reactionTargetMsgId = null;
function showReactionPicker(e, msgId) {
  if (e) e.stopPropagation();
  closeAllOverlays();
  reactionTargetMsgId = msgId;
  const picker = document.getElementById('reaction-picker');
  picker.style.display = 'flex';

  const pickerWidth = picker.offsetWidth || 240;
  let left = e.clientX ? e.clientX - 100 : window.innerWidth / 2;
  if (left + pickerWidth > window.innerWidth - 10) {
    left = Math.max(10, window.innerWidth - pickerWidth - 15);
  }
  if (left < 10) left = 10;

  let top = e.clientY ? e.clientY - 60 : window.innerHeight / 2;
  if (top < 10) top = (e.clientY || 100) + 20;

  picker.style.left = left + 'px';
  picker.style.top = top + 'px';
}

function showReactionBtn(e, msgId) {
  reactionTargetMsgId = msgId;
}

async function sendReaction(emoji) {
  closeAllOverlays();
  if (!reactionTargetMsgId) return;
  try {
    await fetch(basePath + 'send_reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': apiToken },
      body: JSON.stringify({
        number: activeChatJid,
        messageId: reactionTargetMsgId,
        reaction: emoji,
        session_id: currentSession,
      }),
    });
    showToast('Reaction sent', 'success');
    delete lastLoadedMessagesCache[activeChatJid];
    setTimeout(() => loadChatMessages(activeChatJid), 400);
  } catch {
    showToast('Failed to send reaction', 'danger');
  }
}

const EMOJI_LIST = [
  '😀',
  '😂',
  '😍',
  '🥰',
  '😎',
  '😭',
  '😅',
  '🤔',
  '😊',
  '😇',
  '🙃',
  '😉',
  '😋',
  '🤗',
  '😏',
  '😢',
  '😤',
  '😡',
  '🤯',
  '🥳',
  '😴',
  '🤑',
  '😈',
  '👻',
  '🎉',
  '🔥',
  '❤️',
  '💯',
  '👍',
  '👎',
  '🙏',
  '💪',
  '✌️',
  '👏',
  '🤝',
  '🫶',
  '💀',
  '💩',
  '🎊',
  '⭐',
  '💫',
  '🚀',
  '🎯',
  '🏆',
  '💎',
  '🌈',
  '🌙',
  '☀️',
  '🍕',
  '🍔',
  '☕',
  '🎵',
  '🎶',
  '📱',
  '💻',
  '🔑',
  '🏠',
  '🌍',
  '🐶',
  '🐱',
  '🦁',
  '🐻',
];
let emojiPickerBuilt = false;

function toggleEmojiPicker(e) {
  e.stopPropagation();
  const picker = document.getElementById('emoji-picker');
  if (picker.style.display === 'grid') {
    picker.style.display = 'none';
    return;
  }
  if (!emojiPickerBuilt) {
    picker.innerHTML = EMOJI_LIST.map(
      (em) => `<span onclick="insertEmoji('${em}')" title="${em}">${em}</span>`
    ).join('');
    emojiPickerBuilt = true;
  }
  picker.style.display = 'grid';
}

function insertEmoji(em) {
  const inp = document.getElementById('chat-message-input');
  const pos = inp.selectionStart;
  inp.value = inp.value.slice(0, pos) + em + inp.value.slice(pos);
  inp.focus();
  inp.setSelectionRange(pos + em.length, pos + em.length);
}

async function sendFileMessage(input) {
  if (!input.files || !input.files[0] || !activeChatJid) return;
  const file = input.files[0];
  input.value = '';
  const mime = file.type;
  showToast('Uploading…', 'info');

  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;
    let endpoint = 'send_document';
    if (mime.startsWith('image/')) endpoint = 'send_image';
    else if (mime.startsWith('video/')) endpoint = 'send_video';
    else if (mime.startsWith('audio/')) endpoint = 'send_audio';
    try {
      const resp = await fetch(basePath + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': apiToken },
        body: JSON.stringify({
          number: activeChatJid,
          url: dataUrl,
          caption: file.name,
          fileName: file.name,
          session_id: currentSession,
        }),
      });
      if (resp.ok) {
        showToast('File sent', 'success');
        setTimeout(() => loadChatMessages(activeChatJid), 800);
      } else {
        showToast('Failed to send file', 'danger');
      }
    } catch {
      showToast('Failed to send file', 'danger');
    }
  };
  reader.readAsDataURL(file);
}

function toggleChatSearch() {
  const bar = document.getElementById('chat-search-bar');
  const inp = document.getElementById('in-chat-search-input') || document.getElementById('chat-search-input');
  if (!bar) return;
  const isVisible = bar.style.display !== 'none';
  bar.style.display = isVisible ? 'none' : 'block';
  if (!isVisible && inp) {
    inp.value = '';
    inp.focus();
    renderHighlightedMessages(null);
  }
}

function closeChatSearch() {
  const bar = document.getElementById('chat-search-bar');
  if (bar) bar.style.display = 'none';
  renderHighlightedMessages(null);
}

async function searchInActiveChat() {
  const inp = document.getElementById('in-chat-search-input') || document.getElementById('chat-search-input');
  const q = inp ? inp.value.trim() : '';
  await searchChatMessages(q);
}

async function searchChatMessages(q) {
  if (!q || !q.trim() || !activeChatJid) {
    renderHighlightedMessages(null);
    const countEl = document.getElementById('chat-search-count');
    if (countEl) countEl.textContent = '';
    return;
  }
  try {
    const resp = await fetch(
      basePath +
        'api/messages/search?session_id=' +
        currentSession +
        '&jid=' +
        encodeURIComponent(activeChatJid) +
        '&q=' +
        encodeURIComponent(q)
    );
    if (!resp.ok) return;
    const results = await resp.json();
    const countEl = document.getElementById('chat-search-count');
    if (countEl) {
      countEl.textContent = results.length
        ? `${results.length} result${results.length === 1 ? '' : 's'}`
        : 'No results';
    }
    renderHighlightedMessages(results.map((r) => r.id));
    if (results.length) {
      const el = document.querySelector(`[data-msg-id="${results[0].id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch (e) {}
}

function renderHighlightedMessages(ids) {
  document.querySelectorAll('.msg-bubble-row').forEach((row) => {
    row.style.opacity = ids ? (ids.includes(row.dataset.msgId) ? '1' : '0.3') : '1';
  });
}

function closeAllOverlays(e) {
  if (e && (e.target.closest('#msg-context-menu') || e.target.closest('#reaction-picker') || e.target.closest('#emoji-picker'))) {
    return;
  }
  const ctx = document.getElementById('msg-context-menu');
  if (ctx) ctx.style.display = 'none';
  const rx = document.getElementById('reaction-picker');
  if (rx) rx.style.display = 'none';
  const em = document.getElementById('emoji-picker');
  if (em) em.style.display = 'none';
}

document.addEventListener('click', (e) => closeAllOverlays(e));
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('.msg-bubble-row')) closeAllOverlays(e);
});

async function sendChatMessage(event) {
  event.preventDefault();
  if (!activeChatJid) return;

  const input = document.getElementById('chat-message-input');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  showToast('Sending message...', 'info');

  try {
    const payload = {
      number: activeChatJid,
      message: message,
      session_id: currentSession,
    };
    if (replyToMsg) payload.quotedMessageId = replyToMsg.id;
    cancelReply();

    const response = await fetch(basePath + 'send_message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Auth-Token': apiToken,
      },
    if (response.ok) {
      showToast('Message sent', 'success');
      loadChatMessages(activeChatJid);
      loadChats();
    } else {
      const errData = await response.json();
      showToast(errData.error || 'Failed to send message', 'danger');
    }
  } catch (e) {
    showToast('Network error sending message', 'danger');
  }
}

async function openChatInfoDrawer() {
  if (!activeChatJid) return;
  const drawer = document.getElementById('chat-info-drawer');
  const body = document.getElementById('drawer-body-content');
  if (!drawer || !body) return;

  drawer.style.display = 'flex';
  body.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading info…</div>';

  try {
    const res = await fetch(
      basePath + 'api/chat_info?session_id=' + currentSession + '&jid=' + encodeURIComponent(activeChatJid)
    );
    if (!res.ok) throw new Error('Failed');
    const info = await res.json();

    const avatarSrc = info.avatarUrl || avatarCache[activeChatJid];
    const avatarHtml = avatarSrc
      ? `<img src="${avatarSrc}" class="drawer-avatar-img">`
      : `<div class="drawer-avatar-fallback"><i class="fas ${info.isGroup ? 'fa-users' : 'fa-user'}"></i></div>`;

    if (info.isGroup) {
      const createdDate = info.creation
        ? new Date(info.creation * 1000).toLocaleDateString()
        : 'Unknown';
      const participantsHtml = (info.participants || [])
        .map(
          (p) => `
            <div class="participant-item">
              <div class="participant-avatar"><i class="fas fa-user"></i></div>
              <div class="participant-info">
                <div class="participant-name">${escapeHtml(p.name)}</div>
                <div class="participant-id">${escapeHtml(p.id)}</div>
              </div>
              ${p.admin ? '<span class="admin-badge">Group Admin</span>' : ''}
            </div>`
        )
        .join('');

      body.innerHTML = `
        <div class="drawer-profile">
          <div class="drawer-avatar-wrapper">${avatarHtml}</div>
          <h3 class="drawer-title">${escapeHtml(info.name || 'Group')}</h3>
          <p class="drawer-subtitle">Group · ${info.participantsCount || 0} participants</p>
        </div>

        ${
          info.description
            ? `
        <div class="drawer-section">
          <label class="drawer-label">Group Description</label>
          <div class="drawer-desc">${escapeHtml(info.description)}</div>
        </div>`
            : ''
        }

        <div class="drawer-section">
          <label class="drawer-label">Created</label>
          <div class="drawer-value">${createdDate}</div>
        </div>

        <div class="drawer-section">
          <label class="drawer-label">Participants (${info.participantsCount || 0})</label>
          <div class="participants-list">${participantsHtml || '<div class="empty-state">No participants details</div>'}</div>
        </div>
      `;
    } else {
      body.innerHTML = `
        <div class="drawer-profile">
          <div class="drawer-avatar-wrapper">${avatarHtml}</div>
          <h3 class="drawer-title">${escapeHtml(info.name)}</h3>
          <p class="drawer-subtitle">${escapeHtml(info.jid)}</p>
        </div>

        ${
          info.status
            ? `
        <div class="drawer-section">
          <label class="drawer-label">About / Status</label>
          <div class="drawer-desc">${escapeHtml(info.status)}</div>
        </div>`
            : ''
        }

        <div class="drawer-section">
          <label class="drawer-label">Phone / JID</label>
          <div class="drawer-value">${escapeHtml(info.jid)}</div>
        </div>
      `;
    }
  } catch (e) {
    body.innerHTML = '<div class="empty-state">Could not load chat info</div>';
  }
}

function closeChatInfoDrawer() {
  const drawer = document.getElementById('chat-info-drawer');
  if (drawer) drawer.style.display = 'none';
}

window.loadChats = loadChats;
window.filterChatList = filterChatList;
window.goBackToChatList = goBackToChatList;
window.selectChat = selectChat;
window.openNewChatModal = openNewChatModal;
window.closeNewChatModal = closeNewChatModal;
window.startNewChatSubmit = startNewChatSubmit;
window.showContextMenu = showContextMenu;
window.showReactionBtn = showReactionBtn;
window.showReactionPicker = showReactionPicker;
window.sendReaction = sendReaction;
window.ctxReply = ctxReply;
window.ctxCopy = ctxCopy;
window.ctxForward = ctxForward;
window.ctxReact = ctxReact;
window.ctxDelete = ctxDelete;
window.startReply = startReply;
window.cancelReply = cancelReply;
window.toggleEmojiPicker = toggleEmojiPicker;
window.insertEmoji = insertEmoji;
window.sendFileMessage = sendFileMessage;
window.toggleChatSearch = toggleChatSearch;
window.searchChatMessages = searchChatMessages;
window.searchInActiveChat = searchInActiveChat;
window.closeChatSearch = closeChatSearch;
window.openChatInfoDrawer = openChatInfoDrawer;
window.closeChatInfoDrawer = closeChatInfoDrawer;
