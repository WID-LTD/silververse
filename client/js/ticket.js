document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var ticketData = null;
  var ticketEl = document.getElementById('ticket');

  var ticketTemplates = {
    Spectator: { passType: 'SPECTATOR PASS', accent: 'var(--primary)' },
    VIP: { passType: 'VIP ADMISSION PASS', accent: '#6b7280' },
    VVIP: { passType: 'VVIP ADMISSION PASS', accent: 'var(--primary-dark)' },
    Contestant: { passType: 'CONTESTANT PASS', accent: 'var(--gold-dark)' },
    Judge: { passType: 'JUDGE PASS', accent: '#1f2937' },
    Speaker: { passType: 'SPECIAL GUEST PASS', accent: '#7c3aed' },
    Volunteer: { passType: 'VOLUNTEER PASS', accent: '#059669' },
    Sponsor: { passType: 'OFFICIAL SPONSOR PASS', accent: '#0e7490' },
    Staff: { passType: 'STAFF PASS', accent: '#ea580c' },
    Media: { passType: 'MEDIA PASS', accent: '#dc2626' }
  };

  function parseIdFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  async function loadTicket() {
    var regId = parseIdFromUrl();
    if (!regId) {
      showError('No Registration ID provided.');
      return;
    }

    try {
      var res = await fetch('/api/ticket/' + encodeURIComponent(regId), { credentials: 'same-origin' });
      var data = await res.json();
      if (data.success && data.data) {
        ticketData = data.data;
      }
    } catch (_e) {}

    if (!ticketData) {
      showError('Registration not found.');
      return;
    }

    renderTicket(ticketData);
  }

  function showError(msg) {
    ticketEl.innerHTML =
      '<div class="ticket-empty">' +
        '<div class="empty-icon">' +
          '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>' +
        '</div>' +
        '<h2>' + escapeHtml(msg) + '</h2>' +
        '<p>Please register first to receive your e-ticket.</p>' +
        '<a href="register.html" class="btn btn-primary">Register Now</a>' +
      '</div>';
  }

  function renderTicket(data) {
    var tmpl = ticketTemplates[data.category] || ticketTemplates.Spectator;
    var regNum = (data.regId || '').replace('VV26-', '');
    var statusLabel = (data.paymentStatus === 'verified' || data.paymentStatus === 'approved') ? 'APPROVED' : 'PENDING';
    var statusClass = statusLabel === 'APPROVED' ? 'status-approved' : 'status-pending';

    var eventName = data.eventName || 'Voices & Visions Festival 2026';
    var eventDate = data.eventDate ? formatDate(data.eventDate) : '1 August 2026';
    var eventVenue = data.eventVenue || 'Rochas Foundation, Ideato, Orlu, Imo State';

    var profileImgHtml = '';
    if (data.profileImage) {
      profileImgHtml = '<div class="ticket-photo"><img src="' + escapeAttr(data.profileImage) + '" alt="Photo" loading="lazy"></div>';
    }

    var extraHTML = '';
    if (data.category === 'Contestant' && data.talent) {
      extraHTML =
        '<div class="ticket-field"><div class="field-label">Talent</div><div class="field-value">' + escapeHtml(data.talent) + '</div></div>' +
        '<div class="ticket-field"><div class="field-label">Performance Time</div><div class="field-value">' + escapeHtml(data.perfTime || 'TBA') + '</div></div>';
    }

    ticketEl.innerHTML =
      '<div class="split-ticket">' +
        '<!-- LEFT: Blue 60% -->' +
        '<div class="ticket-left">' +
          '<div class="ticket-left-header">' +
            '<div class="ticket-logo">SILVERVERSE</div>' +
            '<div class="ticket-pass-type">' + tmpl.passType + '</div>' +
          '</div>' +
          '<div class="ticket-left-body">' +
            '<h2 class="ticket-event-name">' + escapeHtml(eventName) + '</h2>' +
            '<div class="ticket-field"><div class="field-label">Name</div><div class="field-value">' + escapeHtml((data.firstName || '') + ' ' + (data.lastName || '')) + '</div></div>' +
            '<div class="ticket-field"><div class="field-label">Registration No.</div><div class="field-value">' + escapeHtml(data.regId) + '</div></div>' +
            '<div class="ticket-field"><div class="field-label">Category</div><div class="field-value">' + escapeHtml(data.category || 'Spectator') + ' \u2014 ' + escapeHtml(data.ticketType || 'Regular') + '</div></div>' +
            extraHTML +
          '</div>' +
          '<div class="ticket-left-footer">' +
            '<div class="ticket-field"><div class="field-label">Date</div><div class="field-value">' + escapeHtml(eventDate) + '</div></div>' +
            '<div class="ticket-field"><div class="field-label">Time</div><div class="field-value">9:00 AM Prompt</div></div>' +
            '<div class="ticket-field"><div class="field-label">Venue</div><div class="field-value">' + escapeHtml(eventVenue) + '</div></div>' +
          '</div>' +
        '</div>' +
        '<!-- TEAR LINE -->' +
        '<div class="ticket-tear">' +
          '<div class="tear-circle tear-top"></div>' +
          '<div class="tear-line"></div>' +
          '<div class="tear-circle tear-bottom"></div>' +
        '</div>' +
        '<!-- RIGHT: White 20% -->' +
        '<div class="ticket-right">' +
          '<div class="ticket-right-content">' +
            profileImgHtml +
            '<div id="qrCode" class="ticket-qr-container"></div>' +
            '<div class="qr-label">SCAN AT GATE</div>' +
            '<div class="ticket-right-id">' + escapeHtml(data.regId) + '</div>' +
            '<div class="ticket-right-status ' + statusClass + '">' + statusLabel + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ticket-bottom-bar">' +
        '<span class="powered">Powered by <strong>SilverVerse</strong></span>' +
        '<span class="ticket-id-small">' + escapeHtml(data.regId) + '</span>' +
      '</div>';

    generateQRCode(data.regId);

    var receiptLink = document.getElementById('viewReceiptLink');
    if (receiptLink) {
      receiptLink.href = 'receipt.html?id=' + encodeURIComponent(data.regId);
    }
  }

  function generateQRCode(text) {
    var container = document.getElementById('qrCode');
    if (!container) return;

    if (typeof QRCode !== 'undefined') {
      try {
        new QRCode(container, {
          text: text,
          width: 120,
          height: 120,
          colorDark: '#1f2937',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (_e) {
        container.innerHTML = '<img src="/api/qr/' + encodeURIComponent(text) + '" alt="QR Code" width="120" height="120" loading="lazy">';
      }
    } else {
      container.innerHTML = '<img src="/api/qr/' + encodeURIComponent(text) + '" alt="QR Code" width="120" height="120" loading="lazy">';
    }
  }

  /* ═══ EXPORT FUNCTIONS ═══ */
  window.downloadAsPDF = function () {
    var ticketCapture = document.getElementById('ticket');
    if (!ticketCapture) return;

    var pdfBtn = document.getElementById('pdfBtn');
    if (pdfBtn) { pdfBtn.disabled = true; pdfBtn.textContent = 'Generating...'; }

    html2canvas(ticketCapture, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false
    }).then(function (canvas) {
      var jsPDF = window.jspdf ? window.jspdf.jsPDF : null;
      if (!jsPDF) {
        showToast('PDF library not loaded. Please try printing instead.', 'error');
        if (pdfBtn) { pdfBtn.disabled = false; pdfBtn.innerHTML = '<svg style="width:16px;height:16px;"><use href="#icon-download"/></svg> Save as PDF'; }
        return;
      }

      var imgData = canvas.toDataURL('image/png');
      var pdf = new jsPDF('p', 'mm', 'a4');
      var pdfWidth = pdf.internal.pageSize.getWidth();
      var pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      var fileName = ticketData ? 'SilverVerse-Ticket-' + ticketData.regId + '.pdf' : 'SilverVerse-Ticket.pdf';
      pdf.save(fileName);

      if (pdfBtn) { pdfBtn.disabled = false; pdfBtn.innerHTML = '<svg style="width:16px;height:16px;"><use href="#icon-download"/></svg> Save as PDF'; }
      showToast('PDF downloaded successfully!');
    }).catch(function () {
      showToast('Failed to generate PDF. Please use the print button.', 'error');
      if (pdfBtn) { pdfBtn.disabled = false; pdfBtn.innerHTML = '<svg style="width:16px;height:16px;"><use href="#icon-download"/></svg> Save as PDF'; }
    });
  };

  window.downloadAsPNG = function () {
    var ticketCapture = document.getElementById('ticket');
    if (!ticketCapture) return;

    var pngBtn = document.getElementById('pngBtn');
    if (pngBtn) { pngBtn.disabled = true; pngBtn.textContent = 'Generating...'; }

    html2canvas(ticketCapture, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false
    }).then(function (canvas) {
      var link = document.createElement('a');
      link.download = ticketData ? 'SilverVerse-Ticket-' + ticketData.regId + '.png' : 'SilverVerse-Ticket.png';
      link.href = canvas.toDataURL('image/png');
      link.click();

      if (pngBtn) { pngBtn.disabled = false; pngBtn.innerHTML = '<svg style="width:16px;height:16px;"><use href="#icon-image"/></svg> Save as PNG'; }
      showToast('PNG downloaded successfully!');
    }).catch(function () {
      showToast('Failed to generate PNG.', 'error');
      if (pngBtn) { pngBtn.disabled = false; pngBtn.innerHTML = '<svg style="width:16px;height:16px;"><use href="#icon-image"/></svg> Save as PNG'; }
    });
  };

  window.shareTicket = function () {
    var shareData = {
      title: 'My SilverVerse E-Ticket',
      text: 'Check out my e-ticket for Voices & Visions Festival 2026!',
      url: window.location.href
    };

    if (navigator.share) {
      navigator.share(shareData).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).then(function () {
        showToast('Link copied to clipboard!');
      });
    } else {
      prompt('Copy this link:', window.location.href);
    }
  };

  function formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
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

  loadTicket();
});
