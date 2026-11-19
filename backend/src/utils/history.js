/**
 * One line in a lead's history.
 * who: { id, name } (use SYSTEM for background jobs)
 * extra: { detail, round, agentId, tp: {order,label,type}, meta }
 */
const SYSTEM_ACTOR = { id: 'system', name: 'System' };

async function addLeadHistoryEntry(db, leadId, action, actor, extraDetails = {}) {
  await db.query(
    `INSERT INTO lead_history (lead_id, action, user_id, user_name, detail, round, agent_id,
                               touch_point_order, touch_point_label, touch_point_type, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [leadId, action, actor.id, actor.name, extraDetails.detail || null, extraDetails.round ?? null, extraDetails.agentId || null,
     extraDetails.tp?.order ?? null, extraDetails.tp?.label ?? null, extraDetails.tp?.type ?? null, extraDetails.meta ? JSON.stringify(extraDetails.meta) : null]
  );
}
module.exports = { addLeadHistoryEntry, SYSTEM_ACTOR };
