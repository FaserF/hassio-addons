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

function showConfirm(title, msg, confirmText = 'Confirm', cancelText = 'Cancel', btnType = 'danger') {
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
