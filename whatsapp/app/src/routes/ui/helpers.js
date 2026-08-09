// Helper functions & Toast alerts

// Global error handlers - catch and display any uncaught JS errors
window.onerror = function (message, source, lineno, colno, error) {
  console.error('💥 Uncaught error:', message, 'at', source, lineno + ':' + colno, error);
  try {
    const container = document.getElementById('toast-container');
    if (container) {
      const toast = document.createElement('div');
      toast.className = 'toast danger';
      toast.innerHTML =
        '<i class="fas fa-exclamation-circle toast-icon"></i><span>JS Error: ' +
        String(message).substring(0, 100) +
        '</span>';
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 200);
      }, 5000);
    }
  } catch (e) {
    /* ignore rendering errors in the error handler itself */
  }
};
window.addEventListener('unhandledrejection', function (event) {
  console.error('💥 Unhandled promise rejection:', event.reason);
  try {
    const container = document.getElementById('toast-container');
    if (container) {
      const toast = document.createElement('div');
      toast.className = 'toast danger';
      const msg = event.reason?.message || String(event.reason || 'Unknown rejection');
      toast.innerHTML =
        '<i class="fas fa-exclamation-circle toast-icon"></i><span>Async Error: ' +
        msg.substring(0, 100) +
        '</span>';
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 200);
      }, 5000);
    }
  } catch (e) {
    /* ignore */
  }
});

// Global fetch interceptor to auto-inject X-Auth-Token for all gateway REST endpoints
if (typeof window !== 'undefined' && window.fetch && !window._fetchAuthPatched) {
  window._fetchAuthPatched = 1;
  const _origFetch = window.fetch;
  window.fetch = function (input, init = {}) {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
    if (
      url &&
      (url.startsWith('api/') ||
        url.includes('/api/') ||
        url.startsWith('logs') ||
        url.startsWith('session') ||
        url.startsWith('mark_as_read') ||
        url.startsWith('send_message') ||
        url.startsWith('send_reaction'))
    ) {
      init = init || {};
      init.headers = init.headers || {};
      if (typeof apiToken !== 'undefined' && apiToken) {
        if (init.headers instanceof Headers) {
          if (!init.headers.has('X-Auth-Token')) init.headers.set('X-Auth-Token', apiToken);
        } else if (Array.isArray(init.headers)) {
          if (!init.headers.some(([k]) => k.toLowerCase() === 'x-auth-token')) {
            init.headers.push(['X-Auth-Token', apiToken]);
          }
        } else {
          if (!init.headers['X-Auth-Token']) init.headers['X-Auth-Token'] = apiToken;
        }
      }
    }
    return _origFetch.call(this, input, init);
  };
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'danger') icon = 'fa-exclamation-circle';
  if (type === 'warning') icon = 'fa-exclamation-triangle';

  toast.innerHTML = `<i class="fas ${icon} toast-icon"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/\n/g, ' ');
}

// Confirmation Modal
const confirmModal = document.getElementById('confirm-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalClose = document.getElementById('modal-close');
let modalResolver = null;

function showConfirm(
  title,
  msg,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  btnType = 'danger'
) {
  if (modalTitle) modalTitle.innerHTML = title;
  if (modalMessage) modalMessage.innerHTML = msg;
  if (modalConfirmBtn) {
    modalConfirmBtn.innerHTML = confirmText;
    modalConfirmBtn.className = `btn btn-${btnType} btn-sm`;
  }
  if (modalCancelBtn) {
    modalCancelBtn.innerHTML = cancelText;
  }
  if (confirmModal) confirmModal.classList.add('show');
  return new Promise((resolve) => {
    modalResolver = resolve;
  });
}

function closeConfirm(result) {
  confirmModal.classList.remove('show');
  if (modalResolver) {
    modalResolver(result);
    modalResolver = null;
  }
}

if (modalConfirmBtn) modalConfirmBtn.addEventListener('click', () => closeConfirm(true));
if (modalCancelBtn) modalCancelBtn.addEventListener('click', () => closeConfirm(false));
if (modalClose) modalClose.addEventListener('click', () => closeConfirm(false));

// Theme Management
const getInitialTheme = () => {
  const saved = localStorage.getItem('ha-whatsapp-theme');
  if (saved) return saved;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
};

const setTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ha-whatsapp-theme', theme);
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) toggleBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
};

const toggleTheme = () => {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
};

setTheme(getInitialTheme());
window.showConfirm = showConfirm;
window.toggleTheme = toggleTheme;

// Client-side i18n Engine
const initialLang = localStorage.getItem('ha-whatsapp-lang') || 'de';
let currentLang = initialLang;
let currentTranslations = {};

async function initI18n(lang = currentLang) {
  try {
    const res = await fetch(`api/i18n/translations/${lang}`);
    const data = await res.json();
    if (data.success && data.dictionary) {
      currentTranslations = data.dictionary;
      currentLang = lang;
      window.currentTranslations = currentTranslations;
      window.currentLang = currentLang;
      localStorage.setItem('ha-whatsapp-lang', lang);
      document.documentElement.setAttribute('lang', lang);
      applyI18nDOM();
    }
  } catch (err) {
    console.warn('Failed to load i18n translations:', err);
  }
}

function t(keyPath, params = {}) {
  const keys = keyPath.split('.');
  let val = window.currentTranslations;
  for (const k of keys) {
    if (val && typeof val === 'object' && k in val) {
      val = val[k];
    } else {
      val = null;
      break;
    }
  }

  if (typeof val !== 'string') {
    return keyPath;
  }

  let text = val;
  for (const [pKey, pVal] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
  }
  return text;
}

function applyI18nDOM() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });
}

async function setAppLanguage(lang) {
  await initI18n(lang);
  showToast(t('common.save') + ` (${lang.toUpperCase()})`, 'success');
}

window.t = t;
window.initI18n = initI18n;
window.setAppLanguage = setAppLanguage;
window.currentLang = currentLang;
window.currentTranslations = currentTranslations;

// Auto-initialize i18n on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initI18n());
  } else {
    initI18n();
  }
}

