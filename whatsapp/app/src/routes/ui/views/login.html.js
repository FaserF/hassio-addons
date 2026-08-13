export default function loginView() {
  return `<!DOCTYPE html>
<html lang="de" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title data-i18n="login.title">Anmeldung - WhatsApp Gateway</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💬</text></svg>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
    <link rel="stylesheet" href="ui-assets/styles.css">
    <style>
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: var(--bg-main, #0f172a);
        margin: 0;
        padding: 20px;
        font-family: 'Plus Jakarta Sans', sans-serif;
      }
      .login-card {
        background: var(--bg-card, #1e293b);
        border: 1px solid var(--border-color, #334155);
        border-radius: 16px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
        width: 100%;
        max-width: 420px;
        padding: 32px;
      }
      .login-header {
        text-align: center;
        margin-bottom: 24px;
      }
      .login-logo {
        width: 64px;
        height: 64px;
        background: rgba(37, 211, 102, 0.15);
        color: #25d366;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        margin-bottom: 16px;
      }
      .login-title {
        font-size: 22px;
        font-weight: 700;
        color: var(--text-main, #f8fafc);
        margin: 0 0 6px 0;
      }
      .login-subtitle {
        font-size: 13px;
        color: var(--text-muted, #94a3b8);
        margin: 0;
      }
      .form-group {
        margin-bottom: 20px;
      }
      .form-label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-main, #e2e8f0);
        margin-bottom: 8px;
      }
      .form-input {
        width: 100%;
        padding: 12px 16px;
        border-radius: 10px;
        border: 1px solid var(--border-color, #334155);
        background: var(--bg-input, #0f172a);
        color: var(--text-main, #f8fafc);
        font-size: 15px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.2s;
      }
      .form-input:focus {
        border-color: #25d366;
      }
      .otp-inputs {
        display: flex;
        gap: 8px;
        justify-content: center;
      }
      .otp-digit {
        width: 48px;
        height: 54px;
        text-align: center;
        font-size: 22px;
        font-weight: 700;
        border-radius: 10px;
        border: 1px solid var(--border-color, #334155);
        background: var(--bg-input, #0f172a);
        color: #25d366;
        outline: none;
      }
      .otp-digit:focus {
        border-color: #25d366;
      }
      .btn-login {
        width: 100%;
        padding: 14px;
        border-radius: 10px;
        border: none;
        background: #25d366;
        color: #000;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .btn-login:hover {
        background: #20bd5a;
      }
      .btn-login:active {
        transform: scale(0.98);
      }
      .alert {
        padding: 12px 16px;
        border-radius: 10px;
        font-size: 13px;
        margin-bottom: 20px;
        display: none;
      }
      .alert-danger {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
      }
      .alert-info {
        background: rgba(59, 130, 246, 0.15);
        border: 1px solid rgba(59, 130, 246, 0.3);
        color: #93c5fd;
      }
      .hint-text {
        font-size: 12px;
        color: var(--text-muted, #94a3b8);
        margin-top: 6px;
        line-height: 1.4;
      }
      .step-2 {
        display: none;
      }
    </style>
</head>
<body>
  <div class="login-card">
    <div class="login-header">
      <div class="login-logo">
        <i class="fab fa-whatsapp"></i>
      </div>
      <h1 class="login-title" data-i18n="login.app_name">WhatsApp Gateway</h1>
      <p class="login-subtitle" data-i18n="login.subtitle">Mit Telefonnummer anmelden (2FA)</p>
    </div>

    <div id="alert-msg" class="alert"></div>

    <!-- Step 1: Request OTP Code -->
    <div id="step-1">
      <form id="request-form" onsubmit="requestOtp(event)">
        <div class="form-group">
          <label class="form-label" for="phone-input" data-i18n="login.phone_label">Telefonnummer</label>
          <input type="tel" id="phone-input" class="form-input" placeholder="e.g. 4917612345678" required autocomplete="tel">
          <p class="hint-text" data-i18n="login.phone_hint">Inklusive Landesvorwahl ohne + oder Leerzeichen (z. B. 4917612345678 für Deutschland).</p>
        </div>
        <button type="submit" id="btn-request" class="btn-login">
          <i class="fas fa-paper-plane"></i> <span data-i18n="login.send_code">Code per WhatsApp senden</span>
        </button>
      </form>
    </div>

    <!-- Step 2: Verify OTP Code -->
    <div id="step-2" class="step-2">
      <form id="verify-form" onsubmit="verifyOtp(event)">
        <div class="form-group">
          <label class="form-label" data-i18n="login.otp_label">6-stelliger Anmeldecode</label>
          <div class="otp-inputs">
            <input type="text" maxlength="1" class="otp-digit" id="otp-1" autofocus>
            <input type="text" maxlength="1" class="otp-digit" id="otp-2">
            <input type="text" maxlength="1" class="otp-digit" id="otp-3">
            <input type="text" maxlength="1" class="otp-digit" id="otp-4">
            <input type="text" maxlength="1" class="otp-digit" id="otp-5">
            <input type="text" maxlength="1" class="otp-digit" id="otp-6">
          </div>
          <p class="hint-text" data-i18n="login.otp_hint">Wir haben einen 6-stelligen Code an deine WhatsApp Nummer geschickt.</p>
        </div>
        <button type="submit" id="btn-verify" class="btn-login">
          <i class="fas fa-sign-in-alt"></i> <span data-i18n="login.submit">Anmelden</span>
        </button>
        <button type="button" onclick="backToStep1()" class="btn-login" style="background: transparent; border: 1px solid var(--border-color, #334155); color: var(--text-muted, #94a3b8); margin-top: 10px;">
          <i class="fas fa-arrow-left"></i> <span data-i18n="login.use_different_number">Andere Nummer verwenden</span>
        </button>
      </form>
    </div>
  </div>

  <script>
    let targetPhone = '';

    const otpDigits = document.querySelectorAll('.otp-digit');
    otpDigits.forEach((digit, idx) => {
      digit.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && idx < otpDigits.length - 1) {
          otpDigits[idx + 1].focus();
        }
      });
      digit.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && idx > 0) {
          otpDigits[idx - 1].focus();
        }
      });
    });

    function showAlert(msg, type = 'danger') {
      const el = document.getElementById('alert-msg');
      el.className = 'alert alert-' + type;
      el.innerText = msg;
      el.style.display = 'block';
    }

    function hideAlert() {
      document.getElementById('alert-msg').style.display = 'none';
    }

    async function requestOtp(e) {
      e.preventDefault();
      hideAlert();
      const phoneInput = document.getElementById('phone-input');
      targetPhone = phoneInput.value.trim().replace(/\\D/g, '');

      if (!targetPhone || targetPhone.length < 7) {
        showAlert('Bitte eine gültige Telefonnummer eingeben.');
        return;
      }

      const btn = document.getElementById('btn-request');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Senden...';

      try {
        const res = await fetch('/api/auth/request-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: targetPhone })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          showAlert('Code wurde gesendet! Bitte prüfe dein WhatsApp.', 'info');
          document.getElementById('step-1').style.display = 'none';
          document.getElementById('step-2').style.display = 'block';
          document.getElementById('otp-1').focus();
        } else {
          showAlert(data.message || 'Fehler beim Senden des Codes.');
        }
      } catch (err) {
        showAlert('Netzwerkfehler. Bitte erneut versuchen.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Code per WhatsApp senden';
      }
    }

    async function verifyOtp(e) {
      e.preventDefault();
      hideAlert();

      let code = '';
      otpDigits.forEach(d => code += d.value.trim());

      if (code.length !== 6) {
        showAlert('Bitte den 6-stelligen Code vollständig eingeben.');
        return;
      }

      const btn = document.getElementById('btn-verify');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Prüfen...';

      try {
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: targetPhone, code })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          document.cookie = "wa_session=" + data.sessionToken + "; path=/; max-age=86400";
          window.location.href = '/';
        } else {
          showAlert(data.message || 'Ungültiger Code.');
        }
      } catch (err) {
        showAlert('Netzwerkfehler. Bitte erneut versuchen.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Anmelden';
      }
    }

    function backToStep1() {
      hideAlert();
      document.getElementById('step-2').style.display = 'none';
      document.getElementById('step-1').style.display = 'block';
      otpDigits.forEach(d => d.value = '');
    }
  </script>
</body>
</html>`;
}
