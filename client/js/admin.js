document.addEventListener('DOMContentLoaded', async function () {
  'use strict';

  var loadingEl = document.getElementById('adminLoading');
  var pageEl = document.getElementById('adminPage');
  var currentSection = 'dashboard';
  var allRegistrations = [];
  var allUsers = [];
  var allEvents = [];

  try {
    var res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    var data = await res.json();
    var user = data.user || data;

    if (!data.success && !data.user) {
      window.location.href = 'login.html';
      return;
    }
    if (user.role !== 'admin') {
      window.location.href = 'dashboard.html';
      return;
    }

    var initials = (user.displayName || user.username || 'A').charAt(0).toUpperCase();
    document.getElementById('adminAvatar').textContent = initials;
    document.getElementById('adminName').textContent = user.displayName || user.username || 'Admin';
    document.getElementById('adminRole').textContent = 'Administrator';

    if (loadingEl) loadingEl.style.display = 'none';
    if (pageEl) pageEl.style.display = 'flex';

    setupSidebar();
    setupLogout();
    setupModal();
    navigateTo(getHash() || 'dashboard');
    loadDashboard();

  } catch (err) {
    window.location.href = 'login.html';
  }

  function getHash() {
    var h = window.location.hash.replace('#', '');
    return h || 'dashboard';
  }

  function setupSidebar() {
    var items = document.querySelectorAll('.sidebar-nav-item[data-section]');
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

    var toggle = document.getElementById('sidebarToggle');
    var sidebar = document.getElementById('adminSidebar');
    var overlay = document.getElementById('sidebarOverlay');

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

    document.querySelectorAll('.admin-section').forEach(function (s) {
      s.style.display = 'none';
    });
    var target = document.getElementById('section-' + section);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.sidebar-nav-item').forEach(function (item) {
      item.classList.remove('active');
      if (item.getAttribute('data-section') === section) {
        item.classList.add('active');
      }
    });

    var titles = {
      dashboard: 'Dashboard',
      registrations: 'Registrations',
      users: 'Users',
      events: 'Events',
      checkin: 'Check-in'
    };
    document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';

    if (section === 'dashboard') loadDashboard();
    else if (section === 'registrations') loadRegistrations();
    else if (section === 'users') loadUsers();
    else if (section === 'events') loadEvents();
    else if (section === 'checkin') loadCheckin();
  }

  function setupLogout() {
    var btn = document.getElementById('adminLogoutBtn');
    if (btn) {
      btn.addEventListener('click', async function () {
        try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_e) {}
        window.location.href = 'index.html';
      });
    }
  }

  /* ═══ DASHBOARD ═══ */
  async function loadDashboard() {
    var stats = { total: 0, checkedIn: 0, pending: 0, contestants: 0 };

    try {
      var res = await fetch('/api/admin/stats', { credentials: 'same-origin' });
      var data = await res.json();
      if (data.success && data.stats) {
        stats = data.stats;
      }
    } catch (_e) {
      try {
        var regRes = await fetch('/api/registrations/all', { credentials: 'same-origin' });
        var regData = await regRes.json();
        if (regData.success && Array.isArray(regData.data)) {
          allRegistrations = regData.data;
          stats.total = allRegistrations.length;
          stats.checkedIn = allRegistrations.filter(function (r) { return r.checkedIn; }).length;
          stats.pending = stats.total - stats.checkedIn;
          stats.contestants = allRegistrations.filter(function (r) { return r.category === 'Contestant'; }).length;
        }
      } catch (_e2) {}
    }

    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statCheckedIn').textContent = stats.checkedIn;
    document.getElementById('statPending').textContent = stats.pending;
    document.getElementById('statContestants').textContent = stats.contestants;
    document.getElementById('regCount').textContent = stats.total;
    document.getElementById('pendingBadge').textContent = stats.pending;
  }

  /* ═══ REGISTRATIONS ═══ */
  async function loadRegistrations() {
    try {
      var res = await fetch('/api/registrations/all', { credentials: 'same-origin' });
      var data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        allRegistrations = data.data;
      }
    } catch (_e) {}

    renderRegistrations(allRegistrations);
  }

  function renderRegistrations(regs) {
    var tbody = document.getElementById('regTableBody');
    if (!tbody) return;

    if (regs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400);">No registrations found.</td></tr>';
      return;
    }

    tbody.innerHTML = regs.map(function (r) {
      var statusBadge = r.paymentStatus === 'verified' || r.paymentStatus === 'approved'
        ? '<span class="badge badge-green">Verified</span>'
        : '<span class="badge badge-yellow">Pending</span>';
      var checkinBadge = r.checkedIn
        ? '<span class="badge badge-green">Checked In</span>'
        : '<span class="badge badge-yellow">Not Checked</span>';

      return '<tr>' +
        '<td><strong>' + escapeHtml(r.regId || '') + '</strong></td>' +
        '<td>' + escapeHtml((r.firstName || '') + ' ' + (r.lastName || '')) + '</td>' +
        '<td>' + escapeHtml(r.email || '') + '</td>' +
        '<td><span class="badge badge-blue">' + escapeHtml(r.category || 'Spectator') + '</span></td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' + checkinBadge + '</td>' +
        '<td>' +
          '<div class="cell-actions">' +
            '<button class="action-btn" title="Toggle check-in" onclick="adminApp.toggleCheckin(\'' + escapeAttr(r.regId) + '\')">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' +
            '</button>' +
            '<button class="action-btn" title="Verify payment" onclick="adminApp.verifyPayment(\'' + escapeAttr(r.regId) + '\')">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  var regSearch = document.getElementById('regSearch');
  if (regSearch) {
    regSearch.addEventListener('input', function () {
      var q = this.value.toLowerCase();
      var filtered = allRegistrations.filter(function (r) {
        return (r.regId || '').toLowerCase().includes(q) ||
          ((r.firstName || '') + ' ' + (r.lastName || '')).toLowerCase().includes(q) ||
          (r.email || '').toLowerCase().includes(q) ||
          (r.category || '').toLowerCase().includes(q);
      });
      renderRegistrations(filtered);
    });
  }

  /* ═══ USERS ═══ */
  async function loadUsers() {
    try {
      var res = await fetch('/api/admin/users', { credentials: 'same-origin' });
      var data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        allUsers = data.data;
      }
    } catch (_e) {}

    renderUsers(allUsers);
  }

  function renderUsers(users) {
    var tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray-400);">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(function (u) {
      var initials = (u.displayName || u.username || u.email || '?').charAt(0).toUpperCase();
      var roleBadge = u.role === 'admin'
        ? '<span class="badge badge-gold">Admin</span>'
        : '<span class="badge badge-blue">User</span>';
      var joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

      return '<tr>' +
        '<td>' +
          '<div class="cell-user">' +
            '<div class="user-thumb">' + escapeHtml(initials) + '</div>' +
            '<div><div class="user-name">' + escapeHtml(u.displayName || u.username || 'User') + '</div></div>' +
          '</div>' +
        '</td>' +
        '<td>' + escapeHtml(u.email || '') + '</td>' +
        '<td>' + roleBadge + '</td>' +
        '<td>' + joined + '</td>' +
        '<td>' +
          '<div class="cell-actions">' +
            '<button class="action-btn" title="Toggle admin role" onclick="adminApp.toggleRole(\'' + escapeAttr(u._id || u.id || '') + '\', \'' + escapeAttr(u.role || 'user') + '\')">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  var userSearch = document.getElementById('userSearch');
  if (userSearch) {
    userSearch.addEventListener('input', function () {
      var q = this.value.toLowerCase();
      var filtered = allUsers.filter(function (u) {
        return (u.displayName || '').toLowerCase().includes(q) ||
          (u.username || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q);
      });
      renderUsers(filtered);
    });
  }

  /* ═══ EVENTS ═══ */
  async function loadEvents() {
    try {
      var res = await fetch('/api/admin/events', { credentials: 'same-origin' });
      var data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        allEvents = data.data;
      }
    } catch (_e) {}

    if (allEvents.length === 0) {
      allEvents = [
        { name: 'Voices & Visions Festival 2026', date: '2026-08-15', location: 'Lagos Conference Centre', status: 'upcoming' }
      ];
    }

    renderEvents(allEvents);
  }

  function renderEvents(events) {
    var tbody = document.getElementById('eventTableBody');
    if (!tbody) return;

    if (events.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray-400);">No events found.</td></tr>';
      return;
    }

    tbody.innerHTML = events.map(function (ev) {
      var statusBadge = ev.status === 'upcoming'
        ? '<span class="badge badge-blue">Upcoming</span>'
        : ev.status === 'active'
          ? '<span class="badge badge-green">Active</span>'
          : '<span class="badge badge-yellow">Past</span>';
      var dateStr = ev.date ? new Date(ev.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

      return '<tr>' +
        '<td><strong>' + escapeHtml(ev.name || '') + '</strong></td>' +
        '<td>' + dateStr + '</td>' +
        '<td>' + escapeHtml(ev.location || '') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' +
          '<div class="cell-actions">' +
            '<button class="action-btn" title="Edit event" onclick="adminApp.editEvent(\'' + escapeAttr(ev._id || ev.id || '') + '\')">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>' +
            '</button>' +
            '<button class="action-btn action-danger" title="Delete event" onclick="adminApp.deleteEvent(\'' + escapeAttr(ev._id || ev.id || '') + '\')">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  var addEventBtn = document.getElementById('addEventBtn');
  if (addEventBtn) {
    addEventBtn.addEventListener('click', function () {
      openModal('Add Event',
        '<div class="form-group"><label for="eventName">Event Name</label><input type="text" id="eventName" placeholder="Event name"></div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label for="eventDate">Date</label><input type="date" id="eventDate"></div>' +
          '<div class="form-group"><label for="eventLocation">Location</label><input type="text" id="eventLocation" placeholder="Venue"></div>' +
        '</div>',
        '<button class="btn btn-outline btn-sm" id="modalCancelBtn">Cancel</button>' +
        '<button class="btn btn-primary btn-sm" id="modalSaveBtn">Save Event</button>'
      );

      document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
      document.getElementById('modalSaveBtn').addEventListener('click', function () {
        var name = document.getElementById('eventName').value.trim();
        var date = document.getElementById('eventDate').value;
        var location = document.getElementById('eventLocation').value.trim();

        if (!name) {
          showToast('Event name is required.', 'error');
          return;
        }

        allEvents.push({ name: name, date: date, location: location, status: 'upcoming' });
        renderEvents(allEvents);
        closeModal();
        showToast('Event added successfully!');
      });
    });
  }

  /* ═══ CHECK-IN ═══ */
  async function loadCheckin() {
    if (allRegistrations.length === 0) {
      try {
        var res = await fetch('/api/registrations/all', { credentials: 'same-origin' });
        var data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          allRegistrations = data.data;
        }
      } catch (_e) {}
    }

    renderCheckinTable(allRegistrations);
  }

  function renderCheckinTable(regs) {
    var tbody = document.getElementById('checkinTableBody');
    if (!tbody) return;

    if (regs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray-400);">No registrations found.</td></tr>';
      return;
    }

    tbody.innerHTML = regs.map(function (r) {
      var checkinBadge = r.checkedIn
        ? '<span class="badge badge-green">Checked In</span>'
        : '<span class="badge badge-yellow">Pending</span>';
      var btnLabel = r.checkedIn ? 'Undo' : 'Check In';
      var btnClass = r.checkedIn ? 'btn btn-sm btn-outline' : 'btn btn-sm btn-primary';

      return '<tr>' +
        '<td><strong>' + escapeHtml(r.regId || '') + '</strong></td>' +
        '<td>' + escapeHtml((r.firstName || '') + ' ' + (r.lastName || '')) + '</td>' +
        '<td><span class="badge badge-blue">' + escapeHtml(r.category || 'Spectator') + '</span></td>' +
        '<td>' + checkinBadge + '</td>' +
        '<td><button class="' + btnClass + '" onclick="adminApp.toggleCheckin(\'' + escapeAttr(r.regId) + '\')">' + btnLabel + '</button></td>' +
      '</tr>';
    }).join('');
  }

  var checkinSearch = document.getElementById('checkinSearch');
  if (checkinSearch) {
    checkinSearch.addEventListener('input', function () {
      var q = this.value.toLowerCase();
      var filtered = allRegistrations.filter(function (r) {
        return (r.regId || '').toLowerCase().includes(q) ||
          ((r.firstName || '') + ' ' + (r.lastName || '')).toLowerCase().includes(q);
      });
      renderCheckinTable(filtered);
    });
  }

  var manualCheckinBtn = document.getElementById('manualCheckinBtn');
  if (manualCheckinBtn) {
    manualCheckinBtn.addEventListener('click', function () {
      var input = document.getElementById('manualRegId');
      var id = (input.value || '').trim().toUpperCase();
      var resultEl = document.getElementById('checkinResult');

      if (!id) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = '<div class="badge badge-red" style="padding:8px 12px;">Please enter a Registration ID.</div>';
        return;
      }

      var reg = allRegistrations.find(function (r) { return r.regId === id; });
      if (!reg) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = '<div class="badge badge-red" style="padding:8px 12px;">Registration not found: ' + escapeHtml(id) + '</div>';
        return;
      }

      if (!reg.checkedIn) {
        reg.checkedIn = true;
        reg.checkedInTime = new Date().toISOString();
        resultEl.style.display = 'block';
        resultEl.innerHTML = '<div class="badge badge-green" style="padding:8px 12px;">' + escapeHtml(reg.firstName + ' ' + reg.lastName) + ' checked in successfully!</div>';
      } else {
        resultEl.style.display = 'block';
        resultEl.innerHTML = '<div class="badge badge-yellow" style="padding:8px 12px;">' + escapeHtml(reg.firstName + ' ' + reg.lastName) + ' is already checked in.</div>';
      }

      input.value = '';
      renderCheckinTable(allRegistrations);
      loadDashboard();
    });
  }

  /* ═══ MODAL ═══ */
  function setupModal() {
    var overlay = document.getElementById('modalOverlay');
    var closeBtn = document.getElementById('modalClose');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeModal();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  function openModal(title, bodyHtml, footerHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml || '';
    document.getElementById('modalOverlay').classList.add('active');
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
  }

  /* ═══ PUBLIC API ═══ */
  window.adminApp = {
    toggleCheckin: function (regId) {
      var reg = allRegistrations.find(function (r) { return r.regId === regId; });
      if (!reg) return;

      reg.checkedIn = !reg.checkedIn;
      reg.checkedInTime = reg.checkedIn ? new Date().toISOString() : null;

      var label = reg.checkedIn ? 'checked in' : 'check-in removed';
      showToast(reg.firstName + ' ' + reg.lastName + ' ' + label);

      renderRegistrations(allRegistrations);
      renderCheckinTable(allRegistrations);
      loadDashboard();
    },

    verifyPayment: function (regId) {
      var reg = allRegistrations.find(function (r) { return r.regId === regId; });
      if (!reg) return;

      reg.paymentStatus = 'verified';
      showToast(reg.firstName + ' ' + reg.lastName + ' payment verified!');
      renderRegistrations(allRegistrations);
    },

    toggleRole: function (userId, currentRole) {
      var newRole = currentRole === 'admin' ? 'user' : 'admin';
      var user = allUsers.find(function (u) { return (u._id || u.id) === userId; });
      if (user) {
        user.role = newRole;
        showToast('Role changed to ' + newRole);
        renderUsers(allUsers);
      }
    },

    editEvent: function (eventId) {
      var ev = allEvents.find(function (e) { return (e._id || e.id) === eventId; });
      if (!ev) return;

      openModal('Edit Event',
        '<div class="form-group"><label for="editEventName">Event Name</label><input type="text" id="editEventName" value="' + escapeAttr(ev.name || '') + '"></div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label for="editEventDate">Date</label><input type="date" id="editEventDate" value="' + escapeAttr(ev.date || '') + '"></div>' +
          '<div class="form-group"><label for="editEventLocation">Location</label><input type="text" id="editEventLocation" value="' + escapeAttr(ev.location || '') + '"></div>' +
        '</div>',
        '<button class="btn btn-outline btn-sm" id="modalCancelBtn">Cancel</button>' +
        '<button class="btn btn-primary btn-sm" id="modalSaveBtn">Save Changes</button>'
      );

      document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
      document.getElementById('modalSaveBtn').addEventListener('click', function () {
        ev.name = document.getElementById('editEventName').value.trim();
        ev.date = document.getElementById('editEventDate').value;
        ev.location = document.getElementById('editEventLocation').value.trim();
        renderEvents(allEvents);
        closeModal();
        showToast('Event updated!');
      });
    },

    deleteEvent: function (eventId) {
      if (!confirm('Are you sure you want to delete this event?')) return;
      allEvents = allEvents.filter(function (e) { return (e._id || e.id) !== eventId; });
      renderEvents(allEvents);
      showToast('Event deleted.');
    }
  };

  /* ═══ UTILITIES ═══ */
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
