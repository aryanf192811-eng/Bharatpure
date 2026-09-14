const { GoogleGenAI, Type } = require('@google/genai');

const { pool } = require('../db');
const logger = require('../utils/logger');
const demandService = require('./demand.service');
const priceService = require('./price.service');

const SESSION_TTL_MINUTES = 30;
const CROP_TYPES = ['TURMERIC', 'MUSTARD', 'HONEY', 'GROUNDNUT', 'GHEE', 'SPICES'];
const CITIES = ['Delhi', 'Mumbai', 'Ahmedabad', 'Bangalore', 'Pune', 'Kolkata', 'Chennai'];
const GEMINI_MODEL = 'gemini-2.0-flash'; // cheap/free-tier-eligible per user's explicit request, swapped in from Claude

const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for an Indian farmer-facing WhatsApp bot. The user message may be in Hindi, English, or Hinglish. Classify it.`;
const INTENT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: ['price_query', 'demand_query', 'batch_status', 'order_status', 'list_batch', 'support'] },
    crop_type: { type: Type.STRING, enum: [...CROP_TYPES, 'null'] },
    city: { type: Type.STRING, enum: [...CITIES, 'null'] },
    batch_code: { type: Type.STRING },
    original_language: { type: Type.STRING, enum: ['hindi', 'english', 'hinglish'] },
    confidence: { type: Type.NUMBER },
  },
  required: ['intent', 'original_language', 'confidence'],
};

/**
 * Rule-based fallback intent classifier — used whenever Gemini is unavailable (no
 * GEMINI_API_KEY configured, or the API call itself fails). This is what actually runs in this
 * dev environment right now, since no key is configured. Deliberately simple keyword matching
 * across Hindi/Hinglish/English, not a claim of NLU-grade understanding — good enough to keep
 * the bot functional and testable without the external dependency, and the whole pipeline
 * upgrades automatically to real Gemini-powered classification the moment a real key is added,
 * with zero code changes needed elsewhere.
 */
const classifyIntentLocally = (messageBody) => {
  const text = messageBody.toLowerCase();
  const cropType = CROP_TYPES.find((c) => text.includes(c.toLowerCase())) ?? (text.includes('haldi') ? 'TURMERIC' : text.includes('sarson') ? 'MUSTARD' : text.includes('shahad') ? 'HONEY' : null);
  const city = CITIES.find((c) => text.includes(c.toLowerCase())) ?? null;
  const batchCodeMatch = messageBody.match(/[A-Z]{2}-[A-Z]{3}-\d{4}-\d{3}/);

  let intent = 'support';
  if (/rate|price|bhav|कीमत|दाम/.test(text)) intent = 'price_query';
  else if (/demand|mang|मांग/.test(text)) intent = 'demand_query';
  else if (batchCodeMatch) intent = 'batch_status';
  else if (/order|आर्डर|ऑर्डर/.test(text)) intent = 'order_status';
  else if (/list|becho|बेचो|sell/.test(text)) intent = 'list_batch';

  const isHindiScript = /[ऀ-ॿ]/.test(messageBody);
  const original_language = isHindiScript ? 'hindi' : /haldi|bhav|kitna|kaisa/.test(text) ? 'hinglish' : 'english';

  return { intent, crop_type: cropType, city, batch_code: batchCodeMatch?.[0] ?? null, original_language, confidence: 0.5 };
};

const extractIntent = async (messageBody) => {
  if (!gemini) {
    return classifyIntentLocally(messageBody);
  }
  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: messageBody,
      config: {
        systemInstruction: INTENT_SYSTEM_PROMPT,
        maxOutputTokens: 256,
        responseMimeType: 'application/json',
        responseSchema: INTENT_RESPONSE_SCHEMA,
      },
    });
    const parsed = JSON.parse(response.text);
    // The schema can't express "string or null" cleanly (Gemini's structured-output subset
    // doesn't support nullable enums), so a literal "null" string is used as the sentinel and
    // normalized back to a real null here.
    if (parsed.crop_type === 'null') parsed.crop_type = null;
    if (parsed.city === 'null') parsed.city = null;
    return parsed;
  } catch (err) {
    logger.error({ action: 'WHATSAPP_INTENT_EXTRACTION_FAILED', err: err.message });
    return classifyIntentLocally(messageBody);
  }
};

/** Fallback template response — used under the same "no key / API failure" conditions as above. */
const generateResponseLocally = (intent, responseContext, language) => {
  const greeting = language === 'hindi' ? 'नमस्ते! ' : language === 'hinglish' ? 'Namaste! ' : 'Hello! ';
  if (responseContext.startsWith('API data unavailable')) {
    return `${greeting}${language === 'hindi' ? 'अभी जानकारी उपलब्ध नहीं है, कृपया थोड़ी देर बाद कोशिश करें।' : 'That information isn\'t available right now, please try again shortly.'}`;
  }
  return `${greeting}${responseContext}`;
};

const RESPONSE_SYSTEM_PROMPT = `You are a warm, helpful assistant for Indian farmers on WhatsApp. Reply in the farmer's own language/style (Hindi, English, or Hinglish, matching what they used). Keep it under 160 words. Only use the numbers and facts given in the context below — never invent or guess numbers. If the context says data is unavailable, say so honestly and offer general guidance instead.`;

const generateResponse = async (intent, responseContext, language) => {
  if (!gemini) {
    return generateResponseLocally(intent, responseContext, language);
  }
  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Intent: ${intent}\nLanguage: ${language}\nContext: ${responseContext}`,
      config: { systemInstruction: RESPONSE_SYSTEM_PROMPT, maxOutputTokens: 300 },
    });
    return response.text || generateResponseLocally(intent, responseContext, language);
  } catch (err) {
    logger.error({ action: 'WHATSAPP_RESPONSE_GENERATION_FAILED', err: err.message });
    return generateResponseLocally(intent, responseContext, language);
  }
};

const getOrCreateSession = async (phone) => {
  const result = await pool.query(
    `INSERT INTO whatsapp_sessions (phone, state, session_expires_at)
     VALUES ($1, 'greeting', NOW() + INTERVAL '${SESSION_TTL_MINUTES} minutes')
     ON CONFLICT (phone) DO UPDATE SET last_message_at = NOW()
     RETURNING *`,
    [phone],
  );
  const session = result.rows[0];
  if (new Date(session.session_expires_at) < new Date()) {
    const resetResult = await pool.query(
      `UPDATE whatsapp_sessions SET state = 'greeting', context_data = '{}', session_expires_at = NOW() + INTERVAL '${SESSION_TTL_MINUTES} minutes'
       WHERE phone = $1 RETURNING *`,
      [phone],
    );
    return resetResult.rows[0];
  }
  return session;
};

/**
 * Builds the grounding context string handed to the response-generation Claude call (or its
 * local-fallback equivalent). Routes through this codebase's own demand.service.js/price.service.js
 * (Phase 2) rather than calling AI_SERVICE_URL directly a second time — those already implement
 * the cache-first/graceful-degradation behavior this needs, reusing them is more robust than
 * duplicating that logic here, and is a deliberate improvement over calling the AI service raw
 * as BHARATPURE-AI.md's prose literally describes.
 */
const buildResponseContext = async (parsedIntent) => {
  try {
    if (parsedIntent.intent === 'price_query' && parsedIntent.crop_type) {
      const rec = await priceService.getRecommendation(parsedIntent.crop_type, 90, parsedIntent.city);
      return `${parsedIntent.crop_type} recommended price in ${parsedIntent.city ?? 'your area'}: ₹${(rec.recommended_low_paise / 100).toFixed(0)}-₹${(rec.recommended_high_paise / 100).toFixed(0)} per kg (commodity rate: ₹${(rec.commodity_price_paise / 100).toFixed(0)}/kg, premium: ${rec.premium_pct}%).`;
    }
    if (parsedIntent.intent === 'demand_query' && parsedIntent.crop_type && parsedIntent.city) {
      const forecast = await demandService.getForecast(parsedIntent.crop_type, parsedIntent.city, 30);
      const point = forecast.data[0];
      if (!point) return 'API data unavailable. Provide general guidance.';
      return `${parsedIntent.crop_type} demand in ${parsedIntent.city}: ${point.predicted_kg}kg predicted, ${point.confidence_pct}% confidence.`;
    }
    if (parsedIntent.intent === 'batch_status' && parsedIntent.batch_code) {
      const batchResult = await pool.query(`SELECT status, quality_score FROM batches WHERE batch_code = $1`, [parsedIntent.batch_code]);
      if (batchResult.rows.length === 0) return 'API data unavailable. Provide general guidance.';
      return `Batch ${parsedIntent.batch_code} status: ${batchResult.rows[0].status}, quality score: ${batchResult.rows[0].quality_score ?? 'pending'}.`;
    }
    return 'API data unavailable. Provide general guidance.';
  } catch (err) {
    logger.error({ action: 'WHATSAPP_CONTEXT_BUILD_FAILED', err: err.message });
    return 'API data unavailable. Provide general guidance.';
  }
};

/**
 * The full inbound-message pipeline: session -> intent -> data lookup -> reply -> session update.
 * Never throws -- webhooks.js must always get a string back to put in a TwiML response, this is
 * the WhatsApp-equivalent of "AI/external failures never surface as an error to the end user."
 */
const handleMessage = async (phone, messageBody) => {
  try {
    const session = await getOrCreateSession(phone);
    const parsedIntent = await extractIntent(messageBody);
    const responseContext = await buildResponseContext(parsedIntent);
    const replyText = await generateResponse(parsedIntent.intent, responseContext, parsedIntent.original_language);

    await pool.query(
      `UPDATE whatsapp_sessions SET state = $1, context_data = $2, last_message_at = NOW(),
              session_expires_at = NOW() + INTERVAL '${SESSION_TTL_MINUTES} minutes'
       WHERE phone = $3`,
      [parsedIntent.intent, JSON.stringify(parsedIntent), phone],
    );

    logger.info({ action: 'WHATSAPP_MESSAGE_HANDLED', phone, intent: parsedIntent.intent, usedGemini: Boolean(gemini) });
    return replyText;
  } catch (err) {
    logger.error({ action: 'WHATSAPP_MESSAGE_HANDLING_FAILED', phone, err: err.message });
    return 'Sorry, something went wrong. Please try again in a moment. / माफ़ कीजिए, कुछ गड़बड़ हो गई। कृपया थोड़ी देर बाद कोशिश करें।';
  }
};

module.exports = { handleMessage };
