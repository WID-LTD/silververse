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

module.exports = router;
