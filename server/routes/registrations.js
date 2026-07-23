const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getSQL, isDBEnabled, getMemRegistrations, getNextRegIdMem, getMemEvents } = require('../db');

async function getNextRegId() {
  if (isDBEnabled()) {
    const sql = getSQL();
    const result = await sql`SELECT COUNT(*)::int as count FROM registrations`;
    const count = result[0]?.count || 0;
    return 'VV26-' + String(count + 1).padStart(4, '0');
  }
  return 'VV26-' + String(getNextRegIdMem()).padStart(4, '0');
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
    amountPaid: row.amount_paid || row.amountPaid || 0,
    checkedIn: row.checked_in ?? row.checkedIn ?? false,
    checkedInTime: row.checked_in_time || row.checkedInTime || null,
    createdAt: row.created_at || row.createdAt || '',
  };
}

// POST / — Create registration
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, category, subCategory,
      ticketType, talent, talentDescription, perfTime, eventId, amount,
      paymentTxRef, paymentStatus, profileImage
    } = req.body;

    if (!firstName || !lastName || !email || !phone || !category) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const regId = await getNextRegId();
    const userId = req.session.userId;

    if (isDBEnabled()) {
      const sql = getSQL();
      const events = getMemEvents();

      let resolvedEventId = eventId || null;
      if (!resolvedEventId) {
        const evts = await sql`SELECT id FROM events LIMIT 1`;
        if (evts.length > 0) resolvedEventId = evts[0].id;
      }

      const payStatus = paymentTxRef && paymentStatus ? paymentStatus : 'pending';
      await sql`
        INSERT INTO registrations (user_id, reg_id, event_id, first_name, last_name, email, phone, category, sub_category, ticket_type, talent, talent_description, perf_time, amount_paid, payment_status, payment_tx_ref, profile_image)
        VALUES (${userId}, ${regId}, ${resolvedEventId}, ${firstName}, ${lastName}, ${email.toLowerCase()}, ${phone}, ${category}, ${subCategory || ''}, ${ticketType || 'Regular'}, ${talent || ''}, ${talentDescription || ''}, ${perfTime || ''}, ${amount || 0}, ${payStatus}, ${paymentTxRef || ''}, ${profileImage || ''})
      `;
      res.json({ success: true, regId, message: `Registration successful! Your ID: ${regId}` });
    } else {
      const regs = getMemRegistrations();
      const events = getMemEvents();
      let resolvedEventId = eventId || (events.length > 0 ? events[0].id : null);

      regs.push({
        id: regs.length + 1, user_id: userId, reg_id: regId, event_id: resolvedEventId,
        first_name: firstName, last_name: lastName, email: email.toLowerCase(), phone,
        category, sub_category: subCategory || '', ticket_type: ticketType || 'Regular',
        talent: talent || '', talent_description: talentDescription || '',
        perf_time: perfTime || '', profile_image: profileImage || '', qr_code: '',
        payment_status: (paymentTxRef && paymentStatus) ? paymentStatus : 'pending',
        payment_tx_ref: paymentTxRef || '', amount_paid: amount || 0,
        checked_in: false, checked_in_time: null,
        created_at: new Date().toISOString()
      });
      res.json({ success: true, regId, message: `Registration successful! Your ID: ${regId}` });
    }
  } catch (err) {
    console.error('Create registration error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /contestants — Public: list approved contestants (for contestant page)
router.get('/contestants', async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const rows = await sql`SELECT id, user_id, reg_id, event_id, first_name, last_name, email, phone, category, sub_category, talent, talent_description, profile_image, created_at FROM registrations WHERE category = 'Contestant' ORDER BY created_at DESC`;
      return res.json({ success: true, data: rows.map(r => camelRow(r)) });
    }
    const regs = getMemRegistrations();
    const contestants = regs.filter(r => r.category === 'Contestant').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ success: true, data: contestants.map(r => camelRow(r)) });
  } catch (err) {
    console.error('Contestants error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET / — User's own registrations
router.get('/', requireAuth, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`SELECT * FROM registrations WHERE user_id = ${req.session.userId} ORDER BY id ASC`;
      res.json({ success: true, data: result.map(camelRow) });
    } else {
      const regs = getMemRegistrations().filter(r => r.user_id === req.session.userId);
      res.json({ success: true, data: regs.map(camelRow) });
    }
  } catch (err) {
    console.error('Get registrations error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /stats/summary — Admin only
router.get('/stats/summary', requireAdmin, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE checked_in)::int as checked_in,
          COUNT(*) FILTER (WHERE payment_status = 'pending')::int as pending,
          COUNT(*) FILTER (WHERE category = 'Contestant')::int as contestants,
          COALESCE(SUM(amount_paid), 0)::numeric as total_revenue
        FROM registrations
      `;
      res.json({ success: true, data: result[0] });
    } else {
      const regs = getMemRegistrations();
      res.json({
        success: true,
        data: {
          total: regs.length,
          checked_in: regs.filter(r => r.checked_in).length,
          pending: regs.filter(r => r.payment_status === 'pending').length,
          contestants: regs.filter(r => r.category === 'Contestant').length,
          total_revenue: regs.reduce((sum, r) => sum + (r.amount_paid || 0), 0)
        }
      });
    }
  } catch (err) {
    console.error('Stats summary error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /all — Admin: all registrations with filters
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const { category, search, payment_status } = req.query;

    if (isDBEnabled()) {
      const sql = getSQL();
      let results;
      if (search) {
        const s = '%' + search + '%';
        results = await sql`
          SELECT * FROM registrations
          WHERE reg_id ILIKE ${s} OR first_name ILIKE ${s} OR last_name ILIKE ${s} OR email ILIKE ${s}
          ORDER BY id ASC
        `;
      } else if (category && category !== 'all') {
        results = await sql`SELECT * FROM registrations WHERE category = ${category} ORDER BY id ASC`;
      } else {
        results = await sql`SELECT * FROM registrations ORDER BY id ASC`;
      }

      if (payment_status && payment_status !== 'all') {
        results = results.filter(r => r.payment_status === payment_status);
      }

      res.json({ success: true, data: results.map(camelRow) });
    } else {
      let regs = [...getMemRegistrations()];
      if (search) {
        const s = search.toLowerCase();
        regs = regs.filter(r =>
          r.reg_id.toLowerCase().includes(s) ||
          r.first_name.toLowerCase().includes(s) ||
          r.last_name.toLowerCase().includes(s) ||
          r.email.toLowerCase().includes(s)
        );
      }
      if (category && category !== 'all') {
        regs = regs.filter(r => r.category === category);
      }
      if (payment_status && payment_status !== 'all') {
        regs = regs.filter(r => r.payment_status === payment_status);
      }
      res.json({ success: true, data: regs.map(camelRow) });
    }
  } catch (err) {
    console.error('Get all registrations error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:regId — Single registration
router.get('/:regId', requireAuth, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`SELECT * FROM registrations WHERE reg_id = ${req.params.regId}`;
      if (result.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: camelRow(result[0]) });
    } else {
      const reg = getMemRegistrations().find(r => r.reg_id === req.params.regId);
      if (!reg) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: camelRow(reg) });
    }
  } catch (err) {
    console.error('Get registration error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:regId/checkin — Admin: toggle check-in
router.put('/:regId/checkin', requireAdmin, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`
        UPDATE registrations
        SET checked_in = NOT checked_in,
            checked_in_time = CASE WHEN NOT checked_in THEN NOW() ELSE NULL END
        WHERE reg_id = ${req.params.regId}
        RETURNING *
      `;
      if (result.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: camelRow(result[0]) });
    } else {
      const reg = getMemRegistrations().find(r => r.reg_id === req.params.regId);
      if (!reg) return res.status(404).json({ success: false, message: 'Not found' });
      reg.checked_in = !reg.checked_in;
      reg.checked_in_time = reg.checked_in ? new Date().toISOString() : null;
      res.json({ success: true, data: camelRow(reg) });
    }
  } catch (err) {
    console.error('Checkin error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:regId/verify — Admin: verify payment
router.put('/:regId/verify', requireAdmin, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`
        UPDATE registrations SET payment_status = 'verified'
        WHERE reg_id = ${req.params.regId}
        RETURNING *
      `;
      if (result.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: camelRow(result[0]) });
    } else {
      const reg = getMemRegistrations().find(r => r.reg_id === req.params.regId);
      if (!reg) return res.status(404).json({ success: false, message: 'Not found' });
      reg.payment_status = 'verified';
      res.json({ success: true, data: camelRow(reg) });
    }
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
