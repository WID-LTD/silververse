const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSQL, isDBEnabled, getMemRegistrations, getMemEvents } = require('../db');

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

module.exports = router;
