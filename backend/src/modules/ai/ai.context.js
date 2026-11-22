const { query } = require('../../config/db');
const leadsService = require('../leads/leads.service');

const MAX_CALLS = 20;            // newest calls sent to the model
const MAX_NOTE_CHARS = 700;      // per call description
const MAX_KNOWLEDGE_CHARS = 40000;
const cut = (text, max) => (text && text.length > max ? `${text.slice(0, max)}…` : text || '');

/** Knowledge for this campaign + general knowledge, capped so the prompt stays reasonable. */
async function loadKnowledge(campaignCode) {
  const { rows } = await query(
    `SELECT title, content, campaign_code FROM ai_knowledge
      WHERE active AND (campaign_code IS NULL OR campaign_code = $1)
      ORDER BY (campaign_code IS NULL), title`, [campaignCode]);
  let used = 0;
  const items = [];
  for (const row of rows) {
    if (used + row.content.length > MAX_KNOWLEDGE_CHARS) break;
    used += row.content.length;
    items.push({ title: row.title, scope: row.campaign_code || 'general', content: row.content });
  }
  return items;
}

/**
 * Builds the context sent to Gemini. getLeadDetails() already enforces "may this user see this lead"
 * (a lead you cannot see = 404), so no extra permission check is needed here.
 * Phone and email are NOT sent to the model: the analysis does not need them.
 */
async function buildLeadContext(user, leadId) {
  const lead = await leadsService.getLeadDetails(user, leadId);
  const calls = [...lead.callLogs].reverse().slice(-MAX_CALLS).map((call) => ({
    when: new Date(call.timestamp).toISOString().slice(0, 16).replace('T', ' '),
    type: call.type, reason: call.reason || null, round: call.round,
    step: call.touchPointLabel || null, agent: call.agentName, note: cut(call.description, MAX_NOTE_CHARS),
  }));
  const knowledge = await loadKnowledge(lead.campaignCode);

  return {
    lead: {
      company: lead.companyName, contact: lead.contactName, campaign: lead.campaignCode, status: lead.status,
      currentRound: lead.round, discoveryReached: lead.discoveryReached, callsThisRound: lead.callCount,
      daysUntilExpiry: lead.daysUntilExpiry, hasSale: lead.hasSale,
      nextStep: lead.touchPoints.find((step) => step.order === lead.currentTouchPoint)?.label || null,
      previousRounds: lead.previousAssignments.length,
      upcomingMeeting: lead.upcomingMeeting ? { date: lead.upcomingMeeting.date, time: lead.upcomingMeeting.time } : null,
    },
    callHistory: calls, // oldest -> newest
    companyKnowledge: knowledge,
    campaignCode: lead.campaignCode,
  };
}
module.exports = { buildLeadContext };
