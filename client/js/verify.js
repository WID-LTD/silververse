document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // Redirect non-admin users to login
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var user = d.user || d;
      if (!d.success && !d.user) { window.location.href = 'login.html'; return; }
      if (user.role !== 'admin') { window.location.href = 'dashboard.html'; return; }
    })
    .catch(function () { window.location.href = 'login.html'; });

  var form = document.getElementById('verifyForm');
  var input = document.getElementById('verifyInput');
  var resultEl = document.getElementById('verifyResult');
  var contentEl = document.getElementById('verifyContent');
  var noResultEl = document.getElementById('noResult');

  var checkIcon = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  var xIcon = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var alertIcon = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = (input.value || '').trim().toUpperCase();
    if (!id) {
      input.focus();
      return;
    }
    verifyTicket(id);
  });

  async function verifyTicket(regId) {
    resultEl.classList.remove('show');
    noResultEl.style.display = 'none';

    contentEl.innerHTML =
      '<div class="verify-card">' +
        '<div class="verify-loading">' +
          '<div class="spinner"></div>' +
          '<p>Verifying ' + escapeHtml(regId) + '...</p>' +
        '</div>' +
      '</div>';
    resultEl.classList.add('show');

    var ticket = null;

    try {
      var res = await fetch('/api/verify/' + encodeURIComponent(regId), { credentials: 'same-origin' });
      var data = await res.json();
      if (data.success && data.data) {
        ticket = data.data;
      }
    } catch (_e) {}

    if (!ticket) {
      renderInvalid(regId);
      return;
    }

    var isCheckedIn = ticket.checkedIn === true;
    var isVerified = ticket.paymentStatus === 'verified' || ticket.paymentStatus === 'approved';

    if (isVerified) {
      renderValid(ticket, isCheckedIn);
    } else {
      renderPending(ticket);
    }
  }

  function renderValid(ticket, isCheckedIn) {
    var checkinBadge = isCheckedIn
      ? '<span class="badge badge-green">Checked In</span>'
      : '<span class="badge badge-yellow">Awaiting Check-in</span>';

    var eventName = ticket.eventName || 'Voices & Visions Festival 2026';
    var eventDate = ticket.eventDate ? formatDate(ticket.eventDate) : '1 August 2026';
    var eventVenue = ticket.eventVenue || 'Rochas Foundation, Ideato, Orlu, Imo State';

    contentEl.innerHTML =
      '<div class="verify-card">' +
        '<div class="verify-card-header valid">' +
          '<div class="verify-icon">' + checkIcon + '</div>' +
          '<h2>Valid Ticket</h2>' +
          '<p>This ticket is verified and active</p>' +
        '</div>' +
        '<div class="verify-card-body">' +
          renderDetailRow('Registration ID', ticket.regId) +
          renderDetailRow('Name', (ticket.firstName || '') + ' ' + (ticket.lastName || '')) +
          renderDetailRow('Category', ticket.category || 'Spectator') +
          renderDetailRow('Ticket Type', (ticket.ticketType || 'Regular') + ' Ticket') +
          renderDetailRow('Payment Status', '<span class="badge badge-green">Verified</span>') +
          renderDetailRow('Check-in Status', checkinBadge) +
          renderDetailRow('Event', eventName) +
          renderDetailRow('Date', eventDate) +
          renderDetailRow('Venue', eventVenue) +
        '</div>' +
        '<div class="verify-actions">' +
          '<a href="ticket.html?id=' + encodeURIComponent(ticket.regId) + '" class="btn btn-primary btn-sm">View Ticket</a>' +
          '<a href="receipt.html?id=' + encodeURIComponent(ticket.regId) + '" class="btn btn-outline btn-sm">View Receipt</a>' +
        '</div>' +
      '</div>';

    resultEl.classList.add('show');
  }

  function renderPending(ticket) {
    var eventName = ticket.eventName || 'Voices & Visions Festival 2026';

    contentEl.innerHTML =
      '<div class="verify-card">' +
        '<div class="verify-card-header warning">' +
          '<div class="verify-icon">' + alertIcon + '</div>' +
          '<h2>Payment Pending</h2>' +
          '<p>This ticket exists but payment has not been verified yet</p>' +
        '</div>' +
        '<div class="verify-card-body">' +
          renderDetailRow('Registration ID', ticket.regId) +
          renderDetailRow('Name', (ticket.firstName || '') + ' ' + (ticket.lastName || '')) +
          renderDetailRow('Category', ticket.category || 'Spectator') +
          renderDetailRow('Payment Status', '<span class="badge badge-yellow">Pending</span>') +
          renderDetailRow('Event', eventName) +
        '</div>' +
        '<div class="verify-actions">' +
          '<a href="ticket.html?id=' + encodeURIComponent(ticket.regId) + '" class="btn btn-outline btn-sm">View Ticket</a>' +
        '</div>' +
      '</div>';

    resultEl.classList.add('show');
  }

  function renderInvalid(regId) {
    contentEl.innerHTML =
      '<div class="verify-card">' +
        '<div class="verify-card-header invalid">' +
          '<div class="verify-icon">' + xIcon + '</div>' +
          '<h2>Invalid Ticket</h2>' +
          '<p>No registration found for this ID</p>' +
        '</div>' +
        '<div class="verify-card-body">' +
          '<div style="text-align:center;padding:16px 0;">' +
            '<p style="color:var(--gray-500);margin-bottom:4px;">Registration ID searched:</p>' +
            '<p style="font-size:1.1rem;font-weight:700;color:var(--danger);font-family:var(--font-display);">' + escapeHtml(regId) + '</p>' +
            '<p style="color:var(--gray-400);font-size:0.88rem;margin-top:12px;">Please double-check the ID and try again. If you believe this is an error, contact support.</p>' +
          '</div>' +
        '</div>' +
        '<div class="verify-actions">' +
          '<button class="btn btn-outline btn-sm" onclick="resetVerify()">Try Again</button>' +
        '</div>' +
      '</div>';

    resultEl.classList.add('show');
  }

  window.resetVerify = function () {
    resultEl.classList.remove('show');
    noResultEl.style.display = 'block';
    input.value = '';
    input.focus();
  };

  function renderDetailRow(label, value) {
    return '<div class="verify-detail-row">' +
      '<span class="detail-label">' + label + '</span>' +
      '<span class="detail-value">' + value + '</span>' +
    '</div>';
  }

  function formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_e) {
      return dateStr;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
