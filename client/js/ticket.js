document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var ticketData = null;
  var ticketEl = document.getElementById('ticket');

  var ticketTemplates = {
    Spectator: { theme: 'ticket-theme-spectator', passType: 'SPECTATOR PASS', title: 'ADMISSION PASS' },
    VIP: { theme: 'ticket-theme-vip', passType: 'VIP ADMISSION PASS', title: 'VIP PASS' },
    VVIP: { theme: 'ticket-theme-vvip', passType: 'VVIP ADMISSION PASS', title: 'VVIP PASS' },
    Contestant: { theme: 'ticket-theme-contestant', passType: 'CONTESTANT PASS', title: 'CONTESTANT PASS' },
    Judge: { theme: 'ticket-theme-judge', passType: 'JUDGE PASS', title: 'JUDGE PASS' },
    Speaker: { theme: 'ticket-theme-speaker', passType: 'SPECIAL GUEST PASS', title: 'SPEAKER PASS' },
    Volunteer: { theme: 'ticket-theme-volunteer', passType: 'VOLUNTEER PASS', title: 'VOLUNTEER PASS' },
    Sponsor: { theme: 'ticket-theme-sponsor', passType: 'OFFICIAL SPONSOR PASS', title: 'SPONSOR PASS' },
    Staff: { theme: 'ticket-theme-staff', passType: 'STAFF PASS', title: 'STAFF PASS' },
    Media: { theme: 'ticket-theme-media', passType: 'MEDIA PASS', title: 'MEDIA PASS' }
  };

  function getSeatNumber(category, num) {
    var prefix = { Spectator: 'S', VIP: 'VIP', VVIP: 'VVIP', Contestant: 'CT', Judge: 'JD', Speaker: 'SP', Volunteer: 'VL', Sponsor: 'SR', Staff: 'ST', Media: 'MD' };
    return (prefix[category] || 'G') + '-' + String(num).padStart(3, '0');
  }

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
      } else if (data.regId) {
        ticketData = data;
      }
    } catch (_e) {}

    if (!ticketData) {
      try {
        var localData = localStorage.getItem('silververse_registrations');
        if (localData) {
          var all = JSON.parse(localData);
          ticketData = all.find(function (r) { return r.regId === regId; });
        }
      } catch (_e2) {}
    }

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
          '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>' +
        '</div>' +
        '<h2>' + escapeHtml(msg) + '</h2>' +
        '<p>Please register first to receive your e-ticket.</p>' +
        '<a href="register.html" class="btn btn-primary">Register Now</a>' +
      '</div>';
  }

  function renderTicket(data) {
    var tmpl = ticketTemplates[data.category] || ticketTemplates.Spectator;
    var regNum = (data.regId || '').replace('VV26-', '');
    var seat = getSeatNumber(data.category, parseInt(regNum) || 1);
    var statusLabel = (data.paymentStatus === 'verified' || data.paymentStatus === 'approved') ? 'APPROVED' : 'PENDING';
    var statusClass = statusLabel === 'APPROVED' ? 'status-approved' : 'status-pending';

    var profileImgHtml = '';
    if (data.profileImage) {
      profileImgHtml = '<div style="margin-bottom:12px;"><img src="' + escapeAttr(data.profileImage) + '" alt="Profile" width="48" height="48" style="border-radius:50%;border:2px solid rgba(255,255,255,0.3);object-fit:cover;" loading="lazy"></div>';
    }

    var extraHTML = '';
    if (data.category === 'Contestant' && data.talent) {
      extraHTML =
        '<div class="ticket-field"><div class="field-label">Talent</div><div class="field-value">' + escapeHtml(data.talent) + '</div></div>' +
        '<div class="ticket-field"><div class="field-label">Contest Number</div><div class="field-value">SG-' + String(parseInt(regNum) || 1).padStart(3, '0') + '</div></div>' +
        '<div class="ticket-field"><div class="field-label">Performance Time</div><div class="field-value">' + escapeHtml(data.perfTime || 'TBA') + '</div></div>';
    } else if (data.category === 'Judge') {
      extraHTML =
        '<div class="ticket-field"><div class="field-label">Judge Number</div><div class="field-value">JD-' + String(parseInt(regNum) || 1).padStart(2, '0') + '</div></div>' +
        '<div class="ticket-field"><div class="field-label">Access</div><div class="field-value">VIP + Backstage</div></div>';
    } else if (data.category === 'Volunteer' && data.department) {
      extraHTML =
        '<div class="ticket-field"><div class="field-label">Department</div><div class="field-value">' + escapeHtml(data.department) + '</div></div>' +
        '<div class="ticket-field"><div class="field-label">Access Level</div><div class="field-value">Backstage</div></div>';
    } else if (data.category === 'Media') {
      extraHTML = '<div class="ticket-field"><div class="field-label">Access Level</div><div class="field-value">Backstage + Media Area</div></div>';
    } else if (data.category === 'Speaker') {
      extraHTML = '<div class="ticket-field"><div class="field-label">Access Level</div><div class="field-value">VIP + Stage</div></div>';
    }

    ticketEl.innerHTML =
      '<div class="ticket-top ' + tmpl.theme + '">' +
        profileImgHtml +
        '<div class="pass-type">' + tmpl.passType + '</div>' +
        '<h2>Voices & Visions Festival 2026</h2>' +
        '<div class="event-name">SilverVerse Presents</div>' +
        '<div class="accent-line"></div>' +
      '</div>' +
      '<div class="ticket-perf"><div class="perf-line"></div></div>' +
      '<div class="ticket-body">' +
        '<div class="ticket-info-grid">' +
          '<div class="ticket-field"><div class="field-label">Registration No.</div><div class="field-value large">' + escapeHtml(data.regId) + '</div></div>' +
          '<div class="ticket-field"><div class="field-label">Name</div><div class="field-value">' + escapeHtml(data.firstName + ' ' + data.lastName) + '</div></div>' +
          '<div class="ticket-field"><div class="field-label">Category</div><div class="field-value">' + escapeHtml(data.category) + '</div></div>' +
          '<div class="ticket-field"><div class="field-label">Seat</div><div class="field-value">' + escapeHtml(seat) + '</div></div>' +
          '<div class="ticket-field"><div class="field-label">Status</div><div class="field-value ' + statusClass + '">' + statusLabel + '</div></div>' +
          '<div class="ticket-field"><div class="field-label">Venue</div><div class="field-value">Rochas Foundation, Ideato, Orlu, Imo State</div></div>' +
          '<div class="ticket-field"><div class="field-label">Date</div><div class="field-value">15 August 2026</div></div>' +
          '<div class="ticket-field"><div class="field-label">Time</div><div class="field-value">10:00 AM</div></div>' +
          extraHTML +
        '</div>' +
      '</div>' +
      '<div class="ticket-qr" id="qrSection">' +
        '<div id="qrCode"></div>' +
        '<div class="qr-label">Scan this QR code at the gate</div>' +
      '</div>' +
      '<div class="ticket-footer">' +
        '<div class="powered">Powered by <strong>SilverVerse</strong></div>' +
        '<div style="font-size:0.7rem;color:var(--gray-400);">' + escapeHtml(data.regId) + '</div>' +
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
          width: 160,
          height: 160,
          colorDark: '#1f2937',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (_e) {
        var canvas = document.createElement('canvas');
        canvas.id = 'qrCanvas';
        container.appendChild(canvas);
        if (typeof QRCode !== 'undefined' && QRCode.toCanvas) {
          QRCode.toCanvas(canvas, text, {
            width: 160, margin: 2,
            color: { dark: '#1f2937', light: '#ffffff' }
          });
        }
      }
    }
  }

  /* ═══ EXPORT FUNCTIONS ═══ */

  window.downloadAsPDF = function () {
    var ticketCapture = document.getElementById('ticket');
    if (!ticketCapture) return;

    var pdfBtn = document.getElementById('pdfBtn');
    if (pdfBtn) {
      pdfBtn.disabled = true;
      pdfBtn.textContent = 'Generating...';
    }

    html2canvas(ticketCapture, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
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
    if (pngBtn) {
      pngBtn.disabled = true;
      pngBtn.textContent = 'Generating...';
    }

    html2canvas(ticketCapture, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
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
      }).catch(function () {
        prompt('Copy this link:', window.location.href);
      });
    } else {
      prompt('Copy this link:', window.location.href);
    }
  };

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
