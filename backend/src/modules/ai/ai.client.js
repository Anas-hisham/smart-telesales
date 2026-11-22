const { GoogleGenAI } = require('@google/genai');
const env = require('../../config/env');

let client = null;
/** Created lazily so the server still boots when GEMINI_API_KEY is not set yet. */
function getAiClient() {
  if (!env.geminiApiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey: env.geminiApiKey, httpOptions: { timeout: 120000 } });
  return client;
}
module.exports = { getAiClient };
