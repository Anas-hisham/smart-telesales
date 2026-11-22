const { query } = require('../../config/db');
const env = require('../../config/env');
const { ApiError, Errors } = require('../../utils/errors');
const { sha256 } = require('../../utils/helpers');
const { getAiClient } = require('./ai.client');
const { LEAD_ANALYSIS_SYSTEM_PROMPT } = require('./ai.prompts');
const { buildLeadContext } = require('./ai.context');
const { parseJsonLoose } = require('./ai.json');

const LANGUAGE_NAME = {
  ar: 'Arabic (professional, natural Egyptian-friendly wording for the spoken script)',
  en: 'English',
  ar_en: 'Write the analysis fields in Arabic, BUT everything the agent will SAY to the customer must be in natural, professional English: all of script.* (opening, personalizedTalk, discoveryQuestions, closing), strategy.questionsToAsk and predictedObjections[].response',
};

/** Reads the model answer as JSON (repairs small mistakes such as raw line breaks or quotes inside text). */
function parseModelJson(response) {
  const raw = String(response.text || '');
  try {
    return parseJsonLoose(raw);
  } catch (error) {
    const position = Number(/position (\d+)/.exec(error.message)?.[1]);
    console.error(`[gemini] unreadable answer. finishReason=${response.candidates?.[0]?.finishReason} length=${raw.length}`);
    console.error('[gemini] parse error:', error.message);
    if (!Number.isNaN(position)) console.error('[gemini] around the error:', JSON.stringify(raw.slice(Math.max(0, position - 80), position + 80)));
    throw new ApiError(502, 'AI_BAD_RESPONSE', 'The AI returned an unreadable answer. Try again');
  }
}

/** Streaming keeps the connection alive while the answer is written, so long answers do not time out. */
async function generateStreaming(ai, request) {
  const stream = await ai.models.generateContentStream(request);
  let text = '';
  let finishReason;
  for await (const chunk of stream) {
    text += chunk.text || '';
    finishReason = chunk.candidates?.[0]?.finishReason || finishReason;
  }
  return { text, candidates: [{ finishReason }] };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RETRYABLE = new Set([429, 500, 503, 504]);
const MAX_ATTEMPTS = 2;

/** Google answers 503/429 during demand spikes: retry with a short pause, then try the fallback model (if set). */
async function generateWithRetry(ai, request) {
  const models = [env.geminiModel, env.geminiFallbackModel].filter(Boolean);
  let lastError;
  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        return await generateStreaming(ai, { ...request, model });
      } catch (error) {
        lastError = error;
        console.error(`[gemini] ${model} attempt ${attempt}: status=${error?.status} name=${error?.name} cause=${error?.cause?.code || ''}`);
        console.error('[gemini] message:', String(error?.message).slice(0, 500));
        if (error?.status !== undefined && !RETRYABLE.has(error?.status)) throw new ApiError(502, 'AI_FAILED', 'The AI request failed. Try again');
        if (attempt < MAX_ATTEMPTS) await sleep(attempt * 2000);
      }
    }
  }
  const busy = RETRYABLE.has(lastError?.status);
  throw new ApiError(503, busy ? 'AI_BUSY' : 'AI_FAILED', 'AI is busy right now. Try again in a minute');
}

async function analyzeLead(user, leadId, { lang = 'ar', refresh = false } = {}) {
  const ai = getAiClient();
  if (!ai) throw new ApiError(503, 'AI_NOT_CONFIGURED', 'AI is not configured on the server');

  const context = await buildLeadContext(user, leadId); // also checks that the user may see the lead
  const inputHash = sha256(JSON.stringify([context, lang, env.geminiModel]));

  if (!refresh) {
    const { rows: [cached] } = await query('SELECT * FROM lead_ai_analyses WHERE lead_id=$1 AND lang=$2 AND input_hash=$3', [leadId, lang, inputHash]);
    if (cached) return { analysis: cached.result, generatedAt: cached.created_at, cached: true };
  }

  const { campaignCode, ...modelInput } = context;
  const response = await generateWithRetry(ai, {
    contents: `OUTPUT LANGUAGE: ${LANGUAGE_NAME[lang]}\n\nLEAD DATA AND COMPANY KNOWLEDGE (JSON):\n${JSON.stringify(modelInput, null, 2)}`,
    config: { systemInstruction: LEAD_ANALYSIS_SYSTEM_PROMPT, temperature: 0.4, maxOutputTokens: 16384, responseMimeType: 'application/json' },
  });

  const analysis = parseModelJson(response);
  const { rows: [saved] } = await query(
    `INSERT INTO lead_ai_analyses (lead_id, lang, input_hash, result, model) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (lead_id, lang) DO UPDATE SET input_hash=$3, result=$4, model=$5, created_at=now() RETURNING created_at`,
    [leadId, lang, inputHash, JSON.stringify(analysis), env.geminiModel]);
  return { analysis, generatedAt: saved.created_at, cached: false };
}

// ---- company knowledge (admin managed) ----
const formatKnowledge = (row) => ({ id: row.id, campaignCode: row.campaign_code, title: row.title, content: row.content, active: row.active, updatedAt: row.updated_at });

async function listKnowledge() {
  return (await query('SELECT * FROM ai_knowledge ORDER BY (campaign_code IS NULL) DESC, campaign_code, title')).rows.map(formatKnowledge);
}
async function createKnowledge(user, body) {
  const { rows: [row] } = await query(
    'INSERT INTO ai_knowledge (campaign_code, title, content, created_by) VALUES ($1,$2,$3,$4) RETURNING *',
    [body.campaignCode ? body.campaignCode.toUpperCase() : null, body.title, body.content, user.id]);
  return formatKnowledge(row);
}
async function updateKnowledge(id, body) {
  const { rows: [row] } = await query(
    `UPDATE ai_knowledge SET
       campaign_code = CASE WHEN $2::boolean THEN $3 ELSE campaign_code END,
       title = COALESCE($4, title), content = COALESCE($5, content), active = COALESCE($6, active), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, 'campaignCode' in body, body.campaignCode ? body.campaignCode.toUpperCase() : null, body.title ?? null, body.content ?? null, body.active ?? null]);
  if (!row) throw Errors.notFound('Knowledge item');
  return formatKnowledge(row);
}
async function deleteKnowledge(id) {
  const { rowCount } = await query('DELETE FROM ai_knowledge WHERE id = $1', [id]);
  if (!rowCount) throw Errors.notFound('Knowledge item');
}

module.exports = { analyzeLead, listKnowledge, createKnowledge, updateKnowledge, deleteKnowledge };
