const axios = require('axios');
const express = require('express');
const twilio = require('twilio');

const whatsappService = require('../services/whatsapp.service');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Twilio's MediaUrlN is not a public URL -- fetching it requires HTTP Basic Auth with the
 * account's own Account SID/Auth Token, a real Twilio platform requirement, not an internal
 * choice. Returns null (never throws) on any failure, including the case that's always true in
 * this dev environment: TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are both blank, so this step can't
 * actually be exercised against a real Twilio account here -- the Gemini-audio half of the
 * pipeline is verified directly instead (see whatsapp.service.js), this fetch degrades
 * gracefully rather than being silently skipped or crashing the webhook.
 */
const fetchTwilioMedia = async (mediaUrl, mimeType) => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    logger.warn({ action: 'WHATSAPP_MEDIA_FETCH_SKIPPED', reason: 'TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN not configured' });
    return null;
  }
  try {
    const response = await axios.get(mediaUrl, {
      auth: { username: process.env.TWILIO_ACCOUNT_SID, password: process.env.TWILIO_AUTH_TOKEN },
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    return { mediaBase64: Buffer.from(response.data).toString('base64'), mediaMimeType: mimeType };
  } catch (err) {
    logger.error({ action: 'WHATSAPP_MEDIA_FETCH_FAILED', err: err.message });
    return null;
  }
};

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
    const numMedia = Number(req.body.NumMedia ?? 0);
    const mediaContentType = req.body.MediaContentType0;

    let media = null;
    if (numMedia > 0 && mediaContentType?.startsWith('audio/')) {
      media = await fetchTwilioMedia(req.body.MediaUrl0, mediaContentType);
    }

    if (!phone || (!messageBody && !media)) {
      res.set('Content-Type', 'text/xml');
      return res.status(200).send(twiml('Sorry, I could not read your message. Please try again. / माफ़ कीजिए, संदेश नहीं पढ़ पाया। कृपया दोबारा भेजें।'));
    }

    const replyText = await whatsappService.handleMessage(phone, messageBody, media);
    res.set('Content-Type', 'text/xml');
    return res.status(200).send(twiml(replyText));
  } catch (err) {
    logger.error({ action: 'WHATSAPP_WEBHOOK_FAILED', err: err.message });
    res.set('Content-Type', 'text/xml');
    return res.status(200).send(twiml('Sorry, something went wrong. Please try again shortly. / माफ़ कीजिए, कुछ गड़बड़ हो गई। कृपया थोड़ी देर बाद कोशिश करें।'));
  }
});

module.exports = router;
