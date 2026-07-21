const express = require('express');
const router = express.Router();
const { getSQL, isDBEnabled, getMemRegistrations, getMemEvents } = require('../db');

// GET /:regId — Public verification
router.get('/:regId', async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`
        SELECT r.*, e.name as event_name, e.event_date as event_date, e.venue as event_venue
        FROM registrations r
        LEFT JOIN events e ON r.event_id = e.id
        WHERE r.reg_id = ${req.params.regId}
      `;
      if (result.length === 0) return res.status(404).json({ success: false, message: 'Registration not found' });

      const r = result[0];
      res.json({
        success: true,
        data: {
          regId: r.reg_id,
          firstName: r.first_name,
          lastName: r.last_name,
          category: r.category,
          subCategory: r.sub_category || '',
          ticketType: r.ticket_type || 'Regular',
          paymentStatus: r.payment_status || 'pending',
          checkedIn: r.checked_in ?? false,
          checkedInTime: r.checked_in_time || null,
          eventName: r.event_name || '',
          eventDate: r.event_date || null,
          venue: r.event_venue || 'Rochas Foundation, Ideato, Orlu, Imo State',
        }
      });
    } else {
      const reg = getMemRegistrations().find(r => r.reg_id === req.params.regId);
      if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

      const events = getMemEvents();
      const event = events.find(e => e.id === reg.event_id) || null;

      res.json({
        success: true,
        data: {
          regId: reg.reg_id,
          firstName: reg.first_name,
          lastName: reg.last_name,
          category: reg.category,
          subCategory: reg.sub_category || '',
          ticketType: reg.ticket_type || 'Regular',
          paymentStatus: reg.payment_status || 'pending',
          checkedIn: reg.checked_in ?? false,
          checkedInTime: reg.checked_in_time || null,
          eventName: event ? event.name : '',
          eventDate: event ? event.event_date : null,
          venue: event ? event.venue : 'Rochas Foundation, Ideato, Orlu, Imo State',
        }
      });
    }
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
