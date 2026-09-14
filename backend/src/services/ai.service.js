const axios = require('axios');

const logger = require('../utils/logger');

const AI_TIMEOUT_MS = 30000;

const client = axios.create({ baseURL: process.env.AI_SERVICE_URL, timeout: AI_TIMEOUT_MS });

/**
 * The single choke point for every call to the AI Decision Engine (FastAPI service). Never
 * throws -- every caller gets { data, error } and decides its own fallback, because per
 * BHARATPURE-CLAUDE.md, an AI service outage must never surface as a 500 to the end user. The
 * FastAPI service itself doesn't exist in this codebase yet (not in chatbot.md's scope), so in
 * practice every call currently fails with ECONNREFUSED -- that's the expected, tested path.
 */
const callAI = async (method, path, { params, data } = {}) => {
  try {
    const response = await client.request({ method, url: path, params, data });
    return { data: response.data, error: null };
  } catch (err) {
    logger.error({ action: 'AI_SERVICE_CALL_FAILED', path, err: err.message });
    return { data: null, error: err };
  }
};

module.exports = { callAI };
