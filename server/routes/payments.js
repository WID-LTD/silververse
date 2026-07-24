const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getSQL, isDBEnabled, getMemRegistrations } = require('../db');
const axios = require('axios');

const TICKET_PRICES = { Regular: 1000, VIP: 5000, VVIP: 10000 };
const CALLBACK_URL = process.env.FLW_CALLBACK_URL || 'https://silververses.vercel.app/payment-success.html';
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || '';
const FLW_PUBLIC_KEY = process.env.FLW_PUBLIC_KEY || '';
const FLW_ENABLED = !!(FLW_PUBLIC_KEY && FLW_SECRET_KEY);
const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

// ── Initiate payment ──
router.post('/init', async (req, res) => {
  if (!FLW_ENABLED) {
    return res.status(503).json({ success: false, message: 'Payment system is offline. Please contact support.' });
  }
  try {
    const { regId, email, firstName, lastName, phone, amount, ticketType, paymentMethod } = req.body;
    const price = amount || TICKET_PRICES[ticketType] || 1000;
    const txRef = regId || `SV-${Date.now()}`;

    var phoneClean = phone ? phone.replace(/^0+/, '') : '8000000000';
    var paymentOptions = paymentMethod === 'card' ? 'card' : 'card,opay,ussd';

    var payload = {
      tx_ref: txRef,
      amount: price,
      currency: 'NGN',
      redirect_url: CALLBACK_URL + '?tx_ref=' + encodeURIComponent(txRef),
      customer: {
        email: email || 'festival@silververse.com',
        name: (firstName || 'Festival') + ' ' + (lastName || 'Guest'),
        phonenumber: '234' + phoneClean,
      },
      meta: {
        reg_id: regId || '',
        ticket_type: ticketType || 'Regular',
      },
      customizations: {
        title: 'SilverVerse Ticket',
        description: 'Ticket purchase - ' + (ticketType || 'Regular'),
      },
      payment_options: paymentOptions,
    };

    var response = await axios.post(
      FLW_BASE_URL + '/payments',
      payload,
      {
        headers: {
          'Authorization': 'Bearer ' + FLW_SECRET_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    var charge = response.data;
    if (charge.status === 'success' && charge.data && charge.data.link) {
      if (isDBEnabled()) {
        var sql = getSQL();
        await sql`UPDATE registrations SET payment_tx_ref = ${txRef}, amount_paid = ${price} WHERE reg_id = ${regId}`;
      } else {
        var reg = getMemRegistrations().find(function(r) { return r.reg_id === regId; });
        if (reg) {
          reg.payment_tx_ref = txRef;
          reg.amount_paid = price;
        }
      }

      console.log('Payment init: ' + txRef + ' -> ' + charge.data.link);
      res.json({
        success: true,
        data: {
          txRef: txRef,
          redirect_url: charge.data.link,
          amount: price,
        }
      });
    } else {
      res.json({ success: false, message: charge.message || 'Payment initiation failed' });
    }
  } catch (err) {
    console.error('Payment init error:', err.response ? JSON.stringify(err.response.data) : err.message);
    res.status(500).json({
      success: false,
      message: (err.response && err.response.data && err.response.data.message) || err.message
    });
  }
});

// ── Verify payment ──
router.get('/verify/:tx_ref', async (req, res) => {
  if (!FLW_ENABLED) {
    return res.status(503).json({ success: false, message: 'Payment not configured' });
  }
  try {
    var txRef = req.params.tx_ref;
    var response = await axios.get(
      FLW_BASE_URL + '/transactions/' + encodeURIComponent(txRef) + '/verify',
      {
        headers: {
          'Authorization': 'Bearer ' + FLW_SECRET_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    var result = response.data;
    if (result.status === 'success' && result.data) {
      var trx = result.data;
      if (trx.status === 'successful') {
        if (isDBEnabled()) {
          var sql = getSQL();
          await sql`UPDATE registrations SET payment_status = 'verified', amount_paid = ${trx.amount} WHERE reg_id = ${txRef} OR payment_tx_ref = ${txRef}`;
        } else {
          var reg = getMemRegistrations().find(function(r) { return r.reg_id === txRef || r.payment_tx_ref === txRef; });
          if (reg) {
            reg.payment_status = 'verified';
            reg.amount_paid = trx.amount;
          }
        }
        console.log('Payment verified: ' + txRef);
        res.json({ success: true, data: trx });
      } else {
        res.json({ success: false, message: 'Payment not yet successful', status: trx.status });
      }
    } else {
      res.json({ success: false, message: 'Transaction not found' });
    }
  } catch (err) {
    console.error('Verify error:', err.response ? err.response.data : err.message);
    res.status(500).json({
      success: false,
      message: (err.response && err.response.data && err.response.data.message) || err.message
    });
  }
});

// ── Webhook ──
router.post('/webhook', async (req, res) => {
  try {
    var secretHash = process.env.FLW_WEBHOOK_SECRET;
    var signature = req.headers['verif-hash'];
    var rawBody = JSON.stringify(req.body);

    if (secretHash && signature) {
      var computed = crypto.createHmac('sha256', secretHash).update(rawBody).digest('hex');
      if (computed !== signature) {
        return res.status(401).json({ success: false, message: 'Invalid signature' });
      }
    }

    var payload = req.body;
    var event = payload.event || '';
    var data = payload.data || {};

    if (event === 'charge.completed' && data.status === 'successful') {
      var txRef = data.tx_ref || data.reference || '';
      var amount = data.amount || 0;

      if (isDBEnabled()) {
        var sql = getSQL();
        await sql`UPDATE registrations SET payment_status = 'verified', amount_paid = ${amount} WHERE reg_id = ${txRef} OR payment_tx_ref = ${txRef}`;
      } else {
        var reg = getMemRegistrations().find(function(r) { return r.reg_id === txRef || r.payment_tx_ref === txRef; });
        if (reg) {
          reg.payment_status = 'verified';
          reg.amount_paid = amount;
        }
      }
      console.log('Webhook: payment verified ' + txRef);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(500);
  }
});

// ── Config ──
router.get('/config', function(req, res) {
  res.json({
    success: true,
    enabled: FLW_ENABLED,
    prices: TICKET_PRICES,
    currency: 'NGN',
  });
});

module.exports = router;
