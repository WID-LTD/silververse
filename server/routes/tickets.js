const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSQL, isDBEnabled, getMemRegistrations, getMemEvents } = require('../db');
const QRCode = require('qrcode');

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function camelRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id || row.userId,
    regId: row.reg_id || row.regId,
    eventId: row.event_id || row.eventId,
    firstName: row.first_name || row.firstName,
    lastName: row.last_name || row.lastName,
    email: row.email,
    phone: row.phone,
    category: row.category,
    subCategory: row.sub_category || row.subCategory || '',
    ticketType: row.ticket_type || row.ticketType || 'Regular',
    talent: row.talent || '',
    talentDescription: row.talent_description || row.talentDescription || '',
    perfTime: row.perf_time || row.perfTime || '',
    profileImage: row.profile_image || row.profileImage || '',
    qrCode: row.qr_code || row.qrCode || '',
    paymentStatus: row.payment_status || row.paymentStatus || 'pending',
    paymentTxRef: row.payment_tx_ref || row.paymentTxRef || '',
    amountPaid: parseFloat(row.amount_paid || row.amountPaid || 0),
    checkedIn: row.checked_in ?? row.checkedIn ?? false,
    checkedInTime: row.checked_in_time || row.checkedInTime || null,
    createdAt: row.created_at || row.createdAt || '',
    eventName: row.event_name || row.eventName || '',
    eventDate: row.event_date || row.eventDate || null,
    eventVenue: row.event_venue || row.eventVenue || '',
  };
}

// GET /:regId — Ticket data for display (requireAuth)
router.get('/:regId', requireAuth, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`
        SELECT r.*, e.name as event_name, e.event_date, e.venue as event_venue
        FROM registrations r
        LEFT JOIN events e ON r.event_id = e.id
        WHERE r.reg_id = ${req.params.regId}
      `;
      if (result.length === 0) return res.status(404).json({ success: false, message: 'Registration not found' });
      res.json({ success: true, data: camelRow(result[0]) });
    } else {
      const reg = getMemRegistrations().find(r => r.reg_id === req.params.regId);
      if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });
      const events = getMemEvents();
      const event = events.find(e => e.id === reg.event_id);
      const enriched = {
        ...reg,
        event_name: event ? event.name : '',
        event_date: event ? event.event_date : null,
        event_venue: event ? event.venue : '',
      };
      res.json({ success: true, data: camelRow(enriched) });
    }
  } catch (err) {
    console.error('Ticket data error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:regId/download — Download ticket as PDF/HTML (requireAuth)
router.get('/:regId/download', requireAuth, async (req, res) => {
  try {
    const { format } = req.query;
    if (!format || !['pdf', 'html'].includes(format)) {
      return res.status(400).json({ success: false, message: 'format must be pdf or html' });
    }

    let reg;
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`
        SELECT r.*, e.name as event_name, e.event_date, e.venue as event_venue
        FROM registrations r
        LEFT JOIN events e ON r.event_id = e.id
        WHERE r.reg_id = ${req.params.regId}
      `;
      if (result.length === 0) return res.status(404).json({ success: false, message: 'Registration not found' });
      reg = camelRow(result[0]);
    } else {
      const r = getMemRegistrations().find(r => r.reg_id === req.params.regId);
      if (!r) return res.status(404).json({ success: false, message: 'Registration not found' });
      const events = getMemEvents();
      const event = events.find(e => e.id === r.event_id);
      reg = camelRow({ ...r, event_name: event ? event.name : '', event_date: event ? event.event_date : null, event_venue: event ? event.venue : '' });
    }

    if (format === 'html') {
      var name = (reg.firstName || '') + ' ' + (reg.lastName || '');
      var statusLabel = (reg.paymentStatus === 'verified' || reg.paymentStatus === 'approved') ? 'VERIFIED' : 'PENDING';
      var qrDataUrl = '';
      try { qrDataUrl = await QRCode.toDataURL(reg.regId || 'ticket', { width: 200, margin: 1 }); } catch (_) {}
      var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + reg.regId + ' Ticket</title>';
      html += '<style>body{font-family:sans-serif;display:flex;justify-content:center;padding:40px;background:#eee;}';
      html += '.ticket{width:600px;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);overflow:hidden;}';
      html += '.ticket-header{background:linear-gradient(135deg,#d4af37,#f5d97e);padding:24px;text-align:center;}';
      html += '.ticket-header h1{margin:0;font-size:22px;color:#111;}';
      html += '.ticket-header p{margin:4px 0 0;font-size:14px;color:#333;}';
      html += '.ticket-body{padding:24px;}';
      html += '.ticket-body table{width:100%;border-collapse:collapse;}';
      html += '.ticket-body td{padding:8px 4px;border-bottom:1px solid #eee;font-size:13px;}';
      html += '.ticket-body td:first-child{color:#888;width:120px;}';
      html += '.ticket-footer{background:#f8f8f8;padding:12px;text-align:center;font-size:10px;color:#aaa;}';
      html += '.qr{text-align:center;margin:16px 0;}';
      html += '</style></head><body>';
      html += '<div class="ticket"><div class="ticket-header"><h1>SilverVerse Festival</h1><p>' + reg.regId + '</p></div>';
      html += '<div class="ticket-body">';
      if (qrDataUrl) html += '<div class="qr"><img src="' + qrDataUrl + '" alt="QR" width="120" height="120"></div>';
      html += '<table><tr><td>Name</td><td>' + esc(name) + '</td></tr>';
      html += '<tr><td>Email</td><td>' + esc(reg.email || '') + '</td></tr>';
      html += '<tr><td>Category</td><td>' + esc(reg.category || '') + '</td></tr>';
      html += '<tr><td>Ticket Type</td><td>' + esc(reg.ticketType || 'Regular') + '</td></tr>';
      html += '<tr><td>Status</td><td>' + statusLabel + '</td></tr>';
      html += '<tr><td>Event</td><td>' + esc(reg.eventName || 'Voices & Visions Festival') + '</td></tr>';
      html += '<tr><td>Venue</td><td>' + esc(reg.eventVenue || 'Rochas Foundation, Ideato, Orlu, Imo State') + '</td></tr>';
      if (reg.eventDate) html += '<tr><td>Date</td><td>' + esc(reg.eventDate) + '</td></tr>';
      html += '</table></div>';
      html += '<div class="ticket-footer">Generated by SilverVerse Admin</div></div></body></html>';
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } else {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + reg.regId + '_ticket.pdf"');
      doc.pipe(res);
      doc.fontSize(22).text('SilverVerse Festival', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).text('Ticket - ' + reg.regId, { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(11);
      doc.text('Name: ' + (reg.firstName || '') + ' ' + (reg.lastName || ''));
      doc.text('Email: ' + (reg.email || ''));
      doc.text('Category: ' + (reg.category || ''));
      doc.text('Ticket Type: ' + (reg.ticketType || 'Regular'));
      doc.text('Status: ' + ((reg.paymentStatus === 'verified' || reg.paymentStatus === 'approved') ? 'VERIFIED' : 'PENDING'));
      doc.moveDown(0.5);
      doc.text('Event: ' + (reg.eventName || 'Voices & Visions Festival'));
      doc.text('Venue: ' + (reg.eventVenue || 'Rochas Foundation, Ideato, Orlu, Imo State'));
      if (reg.eventDate) doc.text('Date: ' + reg.eventDate);
      doc.moveDown(1);
      doc.fontSize(8).text('Generated by SilverVerse Admin', { align: 'center' });
      doc.end();
    }
  } catch (err) {
    console.error('Ticket download error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:regId/qr — QR code image for ticket
router.get('/:regId/qr', async (req, res) => {
  try {
    const QRCode = require('qrcode');
    var qrBuf = await QRCode.toBuffer(req.params.regId, { width: 300, margin: 2, color: { dark: '#000', light: '#fff' } });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(qrBuf);
  } catch (err) {
    console.error('QR error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /bulk-print — Print multiple tickets (4 per A4 page, 2×2 grid)
router.post('/bulk-print', requireAuth, async (req, res) => {
  try {
    var ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
    }
    if (ids.length > 200) {
      return res.status(400).json({ success: false, message: 'Maximum 200 tickets per batch' });
    }

    // Fetch all registrations
    var regs = [];
    for (var i = 0; i < ids.length; i++) {
      var regId = ids[i];
      var r;
      if (isDBEnabled()) {
        var sql = getSQL();
        var result = await sql`
          SELECT r.*, e.name as event_name, e.event_date, e.venue as event_venue
          FROM registrations r
          LEFT JOIN events e ON r.event_id = e.id
          WHERE r.reg_id = ${regId}
        `;
        if (result.length > 0) r = camelRow(result[0]);
      } else {
        var mem = getMemRegistrations().find(function (x) { return x.reg_id === regId; });
        if (mem) {
          var events = getMemEvents();
          var ev = events.find(function (e) { return e.id === mem.event_id; });
          r = camelRow({ ...mem, event_name: ev ? ev.name : '', event_date: ev ? ev.event_date : null, event_venue: ev ? ev.venue : '' });
        }
      }
      if (r) regs.push(r);
    }

    if (regs.length === 0) {
      return res.status(404).json({ success: false, message: 'No registrations found' });
    }

    // Generate QR data URLs in parallel
    var qrPromises = regs.map(function (reg) {
      return QRCode.toDataURL(reg.regId || 'ticket', { width: 120, margin: 1 }).catch(function () { return ''; });
    });
    var qrDataUrls = await Promise.all(qrPromises);

    // Build compact ticket HTML for each registration
    function ticketCard(reg, qrDataUrl, idx) {
      var name = esc((reg.firstName || '') + ' ' + (reg.lastName || ''));
      var cat = esc(reg.category || 'Spectator');
      var ticketType = esc(reg.ticketType || 'Regular');
      var statusLabel = (reg.paymentStatus === 'verified' || reg.paymentStatus === 'approved') ? 'VERIFIED' : 'PENDING';
      var statusClass = statusLabel === 'VERIFIED' ? 'status-approved' : 'status-pending';
      var eventDate = reg.eventDate ? esc(reg.eventDate) : '1 August 2026';
      var eventVenue = esc(reg.eventVenue || 'Rochas Foundation, Ideato, Orlu, Imo State');
      var eventName = esc(reg.eventName || 'Voices & Visions Festival 2026');
      var regNum = (reg.regId || '').replace('VV26-', '');

      return '<div class="ticket-cell">' +
        '<div class="compact-ticket">' +
          '<div class="ct-left">' +
            '<div class="ct-logo">SILVERVERSE</div>' +
            '<div class="ct-pass-type">' + cat.toUpperCase() + ' PASS</div>' +
            '<div class="ct-event-name">' + eventName + '</div>' +
            '<div class="ct-field"><span class="ct-label">Name</span><span class="ct-val">' + name + '</span></div>' +
            '<div class="ct-field"><span class="ct-label">Reg No.</span><span class="ct-val">' + esc(reg.regId || '') + '</span></div>' +
            '<div class="ct-field"><span class="ct-label">Category</span><span class="ct-val">' + cat + ' \u2014 ' + ticketType + '</span></div>' +
            '<div class="ct-field"><span class="ct-label">Date</span><span class="ct-val">' + eventDate + '</span></div>' +
            '<div class="ct-field"><span class="ct-label">Venue</span><span class="ct-val">' + eventVenue + '</span></div>' +
          '</div>' +
          '<div class="ct-tear"><div class="ct-tear-dot ct-tear-top"></div><div class="ct-tear-line"></div><div class="ct-tear-dot ct-tear-bottom"></div></div>' +
          '<div class="ct-right">' +
            (qrDataUrl ? '<div class="ct-qr"><img src="' + qrDataUrl + '" alt="QR" width="60" height="60"></div>' : '') +
            '<div class="ct-qr-label">SCAN AT GATE</div>' +
            '<div class="ct-right-id">' + esc(reg.regId || '') + '</div>' +
            '<div class="ct-right-status ' + statusClass + '">' + statusLabel + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    var pageGroups = [];
    for (var i = 0; i < regs.length; i += 4) {
      pageGroups.push(regs.slice(i, i + 4));
    }

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SilverVerse Tickets</title>';
    html += '<style>';
    html += '*{margin:0;padding:0;box-sizing:border-box;}';
    html += '@page{size:A4 landscape;margin:5mm;}';
    html += '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}';
    html += 'body{font-family:Arial,Helvetica,sans-serif;background:#eee;}';
    html += '.page{width:287mm;min-height:200mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:4mm;padding:0;page-break-after:always;}';
    html += '.page:last-child{page-break-after:auto;}';
    html += '.ticket-cell{display:flex;align-items:center;justify-content:center;overflow:hidden;}';
    html += '.compact-ticket{transform:rotate(90deg);width:130mm;height:94mm;transform-origin:center center;display:flex;border-radius:5px;overflow:hidden;box-shadow:0 1px 5px rgba(0,0,0,0.12);background:#fff;}';
    html += '.ct-left{flex:0 0 65%;background:linear-gradient(135deg,#1e3a5f 0%,#0f1f3a 50%,#0a1628 100%);color:#fff;padding:8px 10px;display:flex;flex-direction:column;gap:2px;position:relative;overflow:hidden;font-size:10px;}';
    html += '.ct-left::before{content:"";position:absolute;top:-30px;right:-30px;width:100px;height:100px;border-radius:50%;background:radial-gradient(circle,rgba(212,175,55,0.1) 0%,transparent 70%);pointer-events:none;}';
    html += '.ct-logo{font-size:12px;font-weight:800;letter-spacing:2px;color:#d4af37;}';
    html += '.ct-pass-type{font-size:8px;font-weight:700;letter-spacing:1px;color:rgba(212,175,55,0.8);margin-bottom:1px;}';
    html += '.ct-event-name{font-size:11px;font-weight:700;margin-bottom:3px;line-height:1.2;}';
    html += '.ct-field{display:flex;gap:3px;line-height:1.4;}';
    html += '.ct-label{color:rgba(255,255,255,0.55);white-space:nowrap;min-width:40px;font-size:9px;}';
    html += '.ct-val{color:#fff;font-weight:600;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}';
    html += '.ct-tear{flex:0 0 8px;background:#f0f0f0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:2px 0;}';
    html += '.ct-tear-dot{width:6px;height:6px;border-radius:50%;background:#fff;border:1px solid #ddd;}';
    html += '.ct-tear-line{flex:1;width:1px;background:linear-gradient(to bottom,transparent 0%,#ccc 30%,#ccc 70%,transparent 100%);}';
    html += '.ct-right{flex:0 0 27%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px 4px;gap:1px;}';
    html += '.ct-qr img{display:block;}';
    html += '.ct-qr-label{font-size:6px;font-weight:700;letter-spacing:1px;color:#1e3a5f;}';
    html += '.ct-right-id{font-size:8px;font-weight:700;color:#333;text-align:center;word-break:break-all;}';
    html += '.ct-right-status{font-size:7px;font-weight:700;padding:2px 8px;border-radius:3px;}';
    html += '.status-approved{background:#059669;color:#fff;}';
    html += '.status-pending{background:#f59e0b;color:#fff;}';
    html += '<\/style></head><body>';
    html += '<div id="printArea">';

    for (var p = 0; p < pageGroups.length; p++) {
      html += '<div class="page">';
      for (var t = 0; t < 4; t++) {
        if (t < pageGroups[p].length) {
          var idx = p * 4 + t;
          html += ticketCard(pageGroups[p][t], qrDataUrls[idx], idx);
        } else {
          html += '<div class="ticket-cell"></div>';
        }
      }
      html += '</div>';
    }

    html += '</div>';
    html += '<script>window.onload=function(){if(window.__autoPrint__!==false)setTimeout(function(){window.print()},500);};<\/script>';
    html += '</body></html>';

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Bulk print error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
