const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { getSQL, isDBEnabled, getMemUsers, getNextUserId } = require('../db');
const { requireAuth } = require('../middleware/auth');

// POST /check-username
router.post('/check-username', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, message: 'Username required' });

    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`SELECT id FROM users WHERE username = ${username.toLowerCase()}`;
      return res.json({ success: true, available: result.length === 0 });
    } else {
      const found = getMemUsers().find(u => u.username === username.toLowerCase());
      return res.json({ success: true, available: !found });
    }
  } catch (err) {
    console.error('Check username error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /signup
router.post('/signup', async (req, res) => {
  try {
    const { username, email, phone, password, displayName } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Username, email, and password are required' });
    }
    if (username.length > 50) {
      return res.status(400).json({ success: false, message: 'Username must be 50 characters or less' });
    }

    const lowerUsername = username.toLowerCase();
    const hash = bcrypt.hashSync(password, 10);

    if (isDBEnabled()) {
      const sql = getSQL();
      const existing = await sql`SELECT id FROM users WHERE username = ${lowerUsername} OR email = ${email.toLowerCase()}`;
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'Username or email already exists' });
      }

      const result = await sql`
        INSERT INTO users (username, email, phone, password_hash, display_name, known_ip)
        VALUES (${lowerUsername}, ${email.toLowerCase()}, ${phone || ''}, ${hash}, ${displayName || lowerUsername}, ${req.clientIP || 'unknown'})
        RETURNING id, username, role, display_name
      `;
      const user = result[0];

      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;

      res.json({
        success: true,
        user: { id: user.id, username: user.username, role: user.role, displayName: user.display_name }
      });
    } else {
      const users = getMemUsers();
      const exists = users.find(u => u.username === lowerUsername || u.email === email.toLowerCase());
      if (exists) {
        return res.status(409).json({ success: false, message: 'Username or email already exists' });
      }

      const id = getNextUserId();
      const newUser = {
        id, username: lowerUsername, email: email.toLowerCase(),
        phone: phone || '', password_hash: hash,
        display_name: displayName || lowerUsername,
        role: 'user', profile_image: '', known_ip: req.clientIP || 'unknown',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      };
      users.push(newUser);

      req.session.userId = id;
      req.session.username = lowerUsername;
      req.session.role = 'user';

      res.json({
        success: true,
        user: { id, username: lowerUsername, role: 'user', displayName: newUser.display_name }
      });
    }
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const lowerUsername = username.toLowerCase();

    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`SELECT * FROM users WHERE username = ${lowerUsername}`;
      if (result.length === 0) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const user = result[0];
      if (!bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      if (!user.known_ip) {
        // Auto-set if NULL (self-healing for pre-existing users)
        await sql`UPDATE users SET known_ip = ${req.clientIP}, updated_at = NOW() WHERE id = ${user.id}`;
      } else if (!user.known_ip.split(',').includes(req.clientIP)) {
        // Add new IP to comma-separated list (max 5)
        const ips = user.known_ip.split(',').filter(Boolean);
        ips.push(req.clientIP);
        const trimmed = ips.slice(-5).join(',');
        await sql`UPDATE users SET known_ip = ${trimmed}, updated_at = NOW() WHERE id = ${user.id}`;
      }

      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;

      res.json({
        success: true,
        user: { id: user.id, username: user.username, role: user.role, displayName: user.display_name }
      });
    } else {
      const users = getMemUsers();
      const user = users.find(u => u.username === lowerUsername);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      if (!bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      if (!user.known_ip) {
        user.known_ip = req.clientIP;
      } else if (!user.known_ip.split(',').includes(req.clientIP)) {
        const ips = user.known_ip.split(',').filter(Boolean);
        ips.push(req.clientIP);
        user.known_ip = ips.slice(-5).join(',');
      }
      user.updated_at = new Date().toISOString();

      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;

      res.json({
        success: true,
        user: { id: user.id, username: user.username, role: user.role, displayName: user.display_name }
      });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false, message: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// POST /forgot
router.post('/forgot', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, message: 'Username required' });

    const lowerUsername = username.toLowerCase();

    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`SELECT id, known_ip FROM users WHERE username = ${lowerUsername}`;
      if (result.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      const user = result[0];
      const knownIps = (user.known_ip || '').split(',').filter(Boolean);
      if (knownIps.length === 0 || knownIps.includes(req.clientIP)) {
        return res.json({ success: true, canReset: true });
      } else {
        return res.json({ success: true, canReset: false, message: 'Contact admin at silververse.ng@gmail.com' });
      }
    } else {
      const users = getMemUsers();
      const user = users.find(u => u.username === lowerUsername);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const knownIps = (user.known_ip || '').split(',').filter(Boolean);
      if (knownIps.length === 0 || knownIps.includes(req.clientIP)) {
        return res.json({ success: true, canReset: true });
      } else {
        return res.json({ success: true, canReset: false, message: 'Contact admin at silververse.ng@gmail.com' });
      }
    }
  } catch (err) {
    console.error('Forgot error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
      return res.status(400).json({ success: false, message: 'Username and new password required' });
    }

    const lowerUsername = username.toLowerCase();
    const hash = bcrypt.hashSync(newPassword, 10);

    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`SELECT id, known_ip FROM users WHERE username = ${lowerUsername}`;
      if (result.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      const user = result[0];
      const knownIps = (user.known_ip || '').split(',').filter(Boolean);
      if (knownIps.length > 0 && !knownIps.includes(req.clientIP)) {
        return res.status(403).json({ success: false, message: 'IP mismatch. Contact admin.' });
      }
      await sql`UPDATE users SET password_hash = ${hash}, updated_at = NOW() WHERE id = ${user.id}`;
      return res.json({ success: true });
    } else {
      const users = getMemUsers();
      const user = users.find(u => u.username === lowerUsername);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      const knownIps = (user.known_ip || '').split(',').filter(Boolean);
      if (knownIps.length > 0 && !knownIps.includes(req.clientIP)) {
        return res.status(403).json({ success: false, message: 'IP mismatch. Contact admin.' });
      }
      user.password_hash = hash;
      user.updated_at = new Date().toISOString();
      return res.json({ success: true });
    }
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /update - Update user profile (display name, email, phone, password)
router.put('/update', requireAuth, async (req, res) => {
  try {
    const { displayName, email, phone, currentPassword, newPassword } = req.body;
    const userId = req.session.userId;

    if (isDBEnabled()) {
      const sql = getSQL();
      const user = await sql`SELECT * FROM users WHERE id = ${userId}`;
      if (user.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

      let updates = [];
      let values = [];

      if (displayName) {
        updates.push('display_name');
        values.push(displayName);
      }
      if (email) {
        updates.push('email');
        values.push(email.toLowerCase());
      }
      if (phone) {
        updates.push('phone');
        values.push(phone);
      }

      if (newPassword) {
        if (!currentPassword) return res.status(400).json({ success: false, message: 'Current password required to set new password' });
        const valid = bcrypt.compareSync(currentPassword, user[0].password_hash);
        if (!valid) return res.status(403).json({ success: false, message: 'Current password is incorrect' });
        const hash = bcrypt.hashSync(newPassword, 10);
        updates.push('password_hash');
        values.push(hash);
      }

      if (updates.length > 0) {
        const setClauses = updates.map((col, i) => `${col} = $${i + 1}`).join(', ');
        values.push(userId);
        await sql.unsafe(`UPDATE users SET ${setClauses}, updated_at = NOW() WHERE id = $${values.length}`, values);
      }

      const updated = await sql`SELECT id, username, email, phone, display_name, role, profile_image FROM users WHERE id = ${userId}`;
      const u = updated[0];
      res.json({
        success: true,
        user: { id: u.id, username: u.username, email: u.email, phone: u.phone, role: u.role, displayName: u.display_name, profileImage: u.profile_image }
      });
    } else {
      const users = getMemUsers();
      const user = users.find(u => u.id === userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      if (displayName) user.display_name = displayName;
      if (email) user.email = email.toLowerCase();
      if (phone) user.phone = phone;

      if (newPassword) {
        if (!currentPassword) return res.status(400).json({ success: false, message: 'Current password required' });
        const valid = bcrypt.compareSync(currentPassword, user.password_hash);
        if (!valid) return res.status(403).json({ success: false, message: 'Current password is incorrect' });
        user.password_hash = bcrypt.hashSync(newPassword, 10);
      }

      user.updated_at = new Date().toISOString();
      res.json({
        success: true,
        user: { id: user.id, username: user.username, email: user.email, phone: user.phone, role: user.role, displayName: user.display_name, profileImage: user.profile_image }
      });
    }
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /me
router.get('/me', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`
        SELECT id, username, email, phone, display_name, role, profile_image, created_at
        FROM users WHERE id = ${req.session.userId}
      `;
      if (result.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      const u = result[0];
      res.json({
        success: true,
        user: {
          id: u.id, username: u.username, email: u.email, phone: u.phone,
          role: u.role, displayName: u.display_name, profileImage: u.profile_image,
          createdAt: u.created_at
        }
      });
    } else {
      const users = getMemUsers();
      const user = users.find(u => u.id === req.session.userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({
        success: true,
        user: {
          id: user.id, username: user.username, email: user.email, phone: user.phone,
          role: user.role, displayName: user.display_name, profileImage: user.profile_image,
          createdAt: user.created_at
        }
      });
    }
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
