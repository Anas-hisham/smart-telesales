// run from the backend root:  node test-gemini.js
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

ai.models.generateContent({
  model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  contents: 'You are a B2B sales assistant. Give me a short sales opening script.',
}).then((r) => console.log(r.text)).catch((e) => console.error('FAILED:', e.status, e.message));
