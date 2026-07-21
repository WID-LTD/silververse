require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const QRCode = require('qrcode');
const Flutterwave = require('flutterwave-node-v3');

const app = express();
const PORT = process.env.PORT || 10000;

// ── CORS (allow client on 5050) ──
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Middleware ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Flutterwave ──
const FLW_ENABLED = !!(process.env.FLW_PUBLIC_KEY && process.env.FLW_SECRET_KEY);
let flw = null;
if (FLW_ENABLED) {
  flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
  console.log('✓ Flutterwave initialized');
}

// ── NeonDB (lazy init) ──
let sql = null;
let DB_ENABLED = !!process.env.DATABASE_URL;
if (DB_ENABLED) {
  try {
    sql = neon(process.env.DATABASE_URL);
    console.log('✓ NeonDB driver loaded');
  } catch (err) {
    console.error('⚠ NeonDB init failed:', err.message);
    DB_ENABLED = false;
  }
} else {
  console.log('⚠ No DATABASE_URL — running in local-only mode (localStorage)');
}

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// ── In-memory fallback store (when no DB) ──
let memStore = [];
let memCounter = 0;

// ── DB Init ──
async function initDB() {
  if (!DB_ENABLED) {
    console.log('⚠ Using in-memory store (data resets on restart)');
    return;
  }
  try {
    const testPromise = sql`SELECT 1 as test`;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 5000));
    await Promise.race([testPromise, timeoutPromise]);
    console.log('✓ NeonDB connected');
    await sql`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        reg_id VARCHAR(20) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(200) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        category VARCHAR(50) NOT NULL,
        ticket_type VARCHAR(20) NOT NULL DEFAULT 'Regular',
        talent VARCHAR(100),
        perf_time VARCHAR(50),
        department VARCHAR(100),
        dietary TEXT,
        receipt_url TEXT,
        payment_status VARCHAR(20) DEFAULT 'pending',
        checked_in BOOLEAN DEFAULT FALSE,
        checked_in_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✓ Database tables ready');
  } catch (err) {
    console.error('⚠ Database unavailable, falling back to in-memory:', err.message);
    DB_ENABLED = false;
  }
}

// ── Generate next Registration ID ──
async function getNextRegId() {
  if (!DB_ENABLED) {
    memCounter++;
    return 'VV26-' + String(memCounter).padStart(4, '0');
  }
  const result = await sql`SELECT COUNT(*)::int as count FROM registrations`;
  const count = result[0]?.count || 0;
  return 'VV26-' + String(count + 1).padStart(4, '0');
}

// ── Upload receipt to R2 ──
async function uploadToR2(file, regId) {
  if (!file || !R2_ENABLED) return null;

  const ext = file.mimetype === 'application/pdf' ? '.pdf' : '.' + file.mimetype.split('/')[1];
  const key = `receipts/${regId}${ext}`;

  await r2Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));

  return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key;
}

// ── Helpers to normalize row keys (snake_case → camelCase) ──
function camelRow(row) {
  if (!row) return null;
  return {
    regId: row.reg_id || row.regId,
    firstName: row.first_name || row.firstName,
    lastName: row.last_name || row.lastName,
    email: row.email,
    phone: row.phone,
    category: row.category,
    ticketType: row.ticket_type || row.ticketType,
    talent: row.talent || '',
    perfTime: row.perf_time || row.perfTime || '',
    department: row.department || '',
    dietary: row.dietary || '',
    receiptUrl: row.receipt_url || row.receiptUrl || '',
    paymentStatus: row.payment_status || row.paymentStatus || 'pending',
    checkedIn: row.checked_in ?? row.checkedIn ?? false,
    checkedInTime: row.checked_in_time || row.checkedInTime || null,
    createdAt: row.created_at || row.createdAt || '',
  };
}

// ═══════════════════════════════════════
// API Routes
// ═══════════════════════════════════════

// POST /api/register
app.post('/api/register', upload.single('receiptFile'), async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, category,
      ticketType, talent, perfTime, department, dietary
    } = req.body;

    const regId = await getNextRegId();

    // Upload receipt to R2
    let receiptUrl = null;
    if (req.file) {
      receiptUrl = await uploadToR2(req.file, regId);
    }

    const now = new Date().toISOString();

    if (DB_ENABLED) {
      await sql`
        INSERT INTO registrations (reg_id, first_name, last_name, email, phone, category, ticket_type, talent, perf_time, department, dietary, receipt_url)
        VALUES (${regId}, ${firstName}, ${lastName}, ${email}, ${phone}, ${category}, ${ticketType || 'Regular'}, ${talent || ''}, ${perfTime || ''}, ${department || ''}, ${dietary || ''}, ${receiptUrl || ''})
      `;
    } else {
      memStore.push({
        reg_id: regId, first_name: firstName, last_name: lastName,
        email, phone, category, ticket_type: ticketType || 'Regular',
        talent: talent || '', perf_time: perfTime || '', department: department || '',
        dietary: dietary || '', receipt_url: receiptUrl || '',
        payment_status: 'pending', checked_in: false, checked_in_time: null, created_at: now,
      });
    }

    res.json({ success: true, regId, message: `Registration successful! Your ID: ${regId}` });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Registration failed: ' + err.message });
  }
});

// GET /api/registrations
app.get('/api/registrations', async (req, res) => {
  try {
    const { category, search } = req.query;

    let results;
    if (DB_ENABLED) {
      if (search) {
        results = await sql`
          SELECT * FROM registrations
          WHERE reg_id ILIKE ${'%' + search + '%'}
             OR first_name ILIKE ${'%' + search + '%'}
             OR last_name ILIKE ${'%' + search + '%'}
          ORDER BY id ASC
        `;
      } else if (category && category !== 'all') {
        results = await sql`SELECT * FROM registrations WHERE category = ${category} ORDER BY id ASC`;
      } else {
        results = await sql`SELECT * FROM registrations ORDER BY id ASC`;
      }
      results = results.map(camelRow);
    } else {
      results = memStore.map(camelRow);
      if (search) {
        const s = search.toLowerCase();
        results = results.filter(r =>
          r.regId.toLowerCase().includes(s) ||
          r.firstName.toLowerCase().includes(s) ||
          r.lastName.toLowerCase().includes(s)
        );
      }
      if (category && category !== 'all') {
        results = results.filter(r => r.category === category);
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/registration/:id
app.get('/api/registration/:id', async (req, res) => {
  try {
    let result;
    if (DB_ENABLED) {
      result = (await sql`SELECT * FROM registrations WHERE reg_id = ${req.params.id}`).map(camelRow);
    } else {
      result = memStore.filter(r => r.reg_id === req.params.id).map(camelRow);
    }
    if (!result.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: result[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/checkin/:id
app.put('/api/checkin/:id', async (req, res) => {
  try {
    if (DB_ENABLED) {
      const result = (await sql`
        UPDATE registrations
        SET checked_in = NOT checked_in,
            checked_in_time = CASE WHEN NOT checked_in THEN NOW() ELSE NULL END
        WHERE reg_id = ${req.params.id}
        RETURNING *
      `).map(camelRow);
      if (!result.length) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: result[0] });
    } else {
      const reg = memStore.find(r => r.reg_id === req.params.id);
      if (!reg) return res.status(404).json({ success: false, message: 'Not found' });
      reg.checked_in = !reg.checked_in;
      reg.checked_in_time = reg.checked_in ? new Date().toISOString() : null;
      res.json({ success: true, data: camelRow(reg) });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/verify/:id
app.put('/api/verify/:id', async (req, res) => {
  try {
    if (DB_ENABLED) {
      const result = (await sql`
        UPDATE registrations SET payment_status = 'verified'
        WHERE reg_id = ${req.params.id}
        RETURNING *
      `).map(camelRow);
      if (!result.length) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: result[0] });
    } else {
      const reg = memStore.find(r => r.reg_id === req.params.id);
      if (!reg) return res.status(404).json({ success: false, message: 'Not found' });
      reg.payment_status = 'verified';
      res.json({ success: true, data: camelRow(reg) });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/stats
app.get('/api/stats', async (req, res) => {
  try {
    if (DB_ENABLED) {
      const result = await sql`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE checked_in)::int as checked_in,
          COUNT(*) FILTER (WHERE NOT checked_in)::int as pending,
          COUNT(*) FILTER (WHERE category = 'Contestant')::int as contestants
        FROM registrations
      `;
      res.json({ success: true, data: result[0] });
    } else {
      res.json({
        success: true,
        data: {
          total: memStore.length,
          checked_in: memStore.filter(r => r.checked_in).length,
          pending: memStore.filter(r => !r.checked_in).length,
          contestants: memStore.filter(r => r.category === 'Contestant').length,
        }
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════
// FLUTTERWAVE PAYMENT ROUTES
// ═══════════════════════════════════════

const TICKET_PRICES = { Regular: 3000, VIP: 5000, VVIP: 10000 };
const CALLBACK_URL = process.env.FLW_CALLBACK_URL || `https://silververses.vercel.app/payment-success.html`;

// POST /api/payment/initialize — Create a Flutterwave payment link
app.post('/api/payment/initialize', async (req, res) => {
  if (!FLW_ENABLED) {
    return res.status(503).json({ success: false, message: 'Payment not configured' });
  }
  try {
    const { regId, email, firstName, lastName, phone, amount, ticketType } = req.body;
    const price = amount || TICKET_PRICES[ticketType] || 3000;

    const response = await flw.Charges.mobile_money({
      phone_number: phone,
      network: 'MTN',
      amount: price,
      currency: 'NGN',
      email: email || 'festival@silververse.com',
      tx_ref: regId || `SV-${Date.now()}`,
      callback: CALLBACK_URL,
    });

    if (response.status === 'success') {
      res.json({ success: true, data: response.data });
    } else {
      res.json({ success: false, message: response.message || 'Payment init failed' });
    }
  } catch (err) {
    console.error('Payment init error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/payment/card — Flutterwave Card (Rave) payment
app.post('/api/payment/card', async (req, res) => {
  if (!FLW_ENABLED) {
    return res.status(503).json({ success: false, message: 'Payment not configured' });
  }
  try {
    const { regId, email, firstName, lastName, phone, amount, ticketType, card_number, cvv, expiry_month, expiry_year } = req.body;
    const price = amount || TICKET_PRICES[ticketType] || 3000;

    const response = await flw.Charges.card({
      card_number,
      cvv,
      expiry_month,
      expiry_year,
      amount: price,
      currency: 'NGN',
      email: email || 'festival@silververse.com',
      phone_number: phone || '',
      fullname: `${firstName} ${lastName}`,
      tx_ref: regId || `SV-${Date.now()}`,
      redirect_url: CALLBACK_URL,
    });

    res.json({ success: true, data: response.data, message: response.message });
  } catch (err) {
    console.error('Card payment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/payment/verify/:tx_ref — Verify a Flutterwave transaction
app.get('/api/payment/verify/:tx_ref', async (req, res) => {
  if (!FLW_ENABLED) {
    return res.status(503).json({ success: false, message: 'Payment not configured' });
  }
  try {
    const response = await flw.Transaction.verify({ id: req.params.tx_ref });

    if (response.status === 'success' && response.data.status === 'successful') {
      const txRef = response.data.tx_ref;
      // Auto-verify the registration payment
      if (DB_ENABLED) {
        await sql`UPDATE registrations SET payment_status = 'verified' WHERE reg_id = ${txRef} OR tx_ref = ${txRef}`;
      } else {
        const reg = memStore.find(r => r.reg_id === txRef || r.tx_ref === txRef);
        if (reg) reg.payment_status = 'verified';
      }
      res.json({ success: true, data: response.data });
    } else {
      res.json({ success: false, message: 'Payment not successful', data: response.data });
    }
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/payment/webhook — Flutterwave webhook (IPN)
app.post('/api/payment/webhook', async (req, res) => {
  try {
    const secretHash = process.env.FLW_WEBHOOK_SECRET;
    const signature = req.headers['verif-hash'];

    if (secretHash && signature !== secretHash) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const payload = req.body;
    if (payload.status === 'successful') {
      const txRef = payload.tx_ref;
      if (DB_ENABLED) {
        await sql`UPDATE registrations SET payment_status = 'verified' WHERE reg_id = ${txRef}`;
      } else {
        const reg = memStore.find(r => r.reg_id === txRef);
        if (reg) reg.payment_status = 'verified';
      }
      console.log(`Payment verified via webhook: ${txRef}`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(500);
  }
});

// GET /api/payment/config — Expose public key for frontend
app.get('/api/payment/config', (req, res) => {
  res.json({
    publicKey: process.env.FLW_PUBLIC_KEY || '',
    enabled: FLW_ENABLED,
    prices: TICKET_PRICES,
    currency: 'NGN',
  });
});

// GET /api/qr/:id — Generate QR code as PNG
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

// ── Start Server ──
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🎤 SilverVerse API Server`);
    console.log(`   API running at http://localhost:${PORT}`);
    console.log(`   Endpoints: /api/register, /api/registrations, /api/checkin, /api/stats\n`);
  });
});
