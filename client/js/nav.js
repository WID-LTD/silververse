(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);

  var NAV_PAGES = [
    { label: 'Home', href: 'index.html' },
    { label: 'About', href: 'about.html' },
    { label: 'Events', href: 'events.html' },
    { label: 'Contestants', href: 'contestants.html' },
    { label: 'Videos', href: 'videos.html' },
    { label: 'Blog', href: 'blog.html' },
    { label: 'Contact', href: 'contact.html' },
  ];

  async function init() {
    renderNavLinks();
    await checkAuthState();
    setupMobileToggle();
    setupNavbarScroll();
    highlightActivePage();
    setupBackToTop();
    setupSmoothScroll();
  }

  function renderNavLinks() {
    var container = document.getElementById('navLinks');
    if (!container) return;
    var pathname = window.location.pathname.split('/').pop() || 'index.html';
    var html = '';
    NAV_PAGES.forEach(function (p) {
      var activeClass = p.href === pathname ? ' active' : '';
      html += '<li><a href="' + escapeAttr(p.href) + '" class="nav-page-link' + activeClass + '">' + escapeHtml(p.label) + '</a></li>';
    });
    container.innerHTML = html;
  }

  async function checkAuthState() {
    var authContainer = document.getElementById('navAuth');
    if (!authContainer) return;

    try {
      var res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Not authenticated');
      var data = await res.json();
      var user = data.user || data;

      var displayName = user.displayName || user.username || user.email || 'Account';
      var initial = (displayName.charAt(0) || 'U').toUpperCase();
      var profileImg = user.profileImage || '';
      var html = '';

      if (profileImg) {
        html += '<span class="nav-user-badge" title="' + escapeAttr(displayName) + '">';
        html += '<img src="' + escapeAttr(profileImg) + '" alt="" class="nav-avatar-img" width="28" height="28">';
        html += '<span class="nav-avatar-name">' + escapeHtml(displayName) + '</span></span>';
      } else {
        html += '<span class="nav-user-badge" title="' + escapeAttr(displayName) + '">';
        html += '<span class="nav-avatar-initial">' + escapeHtml(initial) + '</span>';
        html += '<span class="nav-avatar-name">' + escapeHtml(displayName) + '</span></span>';
      }
      html += '<a href="dashboard.html" class="nav-btn-gold">Dashboard</a>';

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
        '<a href="login.html" class="nav-btn-gold">Login</a>' +
        '<a href="register.html" class="nav-btn-gold">Register</a>';
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch (_err) {}
    window.location.href = 'index.html';
  }

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

    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
        links.classList.remove('show');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('click', function (e) {
      if (!toggle.contains(e.target) && !links.contains(e.target)) {
        links.classList.remove('show');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

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

  function highlightActivePage() {
    var pathname = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.navbar-links a[href]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && href === pathname) {
        link.classList.add('active');
      }
    });
  }

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

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
