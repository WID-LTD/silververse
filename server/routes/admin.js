const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { getSQL, isDBEnabled, getMemUsers, getMemRegistrations, getMemEvents } = require('../db');

// GET /stats — Admin dashboard stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const regStats = await sql`
        SELECT
          COUNT(*)::int as total_registrations,
          COUNT(*) FILTER (WHERE checked_in)::int as checked_in,
          COUNT(*) FILTER (WHERE payment_status = 'pending')::int as pending,
          COALESCE(SUM(amount_paid), 0)::numeric as total_revenue,
          COUNT(*) FILTER (WHERE category = 'Contestant')::int as total_contestants
        FROM registrations
      `;
      const userStats = await sql`SELECT COUNT(*)::int as total_users FROM users`;

      res.json({
        success: true,
        data: {
          totalRegistrations: regStats[0].total_registrations,
          checkedIn: regStats[0].checked_in,
          pending: regStats[0].pending,
          totalRevenue: Number(regStats[0].total_revenue),
          totalUsers: userStats[0].total_users,
          totalContestants: regStats[0].total_contestants,
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
          totalRevenue: regs.reduce((sum, r) => sum + (r.amount_paid || 0), 0),
          totalUsers: users.length,
          totalContestants: regs.filter(r => r.category === 'Contestant').length,
        }
      });
    }
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /users — List all users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { search } = req.query;

    if (isDBEnabled()) {
      const sql = getSQL();
      let result;
      if (search) {
        const s = '%' + search + '%';
        result = await sql`
          SELECT id, username, email, phone, display_name, role, profile_image, known_ip, created_at, updated_at
          FROM users WHERE username ILIKE ${s} OR email ILIKE ${s} OR display_name ILIKE ${s}
          ORDER BY id ASC
        `;
      } else {
        result = await sql`
          SELECT id, username, email, phone, display_name, role, profile_image, known_ip, created_at, updated_at
          FROM users ORDER BY id ASC
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
        data: users.map(u => ({
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

// PUT /users/:id/role — Update user role
router.put('/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['user', 'admin', 'moderator'].includes(role)) {
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

// GET /events — List all events
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

// POST /events — Create event
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

// PUT /events/:id — Update event
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

module.exports = router;
