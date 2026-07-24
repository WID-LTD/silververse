const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSQL, isDBEnabled, getMemRegistrations } = require('../db');
const axios = require('axios');
const { Flutterwave, WebhookValidator } = require('flutterwave-node-v4');

const TICKET_PRICES = { Regular: 1000, VIP: 5000, VVIP: 10000 };
const CALLBACK_URL = process.env.FLW_CALLBACK_URL || 'https://silververses.vercel.app/payment-success.html';
const FLW_ENABLED = !!(process.env.FLW_CLIENT_ID && process.env.FLW_CLIENT_SECRET);
const FLW_BASE_URL = 'https://api.flutterwave.cloud/f4b/production';

let flw = null;
let accessToken = null;
let tokenExpiry = 0;

if (FLW_ENABLED) {
  flw = new Flutterwave({
    clientId: process.env.FLW_CLIENT_ID,
    clientSecret: process.env.FLW_CLIENT_SECRET,
    encryptionKey: process.env.FLW_ENCRYPTION_KEY || '',
    environment: process.env.FLW_ENVIRONMENT || 'live',
  });
}

async function ensureToken() {
  if (!flw) return null;
  const now = Date.now();
  if (!accessToken || now >= tokenExpiry) {
    await flw.generateAccessToken();
    accessToken = flw.getAccessToken();
    tokenExpiry = now + 580000;
  }
  return accessToken;
}

router.post('/init', async (req, res) => {
  if (!FLW_ENABLED) {
    return res.status(503).json({ success: false, message: 'Payment not configured' });
  }
  try {
    const { regId, email, firstName, lastName, phone, amount, ticketType, paymentMethod } = req.body;
    const price = amount || TICKET_PRICES[ticketType] || 1000;
    const txRef = regId || `SV-${Date.now()}`;
    const token = await ensureToken();

    var phoneClean = phone ? phone.replace(/^0+/, '') : '8000000000';

    var payload = {
      amount: price,
      currency: 'NGN',
      reference: txRef,
      redirect_url: CALLBACK_URL + '?tx_ref=' + encodeURIComponent(txRef),
      customer: {
        email: email || 'festival@silververse.com',
        name: {
          first: firstName || 'Festival',
          last: lastName || 'Guest',
        },
        phone: {
          country_code: '234',
          number: phoneClean,
        },
      },
      meta: {
        reg_id: regId || '',
        ticket_type: ticketType || 'Regular',
      },
    };

    if (paymentMethod === 'card') {
      payload.payment_method = { type: 'card', card: {} };
      payload.meta.requires_card = true;
    } else {
      payload.payment_method = { type: 'opay' };
    }

    var response = await axios.post(
      FLW_BASE_URL + '/orchestration/direct-charges',
      payload,
      {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
          'X-Trace-Id': 'sv-' + txRef,
        },
        timeout: 30000,
      }
    );

    var charge = response.data;
    if (charge.status === 'success' && charge.data) {
      var redirectUrl = '';
      var nextAction = charge.data.next_action || {};
      if (nextAction.type === 'redirect_url') {
        redirectUrl = nextAction.redirect_url ? (nextAction.redirect_url.url || nextAction.redirect_url) : '';
      }

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

      console.log('Payment init: ' + txRef + ' -> ' + (redirectUrl ? 'redirect' : 'instructions'));
      res.json({
        success: true,
        data: {
          txRef: txRef,
          redirect_url: redirectUrl,
          charge_id: charge.data.id,
          next_action: nextAction,
          amount: price,
        }
      });
    } else {
      res.json({ success: false, message: charge.message || 'Payment initiation failed' });
    }
  } catch (err) {
    console.error('Payment init error:', err.response ? err.response.data : err.message);
    res.status(500).json({
      success: false,
      message: (err.response && err.response.data && err.response.data.message) || err.message
    });
  }
});

router.get('/verify/:tx_ref', async (req, res) => {
  if (!FLW_ENABLED) {
    return res.status(503).json({ success: false, message: 'Payment not configured' });
  }
  try {
    var txRef = req.params.tx_ref;
    var token = await ensureToken();

    var response = await axios.get(
      FLW_BASE_URL + '/charges?reference=' + encodeURIComponent(txRef),
      {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    var chargeData = response.data;
    if (chargeData.status === 'success' && chargeData.data) {
      var items = Array.isArray(chargeData.data) ? chargeData.data : [chargeData.data];
      var charge = null;
      for (var i = 0; i < items.length; i++) {
        if (items[i].reference === txRef) {
          charge = items[i];
          break;
        }
      }
      if (!charge) charge = items[0];

      if (charge && charge.status === 'succeeded') {
        if (isDBEnabled()) {
          var sql = getSQL();
          await sql`UPDATE registrations SET payment_status = 'verified', amount_paid = ${charge.amount} WHERE reg_id = ${txRef} OR payment_tx_ref = ${txRef}`;
        } else {
          var reg = getMemRegistrations().find(function(r) { return r.reg_id === txRef || r.payment_tx_ref === txRef; });
          if (reg) {
            reg.payment_status = 'verified';
            reg.amount_paid = charge.amount;
          }
        }
        console.log('Payment verified: ' + txRef);
        res.json({ success: true, data: charge });
      } else {
        res.json({ success: false, message: 'Payment not yet successful', data: charge || null });
      }
    } else {
      res.json({ success: false, message: 'Charge not found' });
    }
  } catch (err) {
    console.error('Verify error:', err.response ? err.response.data : err.message);
    res.status(500).json({
      success: false,
      message: (err.response && err.response.data && err.response.data.message) || err.message
    });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    var secretHash = process.env.FLW_WEBHOOK_SECRET;
    var signature = req.headers['verif-hash'];
    var rawBody = JSON.stringify(req.body);

    if (secretHash && signature) {
      var validator = new WebhookValidator(secretHash);
      if (!validator.validate(rawBody, signature)) {
        return res.status(401).json({ success: false, message: 'Invalid signature' });
      }
    }

    var payload = req.body;
    var event = payload.event || '';
    var data = payload.data || {};

    if (event === 'charge.completed' && data.status === 'succeeded') {
      var txRef = data.reference || '';
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

router.get('/config', function(req, res) {
  res.json({
    success: true,
    enabled: FLW_ENABLED,
    prices: TICKET_PRICES,
    currency: 'NGN',
  });
});

module.exports = router;
