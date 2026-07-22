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
    try {
      var res = await fetch('/api/admin/stats', { credentials: 'same-origin' });
      var data = await res.json();
      if (data.success && data.data) {
        var s = data.data;
        document.getElementById('statTotal').textContent = s.totalRegistrations || 0;
        document.getElementById('statCheckedIn').textContent = s.checkedIn || 0;
        document.getElementById('statPending').textContent = s.pending || 0;
        document.getElementById('statContestants').textContent = s.totalContestants || 0;
        var regCountEl = document.getElementById('regCount');
        if (regCountEl) regCountEl.textContent = s.totalRegistrations || 0;
        var pendingBadgeEl = document.getElementById('pendingBadge');
        if (pendingBadgeEl) pendingBadgeEl.textContent = s.pending || 0;
        var revenueEl = document.getElementById('statRevenue');
        if (revenueEl) revenueEl.textContent = '\u20A6' + Number(s.totalRevenue || 0).toLocaleString();
      }
    } catch (_e) {}
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
      var amount = r.amountPaid ? '\u20A6' + Number(r.amountPaid).toLocaleString() : '\u20A60';

      return '<tr>' +
        '<td><strong>' + escapeHtml(r.regId || '') + '</strong></td>' +
        '<td>' + escapeHtml((r.firstName || '') + ' ' + (r.lastName || '')) + '</td>' +
        '<td>' + escapeHtml(r.email || '') + '</td>' +
        '<td><span class="badge badge-blue">' + escapeHtml(r.category || 'Spectator') + '</span></td>' +
        '<td>' + amount + '</td>' +
        '<td>' + statusBadge + ' / ' + checkinBadge + '</td>' +
        '<td>' +
          '<div class="cell-actions">' +
            '<button class="action-btn" title="Toggle check-in" data-action="checkin" data-regid="' + escapeAttr(r.regId) + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' +
            '</button>' +
            '<button class="action-btn" title="Verify payment" data-action="verify" data-regid="' + escapeAttr(r.regId) + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
            '</button>' +
            '<button class="action-btn action-danger" title="Delete registration" data-action="delete-reg" data-id="' + r.id + '" data-regid="' + escapeAttr(r.regId) + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = this.getAttribute('data-action');
        var regId = this.getAttribute('data-regid');
        var id = this.getAttribute('data-id');
        if (action === 'checkin') apiToggleCheckin(regId);
        else if (action === 'verify') apiVerifyPayment(regId);
        else if (action === 'delete-reg') apiDeleteRegistration(id, regId);
      });
    });
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
      var userInitials = (u.displayName || u.username || u.email || '?').charAt(0).toUpperCase();
      var roleBadge = u.role === 'admin'
        ? '<span class="badge badge-gold">Admin</span>'
        : '<span class="badge badge-blue">' + escapeHtml(u.role || 'User') + '</span>';
      var joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '\u2014';

      return '<tr>' +
        '<td>' +
          '<div class="cell-user">' +
            '<div class="user-thumb">' + escapeHtml(userInitials) + '</div>' +
            '<div><div class="user-name">' + escapeHtml(u.displayName || u.username || 'User') + '</div></div>' +
          '</div>' +
        '</td>' +
        '<td>' + escapeHtml(u.email || '') + '</td>' +
        '<td>' + roleBadge + '</td>' +
        '<td>' + joined + '</td>' +
        '<td>' +
          '<div class="cell-actions">' +
            '<button class="action-btn" title="Toggle role" data-action="toggle-role" data-userid="' + u.id + '" data-role="' + escapeAttr(u.role || 'user') + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
            '</button>' +
            '<button class="action-btn action-danger" title="Delete user" data-action="delete-user" data-userid="' + u.id + '" data-username="' + escapeAttr(u.username) + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = this.getAttribute('data-action');
        var userId = this.getAttribute('data-userid');
        var role = this.getAttribute('data-role');
        var username = this.getAttribute('data-username');
        if (action === 'toggle-role') apiToggleRole(userId, role);
        else if (action === 'delete-user') apiDeleteUser(userId, username);
      });
    });
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
      var dateStr = ev.eventDate ? formatDate(ev.eventDate) : '\u2014';

      return '<tr>' +
        '<td><strong>' + escapeHtml(ev.name || '') + '</strong></td>' +
        '<td>' + dateStr + '</td>' +
        '<td>' + escapeHtml(ev.venue || '') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' +
          '<div class="cell-actions">' +
            '<button class="action-btn" title="Edit event" data-action="edit-event" data-eventid="' + ev.id + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>' +
            '</button>' +
            '<button class="action-btn action-danger" title="Delete event" data-action="delete-event" data-eventid="' + ev.id + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = this.getAttribute('data-action');
        var eventId = this.getAttribute('data-eventid');
        if (action === 'edit-event') editEvent(eventId);
        else if (action === 'delete-event') apiDeleteEvent(eventId);
      });
    });
  }

  var addEventBtn = document.getElementById('addEventBtn');
  if (addEventBtn) {
    addEventBtn.addEventListener('click', function () {
      openModal('Add Event',
        '<div class="form-group"><label for="eventName">Event Name</label><input type="text" id="eventName" placeholder="Event name"></div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label for="eventDate">Date</label><input type="date" id="eventDate"></div>' +
          '<div class="form-group"><label for="eventVenue">Venue</label><input type="text" id="eventVenue" placeholder="Venue"></div>' +
        '</div>',
        '<button class="btn btn-outline btn-sm" id="modalCancelBtn">Cancel</button>' +
        '<button class="btn btn-primary btn-sm" id="modalSaveBtn">Save Event</button>'
      );

      document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
      document.getElementById('modalSaveBtn').addEventListener('click', async function () {
        var name = document.getElementById('eventName').value.trim();
        var date = document.getElementById('eventDate').value;
        var venue = document.getElementById('eventVenue').value.trim();

        if (!name) {
          showToast('Event name is required.', 'error');
          return;
        }

        try {
          var res = await fetch('/api/admin/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ name, event_date: date, venue })
          });
          var result = await res.json();
          if (result.success) {
            allEvents.push(result.data);
            renderEvents(allEvents);
            closeModal();
            showToast('Event added successfully!');
          } else {
            showToast(result.message || 'Failed to add event.', 'error');
          }
        } catch (_e) {
          showToast('Failed to add event.', 'error');
        }
      });
    });
  }

  function editEvent(eventId) {
    var ev = allEvents.find(function (e) { return String(e.id) === String(eventId); });
    if (!ev) return;

    openModal('Edit Event',
      '<div class="form-group"><label for="editEventName">Event Name</label><input type="text" id="editEventName" value="' + escapeAttr(ev.name || '') + '"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label for="editEventDate">Date</label><input type="date" id="editEventDate" value="' + escapeAttr(ev.eventDate || '') + '"></div>' +
        '<div class="form-group"><label for="editEventVenue">Venue</label><input type="text" id="editEventVenue" value="' + escapeAttr(ev.venue || '') + '"></div>' +
      '</div>',
      '<button class="btn btn-outline btn-sm" id="modalCancelBtn">Cancel</button>' +
      '<button class="btn btn-primary btn-sm" id="modalSaveBtn">Save Changes</button>'
    );

    document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
    document.getElementById('modalSaveBtn').addEventListener('click', async function () {
      var name = document.getElementById('editEventName').value.trim();
      var date = document.getElementById('editEventDate').value;
      var venue = document.getElementById('editEventVenue').value.trim();

      try {
        var res = await fetch('/api/admin/events/' + eventId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ name, event_date: date, venue })
        });
        var result = await res.json();
        if (result.success) {
          var idx = allEvents.findIndex(function (e) { return String(e.id) === String(eventId); });
          if (idx !== -1) allEvents[idx] = result.data;
          renderEvents(allEvents);
          closeModal();
          showToast('Event updated!');
        } else {
          showToast(result.message || 'Failed to update.', 'error');
        }
      } catch (_e) {
        showToast('Failed to update event.', 'error');
      }
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
        '<td><button class="' + btnClass + '" data-action="checkin" data-regid="' + escapeAttr(r.regId) + '">' + btnLabel + '</button></td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-action="checkin"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        apiToggleCheckin(this.getAttribute('data-regid'));
      });
    });
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
    manualCheckinBtn.addEventListener('click', async function () {
      var input = document.getElementById('manualRegId');
      var id = (input.value || '').trim().toUpperCase();
      var resultEl = document.getElementById('checkinResult');

      if (!id) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = '<div class="badge badge-red" style="padding:8px 12px;">Please enter a Registration ID.</div>';
        return;
      }

      try {
        var res = await fetch('/api/registrations/' + encodeURIComponent(id) + '/checkin', {
          method: 'PUT',
          credentials: 'same-origin'
        });
        var data = await res.json();
        if (data.success && data.data) {
          resultEl.style.display = 'block';
          resultEl.innerHTML = '<div class="badge badge-green" style="padding:8px 12px;">' + escapeHtml(data.data.firstName + ' ' + data.data.lastName) + ' \u2014 ' + (data.data.checkedIn ? 'checked in' : 'check-in removed') + '!</div>';

          var idx = allRegistrations.findIndex(function (r) { return r.regId === id; });
          if (idx !== -1) allRegistrations[idx] = data.data;
          renderCheckinTable(allRegistrations);
          loadDashboard();
        } else {
          resultEl.style.display = 'block';
          resultEl.innerHTML = '<div class="badge badge-red" style="padding:8px 12px;">' + escapeHtml(data.message || 'Registration not found') + '</div>';
        }
      } catch (_e) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = '<div class="badge badge-red" style="padding:8px 12px;">Error checking in. Try again.</div>';
      }

      input.value = '';
    });
  }

  /* ═══ EXPORT CSV ═══ */
  var exportBtn = document.getElementById('exportCsvBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      window.open('/api/admin/export/registrations', '_blank');
    });
  }

  /* ═══ API MUTATIONS ═══ */
  async function apiToggleCheckin(regId) {
    try {
      var res = await fetch('/api/registrations/' + encodeURIComponent(regId) + '/checkin', {
        method: 'PUT',
        credentials: 'same-origin'
      });
      var data = await res.json();
      if (data.success && data.data) {
        var label = data.data.checkedIn ? 'checked in' : 'check-in removed';
        showToast(data.data.firstName + ' ' + data.data.lastName + ' ' + label);

        var idx = allRegistrations.findIndex(function (r) { return r.regId === regId; });
        if (idx !== -1) allRegistrations[idx] = data.data;

        renderRegistrations(allRegistrations);
        renderCheckinTable(allRegistrations);
        loadDashboard();
      } else {
        showToast(data.message || 'Failed.', 'error');
      }
    } catch (_e) {
      showToast('Failed to toggle check-in.', 'error');
    }
  }

  async function apiVerifyPayment(regId) {
    try {
      var res = await fetch('/api/registrations/' + encodeURIComponent(regId) + '/verify', {
        method: 'PUT',
        credentials: 'same-origin'
      });
      var data = await res.json();
      if (data.success && data.data) {
        showToast(data.data.firstName + ' ' + data.data.lastName + ' payment verified!');

        var idx = allRegistrations.findIndex(function (r) { return r.regId === regId; });
        if (idx !== -1) allRegistrations[idx] = data.data;

        renderRegistrations(allRegistrations);
        loadDashboard();
      } else {
        showToast(data.message || 'Failed.', 'error');
      }
    } catch (_e) {
      showToast('Failed to verify payment.', 'error');
    }
  }

  async function apiToggleRole(userId, currentRole) {
    var newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      var res = await fetch('/api/admin/users/' + userId + '/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ role: newRole })
      });
      var data = await res.json();
      if (data.success) {
        showToast('Role changed to ' + newRole);
        var idx = allUsers.findIndex(function (u) { return String(u.id) === String(userId); });
        if (idx !== -1) allUsers[idx].role = newRole;
        renderUsers(allUsers);
      } else {
        showToast(data.message || 'Failed.', 'error');
      }
    } catch (_e) {
      showToast('Failed to update role.', 'error');
    }
  }

  async function apiDeleteUser(userId, username) {
    if (!confirm('Delete user "' + username + '"? This cannot be undone.')) return;
    try {
      var res = await fetch('/api/admin/users/' + userId, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      var data = await res.json();
      if (data.success) {
        showToast(data.message || 'User deleted.');
        allUsers = allUsers.filter(function (u) { return String(u.id) !== String(userId); });
        renderUsers(allUsers);
      } else {
        showToast(data.message || 'Failed.', 'error');
      }
    } catch (_e) {
      showToast('Failed to delete user.', 'error');
    }
  }

  async function apiDeleteEvent(eventId) {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    try {
      var res = await fetch('/api/admin/events/' + eventId, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      var data = await res.json();
      if (data.success) {
        showToast(data.message || 'Event deleted.');
        allEvents = allEvents.filter(function (e) { return String(e.id) !== String(eventId); });
        renderEvents(allEvents);
      } else {
        showToast(data.message || 'Failed.', 'error');
      }
    } catch (_e) {
      showToast('Failed to delete event.', 'error');
    }
  }

  async function apiDeleteRegistration(id, regId) {
    if (!confirm('Delete registration "' + regId + '"? This cannot be undone.')) return;
    try {
      var res = await fetch('/api/admin/registrations/' + id, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      var data = await res.json();
      if (data.success) {
        showToast(data.message || 'Registration deleted.');
        allRegistrations = allRegistrations.filter(function (r) { return String(r.id) !== String(id); });
        renderRegistrations(allRegistrations);
        loadDashboard();
      } else {
        showToast(data.message || 'Failed.', 'error');
      }
    } catch (_e) {
      showToast('Failed to delete registration.', 'error');
    }
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

  function formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_e) {
      return dateStr;
    }
  }
});
