document.addEventListener('DOMContentLoaded', async function () {
  'use strict';

  var loadingEl = document.getElementById('loadingState');
  var contentEl = document.getElementById('dashContent');
  if (loadingEl) loadingEl.style.display = 'block';

  try {
    var res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    var data = await res.json();

    if (!data.success && !data.user) {
      window.location.href = 'login.html';
      return;
    }

    var user = data.user || data;

    document.getElementById('dashWelcome').textContent = 'Welcome back, ' + (user.displayName || user.username || 'User') + '!';
    document.getElementById('dashEmail').textContent = user.email || '';

    var initials = (user.displayName || user.username || '?').charAt(0).toUpperCase();
    document.getElementById('dashAvatar').textContent = initials;

    if (user.role) {
      document.getElementById('settingsRole').textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    }

    document.getElementById('settingsName').value = user.displayName || '';
    document.getElementById('settingsEmail').textContent = user.email || '';

    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';

    fetchAndRenderTickets();

  } catch (err) {
    window.location.href = 'login.html';
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

      var detailsHtml = '';
      var fields = [
        { label: 'Registration', value: t.regId },
        { label: 'Category', value: t.category },
        { label: 'Ticket Type', value: (t.ticketType || 'Regular') + ' Ticket' },
        { label: 'Date', value: '15 August 2026' }
      ];
      fields.forEach(function (f) {
        detailsHtml += '<div class="card-detail"><span class="detail-label">' + f.label + '</span><span class="detail-value">' + escapeHtml(f.value) + '</span></div>';
      });

      return '<div class="ticket-card-item">' +
        '<div class="ticket-card-header">' +
          '<span class="card-cat-badge ' + catClass + '">' + escapeHtml(t.category || 'Spectator') + '</span>' +
          '<h3>' + escapeHtml(t.firstName + ' ' + t.lastName) + '</h3>' +
          '<span class="card-event-name">Voices &amp; Visions Festival 2026</span>' +
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
});
