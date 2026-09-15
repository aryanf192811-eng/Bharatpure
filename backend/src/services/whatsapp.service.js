const { GoogleGenAI, Type } = require('@google/genai');

const { pool } = require('../db');
const logger = require('../utils/logger');
const demandService = require('./demand.service');
const priceService = require('./price.service');

const SESSION_TTL_MINUTES = 30;
const CROP_TYPES = ['TURMERIC', 'MUSTARD', 'HONEY', 'GROUNDNUT', 'GHEE', 'SPICES'];
const CITIES = ['Delhi', 'Mumbai', 'Ahmedabad', 'Bangalore', 'Pune', 'Kolkata', 'Chennai'];
// gemini-2.0-flash was retired (404s as of 2026-09-15); gemini-3.6-flash is its replacement,
// still cheap/free-tier-eligible per user's explicit request to swap in from Claude. It's a
// "thinking" model by default, which burns maxOutputTokens on hidden reasoning before ever
// emitting the reply -- verified live, both calls below hit MAX_TOKENS with an empty/truncated
// response at their original token budgets until thinkingConfig.thinkingBudget was set to 0.
const GEMINI_MODEL = 'gemini-3.6-flash';

const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// thinkingConfig.thinkingBudget is 0 on every call using this prompt (see GEMINI_MODEL comment
// above) -- the model does zero internal reasoning before writing its answer, so every
// disambiguation rule it would otherwise have worked out step-by-step has to be spelled out
// here instead. Keep this in sync with classifyIntentLocally's keyword rules below (same
// classification job, just the non-Gemini fallback), and with CROP_TYPES/CITIES/the schema.
const INTENT_SYSTEM_PROMPT = `You are an intent classifier for an Indian farmer-facing WhatsApp bot serving farmers, buyers, and logistics staff on the BharatPure agricultural marketplace platform. Incoming messages may be in Hindi (Devanagari script), English, or Hinglish (Hindi written in Roman letters, e.g. "haldi ka bhav kya hai"). You must classify each message in a single pass with no back-and-forth -- output only the structured fields, nothing else.

CLASSIFY "intent" AS EXACTLY ONE OF:
- price_query -- the sender wants to know a rate/price for a crop. Trigger words: rate, price, bhav, daam, kimat, kya bhav hai, कीमत, दाम, भाव, "kitne ka", "kya rate hai".
- demand_query -- the sender wants to know how much of a crop is wanted/selling in a market, i.e. market demand rather than price. Trigger words: demand, mang, मांग, "kitna bikta hai", "kitni demand hai".
- batch_status -- the sender is asking about a specific tracked batch. Trigger: a batch code matching the pattern XX-XXX-NNNN-NNN (two letters, dash, three letters, dash, four digits, dash, three digits), e.g. "KA-TUR-2026-014". If a code matching that pattern appears anywhere in the message, this is always batch_status regardless of other words present.
- order_status -- the sender is asking about an order they placed or received. Trigger words: order, आर्डर, ऑर्डर, "mera order kaha hai", "order kab aayega".
- list_batch -- the sender (a farmer) wants to list/sell a new batch of produce. Trigger words: list, becho, बेचो, sell, "bechna hai", "naya batch".
- support -- anything that is a greeting, thanks, complaint, unclear request, or does not clearly match one of the five categories above. This is the default when no clear trigger is present -- do not force-fit an ambiguous message into a wrong category.

If multiple triggers appear in one message, prefer in this order: batch_status (a batch code is the most specific, unambiguous signal) > price_query > demand_query > order_status > list_batch > support.

EXTRACT "crop_type" (one of ${CROP_TYPES.join(', ')}, or the literal string "null" if none is mentioned or implied):
Map local/vernacular names to the enum: haldi/हल्दी -> TURMERIC, sarson/सरसों -> MUSTARD, shahad/शहद -> HONEY, moongfali/मूंगफली -> GROUNDNUT, ghee/घी -> GHEE, masala/मसाला/spices -> SPICES. Match case-insensitively and match the English enum names too (e.g. "turmeric price" -> TURMERIC).

EXTRACT "city" (one of ${CITIES.join(', ')}, or the literal string "null" if none is mentioned):
Match the city name in any script or common transliteration appearing in the message. If no city is named, use "null" -- do not guess a default city.

EXTRACT "batch_code": if a substring matches XX-XXX-NNNN-NNN, copy it exactly (preserve case and dashes) into batch_code. Otherwise omit this field or leave it empty.

DETERMINE "original_language":
- hindi: the message contains Devanagari script characters (the Unicode range for Hindi letters/matras).
- hinglish: the message is written in Latin/Roman letters but uses Hindi vocabulary or grammar (e.g. "haldi ka bhav kya hai", "mera order kab aayega", "kitna hai").
- english: the message is written in Latin letters using standard English vocabulary and grammar with no Hindi words mixed in.
When in doubt between hinglish and english, look for any Hindi word (however small) mixed into Latin text -- its presence means hinglish, not english.

SET "confidence" (a number from 0 to 1):
- 0.85-1.0: an explicit trigger keyword or exact batch-code pattern is present and unambiguous.
- 0.5-0.84: the intent is inferred from context/phrasing without an exact trigger keyword, or exactly one of two plausible intents was chosen.
- below 0.5: the message is vague, off-topic, or you are defaulting to "support" because nothing else matched.

Output must strictly follow the response schema and contain nothing beyond the requested fields -- no explanation, no extra commentary, no markdown.`;
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

// Sentinel returned when a voice note can't be classified at all -- either no GEMINI_API_KEY is
// configured, or the Gemini audio call itself failed. classifyIntentLocally has no way to
// understand audio (it's pure keyword matching over text), so silently falling back to it with
// an empty messageBody would misclassify every voice note as a blank "support" message instead
// of honestly telling the farmer to type instead. handleMessage checks this flag and short-
// circuits before the normal reply pipeline.
const VOICE_UNAVAILABLE = { intent: 'support', crop_type: null, city: null, batch_code: null, original_language: 'hinglish', confidence: 0, voice_unavailable: true };

/**
 * @param {string} messageBody
 * @param {{ mediaBase64: string, mediaMimeType: string } | null} [media] - a voice note, already
 *   fetched and base64-encoded by webhooks.js. When present, Gemini transcribes and classifies
 *   it in one call -- no separate transcription step.
 */
const extractIntent = async (messageBody, media) => {
  if (media && !gemini) {
    return VOICE_UNAVAILABLE;
  }
  if (!gemini) {
    return classifyIntentLocally(messageBody);
  }
  try {
    // Confirmed exact shape for the installed @google/genai@2.22.0 SDK: an array of Parts, an
    // inline-audio object part alongside a plain string part, both in `contents` directly (the
    // SDK's `PartUnion = Part | string`, so a bare string is a valid array entry).
    const contents = media
      ? [
          { inlineData: { mimeType: media.mediaMimeType, data: media.mediaBase64 } },
          messageBody || 'Transcribe this farmer voice note (Hindi/English/Hinglish) and classify it per the system instructions.',
        ]
      : messageBody;
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: INTENT_SYSTEM_PROMPT,
        maxOutputTokens: 256,
        thinkingConfig: { thinkingBudget: 0 },
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
    logger.error({ action: 'WHATSAPP_INTENT_EXTRACTION_FAILED', err: err.message, hadMedia: Boolean(media) });
    if (media) return VOICE_UNAVAILABLE;
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

// Same thinkingBudget: 0 constraint as INTENT_SYSTEM_PROMPT above -- the model writes its final
// answer directly with no hidden draft-and-revise pass, so structure/tone/length rules have to
// be explicit and directly followable rather than left for the model to infer and balance itself.
const RESPONSE_SYSTEM_PROMPT = `You are a warm, respectful assistant replying to Indian farmers, bulk buyers, and logistics staff over WhatsApp on the BharatPure agricultural marketplace platform. You will be given the sender's detected intent, their message language, and a context string containing the only facts you are allowed to state.

LANGUAGE: Reply in the same language/style as "Language" tells you:
- hindi -> reply fully in Hindi, Devanagari script.
- hinglish -> reply in Hinglish (Hindi words/grammar written in Roman letters), matching a natural WhatsApp texting register -- this is the default for most farmer messages.
- english -> reply in plain English.
Open with a short, warm greeting appropriate to the language (e.g. "Ram Ram Kisan bhai!" / "Namaste!" / "Hello!") only on the first line, then answer directly -- do not repeat the greeting later in the message.

FACTS: The "Context" string is your ONLY source of numbers and facts. Copy figures from it exactly (same digits, same units, same currency symbol) -- never calculate, round differently, invent, or guess a number that is not literally present in Context. If Context begins with "API data unavailable", say plainly (in the sender's language) that the information is not available right now, then offer brief general guidance relevant to their intent instead of any specific figure.

STRUCTURE: Keep the whole reply under 160 words. When Context contains multiple numeric facts (e.g. a price range and a commodity rate, or a demand quantity and a confidence percentage), present them as short bullet points, not a run-on sentence. End with one short, encouraging closing line inviting a follow-up question. Use at most one or two emoji total (e.g. 🙏 in the greeting, 🌾 in the closing) -- do not overuse them.

TONE: Warm, plain-spoken, respectful of the sender as a working farmer or business contact -- never salesy, never robotic, never use jargon the sender didn't already use themselves.

Output only the reply text meant to be sent to the sender -- no labels, no explanation of your reasoning, no markdown headers.`;

const generateResponse = async (intent, responseContext, language) => {
  if (!gemini) {
    return generateResponseLocally(intent, responseContext, language);
  }
  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Intent: ${intent}\nLanguage: ${language}\nContext: ${responseContext}`,
      config: { systemInstruction: RESPONSE_SYSTEM_PROMPT, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } },
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
 *
 * @param {{ mediaBase64: string, mediaMimeType: string } | null} [media] - see extractIntent's doc.
 */
const handleMessage = async (phone, messageBody, media = null) => {
  try {
    const session = await getOrCreateSession(phone);
    const parsedIntent = await extractIntent(messageBody, media);

    if (parsedIntent.voice_unavailable) {
      const replyText = 'Maaf kijiye, abhi voice message samajh nahi paa rahe hain. Kripya apna sawaal type karke bhejein. 🙏\n\n'
        + "Sorry, we can't process voice messages right now — please type your question instead.";
      await pool.query(
        `UPDATE whatsapp_sessions SET state = 'voice_unavailable', context_data = $1, last_message_at = NOW(),
                session_expires_at = NOW() + INTERVAL '${SESSION_TTL_MINUTES} minutes'
         WHERE phone = $2`,
        [JSON.stringify(parsedIntent), phone],
      );
      logger.info({ action: 'WHATSAPP_MESSAGE_HANDLED', phone, intent: 'voice_unavailable', usedGemini: false });
      return replyText;
    }

    const responseContext = await buildResponseContext(parsedIntent);
    const replyText = await generateResponse(parsedIntent.intent, responseContext, parsedIntent.original_language);

    await pool.query(
      `UPDATE whatsapp_sessions SET state = $1, context_data = $2, last_message_at = NOW(),
              session_expires_at = NOW() + INTERVAL '${SESSION_TTL_MINUTES} minutes'
       WHERE phone = $3`,
      [parsedIntent.intent, JSON.stringify(parsedIntent), phone],
    );

    logger.info({ action: 'WHATSAPP_MESSAGE_HANDLED', phone, intent: parsedIntent.intent, usedGemini: Boolean(gemini), hadMedia: Boolean(media) });
    return replyText;
  } catch (err) {
    logger.error({ action: 'WHATSAPP_MESSAGE_HANDLING_FAILED', phone, err: err.message });
    return 'Sorry, something went wrong. Please try again in a moment. / माफ़ कीजिए, कुछ गड़बड़ हो गई। कृपया थोड़ी देर बाद कोशिश करें।';
  }
};

module.exports = { handleMessage };
