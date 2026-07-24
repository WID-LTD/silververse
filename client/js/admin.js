document.addEventListener('DOMContentLoaded', async function () {
  'use strict';

  var loadingEl = document.getElementById('adminLoading');
  var pageEl = document.getElementById('adminPage');
  var currentSection = 'dashboard';
  var allRegistrations = [];
  var allUsers = [];
  var allEvents = [];
  var allVideos = [];

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
    bindAddRoadmap();
    bindContactForm();
    bindAboutForm();
    bindAddBlog();
    bindCreateRegistration();
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
      checkin: 'Check-in',
      videos: 'Videos',
      roadmap: 'Roadmap',
      contact: 'Contact Settings',
      about: 'About Page',
      verify: 'Verify Ticket',
    };
    document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';

    if (section === 'dashboard') loadDashboard();
    else if (section === 'registrations') loadRegistrations();
    else if (section === 'users') loadUsers();
    else if (section === 'events') loadEvents();
    else if (section === 'checkin') loadCheckin();
    else if (section === 'videos') loadVideos();
    else if (section === 'roadmap') loadRoadmap();
    else if (section === 'contact') loadContactSettings();
    else if (section === 'about') loadAboutContent();
    else if (section === 'blog') loadBlogPosts();
    else if (section === 'verify') bindVerifySection();
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

  var selectedRegIds = {};

  function renderRegistrations(regs) {
    var tbody = document.getElementById('regTableBody');
    if (!tbody) return;

    if (regs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray-400);">No registrations found.</td></tr>';
      return;
    }

    tbody.innerHTML = regs.map(function (r) {
      var checked = selectedRegIds[r.regId] ? 'checked' : '';
      var statusBadge = r.paymentStatus === 'verified' || r.paymentStatus === 'approved'
        ? '<span class="badge badge-green">Verified</span>'
        : '<span class="badge badge-yellow">Pending</span>';
      var checkinBadge = r.checkedIn
        ? '<span class="badge badge-green">Checked In</span>'
        : '<span class="badge badge-yellow">Not Checked</span>';

      var imgHtml = r.profileImage
        ? '<img src="' + escapeAttr(r.profileImage) + '" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:50%;border:2px solid var(--primary);">'
        : '<span style="color:var(--gray-400);font-size:0.75rem;">—</span>';

      return '<tr class="' + (checked ? 'row-selected' : '') + '">' +
        '<td><input type="checkbox" class="reg-select" data-regid="' + escapeAttr(r.regId) + '" ' + checked + '></td>' +
        '<td><strong>' + escapeHtml(r.regId || '') + '</strong></td>' +
        '<td>' + imgHtml + '</td>' +
        '<td>' + escapeHtml((r.firstName || '') + ' ' + (r.lastName || '')) + '</td>' +
        '<td style="font-size:0.8rem;">' + escapeHtml(r.email || '') + '</td>' +
        '<td><span class="badge badge-blue">' + escapeHtml(r.category || 'Spectator') + '</span></td>' +
        '<td style="font-size:0.75rem;">' + statusBadge + ' ' + checkinBadge + '</td>' +
        '<td>' +
          '<div class="cell-actions">' +
            '<button class="action-btn" title="Download ticket" data-action="download" data-regid="' + escapeAttr(r.regId) + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
            '</button>' +
            '<button class="action-btn" title="Toggle check-in" data-action="checkin" data-regid="' + escapeAttr(r.regId) + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' +
            '</button>' +
            '<button class="action-btn" title="Verify payment" data-action="verify" data-regid="' + escapeAttr(r.regId) + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
            '</button>' +
            '<button class="action-btn action-danger" title="Delete" data-action="delete-reg" data-id="' + r.id + '" data-regid="' + escapeAttr(r.regId) + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('.reg-select').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var regId = this.getAttribute('data-regid');
        if (this.checked) selectedRegIds[regId] = true;
        else delete selectedRegIds[regId];
        updateBulkDownloadBtn();
        this.closest('tr').classList.toggle('row-selected', this.checked);
      });
    });

    tbody.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = this.getAttribute('data-action');
        var regId = this.getAttribute('data-regid');
        var id = this.getAttribute('data-id');
        if (action === 'download') openDownloadModal(regId);
        else if (action === 'checkin') apiToggleCheckin(regId);
        else if (action === 'verify') apiVerifyPayment(regId);
        else if (action === 'delete-reg') apiDeleteRegistration(id, regId);
      });
    });
  }

  function updateBulkDownloadBtn() {
    var btn = document.getElementById('bulkDownloadBtn');
    var countEl = document.getElementById('selectedCount');
    var count = Object.keys(selectedRegIds).length;
    if (btn && countEl) {
      countEl.textContent = count;
      btn.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  // Select all checkbox
  var selectAll = document.getElementById('selectAllRegs');
  if (selectAll) {
    selectAll.addEventListener('change', function () {
      document.querySelectorAll('.reg-select').forEach(function (cb) {
        cb.checked = this.checked;
        var regId = cb.getAttribute('data-regid');
        if (this.checked) selectedRegIds[regId] = true;
        else delete selectedRegIds[regId];
        cb.closest('tr').classList.toggle('row-selected', this.checked);
      }.bind(this));
      updateBulkDownloadBtn();
    });
  }

  // Bulk download button
  var bulkBtn = document.getElementById('bulkDownloadBtn');
  if (bulkBtn) {
    bulkBtn.addEventListener('click', function () {
      var ids = Object.keys(selectedRegIds);
      if (ids.length === 0) return;
      openDownloadModal(ids.length === 1 ? ids[0] : ids);
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
            '<button class="action-btn" title="Reset password" data-action="reset-password" data-userid="' + u.id + '" data-username="' + escapeAttr(u.displayName || u.username || 'User') + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
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
        else if (action === 'reset-password') apiResetPassword(userId, username);
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
  var exportBtn = document.getElementById('exportRegBtn');
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

  async function apiResetPassword(userId, username) {
    openModal('Reset Password: ' + escapeHtml(username),
      '<div class="form-group"><label for="resetPassInput">New Password</label><input type="password" id="resetPassInput" class="form-input" placeholder="Minimum 6 characters" minlength="6"></div>',
      '<button class="btn btn-outline btn-sm" id="resetPassCancel">Cancel</button>' +
      '<button class="btn btn-primary btn-sm" id="resetPassSave">Update Password</button>'
    );
    document.getElementById('resetPassCancel').addEventListener('click', closeModal);
    document.getElementById('resetPassSave').addEventListener('click', async function () {
      var newPassword = document.getElementById('resetPassInput').value;
      if (!newPassword || newPassword.length < 6) {
        showToast('Password must be at least 6 characters.', 'error');
        return;
      }
      try {
        var res = await fetch('/api/admin/users/' + userId + '/password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ newPassword: newPassword })
        });
        var data = await res.json();
        if (data.success) {
          showToast(data.message || 'Password updated!');
          closeModal();
        } else {
          showToast(data.message || 'Failed to update password.', 'error');
        }
      } catch (_e) {
        showToast('Failed to update password.', 'error');
      }
    });
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

  /* ═══ VIDEOS ═══ */
  async function loadVideos() {
    try {
      var res = await fetch('/api/videos', { credentials: 'same-origin' });
      var data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        allVideos = data.data;
      }
    } catch (_e) {}
    renderVideos(allVideos);
  }

  function renderVideos(videos) {
    var tbody = document.getElementById('videoTableBody');
    if (!tbody) return;

    if (videos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gray-400);">No videos found. Add your first video!</td></tr>';
      return;
    }

    tbody.innerHTML = videos.map(function (v) {
      var typeBadge = v.videoType === 'youtube'
        ? '<span class="badge badge-red">YouTube</span>'
        : '<span class="badge badge-blue">Upload</span>';

      return '<tr>' +
        '<td><strong>' + escapeHtml(v.title || '') + '</strong></td>' +
        '<td>' + escapeHtml(v.eventId ? 'Event #' + v.eventId : '\u2014') + '</td>' +
        '<td>' + escapeHtml(v.category || '') + '</td>' +
        '<td>' + typeBadge + '</td>' +
        '<td>' + escapeHtml(v.duration || '\u2014') + '</td>' +
        '<td>' +
          '<div class="cell-actions">' +
            '<button class="action-btn" title="Edit video" data-action="edit-video" data-videoid="' + v.id + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>' +
            '</button>' +
            '<button class="action-btn action-danger" title="Delete video" data-action="delete-video" data-videoid="' + v.id + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = this.getAttribute('data-action');
        var videoId = this.getAttribute('data-videoid');
        if (action === 'edit-video') editVideo(videoId);
        else if (action === 'delete-video') apiDeleteVideo(videoId);
      });
    });
  }

  var addVideoBtn = document.getElementById('addVideoBtn');
  if (addVideoBtn) {
    addVideoBtn.addEventListener('click', function () {
      var modalHtml =
        '<div class="form-group"><label for="videoTitle">Title *</label><input type="text" id="videoTitle" placeholder="Video title"></div>' +
        '<div class="form-group">' +
          '<label>Video Source</label>' +
          '<div class="video-source-tabs" style="display:flex;gap:8px;margin-bottom:12px;">' +
            '<button class="btn btn-sm source-tab active" data-source="upload" style="flex:1;">Upload File</button>' +
            '<button class="btn btn-sm source-tab" data-source="youtube" style="flex:1;">YouTube URL</button>' +
          '</div>' +
        '</div>' +
        '<div id="videoSourceUpload">' +
          '<div class="upload-dropzone" id="videoDropzone" style="border:2px dashed var(--gray-300);border-radius:12px;padding:40px 20px;text-align:center;cursor:pointer;transition:all 0.2s;background:var(--gray-50);">' +
            '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="1.5" style="margin-bottom:12px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
            '<p style="color:var(--gray-500);margin:0 0 4px;"><strong>Click to upload</strong> or drag and drop</p>' +
            '<p style="color:var(--gray-400);font-size:0.8rem;margin:0;">MP4, WebM, MOV (max 100MB)</p>' +
            '<input type="file" id="videoFileInput" accept="video/mp4,video/webm,video/quicktime" style="display:none;">' +
          '</div>' +
          '<div id="videoFileInfo" style="display:none;padding:12px;background:var(--primary-50);border-radius:8px;margin-top:8px;font-size:0.85rem;"></div>' +
          '<div id="uploadProgressWrap" style="display:none;margin-top:12px;">' +
            '<div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">' +
              '<span id="uploadPercent">0%</span>' +
              '<span id="uploadSpeed" style="color:var(--gray-500);"></span>' +
            '</div>' +
            '<div style="height:6px;background:var(--gray-200);border-radius:3px;overflow:hidden;">' +
              '<div id="uploadProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--primary),var(--primary-light));border-radius:3px;transition:width 0.3s;"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="videoSourceYoutube" style="display:none;">' +
          '<div class="form-group"><label for="videoUrl">YouTube URL *</label><input type="url" id="videoUrl" placeholder="https://youtube.com/watch?v=..."></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label for="videoCategory">Category</label><input type="text" id="videoCategory" placeholder="e.g. Music, Dance"></div>' +
          '<div class="form-group"><label for="videoDuration">Duration</label><input type="text" id="videoDuration" placeholder="e.g. 12:34"></div>' +
        '</div>';

      openModal('Add Video',
        modalHtml,
        '<button class="btn btn-outline btn-sm" id="modalCancelBtn">Cancel</button>' +
        '<button class="btn btn-primary btn-sm" id="modalSaveBtn">Save Video</button>'
      );

      var currentSource = 'upload';
      var selectedFile = null;

      // Source tab switching
      document.querySelectorAll('.source-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          document.querySelectorAll('.source-tab').forEach(function (t) { t.classList.remove('active'); });
          this.classList.add('active');
          currentSource = this.getAttribute('data-source');
          document.getElementById('videoSourceUpload').style.display = currentSource === 'upload' ? 'block' : 'none';
          document.getElementById('videoSourceYoutube').style.display = currentSource === 'youtube' ? 'block' : 'none';
        });
      });

      // Drag & drop
      var dropzone = document.getElementById('videoDropzone');
      var fileInput = document.getElementById('videoFileInput');

      dropzone.addEventListener('click', function () { fileInput.click(); });

      dropzone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary)';
        dropzone.style.background = 'rgba(30,64,175,0.05)';
      });

      dropzone.addEventListener('dragleave', function () {
        dropzone.style.borderColor = 'var(--gray-300)';
        dropzone.style.background = 'var(--gray-50)';
      });

      dropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--gray-300)';
        dropzone.style.background = 'var(--gray-50)';
        if (e.dataTransfer.files.length) handleVideoFile(e.dataTransfer.files[0]);
      });

      fileInput.addEventListener('change', function () {
        if (this.files.length) handleVideoFile(this.files[0]);
      });

      function handleVideoFile(file) {
        var allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
        if (!allowed.includes(file.type)) {
          showToast('Invalid file type. Allowed: MP4, WebM, MOV', 'error');
          return;
        }
        if (file.size > 100 * 1024 * 1024) {
          showToast('File too large. Maximum 100MB.', 'error');
          return;
        }
        selectedFile = file;
        var sizeLabel = file.size > 1024 * 1024 ? (file.size / (1024 * 1024)).toFixed(1) + ' MB' : (file.size / 1024).toFixed(1) + ' KB';
        document.getElementById('videoFileInfo').style.display = 'block';
        document.getElementById('videoFileInfo').innerHTML = '<strong>' + escapeHtml(file.name) + '</strong> (' + sizeLabel + ')';
      }

      document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
      document.getElementById('modalSaveBtn').addEventListener('click', async function () {
        var title = document.getElementById('videoTitle').value.trim();
        var category = document.getElementById('videoCategory') ? document.getElementById('videoCategory').value.trim() : '';
        var duration = document.getElementById('videoDuration') ? document.getElementById('videoDuration').value.trim() : '';

        if (!title) { showToast('Title is required.', 'error'); return; }

        if (currentSource === 'youtube') {
          var videoUrl = document.getElementById('videoUrl').value.trim();
          if (!videoUrl) { showToast('YouTube URL is required.', 'error'); return; }

          try {
            var res = await fetch('/api/videos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ title: title, videoType: 'youtube', videoUrl: videoUrl, category: category, duration: duration })
            });
            var result = await res.json();
            if (result.success) {
              allVideos.push(result.data);
              renderVideos(allVideos);
              closeModal();
              showToast('Video added successfully!');
            } else {
              showToast(result.message || 'Failed to add video.', 'error');
            }
          } catch (_e) {
            showToast('Failed to add video.', 'error');
          }
        } else {
          if (!selectedFile) { showToast('Please select a video file to upload.', 'error'); return; }

          var saveBtn = document.getElementById('modalSaveBtn');
          saveBtn.disabled = true;
          saveBtn.textContent = 'Uploading...';
          document.getElementById('uploadProgressWrap').style.display = 'block';

          var formData = new FormData();
          formData.append('video', selectedFile);
          formData.append('title', title);
          formData.append('category', category);
          formData.append('duration', duration);

          try {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/videos/upload', true);
            xhr.withCredentials = true;

            xhr.upload.onprogress = function (e) {
              if (e.lengthComputable) {
                var pct = Math.round((e.loaded / e.total) * 100);
                document.getElementById('uploadProgressBar').style.width = pct + '%';
                document.getElementById('uploadPercent').textContent = pct + '%';
                var elapsed = (Date.now() - startTime) / 1000;
                var speed = (e.loaded / (1024 * 1024)) / elapsed;
                document.getElementById('uploadSpeed').textContent = speed.toFixed(1) + ' MB/s';
              }
            };

            var startTime = Date.now();
            xhr.onload = function () {
              try {
                var result = JSON.parse(xhr.responseText);
                if (result.success) {
                  allVideos.push(result.data);
                  renderVideos(allVideos);
                  closeModal();
                  showToast('Video uploaded and saved!');
                } else {
                  showToast(result.message || 'Upload failed.', 'error');
                  saveBtn.disabled = false;
                  saveBtn.textContent = 'Save Video';
                }
              } catch (_e) {
                showToast('Upload failed.', 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Video';
              }
            };

            xhr.onerror = function () {
              showToast('Upload failed. Check your connection.', 'error');
              saveBtn.disabled = false;
              saveBtn.textContent = 'Save Video';
            };

            xhr.send(formData);
          } catch (_e) {
            showToast('Upload failed.', 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Video';
          }
        }
      });
    });
  }

  async function editVideo(id) {
    var video = allVideos.find(function (v) { return String(v.id) === String(id); });
    if (!video) return;

    openModal('Edit Video',
      '<div class="form-group"><label for="videoTitle">Title</label><input type="text" id="videoTitle" value="' + escapeAttr(video.title || '') + '"></div>' +
      '<div class="form-group"><label for="videoUrl">YouTube URL</label><input type="url" id="videoUrl" value="' + escapeAttr(video.videoUrl || '') + '"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label for="videoCategory">Category</label><input type="text" id="videoCategory" value="' + escapeAttr(video.category || '') + '"></div>' +
        '<div class="form-group"><label for="videoDuration">Duration</label><input type="text" id="videoDuration" value="' + escapeAttr(video.duration || '') + '"></div>' +
      '</div>',
      '<button class="btn btn-outline btn-sm" id="modalCancelBtn">Cancel</button>' +
      '<button class="btn btn-primary btn-sm" id="modalSaveBtn">Update Video</button>'
    );

    document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
    document.getElementById('modalSaveBtn').addEventListener('click', async function () {
      var title = document.getElementById('videoTitle').value.trim();
      var videoUrl = document.getElementById('videoUrl').value.trim();
      var category = document.getElementById('videoCategory').value.trim();
      var duration = document.getElementById('videoDuration').value.trim();

      if (!title) { showToast('Title is required.', 'error'); return; }

      try {
        var res = await fetch('/api/videos/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ title, videoUrl, category, duration })
        });
        var result = await res.json();
        if (result.success) {
          var idx = allVideos.findIndex(function (v) { return String(v.id) === String(id); });
          if (idx !== -1) allVideos[idx] = result.data;
          renderVideos(allVideos);
          closeModal();
          showToast('Video updated!');
        } else {
          showToast(result.message || 'Failed.', 'error');
        }
      } catch (_e) {
        showToast('Failed to update video.', 'error');
      }
    });
  }

  async function apiDeleteVideo(id) {
    if (!confirm('Delete this video?')) return;
    try {
      var res = await fetch('/api/videos/' + id, { method: 'DELETE', credentials: 'same-origin' });
      var data = await res.json();
      if (data.success) {
        showToast(data.message || 'Video deleted.');
        allVideos = allVideos.filter(function (v) { return String(v.id) !== String(id); });
        renderVideos(allVideos);
      } else {
        showToast(data.message || 'Failed.', 'error');
      }
    } catch (_e) {
      showToast('Failed to delete video.', 'error');
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

  function openModal(title, bodyHtml, footerHtml, onSave) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml || '';
    document.getElementById('modalOverlay').classList.add('active');

    if (onSave) {
      var saveBtn = document.getElementById('modalSaveBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', onSave);
      }
    }
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

  // ═══════════════════════════════════════
  // ROADMAP
  // ═══════════════════════════════════════
  var roadmapEventId = 1;

  function loadRoadmap() {
    fetch('/api/admin/events', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.success && d.data.length > 0) {
          roadmapEventId = d.data[0].id;
          fetchRoadmap();
        }
      });
  }

  function fetchRoadmap() {
    fetch('/api/admin/roadmap/' + roadmapEventId, { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var tbody = document.getElementById('roadmapTableBody');
        if (!tbody) return;
        if (!d.success || !d.data) { tbody.innerHTML = '<tr><td colspan="5">Failed to load</td></tr>'; return; }
        tbody.innerHTML = d.data.map(function (m) {
          return '<tr><td>' + escapeHtml(m.title) + '</td><td>' + escapeHtml(m.milestoneDate || '') + '</td><td><span class="status-badge status-' + m.status + '">' + escapeHtml(m.status) + '</span></td><td>' + (m.sortOrder || 0) + '</td><td class="action-cell"><button class="btn btn-sm btn-outline" onclick="editRoadmap(' + m.id + ')">Edit</button> <button class="btn btn-sm btn-danger" onclick="deleteRoadmap(' + m.id + ')">Delete</button></td></tr>';
        }).join('');
      });
  }

  window.editRoadmap = function (id) {
    fetch('/api/admin/roadmap/' + roadmapEventId, { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.success || !d.data) return;
        var m = d.data.find(function (x) { return x.id === id; });
        if (!m) return;
        showModal('Edit Milestone',
          '<div class="form-group"><label>Title</label><input type="text" id="rmTitle" class="form-input" value="' + escapeAttr(m.title) + '"></div>' +
          '<div class="form-group"><label>Date</label><input type="text" id="rmDate" class="form-input" value="' + escapeAttr(m.milestoneDate || '') + '"></div>' +
          '<div class="form-group"><label>Status</label><select id="rmStatus" class="form-input"><option value="completed"' + (m.status === 'completed' ? ' selected' : '') + '>Completed</option><option value="live"' + (m.status === 'live' ? ' selected' : '') + '>Live</option><option value="upcoming"' + (m.status === 'upcoming' ? ' selected' : '') + '>Upcoming</option></select></div>' +
          '<div class="form-group"><label>Order</label><input type="number" id="rmOrder" class="form-input" value="' + (m.sortOrder || 0) + '"></div>',
          'Save', function () {
            var data = { title: document.getElementById('rmTitle').value, milestoneDate: document.getElementById('rmDate').value, status: document.getElementById('rmStatus').value, sortOrder: parseInt(document.getElementById('rmOrder').value) || 0 };
            fetch('/api/admin/roadmap/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) })
              .then(function (r) { return r.json(); })
              .then(function (res) { if (res.success) { showToast('Milestone updated'); closeModal(); fetchRoadmap(); } else showToast(res.message, 'error'); });
          });
      });
  };

  window.deleteRoadmap = function (id) {
    if (!confirm('Delete this milestone?')) return;
    fetch('/api/admin/roadmap/' + id, { method: 'DELETE', credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.success) { showToast(d.message); fetchRoadmap(); } else showToast(d.message, 'error'); });
  };

  function bindAddRoadmap() {
    var addBtn = document.getElementById('addRoadmapBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        showModal('Add Milestone',
          '<div class="form-group"><label>Title</label><input type="text" id="rmTitle" class="form-input" placeholder="Milestone title"></div>' +
          '<div class="form-group"><label>Date</label><input type="text" id="rmDate" class="form-input" placeholder="e.g. August 2026"></div>' +
          '<div class="form-group"><label>Status</label><select id="rmStatus" class="form-input"><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="completed">Completed</option></select></div>' +
          '<div class="form-group"><label>Order</label><input type="number" id="rmOrder" class="form-input" value="0"></div>',
          'Create', function () {
            var data = { eventId: roadmapEventId, title: document.getElementById('rmTitle').value, milestoneDate: document.getElementById('rmDate').value, status: document.getElementById('rmStatus').value, sortOrder: parseInt(document.getElementById('rmOrder').value) || 0 };
            if (!data.title) { showToast('Title required', 'error'); return; }
            fetch('/api/admin/roadmap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) })
              .then(function (r) { return r.json(); })
              .then(function (res) { if (res.success) { showToast('Milestone created'); closeModal(); fetchRoadmap(); } else showToast(res.message, 'error'); });
          });
      });
    }
  }

  // ═══════════════════════════════════════
  // CONTACT SETTINGS
  // ═══════════════════════════════════════
  function loadContactSettings() {
    fetch('/api/admin/contact-settings', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.success || !d.data) return;
        var map = d.data;
        var fields = ['Email', 'Phone1', 'Phone2', 'Whatsapp', 'Address', 'Instagram', 'Twitter', 'Facebook'];
        fields.forEach(function (f) {
          var el = document.getElementById('contact' + f);
          if (el && map[f.toLowerCase()]) el.value = map[f.toLowerCase()];
        });
      });
  }

  function bindContactForm() {
    var form = document.getElementById('contactForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var data = {
          email: document.getElementById('contactEmail').value,
          phone1: document.getElementById('contactPhone1').value,
          phone2: document.getElementById('contactPhone2').value,
          whatsapp: document.getElementById('contactWhatsapp').value,
          address: document.getElementById('contactAddress').value,
          social_instagram: document.getElementById('contactInstagram').value,
          social_twitter: document.getElementById('contactTwitter').value,
          social_facebook: document.getElementById('contactFacebook').value,
        };
        fetch('/api/admin/contact-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) })
          .then(function (r) { return r.json(); })
          .then(function (res) { if (res.success) showToast('Contact settings saved'); else showToast(res.message, 'error'); });
      });
    }
  }

  // ═══════════════════════════════════════
  // ABOUT CONTENT
  // ═══════════════════════════════════════
  function loadAboutContent() {
    fetch('/api/admin/about', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var container = document.getElementById('aboutFields');
        if (!container) return;
        if (!d.success || !d.data) { container.innerHTML = '<p>No about content loaded</p>'; return; }
        container.innerHTML = d.data.map(function (s) {
          return '<div class="form-group" style="border:1px solid var(--gray-200);padding:16px;border-radius:var(--radius);margin-bottom:16px;"><label><strong>' + escapeHtml(s.section_key || s.sectionKey) + '</strong></label>' +
            '<input type="hidden" class="about-key" value="' + escapeAttr(s.section_key || s.sectionKey) + '">' +
            '<div class="form-group" style="margin-top:8px;"><label>Title</label><input type="text" class="about-title form-input" value="' + escapeAttr(s.title || '') + '"></div>' +
            '<div class="form-group"><label>Content</label><textarea class="about-content form-input" rows="4">' + escapeHtml(s.content || '') + '</textarea></div>' +
            '<div class="form-group"><label>Image URL</label><input type="text" class="about-image form-input" value="' + escapeAttr(s.image_url || s.imageUrl || '') + '"></div></div>';
        }).join('');
      });
  }

  function bindAboutForm() {
    var form = document.getElementById('aboutForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var fields = document.querySelectorAll('.about-key');
        var saveAll = [];
        fields.forEach(function (hidden) {
          var container = hidden.closest('.form-group');
          if (!container) return;
          var sectionKey = hidden.value;
          var title = container.querySelector('.about-title') ? container.querySelector('.about-title').value : '';
          var content = container.querySelector('.about-content') ? container.querySelector('.about-content').value : '';
          var imageUrl = container.querySelector('.about-image') ? container.querySelector('.about-image').value : '';
          saveAll.push(fetch('/api/admin/about', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ sectionKey: sectionKey, title: title, content: content, imageUrl: imageUrl }) }));
        });
        Promise.all(saveAll).then(function () { showToast('About content saved'); });
      });
    }
  }

  // ═══════════════════════════════════════
  // BLOG
  // ═══════════════════════════════════════
  function loadBlogPosts() {
    fetch('/api/admin/blog', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var tbody = document.getElementById('blogTableBody');
        if (!tbody) return;
        if (!d.success || !d.data) { tbody.innerHTML = '<tr><td colspan="5">No posts yet</td></tr>'; return; }
        tbody.innerHTML = d.data.map(function (p) {
          return '<tr><td>' + escapeHtml(p.title) + '</td><td>' + escapeHtml(p.author_name || '—') + '</td><td><span class="status-badge status-' + (p.published ? 'live' : 'upcoming') + '">' + (p.published ? 'Published' : 'Draft') + '</span></td><td>' + formatDate(p.published_at || p.created_at) + '</td><td class="action-cell"><button class="btn btn-sm btn-outline" onclick="editBlogPost(' + p.id + ')">Edit</button> <button class="btn btn-sm btn-danger" onclick="deleteBlogPost(' + p.id + ')">Delete</button></td></tr>';
        }).join('');
      });
  }

  window.editBlogPost = function (id) {
    fetch('/api/admin/blog', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.success || !d.data) return;
        var p = d.data.find(function (x) { return x.id === id; });
        if (!p) return;
        showModal('Edit Post',
          '<div class="form-group"><label>Title</label><input type="text" id="bpTitle" class="form-input" value="' + escapeAttr(p.title) + '"></div>' +
          '<div class="form-group"><label>Excerpt</label><input type="text" id="bpExcerpt" class="form-input" value="' + escapeAttr(p.excerpt || '') + '"></div>' +
          '<div class="form-group"><label>Content (HTML)</label><textarea id="bpContent" class="form-input" rows="8">' + escapeHtml(p.content || '') + '</textarea></div>' +
          '<div class="form-group"><label>Featured Image URL</label><input type="text" id="bpImage" class="form-input" value="' + escapeAttr(p.featured_image || '') + '"></div>' +
          '<div class="form-group"><label class="checkbox-wrap" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="bpPublished" ' + (p.published ? 'checked' : '') + '> <span>Published</span></label></div>',
          'Save', function () {
            var data = { title: document.getElementById('bpTitle').value, excerpt: document.getElementById('bpExcerpt').value, content: document.getElementById('bpContent').value, featuredImage: document.getElementById('bpImage').value, published: document.getElementById('bpPublished').checked };
            if (!data.title) { showToast('Title required', 'error'); return; }
            fetch('/api/admin/blog/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) })
              .then(function (r) { return r.json(); })
              .then(function (res) { if (res.success) { showToast('Post updated'); closeModal(); loadBlogPosts(); } else showToast(res.message, 'error'); });
          });
      });
  };

  window.deleteBlogPost = function (id) {
    if (!confirm('Delete this post?')) return;
    fetch('/api/admin/blog/' + id, { method: 'DELETE', credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.success) { showToast(d.message); loadBlogPosts(); } else showToast(d.message, 'error'); });
  };

  function bindAddBlog() {
    var addBtn = document.getElementById('addBlogBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        openModal('New Post',
          '<div class="form-group"><label>Title</label><input type="text" id="bpTitle" class="form-input" placeholder="Post title"></div>' +
          '<div class="form-group"><label>Excerpt</label><input type="text" id="bpExcerpt" class="form-input" placeholder="Short summary"></div>' +
          '<div class="form-group"><label>Content (HTML)</label><textarea id="bpContent" class="form-input" rows="8" placeholder="Write your post content here..."></textarea></div>' +
          '<div class="form-group"><label>Featured Image URL</label><input type="text" id="bpImage" class="form-input" placeholder="https://..."></div>' +
          '<div class="form-group"><label class="checkbox-wrap" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="bpPublished"> <span>Publish immediately</span></label></div>',
          'Create', function () {
            var data = { title: document.getElementById('bpTitle').value, excerpt: document.getElementById('bpExcerpt').value, content: document.getElementById('bpContent').value, featuredImage: document.getElementById('bpImage').value, published: document.getElementById('bpPublished').checked };
            if (!data.title) { showToast('Title required', 'error'); return; }
            fetch('/api/admin/blog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) })
              .then(function (r) { return r.json(); })
              .then(function (res) { if (res.success) { showToast('Post created'); closeModal(); loadBlogPosts(); } else showToast(res.message, 'error'); });
          });
      });
    }
  }

  // ═══════════════════════════════════════
  // DOWNLOAD MODAL
  // ═══════════════════════════════════════
  function openDownloadModal(regIdOrIds) {
    var ids = Array.isArray(regIdOrIds) ? regIdOrIds : [regIdOrIds];
    var isMulti = ids.length > 1;

    openModal(isMulti ? 'Download Tickets (' + ids.length + ')' : 'Download Ticket',
      '<div style="max-height:300px;overflow-y:auto;">' +
        ids.map(function (id) {
          return '<label class="checkbox-wrap" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-color);">' +
            '<input type="checkbox" class="dlt-check" value="' + escapeAttr(id) + '" checked> <span style="font-size:0.85rem;">' + escapeHtml(id) + '</span></label>';
        }).join('') +
      '</div>' +
      '<p style="font-size:0.8rem;color:var(--gray-500);margin-top:12px;">One ticket per page. Select tickets above, then choose format.</p>',
      '<button class="btn btn-outline btn-sm" id="modalCancelBtn">Cancel</button>' +
      '<button class="btn btn-primary btn-sm" id="dltPdfBtn">Download PDF</button>' +
      '<button class="btn btn-primary btn-sm" id="dltHtmlBtn">View Ticket</button>' +
      '<button class="btn btn-primary btn-sm" id="dltPrintBtn">Print</button>',
      function () {});

    document.getElementById('modalCancelBtn').addEventListener('click', closeModal);

    function selectedIds() {
      return Array.from(document.querySelectorAll('.dlt-check:checked')).map(function (cb) { return cb.value; });
    }

    document.getElementById('dltPdfBtn').addEventListener('click', function () {
      var sel = selectedIds();
      if (sel.length === 0) { showToast('Select at least one ticket.', 'error'); return; }
      downloadTickets(sel, 'pdf');
      closeModal();
    });
    document.getElementById('dltHtmlBtn').addEventListener('click', function () {
      var sel = selectedIds();
      if (sel.length === 0) { showToast('Select at least one ticket.', 'error'); return; }
      downloadTickets(sel, 'html');
      closeModal();
    });
    document.getElementById('dltPrintBtn').addEventListener('click', function () {
      var sel = selectedIds();
      if (sel.length === 0) { showToast('Select at least one ticket.', 'error'); return; }
      printTickets(sel);
      closeModal();
    });
  }

  function downloadTickets(ids, format) {
    ids.forEach(async function (regId) {
      if (format === 'html') {
        window.open('/api/ticket/' + encodeURIComponent(regId) + '/download?format=html', '_blank');
        return;
      }
      var url = '/api/ticket/' + encodeURIComponent(regId) + '/download?format=' + format;
      try {
        var res = await fetch(url, { credentials: 'include' });
        if (!res.ok) { showToast('Failed to download ' + regId, 'error'); return; }
        var blob = await res.blob();
        var blobUrl = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = blobUrl;
        a.download = regId + '_ticket.' + (format === 'pdf' ? 'pdf' : 'html');
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch (_e) {
        showToast('Failed to download ' + regId, 'error');
      }
    });
    showToast(format === 'html' ? 'Opening ticket(s)...' : 'Downloading ' + ids.length + ' ticket(s)...');
  }

  function printTickets(ids) {
    var printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Print Tickets</title></head><body>');
    ids.forEach(function (regId) {
        function printTickets(ids) {
    ids.forEach(async function (regId) {
      try {
        var res = await fetch('/api/ticket/' + encodeURIComponent(regId) + '/download?format=html', { credentials: 'include' });
        if (!res.ok) { showToast('Failed to load ' + regId, 'error'); return; }
        var html = await res.text();
        var w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
          w.onload = function () { w.print(); };
        }
      } catch (_e) {
        showToast('Failed to load ' + regId, 'error');
      }
    });
    showToast('Opening ' + ids.length + ' ticket(s) for printing...');
  }
  }

  // ═══════════════════════════════════════
  // VERIFY SECTION
  // ═══════════════════════════════════════
  var _verifyBound = false;
  function bindVerifySection() {
    if (_verifyBound) return;
    _verifyBound = true;

    var btn = document.getElementById('verifyTicketBtn');
    var input = document.getElementById('verifyRegId');
    var resultEl = document.getElementById('verifyResult');
    if (!btn || !input || !resultEl) return;

    btn.addEventListener('click', async function () {
      var regId = input.value.trim().toUpperCase();
      if (!regId) { input.focus(); return; }
      resultEl.style.display = 'none';
      btn.disabled = true;
      btn.textContent = 'Verifying...';

      try {
        var res = await fetch('/api/verify/' + encodeURIComponent(regId), { credentials: 'same-origin' });
        var data = await res.json();
        if (data.success && data.data) {
          var d = data.data;
          var checkedIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>';
          var name = (d.firstName || '') + ' ' + (d.lastName || '');
          resultEl.innerHTML =
            '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius);padding:20px;">' +
              '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">' + checkedIcon +
                '<div><strong style="font-size:1.1rem;">' + escapeHtml(d.regId || '') + '</strong><br><span style="color:var(--gray-500);font-size:0.85rem;">' + escapeHtml(d.category || '') + '</span></div>' +
              '</div>' +
              '<table style="width:100%;font-size:0.85rem;border-collapse:collapse;">' +
                '<tr><td style="padding:4px 8px;color:var(--gray-500);">Name</td><td style="padding:4px 8px;">' + escapeHtml(name) + '</td></tr>' +
                '<tr><td style="padding:4px 8px;color:var(--gray-500);">Email</td><td style="padding:4px 8px;">' + escapeHtml(d.email || '') + '</td></tr>' +
                '<tr><td style="padding:4px 8px;color:var(--gray-500);">Status</td><td style="padding:4px 8px;">' + (d.paymentStatus === 'verified' || d.paymentStatus === 'approved' ? '<span class="badge badge-green">Verified</span>' : '<span class="badge badge-yellow">Pending</span>') + '</td></tr>' +
                '<tr><td style="padding:4px 8px;color:var(--gray-500);">Checked In</td><td style="padding:4px 8px;">' + (d.checkedIn ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-yellow">No</span>') + '</td></tr>' +
              '</table>' +
              '<div style="margin-top:12px;display:flex;gap:8px;">' +
                '<button class="btn btn-outline btn-sm" id="verifyDownloadBtn" data-regid="' + escapeAttr(d.regId) + '">Download Ticket</button>' +
                (!d.checkedIn ? '<button class="btn btn-primary btn-sm" id="verifyCheckinBtn" data-regid="' + escapeAttr(d.regId) + '">Check In</button>' : '') +
              '</div>' +
            '</div>';
          resultEl.style.display = 'block';

          var dlBtn = document.getElementById('verifyDownloadBtn');
          if (dlBtn) dlBtn.addEventListener('click', function () { openDownloadModal(this.getAttribute('data-regid')); });
          var ciBtn = document.getElementById('verifyCheckinBtn');
          if (ciBtn) ciBtn.addEventListener('click', function () {
            var regId = this.getAttribute('data-regid');
            apiToggleCheckin(regId);
            this.remove();
          });
        } else {
          resultEl.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--danger);border-radius:var(--radius);padding:20px;text-align:center;color:var(--danger);">Ticket not found or invalid.</div>';
          resultEl.style.display = 'block';
        }
      } catch (_e) {
        resultEl.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--danger);border-radius:var(--radius);padding:20px;text-align:center;color:var(--danger);">Network error. Try again.</div>';
        resultEl.style.display = 'block';
      }

      btn.disabled = false;
      btn.textContent = 'Verify Ticket';
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') btn.click();
    });
  }

  // ═══════════════════════════════════════
  // CREATE REGISTRATION (Admin, bulk)
  // ═══════════════════════════════════════
  function bindCreateRegistration() {
    var btn = document.getElementById('createRegBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      openModal('Create Registration',
        '<div class="form-row">' +
          '<div class="form-group"><label>Category *</label><select id="crCategory" class="form-input">' +
            '<option value="Spectator">Spectator</option>' +
            '<option value="Contestant">Contestant</option>' +
            '<option value="VIP">VIP Guest</option>' +
            '<option value="VVIP">VVIP (Table for Four)</option>' +
            '<option value="Volunteer">Volunteer</option>' +
            '<option value="Speaker">Speaker</option>' +
          '</select></div>' +
          '<div class="form-group"><label>Ticket Type</label><select id="crTicketType" class="form-input">' +
            '<option value="Regular">Regular</option>' +
            '<option value="VIP">VIP</option>' +
            '<option value="VVIP">VVIP</option>' +
          '</select></div>' +
        '</div>' +
        '<div class="form-group"><label>Quantity (bulk)</label><input type="number" id="crQuantity" class="form-input" value="1" min="1" max="50"></div>' +
        '<p style="font-size:0.8rem;color:var(--gray-500);margin-top:8px;">Registrations will be created with default details (Registered by Admin). You can edit them later.</p>',
        '<button class="btn btn-outline btn-sm" id="modalCancelBtn">Cancel</button>' +
        '<button class="btn btn-primary btn-sm" id="modalSaveBtn">Create Registration</button>',
        async function () {
          var category = document.getElementById('crCategory').value;
          var ticketType = document.getElementById('crTicketType').value;
          var quantity = parseInt(document.getElementById('crQuantity').value) || 1;

          var registrations = [];
          for (var i = 0; i < quantity; i++) {
            registrations.push({
              firstName: 'Registered',
              lastName: 'by Admin',
              email: 'admin-registration-' + Date.now() + '-' + i + '@silververse.ng',
              phone: '',
              category: category,
              ticketType: ticketType,
              subCategory: '',
              paymentTxRef: 'ADMIN-' + Date.now() + '-' + i,
              paymentStatus: 'verified'
            });
          }

          try {
            var res = await fetch('/api/admin/registrations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ registrations: registrations })
            });
            var data = await res.json();
            if (data.success) {
              showToast(data.message);
              closeModal();
              loadRegistrations();
            } else {
              showToast(data.message, 'error');
            }
          } catch (_e) {
            showToast('Failed to create registration.', 'error');
          }
        });
      document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
    });
  }
});
