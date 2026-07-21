const express = require('express');
const QRCode = require('qrcode');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSQL, isDBEnabled, getMemRegistrations } = require('../db');

// GET /:regId — Ticket data for display (requireAuth)
router.get('/:regId', requireAuth, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`SELECT * FROM registrations WHERE reg_id = ${req.params.regId}`;
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
          talent: r.talent || '',
          perfTime: r.perf_time || '',
          profileImage: r.profile_image || '',
          paymentStatus: r.payment_status || 'pending',
          qrData: r.reg_id,
        }
      });
    } else {
      const reg = getMemRegistrations().find(r => r.reg_id === req.params.regId);
      if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

      res.json({
        success: true,
        data: {
          regId: reg.reg_id,
          firstName: reg.first_name,
          lastName: reg.last_name,
          category: reg.category,
          subCategory: reg.sub_category || '',
          ticketType: reg.ticket_type || 'Regular',
          talent: reg.talent || '',
          perfTime: reg.perf_time || '',
          profileImage: reg.profile_image || '',
          paymentStatus: reg.payment_status || 'pending',
          qrData: reg.reg_id,
        }
      });
    }
  } catch (err) {
    console.error('Ticket data error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
