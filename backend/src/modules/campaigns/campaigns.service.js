const { query } = require('../../config/db');
const { Errors } = require('../../utils/errors');

const formatCampaignForApi = (campaignRow) => ({
  id: campaignRow.id, campaignCode: campaignRow.campaign_code, name: campaignRow.name, touchPoints: campaignRow.touch_points,
  updatedAt: campaignRow.updated_at, leadCount: campaignRow.lead_count ?? 0,
});
const CAMPAIGN_SELECT = `SELECT w.*, (SELECT count(*) FROM leads l WHERE l.campaign_code = w.campaign_code) AS lead_count FROM workflows w`;

/** steps with "days to wait after the previous step" -> touch points with running totals */
function buildTouchPointsFromSteps(steps) {
  let offset = 0;
  return steps.map((step, stepIndex) => { offset += step.gapDays; return { order: stepIndex, type: step.type, label: step.label.trim(), dayOffset: offset }; });
}

async function listCampaigns() {
  return (await query(`${CAMPAIGN_SELECT} ORDER BY w.name`)).rows.map(formatCampaignForApi);
}
async function createCampaign(body) {
  const code = body.campaignCode.trim().toUpperCase();
  const existingCampaign = await query('SELECT 1 FROM workflows WHERE campaign_code = $1', [code]);
  if (existingCampaign.rowCount) throw Errors.conflict('CAMPAIGN_CODE_EXISTS', 'This campaign code is already used');
  const { rows: [insertedCampaign] } = await query(
    'INSERT INTO workflows (campaign_code, name, touch_points) VALUES ($1,$2,$3) RETURNING *',
    [code, body.name.trim(), JSON.stringify(buildTouchPointsFromSteps(body.steps))]);
  return formatCampaignForApi(insertedCampaign);
}
async function updateCampaign(code, body) {
  const normalizedCode = code.trim().toUpperCase();
  if (body.campaignCode.trim().toUpperCase() !== normalizedCode) throw Errors.validation([{ field: 'campaignCode', message: 'The code never changes' }]);
  const { rows: [updatedCampaign] } = await query(
    'UPDATE workflows SET name=$2, touch_points=$3, updated_at=now() WHERE campaign_code=$1 RETURNING *',
    [normalizedCode, body.name.trim(), JSON.stringify(buildTouchPointsFromSteps(body.steps))]);
  if (!updatedCampaign) throw Errors.notFound('Campaign');
  return formatCampaignForApi((await query(`${CAMPAIGN_SELECT} WHERE w.id = $1`, [updatedCampaign.id])).rows[0]);
}
async function deleteCampaign(code) {
  const normalizedCode = code.trim().toUpperCase();
  const { rows: [workflow] } = await query('SELECT id FROM workflows WHERE campaign_code = $1', [normalizedCode]);
  if (!workflow) throw Errors.notFound('Campaign');
  const leadsUsingCampaign = await query('SELECT 1 FROM leads WHERE campaign_code = $1 LIMIT 1', [normalizedCode]);
  if (leadsUsingCampaign.rowCount) throw Errors.conflict('CAMPAIGN_IN_USE', 'This campaign still has leads');
  await query('DELETE FROM workflows WHERE id = $1', [workflow.id]);
}

module.exports = { listCampaigns, createCampaign, updateCampaign, deleteCampaign };
