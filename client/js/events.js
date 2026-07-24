/* ═══════════════════════════════════════
   SilverVerse — Events Page
   Fetches and renders events from the API
   ═══════════════════════════════════════ */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', loadEvents);

  var MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  async function loadEvents() {
    var grid = document.getElementById('eventsGrid');
    var loading = document.getElementById('eventsLoading');
    if (!grid) return;

    try {
      var res = await fetch('/api/events', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to fetch events');
      var data = await res.json();
      var events = data.data || data.events || [];

      if (!Array.isArray(events) || events.length === 0) {
        grid.innerHTML = renderEmpty();
        return;
      }

      events.sort(function (a, b) {
        return new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt);
      });

      grid.innerHTML = events.map(renderEventCard).join('');
      observeCards(grid);
    } catch (err) {
      grid.innerHTML = renderError(err.message);
    }
  }

  function renderEventCard(event) {
    var name = escapeHtml(event.name || event.title || 'Untitled Event');
    var dateStr = formatDate(event.date);
    var venue = escapeHtml(event.venue || event.location || 'Venue TBA');
    var description = escapeHtml(event.description || event.shortDescription || '');
    var truncated = description.length > 120 ? description.slice(0, 120) + '...' : description;
    var status = (event.status || 'upcoming').toLowerCase();
    var badgeClass = 'event-badge event-badge-' + status;
    var statusLabel = capitalize(status);
    var id = event.id || event._id || '';

    return '' +
      '<div class="event-card">' +
        '<div class="event-card-top">' +
          '<span class="' + badgeClass + '">' + statusLabel + '</span>' +
        '</div>' +
        '<div class="event-card-body">' +
          '<h3 class="event-name">' + name + '</h3>' +
          '<div class="event-meta">' +
            '<div class="event-meta-item">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
              '<span>' + dateStr + '</span>' +
            '</div>' +
            '<div class="event-meta-item">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
              '<span>' + venue + '</span>' +
            '</div>' +
          '</div>' +
          (truncated ? '<p class="event-desc">' + truncated + '</p>' : '') +
        '</div>' +
        '<div class="event-card-footer">' +
          '<a href="register.html' + (id ? '?event=' + encodeURIComponent(id) : '') + '" class="btn btn-primary btn-sm event-register-btn">' +
            'Register Now' +
            ' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' +
          '</a>' +
        '</div>' +
      '</div>';
  }

  function renderEmpty() {
    return '' +
      '<div class="events-empty">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--gray-300);margin-bottom:16px;">' +
          '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>' +
          '<line x1="16" y1="2" x2="16" y2="6"/>' +
          '<line x1="8" y1="2" x2="8" y2="6"/>' +
          '<line x1="3" y1="10" x2="21" y2="10"/>' +
        '</svg>' +
        '<h3 style="font-size:1.3rem;margin-bottom:8px;">No events yet</h3>' +
        '<p style="color:var(--gray-500);font-size:0.95rem;">Check back soon for upcoming events.</p>' +
      '</div>';
  }

  function renderError(message) {
    return '' +
      '<div class="events-empty">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--danger);margin-bottom:16px;">' +
          '<circle cx="12" cy="12" r="10"/>' +
          '<line x1="12" y1="8" x2="12" y2="12"/>' +
          '<line x1="12" y1="16" x2="12.01" y2="16"/>' +
        '</svg>' +
        '<h3 style="font-size:1.3rem;margin-bottom:8px;">Unable to load events</h3>' +
        '<p style="color:var(--gray-500);font-size:0.95rem;">' + escapeHtml(message) + '</p>' +
      '</div>';
  }

  function observeCards(container) {
    var cards = container.querySelectorAll('.event-card');
    cards.forEach(function (card, i) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(24px)';
      card.style.transition = 'opacity 0.5s cubic-bezier(0.16,1,0.3,1) ' + (i * 0.08) + 's, transform 0.5s cubic-bezier(0.16,1,0.3,1) ' + (i * 0.08) + 's';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        });
      });
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Date TBA';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Date TBA';
    return d.getDate() + ' ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
