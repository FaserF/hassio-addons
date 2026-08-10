// Chat client UI logic

let lastLoadedMessagesCache = {};
let lastChatsCache = '';
let reactionTargetMsgId = null;
let chatModConfigCache = null;
let chatTgConfigCache = null;

function switchNewChatTab(mode) {
  const directForm = document.getElementById('new-direct-chat-form');
  const groupForm = document.getElementById('new-group-chat-form');
  const directBtn = document.getElementById('tab-btn-direct-chat');
  const groupBtn = document.getElementById('tab-btn-group-chat');

  if (mode === 'group') {
    if (directForm) directForm.style.display = 'none';
    if (groupForm) groupForm.style.display = 'block';
    if (directBtn) {
      directBtn.classList.remove('btn-primary');
      directBtn.classList.add('btn-secondary');
    }
    if (groupBtn) {
      groupBtn.classList.remove('btn-secondary');
      groupBtn.classList.add('btn-primary');
    }
    const subjInp = document.getElementById('new-group-subject');
    if (subjInp) setTimeout(() => subjInp.focus(), 50);
  } else {
    if (directForm) directForm.style.display = 'block';
    if (groupForm) groupForm.style.display = 'none';
    if (directBtn) {
      directBtn.classList.remove('btn-secondary');
      directBtn.classList.add('btn-primary');
    }
    if (groupBtn) {
      groupBtn.classList.remove('btn-primary');
      groupBtn.classList.add('btn-secondary');
    }
    const inp = document.getElementById('new-chat-number');
    if (inp) setTimeout(() => inp.focus(), 50);
  }
}

async function createNewGroupSubmit(event) {
  if (event) event.preventDefault();
  const subjectEl = document.getElementById('new-group-subject');
  const partEl = document.getElementById('new-group-participants');
  const subject = subjectEl ? subjectEl.value.trim() : '';
  const rawParts = partEl ? partEl.value.trim() : '';

  if (!subject) {
    showToast(t('chats.group_subject_warning'), 'warning');
    return;
  }
  if (!rawParts) {
    showToast(t('chats.group_participant_warning'), 'warning');
    return;
  }

  const participants = rawParts
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (participants.length === 0) {
    showToast(t('chats.group_participant_valid_warning'), 'warning');
    return;
  }

  try {
    const res = await fetch(basePath + 'api/groups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': apiToken },
      body: JSON.stringify({ subject, participants, session_id: currentSession }),
    });
    const data = await res.json();
    if (res.ok && (data.success || data.status === 'created')) {
      showToast(t('chats.group_created', { name: subject }), 'success');
      closeNewChatModal();
      await loadChats();
      const newJid = data.group?.id || data.group?.gid;
      if (newJid) {
        selectChat(newJid, subject);
      }
    } else {
      showToast(data.detail || t('chats.group_create_failed'), 'danger');
    }
  } catch (err) {
    showToast(t('chats.group_create_error', { error: err.message }), 'danger');
  }
}

function openNewChatModal() {
  if (!isConnected) {
    showToast(t('chats.not_connected'), 'warning');
    return;
  }
  const modal = document.getElementById('new-chat-modal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.zIndex = '999999';
    switchNewChatTab('direct');
  }
}

function closeNewChatModal() {
  const modal = document.getElementById('new-chat-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
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
      showToast(t('chats.invalid_phone'), 'danger');
      return;
    }
    jid = `${cleanNum}@s.whatsapp.net`;
  }

  closeNewChatModal();
  const displayName = jid.split('@')[0];
  selectChat(jid, displayName);
  showToast(t('chats.initialized', { name: displayName }), 'success');
}

function matchJid(a, b, extraName = '') {
  if (!a || !b) return false;
  const sA = String(a).trim().toLowerCase();
  const sB = String(b).trim().toLowerCase();
  if (sA === sB) return true;
  const rawA = sA
    .split('@')[0]
    .split(':')[0]
    .replace(/[^0-9]/g, '');
  const rawB = sB
    .split('@')[0]
    .split(':')[0]
    .replace(/[^0-9]/g, '');
  if (rawA && rawB && rawA === rawB) return true;
  if (sA.split('@')[0] === sB.split('@')[0]) return true;
  if (extraName) {
    const cName = String(extraName).trim().toLowerCase();
    if (sA === cName || sA.split('@')[0] === cName) return true;
  }
  return false;
}

async function fetchChatBadgesConfig() {
  try {
    const headers = {};
    if (typeof apiToken !== 'undefined' && apiToken) {
      headers['X-Auth-Token'] = apiToken;
    }
    const [modRes, tgRes] = await Promise.all([
      fetch(basePath + 'api/moderation/config', { headers }).catch(() => null),
      fetch(basePath + 'api/telegram/config', { headers }).catch(() => null),
    ]);
    if (modRes && modRes.ok) {
      const json = await modRes.json();
      chatModConfigCache = json.data || json;
    }
    if (tgRes && tgRes.ok) {
      const json = await tgRes.json();
      chatTgConfigCache = json.data || json;
    }
    if (activeChatJid) {
      updateChatHeaderBadges(activeChatJid, activeChatName);
    }
  } catch (e) {
    console.warn('Failed to fetch chat badges config:', e);
  }
}

function updateChatHeaderBadges(jid, chatName = '') {
  if (!jid || jid !== activeChatJid) return;
  const headerBadgesEl = document.getElementById('active-chat-header-badges');
  if (!headerBadgesEl) return;

  let hasModActive = false;
  if (jid.endsWith('@g.us') && chatModConfigCache) {
    const modData = chatModConfigCache.data || chatModConfigCache;
    const globalEnabled = modData.global_enabled !== false;
    if (globalEnabled) {
      const groups = modData.groups || {};
      const groupEntry = Object.entries(groups).find(([gKey, gVal]) => {
        if (matchJid(gKey, jid, chatName)) return true;
        if (gVal?.jid && matchJid(gVal.jid, jid, chatName)) return true;
        if (gVal?.name && matchJid(gVal.name, jid, chatName)) return true;
        return false;
      });
      if (groupEntry && groupEntry[1]?.enabled !== false) {
        hasModActive = true;
      }
    }
  }

  let activeMapping = null;
  if (chatTgConfigCache) {
    const tgData = chatTgConfigCache.data || chatTgConfigCache;
    const tgEnabled = tgData.enabled !== false;
    const mappings = tgData.mappings || [];
    if (tgEnabled && Array.isArray(mappings)) {
      activeMapping = mappings.find((m) => {
        if (m.enabled === false) return false;
        if (matchJid(m.wa_jid, jid, chatName)) return true;
        if (m.wa_name && matchJid(m.wa_name, jid, chatName)) return true;
        return false;
      });
    }
  }

  const modBtn = hasModActive
    ? `<button class="btn btn-ghost chat-header-btn" style="color:var(--primary);background:rgba(37,211,102,0.12);" onclick="navigateToModerationGroup(event, '${jid}')" title="Moderation Active — Click to configure"><i class="fas fa-shield-alt"></i></button>`
    : '';

  const tgBtn = activeMapping
    ? `<button class="btn btn-ghost chat-header-btn" style="color:#0088cc;background:rgba(0,136,204,0.12);" onclick="navigateToTelegramMapping(event, '${jid}', '${activeMapping.id}')" title="Telegram Bridge Active — Click to edit mapping"><i class="fab fa-telegram-plane"></i></button>`
    : '';

  headerBadgesEl.innerHTML = `${modBtn}${tgBtn}`;
}

async function loadChats() {
  if (!isChatTabActive) return;
  try {
    await fetchChatBadgesConfig();
    const response = await fetch(basePath + 'api/chats?session_id=' + currentSession);
    if (!response.ok) return;
    allChats = await response.json();
    const chatsKey =
      JSON.stringify(allChats) +
      JSON.stringify(chatModConfigCache) +
      JSON.stringify(chatTgConfigCache);
    if (chatsKey !== lastChatsCache) {
      lastChatsCache = chatsKey;
      renderChatList(allChats);
    }
  } catch (e) {
    console.error('Failed to load chats:', e);
  }
}

function navigateToModerationGroup(event, jid) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (window.switchTab) {
    window.switchTab('moderation');
  }
  setTimeout(() => {
    if (window.selectModerationGroup) {
      window.selectModerationGroup(jid);
    }
    const select = document.getElementById('mod-group-select');
    if (select) {
      select.value = jid;
      select.dispatchEvent(new Event('change'));
    }
  }, 120);
}

function navigateToTelegramMapping(event, jid, mappingId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (window.switchTab) {
    window.switchTab('telegram');
  }
  setTimeout(() => {
    if (window.editTelegramMapping && mappingId) {
      window.editTelegramMapping(mappingId);
    }
  }, 120);
}

function renderChatList(chats) {
  const container = document.getElementById('chat-list-items');
  if (!chats || chats.length === 0) {
    container.innerHTML = `<div class="empty-state">${t('chats.no_conversations')}</div>`;
    return;
  }

  const searchVal = document.getElementById('chat-search').value.toLowerCase();
  const filtered = chats.filter(
    (c) => c.name.toLowerCase().includes(searchVal) || c.jid.toLowerCase().includes(searchVal)
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">${t('chats.no_matching')}</div>`;
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

      // Check Moderation active state for this group
      let hasModActive = false;
      if (c.jid.endsWith('@g.us') && chatModConfigCache) {
        const modData = chatModConfigCache.data || chatModConfigCache;
        const globalEnabled = modData.global_enabled !== false;
        if (globalEnabled) {
          const groups = modData.groups || {};
          const groupEntry = Object.entries(groups).find(([gKey, gVal]) => {
            if (matchJid(gKey, c.jid, c.name)) return true;
            if (gVal?.jid && matchJid(gVal.jid, c.jid, c.name)) return true;
            if (gVal?.name && matchJid(gVal.name, c.jid, c.name)) return true;
            return false;
          });
          if (groupEntry && groupEntry[1]?.enabled !== false) {
            hasModActive = true;
          }
        }
      }

      // Check Telegram Bridge active state for this chat/group
      let activeMapping = null;
      if (chatTgConfigCache) {
        const tgData = chatTgConfigCache.data || chatTgConfigCache;
        const tgEnabled = tgData.enabled !== false;
        const mappings = tgData.mappings || [];
        if (tgEnabled && Array.isArray(mappings)) {
          activeMapping = mappings.find((m) => {
            if (m.enabled === false) return false;
            if (matchJid(m.wa_jid, c.jid, c.name)) return true;
            if (m.wa_name && matchJid(m.wa_name, c.jid, c.name)) return true;
            return false;
          });
        }
      }

      const modBadgeHtml = hasModActive
        ? `<span class="chat-badge-icon mod-badge" onclick="navigateToModerationGroup(event, '${c.jid}')" title="Moderation Active — Click to configure"><i class="fas fa-shield-alt"></i></span>`
        : '';

      const tgBadgeHtml = activeMapping
        ? `<span class="chat-badge-icon tg-badge" onclick="navigateToTelegramMapping(event, '${c.jid}', '${activeMapping.id}')" title="Telegram Bridge Active — Click to edit mapping"><i class="fab fa-telegram-plane"></i></span>`
        : '';

      const badgesContainer =
        modBadgeHtml || tgBadgeHtml
          ? `<span class="chat-badges">${modBadgeHtml}${tgBadgeHtml}</span>`
          : '';

      return `
            <div class="chat-item ${isActive}" onclick="selectChat('${c.jid}', '${escapeHtml(c.name)}')">
                <div class="chat-avatar" data-avatar-jid="${c.jid}">
                    ${avatarHtml}
                </div>
                <div class="chat-info">
                    <div class="chat-meta">
                        <span class="chat-name">${escapeHtml(c.name)}${badgesContainer}</span>
                        <span class="chat-time">${timeStr}</span>
                    </div>
                    <div class="chat-last-msg">${escapeHtml(c.preview || t('chats.no_messages'))}</div>
                </div>
            </div>
        `;
    })
    .join('');

  // Fetch avatars for list items in background
  filtered.forEach((c) => {
    if (avatarCache[c.jid] === undefined) {
      fetchAvatar(c.jid);
    }
  });
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
    const headers = {};
    if (typeof apiToken !== 'undefined' && apiToken) {
      headers['X-Auth-Token'] = apiToken;
    }
    const res = await fetch(
      basePath + 'api/avatar?session_id=' + currentSession + '&jid=' + encodeURIComponent(jid),
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      avatarCache[jid] = data.url;
      updateAvatarElements(jid, data.url);
      return data.url;
    }
  } catch (e) {}
  avatarCache[jid] = null;
  updateAvatarElements(jid, null);
  return null;
}

function updateAvatarElements(jid, url) {
  const safeJid = jid.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const els = document.querySelectorAll(`[data-avatar-jid="${safeJid}"]`);
  const iconClass = jid.endsWith('@g.us') ? 'fa-users' : 'fa-user';
  const html = url
    ? `<img src="${url}" class="avatar-img" alt="Avatar">`
    : `<i class="fas ${iconClass}"></i>`;

  els.forEach((el) => {
    el.innerHTML = html;
  });

  if (activeChatJid === jid) {
    const headerAvatar = document.getElementById('active-chat-avatar');
    if (headerAvatar) {
      headerAvatar.innerHTML = html;
    }
  }
}

function selectChat(jid, name) {
  activeChatJid = jid;
  activeChatName = name || jid.split('@')[0];
  delete lastLoadedMessagesCache[jid];
  document.body.classList.add('chat-open');
  cancelReply();
  closeAllOverlays();
  closeChatInfoDrawer();

  document.getElementById('chat-thread-empty').style.display = 'none';
  document.getElementById('chat-thread-active').style.display = 'flex';

  const avatarEl = document.getElementById('active-chat-avatar');
  if (avatarEl) {
    const cached = avatarCache[jid];
    const iconClass = jid.endsWith('@g.us') ? 'fa-users' : 'fa-user';
    avatarEl.innerHTML = cached
      ? `<img src="${cached}" class="avatar-img" alt="Avatar">`
      : `<i class="fas ${iconClass}"></i>`;
  }
  fetchAvatar(jid);

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

  // Update header badges (Moderation & Telegram Bridge)
  updateChatHeaderBadges(jid, name || activeChatName);

  document.getElementById('chat-thread-messages').innerHTML =
    `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> ${t('common.loading')}</div>`;

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

  if (window._msgPollInterval) clearInterval(window._msgPollInterval);
  window._msgPollInterval = setInterval(() => {
    if (activeChatJid === jid && isChatTabActive) {
      loadChatMessages(jid);
    } else {
      clearInterval(window._msgPollInterval);
    }
  }, 2500);

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

async function voteOnPollOption(e, optText) {
  if (e) e.stopPropagation();
  if (!activeChatJid) return;
  try {
    const res = await fetch(basePath + 'api/poll/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': apiToken },
      body: JSON.stringify({ jid: activeChatJid, option: optText, session_id: currentSession }),
    });
    if (res.ok) {
      showToast(t('chats.voted', { option: optText }), 'success');
      loadChatMessages(activeChatJid);
    } else {
      showToast(t('chats.vote_failed'), 'danger');
    }
  } catch (err) {
    showToast(t('chats.vote_failed'), 'danger');
  }
}

function renderPollBlock(m) {
  if (!m.poll) return '';
  const p = m.poll;
  const title = escapeHtml(p.name || 'Poll');
  const optionsHtml = (p.options || [])
    .map((opt, idx) => {
      const optStr = typeof opt === 'string' ? opt : opt.text || `Option ${idx + 1}`;
      const escapedOpt = escapeAttr(optStr);
      return `
    <div class="msg-poll-option" onclick="voteOnPollOption(event, '${escapedOpt}')" style="cursor:pointer;" title="Click to vote for '${escapeAttr(optStr)}'">
      <div class="msg-poll-option-name">
        <i class="far fa-circle msg-poll-check" style="font-size:12px;margin-right:6px;opacity:0.7;"></i>
        ${escapeHtml(optStr)}
      </div>
      <div class="msg-poll-bar-container">
        <div class="msg-poll-bar-fill" style="width: 0%;"></div>
      </div>
    </div>`;
    })
    .join('');

  return `
    <div class="msg-poll-card">
      <div class="msg-poll-title"><i class="fas fa-poll" style="color:var(--primary);margin-right:8px;"></i>${title}</div>
      <div class="msg-poll-options">${optionsHtml}</div>
      <div class="msg-poll-footer"><i class="fas fa-hand-pointer" style="margin-right:4px;"></i>Click option to vote &middot; ${p.selectableCount > 1 ? 'Multiple Choice' : 'Single Choice'}</div>
    </div>`;
}

function renderLocationBlock(m) {
  if (!m.location) return '';
  const loc = m.location;
  const lat = loc.degreesLatitude || 0;
  const lng = loc.degreesLongitude || 0;
  const label = escapeHtml(loc.name || loc.address || `${lat}, ${lng}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const icon = loc.isLive ? 'fa-broadcast-tower' : 'fa-map-marker-alt';

  return `
    <div class="msg-location-card" onclick="window.open('${mapsUrl}','_blank')">
      <div class="msg-location-header">
        <div class="msg-location-icon"><i class="fas ${icon}"></i></div>
        <div class="msg-location-details">
          <div class="msg-location-title">${label}</div>
          <div class="msg-location-coords">${lat.toFixed(4)}, ${lng.toFixed(4)}${loc.isLive ? ' • Live Location' : ''}</div>
        </div>
      </div>
      <div class="msg-location-action"><i class="fas fa-external-link-alt" style="margin-right:4px;"></i> Open in Google Maps</div>
    </div>`;
}

function renderContactBlock(m) {
  if (!m.contact) return '';
  const c = m.contact;
  const name = escapeHtml(c.displayName || 'Contact Card');
  const phone = escapeHtml(c.phone || '');
  const cleanPhone = phone.replace(/[^0-9]/g, '');

  return `
    <div class="msg-contact-card">
      <div class="msg-contact-body">
        <div class="msg-contact-avatar"><i class="fas fa-user-tie"></i></div>
        <div class="msg-contact-info">
          <div class="msg-contact-name">${name}</div>
          ${phone ? `<div class="msg-contact-phone">${phone}</div>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        ${cleanPhone ? `<button class="btn btn-primary btn-sm" onclick="selectChat('${cleanPhone}@s.whatsapp.net', '${escapeAttr(name)}')" style="font-size:11.5px;padding:3px 10px;"><i class="fas fa-comment-alt" style="margin-right:4px;"></i> Chat</button>` : ''}
        ${phone ? `<a href="tel:${phone}" class="btn btn-secondary btn-sm" style="font-size:11.5px;padding:3px 10px;text-decoration:none;"><i class="fas fa-phone-alt" style="margin-right:4px;"></i> Call</a>` : ''}
      </div>
    </div>`;
}

function renderEventBlock(m) {
  if (!m.eventData) return '';
  const ev = m.eventData;
  const name = escapeHtml(ev.name || 'Event');
  const desc = escapeHtml(ev.description || '');
  const dateStr = ev.startTime
    ? new Date(ev.startTime * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : '';
  const loc = escapeHtml(ev.location || '');
  const canceled = ev.isCanceled
    ? '<span style="color:#ef4444;font-weight:bold;margin-left:6px;">[Canceled]</span>'
    : '';

  return `
    <div class="msg-event-card">
      <div class="msg-event-header">
        <i class="far fa-calendar-alt" style="font-size:18px;color:var(--primary);"></i>
        <div class="msg-event-title">${name}${canceled}</div>
      </div>
      ${dateStr ? `<div class="msg-event-detail"><i class="far fa-clock"></i> ${dateStr}</div>` : ''}
      ${loc ? `<div class="msg-event-detail"><i class="fas fa-map-marker-alt"></i> ${loc}</div>` : ''}
      ${desc ? `<div class="msg-event-desc">${desc}</div>` : ''}
      ${ev.joinLink ? `<a href="${escapeAttr(ev.joinLink)}" target="_blank" class="msg-event-link"><i class="fas fa-link"></i> Join Event</a>` : ''}
    </div>`;
}

function renderMediaBlock(m) {
  if (!m.mediaUrl) {
    if (m.mediaType) {
      const typeIcons = {
        image: 'fa-image',
        video: 'fa-video',
        audio: 'fa-music',
        sticker: 'fa-sticky-note',
        document: 'fa-file-alt',
      };
      const icon = typeIcons[m.mediaType] || 'fa-paperclip';
      const label = m.mediaType.charAt(0).toUpperCase() + m.mediaType.slice(1);
      return `<div class="msg-media-badge"><i class="fas ${icon}" style="color:var(--primary);"></i> ${escapeHtml(label)}</div>`;
    }
    return '';
  }
  let url = m.mediaUrl;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (!url.startsWith('/')) url = '/' + url;
    if (basePath && !url.startsWith(basePath)) {
      url = basePath + url.replace(/^\//, '');
    }
  }
  if (
    typeof apiToken !== 'undefined' &&
    apiToken &&
    (url.includes('api/') || url.includes('media/'))
  ) {
    if (!url.includes('token=')) {
      url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(apiToken);
    }
  }
  if (m.mediaType === 'image' || (m.mediaMime && m.mediaMime.startsWith('image/'))) {
    const fallbackText = m.caption ? escapeHtml(m.caption) : 'Photo Attachment';
    return `<img class="msg-media msg-media-img" src="${url}" alt="${escapeHtml(m.caption || 'Image')}" onclick="window.open('${url}','_blank')" onerror="this.onerror=null;this.outerHTML='<div class=\\'msg-media-badge\\'><i class=\\'fas fa-image\\' style=\\'color:var(--primary);\\'></i> ${fallbackText}</div>';" loading="lazy">`;
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

function renderButtons(m) {
  if (!m.buttons || m.buttons.length === 0) return '';
  const btnsHtml = m.buttons
    .map(
      (b) =>
        `<button class="msg-button-item" onclick="sendInteractiveReply('${escapeAttr(b.id || b.text)}','${escapeAttr(b.text)}')">
          <i class="fas fa-reply"></i> ${escapeHtml(b.text)}
        </button>`
    )
    .join('');
  return `<div class="msg-buttons-container">${btnsHtml}</div>`;
}

function sendInteractiveReply(btnId, btnText) {
  const input = document.getElementById('chat-message-input');
  if (input) {
    input.value = btnText || btnId;
    sendChatMessage(new Event('submit'));
  }
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
      container.innerHTML = `<div class="empty-state">${t('chats.no_messages_conversation')}</div>`;
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
        const pollBlock = renderPollBlock(m);
        const locationBlock = renderLocationBlock(m);
        const contactBlock = renderContactBlock(m);
        const eventBlock = renderEventBlock(m);
        const mediaBlock = renderMediaBlock(m);

        // Don't duplicate text if native poll/location/contact/event block is rendered
        const hasNativeWidget = Boolean(pollBlock || locationBlock || contactBlock || eventBlock);
        const rawText = m.text && !hasNativeWidget ? m.text : '';
        const textBlock =
          rawText && !(m.mediaType && !m.caption && m.mediaUrl)
            ? `<div class="msg-bubble-text">${escapeHtml(rawText)}</div>`
            : '';
        const captionBlock =
          m.caption && m.mediaType && m.mediaUrl
            ? `<div class="msg-bubble-text" style="margin-top:4px;">${escapeHtml(m.caption)}</div>`
            : '';
        const ackBlock = renderAck(m);
        const reactBlock = renderReactions(m);
        const buttonsBlock = renderButtons(m);

        const myReaction =
          (m.reactions || []).find((r) => r.sender === 'me' || r.sender === (m.fromMe ? 'You' : ''))
            ?.emoji || '';

        const hasContent = Boolean(
          (textBlock && textBlock.trim()) ||
          captionBlock ||
          mediaBlock ||
          quoteBlock ||
          pollBlock ||
          locationBlock ||
          contactBlock ||
          eventBlock ||
          buttonsBlock
        );

        if (!hasContent) {
          const sysText = (m.text || m.caption || '').trim();
          if (sysText) {
            return `<div class="msg-system-row"><span class="msg-system-pill">${escapeHtml(sysText)}</span></div>`;
          }
          return '';
        }

        return `<div class="msg-bubble-row ${direction}" data-msg-id="${m.id}" data-msg-text="${escapeAttr(m.text || m.caption || '')}" data-sender="${escapeAttr(m.senderName || '')}" data-my-reaction="${escapeAttr(myReaction)}"
                         oncontextmenu="showContextMenu(event,'${m.id}')">
                        <div class="msg-bubble">
                            ${senderLabel}
                            ${quoteBlock}
                            ${pollBlock}
                            ${locationBlock}
                            ${contactBlock}
                            ${eventBlock}
                            ${mediaBlock}
                            ${textBlock}
                            ${captionBlock}
                            ${buttonsBlock}
                            <div class="msg-bubble-time">${timeStr}${ackBlock}</div>
                        </div>
                        ${reactBlock}
                    </div>`;
      })
      .filter(Boolean)
      .join('');

    if (wasScrolledToBottom) {
      container.scrollTop = container.scrollHeight;
    }
  } catch (e) {
    console.error('Failed to load chat messages:', e);
  }
}

function showContextMenu(e, msgId) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  closeAllOverlays();
  ctxTargetMsg = document.querySelector(`[data-msg-id="${msgId}"]`);
  reactionTargetMsgId = msgId;
  const menu = document.getElementById('msg-context-menu');

  // Capture click coordinates immediately before any async frames
  const clickX = e.clientX;
  const clickY = e.clientY;

  // Phase 1: make menu visible but invisible so the browser paints & computes its size
  menu.style.visibility = 'hidden';
  menu.style.left = '0px';
  menu.style.top = '0px';
  menu.style.display = 'block';

  // Phase 2: after browser has computed layout, read real dimensions and clamp to viewport
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      const menuWidth = rect.width || 220;
      const menuHeight = rect.height || 280;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 8;

      let left = clickX;
      let top = clickY;

      // Clamp right edge
      if (left + menuWidth > vw - margin) {
        left = Math.max(margin, vw - menuWidth - margin);
      }
      // Clamp left edge
      if (left < margin) left = margin;

      // Clamp bottom edge
      if (top + menuHeight > vh - margin) {
        top = Math.max(margin, vh - menuHeight - margin);
      }
      // Clamp top edge
      if (top < margin) top = margin;

      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
      menu.style.visibility = 'visible';
    });
  });
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
  showToast(t('chats.copied'), 'success');
}

function ctxForward() {
  closeAllOverlays();
  showToast(t('chats.forward_coming_soon'), 'info');
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

  picker.style.visibility = 'hidden';
  picker.style.left = '0px';
  picker.style.top = '0px';
  picker.style.display = 'flex';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const pickerWidth = picker.offsetWidth || 240;
      const pickerHeight = picker.offsetHeight || 50;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 10;

      let left = rect.left + 20;
      if (left + pickerWidth > vw - margin) {
        left = Math.max(margin, vw - pickerWidth - margin);
      }
      if (left < margin) left = margin;

      let top = rect.top - 45;
      if (top < margin) top = Math.min(vh - pickerHeight - margin, rect.bottom + 10);

      picker.style.left = left + 'px';
      picker.style.top = top + 'px';
      picker.style.visibility = 'visible';
    });
  });
}

function ctxDelete() {
  closeAllOverlays();
  showToast(t('chats.deleted_for_you'), 'info');
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

function showReactionBtn() {}

async function sendReaction(emoji) {
  closeAllOverlays();
  if (!reactionTargetMsgId) return;
  try {
    const targetMsg = document.querySelector(`[data-msg-id="${reactionTargetMsgId}"]`);
    const existingReaction = targetMsg?.dataset?.myReaction || '';

    // Toggle off if clicking the same emoji again
    const finalEmoji = existingReaction && existingReaction === emoji ? '' : emoji;

    const resp = await fetch(basePath + 'send_reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': apiToken },
      body: JSON.stringify({
        number: activeChatJid,
        messageId: reactionTargetMsgId,
        reaction: finalEmoji,
        session_id: currentSession,
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      showToast(t('chats.reaction_failed', { error: err.detail || resp.status }), 'danger');
      return;
    }
    showToast(finalEmoji ? t('chats.reaction_sent') : t('chats.reaction_removed'), 'success');
    delete lastLoadedMessagesCache[activeChatJid];
    setTimeout(() => loadChatMessages(activeChatJid), 300);
  } catch {
    showToast(t('chats.reaction_update_failed'), 'danger');
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
  showToast(t('chats.uploading'), 'info');

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
          mimetype: mime,
          session_id: currentSession,
        }),
      });
      if (resp.ok) {
        showToast(t('chats.file_sent'), 'success');
        setTimeout(() => loadChatMessages(activeChatJid), 800);
      } else {
        showToast(t('chats.file_send_failed'), 'danger');
      }
    } catch {
      showToast(t('chats.file_send_failed'), 'danger');
    }
  };
  reader.readAsDataURL(file);
}

function toggleChatSearch() {
  const bar = document.getElementById('chat-search-bar');
  const inp =
    document.getElementById('in-chat-search-input') || document.getElementById('chat-search-input');
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
  const inp =
    document.getElementById('in-chat-search-input') || document.getElementById('chat-search-input');
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
  if (
    e &&
    (e.target.closest('#msg-context-menu') ||
      e.target.closest('#reaction-picker') ||
      e.target.closest('#emoji-picker'))
  ) {
    return;
  }
  const ctx = document.getElementById('msg-context-menu');
  if (ctx) {
    ctx.style.display = 'none';
    ctx.style.visibility = '';
  }
  const rx = document.getElementById('reaction-picker');
  if (rx) rx.style.display = 'none';
  const em = document.getElementById('emoji-picker');
  if (em) em.style.display = 'none';
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => closeAllOverlays(e));
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('.msg-bubble-row')) closeAllOverlays(e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllOverlays();
      closeChatInfoDrawer();
      closeChatSearch();
      closeNewChatModal();
    }
  });
}

async function sendChatMessage(event) {
  event.preventDefault();
  if (!activeChatJid) return;

  const input = document.getElementById('chat-message-input');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  showToast(t('chats.sending'), 'info');

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
      showToast(t('chats.message_sent'), 'success');
      delete lastLoadedMessagesCache[activeChatJid];
      loadChatMessages(activeChatJid);
      loadChats();
    } else {
      const errData = await response.json();
      showToast(errData.error || t('chats.message_send_failed'), 'danger');
    }
  } catch (e) {
    showToast(t('chats.network_error_send'), 'danger');
  }
}

async function openChatInfoDrawer() {
  if (!activeChatJid) return;
  const drawer = document.getElementById('chat-info-drawer');
  const body = document.getElementById('drawer-body-content');
  if (!drawer || !body) return;

  drawer.style.display = 'flex';
  body.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> ${t('chats.loading_info')}</div>`;

  try {
    const res = await fetch(
      basePath +
        'api/chat_info?session_id=' +
        currentSession +
        '&jid=' +
        encodeURIComponent(activeChatJid)
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
    body.innerHTML = `<div class="empty-state">${t('chats.could_not_load_info')}</div>`;
  }
}

function closeChatInfoDrawer() {
  const drawer = document.getElementById('chat-info-drawer');
  if (drawer) drawer.style.display = 'none';
}

if (typeof window !== 'undefined') {
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
  window.sendChatMessage = sendChatMessage;
  window.sendInteractiveReply = sendInteractiveReply;
  window.voteOnPollOption = voteOnPollOption;
  window.navigateToModerationGroup = navigateToModerationGroup;
  window.navigateToTelegramMapping = navigateToTelegramMapping;
  window.switchNewChatTab = switchNewChatTab;
  window.createNewGroupSubmit = createNewGroupSubmit;
}
