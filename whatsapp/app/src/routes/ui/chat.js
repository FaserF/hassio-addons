// Chat client UI logic

let lastLoadedMessagesCache = {};
let lastChatsCache = '';

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

      return `
            <div class="chat-item ${isActive}" onclick="selectChat('${c.jid}', '${escapeHtml(c.name)}')">
                <div class="chat-avatar">
                    <i class="fas ${avatarIcon}"></i>
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
  const jidEl = document.getElementById('active-chat-jid');
  if (jidEl && !jidText) jidEl.textContent = jid;

  const avatar = document.getElementById('active-chat-avatar');
  if (avatar) {
    avatar.innerHTML = `<div class="chat-header-avatar"><i class="fas ${jid.endsWith('@g.us') ? 'fa-users' : 'fa-user'}"></i></div>`;
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
  menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
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
  e.stopPropagation();
  closeAllOverlays();
  reactionTargetMsgId = msgId;
  const picker = document.getElementById('reaction-picker');
  picker.style.display = 'flex';
  picker.style.left = Math.min(e.clientX, window.innerWidth - 250) + 'px';
  picker.style.top = e.clientY - 60 + 'px';
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
    setTimeout(() => loadChatMessages(activeChatJid), 500);
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
  const inp = document.getElementById('chat-search-input');
  const isVisible = bar.style.display !== 'none';
  bar.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) {
    inp.value = '';
    inp.focus();
    renderHighlightedMessages(null);
  }
}

async function searchChatMessages(q) {
  if (!q.trim() || !activeChatJid) {
    renderHighlightedMessages(null);
    document.getElementById('chat-search-count').textContent = '';
    return;
  }
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
  document.getElementById('chat-search-count').textContent = results.length
    ? `${results.length} result${results.length === 1 ? '' : 's'}`
    : 'No results';
  renderHighlightedMessages(results.map((r) => r.id));
  if (results.length) {
    const el = document.querySelector(`[data-msg-id="${results[0].id}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function renderHighlightedMessages(ids) {
  document.querySelectorAll('.msg-bubble-row').forEach((row) => {
    row.style.opacity = ids ? (ids.includes(row.dataset.msgId) ? '1' : '0.3') : '1';
  });
}

function closeAllOverlays() {
  document.getElementById('msg-context-menu').style.display = 'none';
  document.getElementById('reaction-picker').style.display = 'none';
  document.getElementById('emoji-picker').style.display = 'none';
}

document.addEventListener('click', closeAllOverlays);
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('.msg-bubble-row')) closeAllOverlays();
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
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      showToast('Message sent', 'success');
      loadChatMessages(activeChatJid);
      loadChats();
    } else {
      const errData = await response.json();
      showToast(errData.detail || 'Failed to send message', 'danger');
    }
  } catch (e) {
    showToast('Failed to send message', 'danger');
  }
}
