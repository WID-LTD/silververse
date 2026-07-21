/* ═══════════════════════════════════════
   SilverVerse — Auth Logic
   Login, Forgot Password, Password Reset
   ═══════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // ──────────────────────────────────────
  // LOGIN PAGE
  // ──────────────────────────────────────
  var loginForm = document.getElementById('loginForm');
  var loginBtn = document.getElementById('loginBtn');

  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      handleLogin();
    });
  }

  function handleLogin() {
    var username = (document.getElementById('loginUsername') || {}).value;
    var password = (document.getElementById('loginPassword') || {}).value;

    username = username ? username.trim() : '';
    password = password || '';

    if (!username) {
      showAuthError('loginError', 'loginErrorMsg', 'Please enter your username.');
      return;
    }
    if (!password) {
      showAuthError('loginError', 'loginErrorMsg', 'Please enter your password.');
      return;
    }

    hideAuthError('loginError');
    setButtonLoading(loginBtn, true);

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username: username, password: password })
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Invalid credentials'); });
        return res.json();
      })
      .then(function (data) {
        showToast('Login successful! Redirecting...', 'success');
        var role = data.role || (data.user && data.user.role) || '';
        var dest = role === 'admin' ? 'admin.html' : 'dashboard.html';
        setTimeout(function () {
          window.location.href = dest;
        }, 800);
      })
      .catch(function (err) {
        showAuthError('loginError', 'loginErrorMsg', err.message || 'Login failed. Please try again.');
        setButtonLoading(loginBtn, false);
      });
  }

  // ──────────────────────────────────────
  // FORGOT PASSWORD — Step 1: Check Account
  // ──────────────────────────────────────
  var forgotForm = document.getElementById('forgotForm');
  var forgotCheckBtn = document.getElementById('forgotCheckBtn');

  if (forgotForm) {
    forgotForm.addEventListener('submit', function (e) {
      e.preventDefault();
      handleForgotCheck();
    });
  }

  function handleForgotCheck() {
    var username = (document.getElementById('forgotUsername') || {}).value;
    username = username ? username.trim() : '';

    if (!username) {
      showAuthError('forgotError', 'forgotErrorMsg', 'Please enter your username.');
      return;
    }

    hideAuthError('forgotError');
    setButtonLoading(forgotCheckBtn, true);

    fetch('/api/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username: username })
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Account not found'); });
        return res.json();
      })
      .then(function (data) {
        setButtonLoading(forgotCheckBtn, false);

        // Store username for the reset step
        var forgotStep1 = document.getElementById('forgotStep1');
        var forgotStep2a = document.getElementById('forgotStep2a');
        var forgotStep2b = document.getElementById('forgotStep2b');

        if (data.canReset) {
          // IP recognized — show password reset form
          forgotStep1.style.display = 'none';
          forgotStep2a.style.display = 'block';
        } else {
          // IP NOT recognized — show contact admin message
          forgotStep1.style.display = 'none';
          forgotStep2b.style.display = 'block';
        }
      })
      .catch(function (err) {
        showAuthError('forgotError', 'forgotErrorMsg', err.message || 'Could not find your account.');
        setButtonLoading(forgotCheckBtn, false);
      });
  }

  // ──────────────────────────────────────
  // FORGOT PASSWORD — Step 2a: Reset Password
  // ──────────────────────────────────────
  var resetForm = document.getElementById('resetForm');
  var resetBtn = document.getElementById('resetBtn');

  if (resetForm) {
    resetForm.addEventListener('submit', function (e) {
      e.preventDefault();
      handlePasswordReset();
    });
  }

  function handlePasswordReset() {
    var username = (document.getElementById('forgotUsername') || {}).value;
    var newPassword = (document.getElementById('newPassword') || {}).value;
    var confirmPassword = (document.getElementById('confirmPassword') || {}).value;

    username = username ? username.trim() : '';
    newPassword = newPassword || '';
    confirmPassword = confirmPassword || '';

    if (!newPassword || newPassword.length < 6) {
      showAuthError('resetError', 'resetErrorMsg', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAuthError('resetError', 'resetErrorMsg', 'Passwords do not match.');
      return;
    }

    hideAuthError('resetError');
    setButtonLoading(resetBtn, true);

    fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username: username, newPassword: newPassword })
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Reset failed'); });
        return res.json();
      })
      .then(function () {
        // Hide reset form, show success
        document.getElementById('forgotStep2a').style.display = 'none';
        document.getElementById('forgotSuccess').style.display = 'block';
        showToast('Password reset successful!', 'success');
        setTimeout(function () {
          window.location.href = 'login.html';
        }, 3000);
      })
      .catch(function (err) {
        showAuthError('resetError', 'resetErrorMsg', err.message || 'Could not reset password. Please try again.');
        setButtonLoading(resetBtn, false);
      });
  }

  // ──────────────────────────────────────
  // PASSWORD VISIBILITY TOGGLE
  // ──────────────────────────────────────
  document.querySelectorAll('.password-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var field = this.closest('.password-field');
      if (!field) return;
      var input = field.querySelector('input');
      if (!input) return;

      var isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      this.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      this.setAttribute('title', isPassword ? 'Hide password' : 'Show password');

      // Swap the eye icon
      if (isPassword) {
        this.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
      } else {
        this.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      }
    });
  });

  // ──────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────
  function showAuthError(containerId, msgId, message) {
    var container = document.getElementById(containerId);
    var msg = document.getElementById(msgId);
    if (container && msg) {
      msg.textContent = message;
      container.style.display = 'flex';
    }
  }

  function hideAuthError(containerId) {
    var container = document.getElementById(containerId);
    if (container) container.style.display = 'none';
  }

  function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    var textEl = btn.querySelector('.btn-text');
    var spinnerEl = btn.querySelector('.btn-spinner');
    if (isLoading) {
      btn.disabled = true;
      if (textEl) textEl.textContent = 'Please wait...';
      if (spinnerEl) spinnerEl.style.display = 'inline-flex';
    } else {
      btn.disabled = false;
      if (textEl) {
        // Restore original text based on button context
        if (btn.id === 'loginBtn') textEl.textContent = 'Sign In';
        else if (btn.id === 'forgotCheckBtn') textEl.textContent = 'Check Account';
        else if (btn.id === 'resetBtn') textEl.textContent = 'Reset Password';
        else textEl.textContent = 'Submit';
      }
      if (spinnerEl) spinnerEl.style.display = 'none';
    }
  }

  function showToast(message, type) {
    type = type || 'success';
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 3500);
  }
});
