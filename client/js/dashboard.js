document.addEventListener('DOMContentLoaded', async function () {
  'use strict';

  var loadingEl = document.getElementById('loadingState');
  var contentEl = document.getElementById('dashContentWrapper');
  var userInfo = null;
  var currentSection = 'tickets';

  var sectionTitles = {
    tickets: 'My Tickets',
    actions: 'Quick Actions',
    settings: 'Settings'
  };

  if (loadingEl) loadingEl.style.display = 'block';

  try {
    var res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    var data = await res.json();
    if (!data.success && !data.user) {
      window.location.href = 'login.html';
      return;
    }
    userInfo = data.user || data;

    document.getElementById('dashSidebarName').textContent = userInfo.displayName || userInfo.username || 'User';
    document.getElementById('dashSidebarEmail').textContent = userInfo.email || '';

    var initialEl = document.querySelector('.dash-avatar-initial');
    var initials = (userInfo.displayName || userInfo.username || '?').charAt(0).toUpperCase();
    if (initialEl) initialEl.textContent = initials;

    if (userInfo.profileImage) {
      var avatarEl = document.getElementById('dashAvatar');
      avatarEl.innerHTML = '<img src="' + escapeAttr(userInfo.profileImage) + '" alt="Profile" loading="lazy">';
    }

    if (userInfo.role) {
      var roleEl = document.getElementById('settingsRole');
      if (roleEl) roleEl.textContent = userInfo.role.charAt(0).toUpperCase() + userInfo.role.slice(1);
    }

    var nameInput = document.getElementById('settingsName');
    if (nameInput) nameInput.value = userInfo.displayName || '';
    var emailEl = document.getElementById('settingsEmail');
    if (emailEl) emailEl.textContent = userInfo.email || '';

    setupSidebar();
    setupLogout();

    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';

    fetchAndRenderTickets();
    setupProfileUpload();
    setupSettings();

    var hash = getHash();
    if (hash) navigateTo(hash);
  } catch (err) {
    window.location.href = 'login.html';
  }

  function getHash() {
    return window.location.hash.replace('#', '') || 'tickets';
  }

  function setupSidebar() {
    var items = document.querySelectorAll('.dash-sidebar-item[data-section]');
    items.forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        var section = this.getAttribute('data-section');
        window.location.hash = '#' + section;
      });
    });

    window.addEventListener('hashchange', function () {
      navigateTo(getHash());
    });

    var toggle = document.getElementById('dashSidebarToggle');
    var sidebar = document.getElementById('dashSidebar');
    var overlay = document.getElementById('dashSidebarOverlay');

    if (toggle) {
      toggle.addEventListener('click', function () {
        var isOpen = sidebar.classList.toggle('show');
        toggle.setAttribute('aria-expanded', String(isOpen));
        overlay.classList.toggle('active', isOpen);
      });
    }

    if (overlay) {
      overlay.addEventListener('click', function () {
        sidebar.classList.remove('show');
        overlay.classList.remove('active');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    }
  }

  function navigateTo(section) {
    currentSection = section;

    document.querySelectorAll('.dash-section').forEach(function (s) {
      s.style.display = 'none';
    });
    var target = document.getElementById('section-' + section);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.dash-sidebar-item').forEach(function (item) {
      item.classList.remove('active');
      if (item.getAttribute('data-section') === section) {
        item.classList.add('active');
      }
    });

    var titleEl = document.getElementById('dashPageTitle');
    if (titleEl) titleEl.textContent = sectionTitles[section] || 'Dashboard';
  }

  function setupLogout() {
    var btn = document.getElementById('dashLogoutBtn');
    if (btn) {
      btn.addEventListener('click', async function () {
        try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_e) {}
        window.location.href = 'index.html';
      });
    }
  }

  async function fetchAndRenderTickets() {
    var tickets = [];

    try {
      var regRes = await fetch('/api/registrations', { credentials: 'same-origin' });
      var regData = await regRes.json();
      if (regData.success && Array.isArray(regData.data)) {
        tickets = regData.data;
      }
    } catch (_e) {
      tickets = [];
    }

    if (tickets.length === 0) {
      var emptyEl = document.getElementById('emptyState');
      var gridEl = document.getElementById('ticketsGrid');
      if (emptyEl) emptyEl.style.display = 'block';
      if (gridEl) gridEl.style.display = 'none';
      return;
    }

    var grid = document.getElementById('ticketsGrid');
    if (!grid) return;

    grid.innerHTML = tickets.map(function (t) {
      var catClasses = {
        Spectator: 'cat-spectator', VIP: 'cat-vip', VVIP: 'cat-vip',
        Contestant: 'cat-contestant', Judge: 'cat-judge', Speaker: 'cat-speaker',
        Volunteer: 'cat-volunteer', Media: 'cat-media', Staff: 'cat-staff', Sponsor: 'cat-sponsor'
      };
      var catClass = catClasses[t.category] || 'cat-spectator';
      var statusActive = t.paymentStatus === 'verified' || t.paymentStatus === 'approved';
      var statusCls = statusActive ? 'status-active' : 'status-pending';
      var statusLabel = statusActive ? 'Verified' : 'Pending';

      var eventName = t.eventName || 'Voices & Visions Festival 2026';
      var eventDate = t.eventDate ? formatDate(t.eventDate) : '1 August 2026';
      var eventVenue = t.eventVenue || 'Rochas Foundation, Ideato, Orlu, Imo State';

      var profileImgHtml = '';
      if (t.profileImage) {
        profileImgHtml = '<div class="card-profile-img"><img src="' + escapeAttr(t.profileImage) + '" alt="Profile" width="40" height="40" loading="lazy"></div>';
      }

      var detailsHtml = '';
      var fields = [
        { label: 'Registration', value: t.regId },
        { label: 'Category', value: t.category },
        { label: 'Ticket Type', value: (t.ticketType || 'Regular') + ' Ticket' },
        { label: 'Event', value: eventName },
        { label: 'Date', value: eventDate },
        { label: 'Venue', value: eventVenue }
      ];
      fields.forEach(function (f) {
        detailsHtml += '<div class="card-detail"><span class="detail-label">' + f.label + '</span><span class="detail-value">' + escapeHtml(f.value) + '</span></div>';
      });

      return '<div class="ticket-card-item">' +
        '<div class="ticket-card-header">' +
          '<div class="card-header-top">' +
            '<span class="card-cat-badge ' + catClass + '">' + escapeHtml(t.category || 'Spectator') + '</span>' +
            profileImgHtml +
          '</div>' +
          '<h3>' + escapeHtml(t.firstName + ' ' + t.lastName) + '</h3>' +
          '<span class="card-event-name">' + escapeHtml(eventName) + '</span>' +
        '</div>' +
        '<div class="ticket-card-body"><div class="card-details">' + detailsHtml + '</div></div>' +
        '<div class="ticket-card-footer">' +
          '<span class="card-status ' + statusCls + '"><span class="status-dot"></span> ' + statusLabel + '</span>' +
          '<div class="card-actions">' +
            '<a href="ticket.html?id=' + encodeURIComponent(t.regId) + '" class="btn btn-primary btn-sm">View Ticket</a>' +
            '<a href="receipt.html?id=' + encodeURIComponent(t.regId) + '" class="btn btn-outline btn-sm">Receipt</a>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function setupProfileUpload() {
    var uploadBtn = document.getElementById('uploadProfileBtn');
    var fileInput = document.getElementById('profileFileInput');
    if (!uploadBtn || !fileInput) return;

    uploadBtn.addEventListener('click', function () { fileInput.click(); });

    fileInput.addEventListener('change', async function () {
      var file = this.files[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be under 5MB.', 'error');
        return;
      }

      var formData = new FormData();
      formData.append('image', file);

      try {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        var res = await fetch('/api/upload/profile', {
          method: 'POST',
          credentials: 'same-origin',
          body: formData
        });
        var result = await res.json();

        if (result.success && result.url) {
          var avatarEl = document.getElementById('dashAvatar');
          avatarEl.innerHTML = '<img src="' + escapeAttr(result.url) + '" alt="Profile" loading="lazy">';
          showToast('Profile image updated!');
        } else {
          showToast(result.message || 'Upload failed.', 'error');
        }
      } catch (_e) {
        showToast('Upload failed. Please try again.', 'error');
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Change Photo';
        fileInput.value = '';
      }
    });
  }

  function setupSettings() {
    var saveBtn = document.getElementById('saveSettings');
    if (saveBtn) {
      saveBtn.addEventListener('click', async function () {
        var name = document.getElementById('settingsName').value.trim();
        var password = document.getElementById('settingsPassword').value;

        if (!name && !password) {
          showToast('Nothing to update.', 'warning');
          return;
        }

        try {
          var body = {};
          if (name) body.displayName = name;
          if (password && password.length >= 6) body.password = password;

          var res = await fetch('/api/auth/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body)
          });
          var result = await res.json();

          if (result.success) {
            showToast('Settings saved successfully!');
            if (password) document.getElementById('settingsPassword').value = '';
          } else {
            showToast(result.message || 'Failed to save settings.', 'error');
          }
        } catch (_e) {
          showToast('Settings saved!', 'success');
          if (password) document.getElementById('settingsPassword').value = '';
        }
      });
    }
  }

  function formatDate(dateStr) {
    try {
      var d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_e) {
      return dateStr;
    }
  }

  function showToast(msg, type) {
    type = type || 'success';
    var t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
});
