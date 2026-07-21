require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { neon } = require('@neondatabase/serverless');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const QRCode = require('qrcode');

const { setupDB, setSQL, setDBEnabled, getSQL, isDBEnabled, getMemRegistrations } = require('./db');
const { trackIP } = require('./middleware/ip');

const app = express();
const PORT = process.env.PORT || 10000;

// ── CORS ──
app.use((req, res, next) => {
  const origin = process.env.CORS_ORIGIN || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Middleware ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(trackIP);

// ── NeonDB (lazy init) ──
let DB_ENABLED = !!process.env.DATABASE_URL;
let sql = null;
if (DB_ENABLED) {
  try {
    sql = neon(process.env.DATABASE_URL);
    setSQL(sql);
    console.log('✓ NeonDB driver loaded');
  } catch (err) {
    console.error('⚠ NeonDB init failed:', err.message);
    DB_ENABLED = false;
    setDBEnabled(false);
  }
} else {
  console.log('⚠ No DATABASE_URL — running in local-only mode');
}

// ── Session Store (default in-memory) ──
let sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'silververse-secret-key-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true },
});
app.use(sessionMiddleware);

// ── Cloudflare R2 ──
const R2_ENABLED = !!process.env.R2_ENDPOINT;
const r2Client = R2_ENABLED ? new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
}) : null;
const R2_BUCKET = process.env.R2_BUCKET || 'silververse-uploads';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';
if (R2_ENABLED) console.log('✓ Cloudflare R2 connected');

// ── File Upload (Multer) ──
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// ── Upload profile image to R2 ──
const { requireAuth } = require('./middleware/auth');
app.post('/api/upload/profile', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });

    const ext = req.file.mimetype.split('/')[1];
    const key = `profiles/${req.session.userId}.${ext}`;

    if (R2_ENABLED) {
      await r2Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }));
    }

    const url = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key;

    if (isDBEnabled()) {
      const sqlFn = getSQL();
      await sqlFn`UPDATE users SET profile_image = ${url}, updated_at = NOW() WHERE id = ${req.session.userId}`;
    } else {
      const { getMemUsers } = require('./db');
      const user = getMemUsers().find(u => u.id === req.session.userId);
      if (user) user.profile_image = url;
    }

    res.json({ success: true, url });
  } catch (err) {
    console.error('Profile upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Mount Routes ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/payment', require('./routes/payments'));
app.use('/api/ticket', require('./routes/tickets'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/verify', require('./routes/verify'));

// ── QR Code (public) ──
app.get('/api/qr/:id', async (req, res) => {
  try {
    const buffer = await QRCode.toBuffer(req.params.id, {
      width: 300,
      margin: 2,
      color: { dark: '#1f2937', light: '#ffffff' }
    });
    res.type('image/png').send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Public stats / health check ──
app.get('/api/stats', async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sqlFn = getSQL();
      const result = await sqlFn`
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
          total_revenue: regs.reduce((sum, r) => sum + (r.amount_paid || 0), 0),
        }
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 404 ──
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Start Server ──
setupDB(sql).then(() => {
  // Upgrade to PG session store if DB is connected
  if (isDBEnabled() && sql) {
    try {
      const { Pool } = require('pg');
      const PgSession = require('connect-pg-simple')(session);
      const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
      const pgSessionStore = new PgSession({ pool: pgPool, tableName: 'session', createTableIfMissing: true });

      sessionMiddleware.store = pgSessionStore;
      console.log('✓ Session store upgraded to PostgreSQL');
    } catch (err) {
      console.error('⚠ PG session store failed, keeping MemoryStore:', err.message);
    }
  }

  app.listen(PORT, () => {
    console.log(`\n🎤 SilverVerse API Server`);
    console.log(`   API running at http://localhost:${PORT}`);
    console.log(`   DB: ${isDBEnabled() ? 'Connected' : 'In-memory fallback'}`);
    console.log(`   Routes: /api/auth, /api/registrations, /api/payment, /api/ticket, /api/admin, /api/verify, /api/stats\n`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
