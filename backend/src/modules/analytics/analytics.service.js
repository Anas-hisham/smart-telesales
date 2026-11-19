/**
 * Definitions used here:
 *   calls      = call logs in the range
 *   answered   = lvm + discovery (the line was picked up: by a person or a voicemail)
 *   reached    = discovery (a real conversation)
 *   answerRate = answered / calls      reachRate = discovery / calls
 *   leads      = distinct leads called   sold = distinct leads with a sale   conversion = sold / leads
 *   reachToSale = sold / reached         callsPerLead = calls / leads
 */
const { query } = require('../../config/db');
const env = require('../../config/env');
const { Errors } = require('../../utils/errors');
const { safeRatio, roundToFourDecimals } = require('../../utils/helpers');
const { getCairoToday, getWeekStartSaturday, getFirstDayOfMonth, daysBetween } = require('../../utils/time');
const { visibleAgentIds } = require('../../utils/scope');
const { getUserNamesById } = require('../../utils/user');

const REASON_LABELS = {
  interested: 'Interested', callback: 'Call back', price: 'Price', timing: 'Timing', not_interested: 'Not interested',
  wrong_contact: 'Wrong contact', no_answer: 'No answer', voicemail: 'Voicemail', other: 'Other',
};

function resolveDateRange({ preset, from, to }) {
  const today = getCairoToday();
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'week') return { from: getWeekStartSaturday(today), to: today }; // weeks start on Saturday
  if (preset === 'month') return { from: getFirstDayOfMonth(today), to: today };
  if (!from || !to) throw Errors.validation([{ field: !from ? 'from' : 'to', message: 'Required for a custom range' }]);
  if (from > to) throw Errors.validation([{ field: 'from', message: 'Must not be after "to"' }]);
  if (daysBetween(from, to) > 366) throw Errors.validation([{ field: 'to', message: 'At most 366 days' }]);
  return { from, to };
}

const buildStatsRow = (key, label, callStats = {}, salesStats = {}) => {
  const calls = callStats.calls || 0;
  const leads = callStats.leads || 0;
  const reached = callStats.reached || 0;
  const sold = salesStats.sold || 0;
  return {
    key, label, calls, nvm: callStats.nvm || 0, lvm: callStats.lvm || 0, discovery: callStats.discovery || 0,
    answerRate: safeRatio((callStats.lvm || 0) + (callStats.discovery || 0), calls), reachRate: safeRatio(callStats.discovery || 0, calls),
    leads, reached, sold, sales: salesStats.sales || 0, conversion: safeRatio(sold, leads), reachToSale: safeRatio(sold, reached),
    callsPerLead: leads ? roundToFourDecimals(calls / leads) : 0,
  };
};

async function buildAnalyticsReport(user, filters) {
  const range = resolveDateRange(filters);
  const campaign = filters.campaign && filters.campaign !== 'all' ? filters.campaign.toUpperCase() : null;
  const ids = await visibleAgentIds(user);
  const baseSqlParams = [ids, range.from, range.to, campaign, env.tz];
  const CALL_LOGS_FILTER_SQL = `FROM call_logs c JOIN leads l ON l.id = c.lead_id
    WHERE c.agent_id = ANY($1::uuid[]) AND (c.timestamp AT TIME ZONE $5)::date BETWEEN $2::date AND $3::date AND ($4::text IS NULL OR l.campaign_code = $4)`;
  const SALES_FILTER_SQL = `FROM sales s WHERE s.agent_id = ANY($1::uuid[]) AND s.date BETWEEN $2::date AND $3::date AND ($4::text IS NULL OR s.campaign_code = $4)`;
  const callAggregatesSql = `count(*) calls, count(*) FILTER (WHERE c.type='nvm') nvm, count(*) FILTER (WHERE c.type='lvm') lvm,
               count(*) FILTER (WHERE c.type='discovery') discovery, count(DISTINCT c.lead_id) leads,
               count(DISTINCT c.lead_id) FILTER (WHERE c.type='discovery') reached`;
  const salesSqlParams = baseSqlParams.slice(0, 4); // the SALES queries do not use the time zone
  const runQueryRows = (sql, sqlParams = baseSqlParams) => query(sql, sqlParams).then((result) => result.rows);

  const [totalsRows, callsByCampaign, callsByAgent, callsByHour, callReasonCounts, salesTotalsRows, salesByCampaign, salesByAgent, funnelRows, callsWithoutReasonRows, expiringLeadsRows, leadsWithoutPhoneRows] = await Promise.all([
    runQueryRows(`SELECT ${callAggregatesSql} ${CALL_LOGS_FILTER_SQL}`),
    runQueryRows(`SELECT l.campaign_code k, ${callAggregatesSql} ${CALL_LOGS_FILTER_SQL} GROUP BY 1`),
    runQueryRows(`SELECT c.agent_id k, ${callAggregatesSql} ${CALL_LOGS_FILTER_SQL} GROUP BY 1`),
    runQueryRows(`SELECT extract(hour FROM c.timestamp AT TIME ZONE $5)::int h, count(*) calls, count(*) FILTER (WHERE c.type IN ('lvm','discovery')) answered,
              count(*) FILTER (WHERE c.type='discovery') reached ${CALL_LOGS_FILTER_SQL} GROUP BY 1`),
    runQueryRows(`SELECT c.reason, count(*) n ${CALL_LOGS_FILTER_SQL} AND c.reason IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`),
    runQueryRows(`SELECT count(*) sales, count(DISTINCT s.lead_id) sold ${SALES_FILTER_SQL}`, salesSqlParams),
    runQueryRows(`SELECT s.campaign_code k, count(*) sales, count(DISTINCT s.lead_id) sold ${SALES_FILTER_SQL} GROUP BY 1`, salesSqlParams),
    runQueryRows(`SELECT s.agent_id k, count(*) sales, count(DISTINCT s.lead_id) sold ${SALES_FILTER_SQL} GROUP BY 1`, salesSqlParams),
    runQueryRows(`SELECT
         (SELECT count(*) FROM (SELECT c.lead_id ${CALL_LOGS_FILTER_SQL}
            UNION SELECT l.id FROM leads l WHERE l.agent_id = ANY($1::uuid[]) AND (l.assigned_at AT TIME ZONE $5)::date BETWEEN $2::date AND $3::date AND ($4::text IS NULL OR l.campaign_code = $4)) x) leads,
         (SELECT count(DISTINCT c.lead_id) ${CALL_LOGS_FILTER_SQL}) contacted,
         (SELECT count(DISTINCT c.lead_id) ${CALL_LOGS_FILTER_SQL} AND c.type = 'discovery') reached,
         (SELECT count(DISTINCT m.lead_id) FROM meetings m JOIN leads l ON l.id = m.lead_id WHERE m.type = 'lead_meeting' AND m.agent_id = ANY($1::uuid[])
            AND (m.created_at AT TIME ZONE $5)::date BETWEEN $2::date AND $3::date AND ($4::text IS NULL OR l.campaign_code = $4)) meetings,
         (SELECT count(DISTINCT s.lead_id) ${SALES_FILTER_SQL}) sold`),
    runQueryRows(`SELECT count(*) n ${CALL_LOGS_FILTER_SQL} AND c.reason IS NULL`),
    runQueryRows(`SELECT count(*) n FROM leads l WHERE l.agent_id = ANY($1::uuid[]) AND NOT l.removed_from_queue AND NOT l.stopped
         AND ((now() AT TIME ZONE $3)::date - (l.last_activity_at AT TIME ZONE $3)::date) >= $4 AND ($2::text IS NULL OR l.campaign_code = $2)`,
      [ids, campaign, env.tz, env.expiryDays - 3]),
    runQueryRows(`SELECT count(*) n FROM leads l WHERE l.agent_id = ANY($1::uuid[]) AND NOT l.removed_from_queue AND l.phone = '' AND ($2::text IS NULL OR l.campaign_code = $2)`, [ids, campaign]),
  ]);

  const campaignNamesByCode = new Map((await query('SELECT campaign_code, name FROM workflows')).rows.map((workflow) => [workflow.campaign_code, workflow.name]));
  const agentNamesById = await getUserNamesById(ids);
  const mergeCallsAndSalesRows = (calls, sales, label) => {
    const keys = new Set([...calls.map((callRow) => callRow.k), ...sales.map((salesRow) => salesRow.k)]);
    return [...keys].map((key) => buildStatsRow(key, label(key), calls.find((callRow) => callRow.k === key), sales.find((salesRow) => salesRow.k === key)))
      .sort((firstRow, secondRow) => secondRow.calls - firstRow.calls || secondRow.sales - firstRow.sales);
  };

  const totals = totalsRows[0];
  const reasonTotal = callReasonCounts.reduce((runningTotal, reasonRow) => runningTotal + reasonRow.n, 0);
  const days = daysBetween(range.from, range.to) + 1;
  const dataQualityWarnings = [];
  if (callsWithoutReasonRows[0].n) dataQualityWarnings.push({ id: 'calls_without_reason', level: 'warn', text: `${callsWithoutReasonRows[0].n} call(s) have no reason` });
  if (expiringLeadsRows[0].n) dataQualityWarnings.push({ id: 'leads_expiring_soon', level: 'info', text: `${expiringLeadsRows[0].n} lead(s) will return to the pool within 3 days` });
  if (leadsWithoutPhoneRows[0].n) dataQualityWarnings.push({ id: 'leads_without_phone', level: 'info', text: `${leadsWithoutPhoneRows[0].n} lead(s) in queues have no phone number` });

  return {
    range,
    calls: { calls: totals.calls, nvm: totals.nvm, lvm: totals.lvm, discovery: totals.discovery, answerRate: safeRatio(totals.lvm + totals.discovery, totals.calls), reachRate: safeRatio(totals.discovery, totals.calls) },
    funnel: funnelRows[0],
    campaigns: mergeCallsAndSalesRows(callsByCampaign, salesByCampaign, (key) => campaignNamesByCode.get(key) || key),
    agents: mergeCallsAndSalesRows(callsByAgent, salesByAgent, (key) => agentNamesById.get(key) || key),
    hours: Array.from({ length: 24 }, (_, hour) => {
      const hourRow = callsByHour.find((candidateRow) => candidateRow.h === hour) || { calls: 0, answered: 0, reached: 0 };
      return { hour: hour, calls: hourRow.calls, answered: hourRow.answered, reached: hourRow.reached, reachRate: safeRatio(hourRow.reached, hourRow.calls) };
    }),
    reasons: callReasonCounts.map((reasonRow) => ({ reason: reasonRow.reason, label: REASON_LABELS[reasonRow.reason] || reasonRow.reason, count: reasonRow.n, share: safeRatio(reasonRow.n, reasonTotal) })),
    salesCount: salesTotalsRows[0].sales,
    salesTarget: Math.round((ids.length * env.salesTargetPerAgent * days) / 30), // monthly target, scaled to the range
    dataQuality: dataQualityWarnings,
  };
}

module.exports = { buildAnalyticsReport };
