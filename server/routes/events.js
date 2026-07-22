const express = require('express');
const router = express.Router();
const { getSQL, isDBEnabled, getMemEvents, getNextEventId } = require('../db');
const { requireAuth } = require('../middleware/auth');

function camelRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    eventDate: row.event_date || row.eventDate || null,
    eventTime: row.event_time || row.eventTime || '09:00:00',
    venue: row.venue || '',
    status: row.status || 'upcoming',
    isTrending: row.is_trending || row.isTrending || false,
    createdAt: row.created_at || row.createdAt || '',
  };
}

// GET /trending — Get trending event (public)
router.get('/trending', async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`SELECT * FROM events WHERE is_trending = true LIMIT 1`;
      if (result.length === 0) {
        const first = await sql`SELECT * FROM events ORDER BY id ASC LIMIT 1`;
        if (first.length === 0) return res.status(404).json({ success: false, message: 'No events found' });
        return res.json({ success: true, data: camelRow(first[0]) });
      }
      res.json({ success: true, data: camelRow(result[0]) });
    } else {
      const events = getMemEvents();
      let trending = events.find(e => e.is_trending);
      if (!trending) trending = events[0];
      if (!trending) return res.status(404).json({ success: false, message: 'No events found' });
      res.json({ success: true, data: camelRow(trending) });
    }
  } catch (err) {
    console.error('Trending event error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET / — List all events (public)
router.get('/', async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`SELECT * FROM events ORDER BY event_date ASC`;
      res.json({ success: true, data: result.map(camelRow) });
    } else {
      const events = getMemEvents();
      res.json({ success: true, data: events.map(camelRow) });
    }
  } catch (err) {
    console.error('List events error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id — Single event (public)
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID' });
    }

    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`SELECT * FROM events WHERE id = ${id}`;
      if (result.length === 0) return res.status(404).json({ success: false, message: 'Event not found' });
      res.json({ success: true, data: camelRow(result[0]) });
    } else {
      const event = getMemEvents().find(e => e.id === id);
      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
      res.json({ success: true, data: camelRow(event) });
    }
  } catch (err) {
    console.error('Get event error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST / — Create event (admin only)
router.post('/', requireAuth, async (req, res) => {
  try {
    if (req.session.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { name, description, event_date, venue, status } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Event name is required' });
    }

    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`
        INSERT INTO events (name, description, event_date, venue, status)
        VALUES (${name}, ${description || ''}, ${event_date || null}, ${venue || 'Rochas Foundation, Ideato, Orlu, Imo State'}, ${status || 'upcoming'})
        RETURNING *
      `;
      res.json({ success: true, data: camelRow(result[0]) });
    } else {
      const events = getMemEvents();
      const newEvent = {
        id: getNextEventId(),
        name,
        description: description || '',
        event_date: event_date || null,
        venue: venue || 'Rochas Foundation, Ideato, Orlu, Imo State',
        status: status || 'upcoming',
        created_at: new Date().toISOString(),
      };
      events.push(newEvent);
      res.json({ success: true, data: camelRow(newEvent) });
    }
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id — Update event (admin only)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    if (req.session.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID' });
    }

    const { name, description, event_date, venue, status } = req.body;

    if (isDBEnabled()) {
      const sql = getSQL();
      const existing = await sql`SELECT * FROM events WHERE id = ${id}`;
      if (existing.length === 0) return res.status(404).json({ success: false, message: 'Event not found' });

      const result = await sql`
        UPDATE events SET
          name = ${name ?? existing[0].name},
          description = ${description ?? existing[0].description},
          event_date = ${event_date ?? existing[0].event_date},
          venue = ${venue ?? existing[0].venue},
          status = ${status ?? existing[0].status}
        WHERE id = ${id}
        RETURNING *
      `;
      res.json({ success: true, data: camelRow(result[0]) });
    } else {
      const events = getMemEvents();
      const event = events.find(e => e.id === id);
      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

      if (name != null) event.name = name;
      if (description != null) event.description = description;
      if (event_date != null) event.event_date = event_date;
      if (venue != null) event.venue = venue;
      if (status != null) event.status = status;

      res.json({ success: true, data: camelRow(event) });
    }
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /:id — Delete event (admin only)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (req.session.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID' });
    }

    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`DELETE FROM events WHERE id = ${id} RETURNING *`;
      if (result.length === 0) return res.status(404).json({ success: false, message: 'Event not found' });
      res.json({ success: true, data: camelRow(result[0]) });
    } else {
      const events = getMemEvents();
      const idx = events.findIndex(e => e.id === id);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Event not found' });
      const [removed] = events.splice(idx, 1);
      res.json({ success: true, data: camelRow(removed) });
    }
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
