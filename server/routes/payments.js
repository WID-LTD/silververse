const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSQL, isDBEnabled, getMemRegistrations } = require('../db');

const TICKET_PRICES = { Regular: 3000, VIP: 5000, VVIP: 10000 };
const CALLBACK_URL = process.env.FLW_CALLBACK_URL || 'https://silververses.vercel.app/payment-success.html';
const FLW_ENABLED = !!(process.env.FLW_PUBLIC_KEY && process.env.FLW_SECRET_KEY);

let flw = null;
if (FLW_ENABLED) {
  const Flutterwave = require('flutterwave-node-v3');
  flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
}

// POST /initialize — Mobile money
router.post('/initialize', requireAuth, async (req, res) => {
  if (!FLW_ENABLED || !flw) {
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

// POST /card — Card payment
router.post('/card', requireAuth, async (req, res) => {
  if (!FLW_ENABLED || !flw) {
    return res.status(503).json({ success: false, message: 'Payment not configured' });
  }
  try {
    const { regId, email, firstName, lastName, phone, amount, ticketType, card_number, cvv, expiry_month, expiry_year } = req.body;
    const price = amount || TICKET_PRICES[ticketType] || 3000;

    const response = await flw.Charges.card({
      card_number, cvv, expiry_month, expiry_year,
      amount: price,
      currency: 'NGN',
      email: email || 'festival@silververse.com',
      phone_number: phone || '',
      fullname: `${firstName || ''} ${lastName || ''}`.trim(),
      tx_ref: regId || `SV-${Date.now()}`,
      redirect_url: CALLBACK_URL,
    });

    res.json({ success: true, data: response.data, message: response.message });
  } catch (err) {
    console.error('Card payment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /verify/:tx_ref — Verify transaction
router.get('/verify/:tx_ref', requireAuth, async (req, res) => {
  if (!FLW_ENABLED || !flw) {
    return res.status(503).json({ success: false, message: 'Payment not configured' });
  }
  try {
    const response = await flw.Transaction.verify({ id: req.params.tx_ref });

    if (response.status === 'success' && response.data.status === 'successful') {
      const txRef = response.data.tx_ref;

      if (isDBEnabled()) {
        const sql = getSQL();
        await sql`UPDATE registrations SET payment_status = 'verified', payment_tx_ref = ${txRef} WHERE reg_id = ${txRef} OR payment_tx_ref = ${txRef}`;
      } else {
        const reg = getMemRegistrations().find(r => r.reg_id === txRef || r.payment_tx_ref === txRef);
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

// POST /webhook — Flutterwave webhook (public)
router.post('/webhook', async (req, res) => {
  try {
    const secretHash = process.env.FLW_WEBHOOK_SECRET;
    const signature = req.headers['verif-hash'];

    if (secretHash && signature !== secretHash) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const payload = req.body;
    if (payload.status === 'successful') {
      const txRef = payload.tx_ref;

      if (isDBEnabled()) {
        const sql = getSQL();
        await sql`UPDATE registrations SET payment_status = 'verified' WHERE reg_id = ${txRef}`;
      } else {
        const reg = getMemRegistrations().find(r => r.reg_id === txRef);
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

// GET /config — Public config
router.get('/config', (req, res) => {
  res.json({
    publicKey: process.env.FLW_PUBLIC_KEY || '',
    enabled: FLW_ENABLED,
    prices: TICKET_PRICES,
    currency: 'NGN',
  });
});

module.exports = router;
