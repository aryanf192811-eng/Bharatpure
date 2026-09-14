const express = require('express');
const twilio = require('twilio');

const whatsappService = require('../services/whatsapp.service');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Twilio request-signature validation. Skipped in dev (no TWILIO_AUTH_TOKEN configured in this
 * environment, and BHARATPURE-AI.md explicitly documents "skipped in dev, 403 in prod if
 * invalid"). In production with a real token, an invalid signature is rejected before the
 * message ever reaches whatsapp.service.js.
 */
const validateTwilio = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production' || !process.env.TWILIO_AUTH_TOKEN) {
    return next();
  }
  const signature = req.headers['x-twilio-signature'];
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const valid = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, req.body);
  if (!valid) {
    return res.status(403).send('Invalid Twilio signature');
  }
  return next();
};

const twiml = (message) => {
  const response = new twilio.twiml.MessagingResponse();
  response.message(message);
  return response.toString();
};

/**
 * Never returns a 500 to Twilio, per BHARATPURE-AI.md — any failure anywhere in this handler
 * (including whatsapp.service.js itself failing, though that function already has its own
 * catch-all) gets a graceful bilingual TwiML fallback instead.
 */
router.post('/whatsapp', validateTwilio, async (req, res) => {
  try {
    const rawFrom = req.body.From ?? '';
    const phone = rawFrom.replace(/^whatsapp:\+91/, '').replace(/^whatsapp:\+/, '');
    const messageBody = req.body.Body ?? '';

    if (!phone || !messageBody) {
      res.set('Content-Type', 'text/xml');
      return res.status(200).send(twiml('Sorry, I could not read your message. Please try again. / माफ़ कीजिए, संदेश नहीं पढ़ पाया। कृपया दोबारा भेजें।'));
    }

    const replyText = await whatsappService.handleMessage(phone, messageBody);
    res.set('Content-Type', 'text/xml');
    return res.status(200).send(twiml(replyText));
  } catch (err) {
    logger.error({ action: 'WHATSAPP_WEBHOOK_FAILED', err: err.message });
    res.set('Content-Type', 'text/xml');
    return res.status(200).send(twiml('Sorry, something went wrong. Please try again shortly. / माफ़ कीजिए, कुछ गड़बड़ हो गई। कृपया थोड़ी देर बाद कोशिश करें।'));
  }
});

module.exports = router;
