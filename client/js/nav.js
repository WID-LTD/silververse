/* ═══════════════════════════════════════
   SilverVerse — Shared Navigation
   Loaded on every page
   ═══════════════════════════════════════ */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await checkAuthState();
    setupMobileToggle();
    setupNavbarScroll();
    highlightActivePage();
    setupBackToTop();
    setupSmoothScroll();
  }

  /* ── 1. Check Auth State ── */
  async function checkAuthState() {
    var authContainer = document.getElementById('navAuth');
    if (!authContainer) return;

    try {
      var res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Not authenticated');
      var data = await res.json();
      var user = data.user || data;

      var displayName = user.displayName || user.username || user.email || 'Account';
      var html = '';

      html += '<span class="nav-user-badge" title="' + escapeAttr(displayName) + '">' + escapeHtml(displayName) + '</span>';
      html += '<a href="dashboard.html">Dashboard</a>';

      if (user.role === 'admin' || user.isAdmin) {
        html += '<a href="admin.html" class="nav-admin-link">Admin</a>';
      }

      html += '<button class="nav-logout-btn" id="navLogoutBtn" aria-label="Log out">Logout</button>';

      authContainer.innerHTML = html;

      var logoutBtn = document.getElementById('navLogoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
      }
    } catch (_err) {
      authContainer.innerHTML =
        '<a href="login.html">Login</a>';
    }
  }

  /* ── 2. Logout ── */
  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch (_err) {
      // Redirect anyway
    }
    window.location.href = 'index.html';
  }

  /* ── 3. Mobile Hamburger Toggle ── */
  function setupMobileToggle() {
    var toggle = document.querySelector('.mobile-toggle');
    var links = document.getElementById('navLinks');
    if (!toggle || !links) return;

    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'navLinks');

    toggle.addEventListener('click', function () {
      var isOpen = links.classList.toggle('show');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    links.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        links.classList.remove('show');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', function (e) {
      if (!toggle.contains(e.target) && !links.contains(e.target)) {
        links.classList.remove('show');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── 4. Navbar Scroll Effect ── */
  function setupNavbarScroll() {
    var navbar = document.querySelector('.navbar');
    if (!navbar) return;

    function onScroll() {
      if (window.scrollY > 80) {
        navbar.classList.add('navbar-scrolled');
      } else {
        navbar.classList.remove('navbar-scrolled');
      }
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ── 5. Active Page Highlighting ── */
  function highlightActivePage() {
    var pathname = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.navbar-links a[href]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && href === pathname) {
        link.classList.add('active');
      }
    });
  }

  /* ── 6. Back-to-Top Button ── */
  function setupBackToTop() {
    var btn = document.getElementById('backToTop');
    if (!btn) return;

    window.addEventListener('scroll', function () {
      if (window.scrollY > 600) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    }, { passive: true });

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── 7. Smooth Scroll for Anchor Links ── */
  function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var targetId = this.getAttribute('href');
        if (!targetId || targetId === '#') return;
        var targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          var headerOffset = 80;
          var elementPosition = targetEl.getBoundingClientRect().top;
          var offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
      });
    });
  }

  /* ── Utilities ── */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
