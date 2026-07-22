const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { getSQL, isDBEnabled, getMemUsers, getMemRegistrations, getMemEvents } = require('../db');

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
  };
}

// ── GET /stats — Admin dashboard stats ──
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const regStats = await sql`
        SELECT
          COUNT(*)::int as total_registrations,
          COUNT(*) FILTER (WHERE checked_in)::int as checked_in,
          COUNT(*) FILTER (WHERE payment_status = 'pending')::int as pending,
          COUNT(*) FILTER (WHERE payment_status = 'verified')::int as verified_payments,
          COUNT(*) FILTER (WHERE payment_status = 'rejected')::int as rejected_payments,
          COALESCE(SUM(amount_paid), 0)::numeric as total_revenue,
          COUNT(*) FILTER (WHERE category = 'Contestant')::int as total_contestants,
          COUNT(*) FILTER (WHERE category = 'User')::int as total_users
        FROM registrations
      `;
      const userStats = await sql`SELECT COUNT(*)::int as total_users FROM users`;

      res.json({
        success: true,
        data: {
          totalRegistrations: regStats[0].total_registrations,
          checkedIn: regStats[0].checked_in,
          pending: regStats[0].pending,
          verifiedPayments: regStats[0].verified_payments,
          rejectedPayments: regStats[0].rejected_payments,
          totalRevenue: Number(regStats[0].total_revenue),
          totalUsers: userStats[0].total_users,
          totalContestants: regStats[0].total_contestants,
          totalSpectators: regStats[0].total_users,
        }
      });
    } else {
      const regs = getMemRegistrations();
      const users = getMemUsers();
      res.json({
        success: true,
        data: {
          totalRegistrations: regs.length,
          checkedIn: regs.filter(r => r.checked_in).length,
          pending: regs.filter(r => r.payment_status === 'pending').length,
          verifiedPayments: regs.filter(r => r.payment_status === 'verified').length,
          rejectedPayments: regs.filter(r => r.payment_status === 'rejected').length,
          totalRevenue: regs.reduce((sum, r) => sum + (r.amount_paid || 0), 0),
          totalUsers: users.length,
          totalContestants: regs.filter(r => r.category === 'Contestant').length,
          totalSpectators: regs.filter(r => r.category === 'User').length,
        }
      });
    }
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /payments — Payment breakdown by ticket type ──
router.get('/payments', requireAdmin, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const byType = await sql`
        SELECT
          ticket_type,
          COUNT(*)::int as count,
          COALESCE(SUM(amount_paid), 0)::numeric as revenue
        FROM registrations
        WHERE payment_status = 'verified'
        GROUP BY ticket_type
      `;
      const byStatus = await sql`
        SELECT payment_status, COUNT(*)::int as count
        FROM registrations
        GROUP BY payment_status
      `;
      res.json({
        success: true,
        data: {
          byType: byType.map(r => ({ type: r.ticket_type, count: r.count, revenue: Number(r.revenue) })),
          byStatus: byStatus.map(r => ({ status: r.payment_status, count: r.count })),
        }
      });
    } else {
      const regs = getMemRegistrations();
      const typeMap = {};
      const statusMap = {};
      regs.forEach(r => {
        const key = r.ticket_type || 'Regular';
        if (!typeMap[key]) typeMap[key] = { type: key, count: 0, revenue: 0 };
        if (r.payment_status === 'verified') {
          typeMap[key].count++;
          typeMap[key].revenue += r.amount_paid || 0;
        }
        const sKey = r.payment_status || 'pending';
        statusMap[sKey] = (statusMap[sKey] || 0) + 1;
      });
      res.json({
        success: true,
        data: {
          byType: Object.values(typeMap),
          byStatus: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
        }
      });
    }
  } catch (err) {
    console.error('Payment stats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /export/registrations — CSV export ──
router.get('/export/registrations', requireAdmin, async (req, res) => {
  try {
    let regs = [];
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`
        SELECT r.*, e.name as event_name
        FROM registrations r
        LEFT JOIN events e ON r.event_id = e.id
        ORDER BY r.id ASC
      `;
      regs = result;
    } else {
      regs = getMemRegistrations().map(r => {
        const events = getMemEvents();
        const event = events.find(e => e.id === r.event_id);
        return { ...r, event_name: event ? event.name : '' };
      });
    }

    const header = 'Reg ID,First Name,Last Name,Email,Phone,Category,Sub Category,Ticket Type,Talent,Talent Description,Payment Status,Amount Paid,Checked In,Event,Created At\n';
    const rows = regs.map(r => {
      const d = isDBEnabled() ? r : r;
      return [
        d.reg_id || '',
        d.first_name || '',
        d.last_name || '',
        d.email || '',
        d.phone || '',
        d.category || '',
        d.sub_category || '',
        d.ticket_type || 'Regular',
        d.talent || '',
        (d.talent_description || '').replace(/"/g, '""'),
        d.payment_status || 'pending',
        d.amount_paid || 0,
        d.checked_in ? 'Yes' : 'No',
        d.event_name || '',
        d.created_at || ''
      ].map(v => `"${v}"`).join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="silververse-registrations.csv"');
    res.send(header + rows);
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /users — List all users (with pagination) ──
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (isDBEnabled()) {
      const sql = getSQL();
      let result;
      if (search) {
        const s = '%' + search + '%';
        result = await sql`
          SELECT id, username, email, phone, display_name, role, profile_image, known_ip, created_at, updated_at
          FROM users WHERE username ILIKE ${s} OR email ILIKE ${s} OR display_name ILIKE ${s}
          ORDER BY id ASC
          LIMIT ${parseInt(limit)} OFFSET ${offset}
        `;
      } else {
        result = await sql`
          SELECT id, username, email, phone, display_name, role, profile_image, known_ip, created_at, updated_at
          FROM users ORDER BY id ASC
          LIMIT ${parseInt(limit)} OFFSET ${offset}
        `;
      }
      res.json({
        success: true,
        data: result.map(u => ({
          id: u.id, username: u.username, email: u.email, phone: u.phone,
          displayName: u.display_name, role: u.role, profileImage: u.profile_image,
          knownIp: u.known_ip, createdAt: u.created_at, updatedAt: u.updated_at
        }))
      });
    } else {
      let users = [...getMemUsers()];
      if (search) {
        const s = search.toLowerCase();
        users = users.filter(u =>
          u.username.toLowerCase().includes(s) ||
          u.email.toLowerCase().includes(s) ||
          u.display_name.toLowerCase().includes(s)
        );
      }
      res.json({
        success: true,
        data: users.slice(offset, offset + parseInt(limit)).map(u => ({
          id: u.id, username: u.username, email: u.email, phone: u.phone,
          displayName: u.display_name, role: u.role, profileImage: u.profile_image,
          knownIp: u.known_ip, createdAt: u.created_at, updatedAt: u.updated_at
        }))
      });
    }
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /users/:id/role — Update user role ──
router.put('/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['user', 'admin', 'moderator', 'contestant'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`
        UPDATE users SET role = ${role}, updated_at = NOW()
        WHERE id = ${parseInt(req.params.id)}
        RETURNING id, username, email, display_name, role
      `;
      if (result.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
      const u = result[0];
      res.json({
        success: true,
        data: { id: u.id, username: u.username, email: u.email, displayName: u.display_name, role: u.role }
      });
    } else {
      const users = getMemUsers();
      const user = users.find(u => u.id === parseInt(req.params.id));
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      user.role = role;
      user.updated_at = new Date().toISOString();
      res.json({
        success: true,
        data: { id: user.id, username: user.username, email: user.email, displayName: user.display_name, role: user.role }
      });
    }
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /users/:id — Delete user ──
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`DELETE FROM users WHERE id = ${parseInt(req.params.id)} RETURNING id, username`;
      if (result.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, message: `User "${result[0].username}" deleted` });
    } else {
      const users = getMemUsers();
      const idx = users.findIndex(u => u.id === parseInt(req.params.id));
      if (idx === -1) return res.status(404).json({ success: false, message: 'User not found' });
      const deleted = users.splice(idx, 1)[0];
      res.json({ success: true, message: `User "${deleted.username}" deleted` });
    }
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /events — List all events ──
router.get('/events', requireAdmin, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`SELECT * FROM events ORDER BY id ASC`;
      res.json({
        success: true,
        data: result.map(e => ({
          id: e.id, name: e.name, description: e.description,
          eventDate: e.event_date, venue: e.venue, status: e.status, createdAt: e.created_at
        }))
      });
    } else {
      const events = getMemEvents();
      res.json({
        success: true,
        data: events.map(e => ({
          id: e.id, name: e.name, description: e.description,
          eventDate: e.event_date, venue: e.venue, status: e.status, createdAt: e.created_at
        }))
      });
    }
  } catch (err) {
    console.error('Admin events error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /events — Create event ──
router.post('/events', requireAdmin, async (req, res) => {
  try {
    const { name, description, event_date, venue } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Event name required' });

    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`
        INSERT INTO events (name, description, event_date, venue)
        VALUES (${name}, ${description || ''}, ${event_date || null}, ${venue || 'Rochas Foundation, Ideato, Orlu, Imo State'})
        RETURNING *
      `;
      const e = result[0];
      res.json({
        success: true,
        data: { id: e.id, name: e.name, description: e.description, eventDate: e.event_date, venue: e.venue, status: e.status, createdAt: e.created_at }
      });
    } else {
      const events = getMemEvents();
      const newEvent = {
        id: events.length + 1, name, description: description || '',
        event_date: event_date || null, venue: venue || 'Rochas Foundation, Ideato, Orlu, Imo State',
        status: 'upcoming', created_at: new Date().toISOString()
      };
      events.push(newEvent);
      res.json({
        success: true,
        data: { id: newEvent.id, name: newEvent.name, description: newEvent.description, eventDate: newEvent.event_date, venue: newEvent.venue, status: newEvent.status, createdAt: newEvent.created_at }
      });
    }
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /events/:id — Update event ──
router.put('/events/:id', requireAdmin, async (req, res) => {
  try {
    const { name, description, event_date, venue, status } = req.body;

    if (isDBEnabled()) {
      const sql = getSQL();
      const existing = await sql`SELECT * FROM events WHERE id = ${parseInt(req.params.id)}`;
      if (existing.length === 0) return res.status(404).json({ success: false, message: 'Event not found' });

      const e = existing[0];
      const result = await sql`
        UPDATE events SET
          name = ${name || e.name},
          description = ${description || e.description},
          event_date = ${event_date || e.event_date},
          venue = ${venue || e.venue},
          status = ${status || e.status}
        WHERE id = ${parseInt(req.params.id)}
        RETURNING *
      `;
      const updated = result[0];
      res.json({
        success: true,
        data: { id: updated.id, name: updated.name, description: updated.description, eventDate: updated.event_date, venue: updated.venue, status: updated.status, createdAt: updated.created_at }
      });
    } else {
      const events = getMemEvents();
      const event = events.find(e => e.id === parseInt(req.params.id));
      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

      if (name) event.name = name;
      if (description) event.description = description;
      if (event_date) event.event_date = event_date;
      if (venue) event.venue = venue;
      if (status) event.status = status;

      res.json({
        success: true,
        data: { id: event.id, name: event.name, description: event.description, eventDate: event.event_date, venue: event.venue, status: event.status, createdAt: event.created_at }
      });
    }
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /events/:id — Delete event ──
router.delete('/events/:id', requireAdmin, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`DELETE FROM events WHERE id = ${parseInt(req.params.id)} RETURNING id, name`;
      if (result.length === 0) return res.status(404).json({ success: false, message: 'Event not found' });
      res.json({ success: true, message: `Event "${result[0].name}" deleted` });
    } else {
      const events = getMemEvents();
      const idx = events.findIndex(e => e.id === parseInt(req.params.id));
      if (idx === -1) return res.status(404).json({ success: false, message: 'Event not found' });
      const deleted = events.splice(idx, 1)[0];
      res.json({ success: true, message: `Event "${deleted.name}" deleted` });
    }
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /registrations/:id — Delete registration ──
router.delete('/registrations/:id', requireAdmin, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`DELETE FROM registrations WHERE id = ${parseInt(req.params.id)} RETURNING id, reg_id`;
      if (result.length === 0) return res.status(404).json({ success: false, message: 'Registration not found' });
      res.json({ success: true, message: `Registration "${result[0].reg_id}" deleted` });
    } else {
      const regs = getMemRegistrations();
      const idx = regs.findIndex(r => r.id === parseInt(req.params.id));
      if (idx === -1) return res.status(404).json({ success: false, message: 'Registration not found' });
      const deleted = regs.splice(idx, 1)[0];
      res.json({ success: true, message: `Registration "${deleted.reg_id}" deleted` });
    }
  } catch (err) {
    console.error('Delete registration error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
