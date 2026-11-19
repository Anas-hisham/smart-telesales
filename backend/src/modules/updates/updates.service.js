const { query, runInTransaction } = require('../../config/db');
const { Errors } = require('../../utils/errors');
const { getUserNamesById } = require('../../utils/user');
const { notifyUsers } = require('../../utils/notify');

async function formatUpdatesForApi(rows) {
  const names = await getUserNamesById(rows.flatMap((updateRow) => [updateRow.author_id, ...updateRow.recipient_ids]));
  return rows.map((updateRow) => ({
    id: updateRow.id, audience: updateRow.audience, teamId: updateRow.team_id || null, authorId: updateRow.author_id, authorName: names.get(updateRow.author_id) || '',
    title: updateRow.title, content: updateRow.content, createdAt: updateRow.created_at, acknowledgedBy: updateRow.acknowledged_by, seenBy: updateRow.seen_by,
    recipients: updateRow.recipient_ids.map((id) => ({ id, name: names.get(id) || '' })),
  }));
}

async function listUpdates(user) {
  const { rows } = await query(
    `SELECT * FROM team_updates WHERE author_id = $1 OR $1 = ANY(recipient_ids) ORDER BY created_at DESC`, [user.id]);
  return formatUpdatesForApi(rows);
}

async function createUpdate(user, body) {
  let audience = body.audience;
  let teamId = null;
  let recipientIds;
  if (user.role === 'team_leader') {
    audience = 'specific_team'; // a Team Leader always writes to his own team
    teamId = user.team_id;
    recipientIds = (await query(`SELECT id FROM users WHERE role='agent' AND active AND team_id = $1`, [teamId])).rows.map((userRow) => userRow.id);
  } else if (user.role === 'operation_manager') {
    if (audience === 'specific_team') throw Errors.validation([{ field: 'audience', message: 'Use all, team_leaders or quality' }]);
    const teamLeadersSql = `SELECT u.id FROM users u JOIN teams t ON t.leader_id = u.id WHERE u.active AND t.manager_id = $1`;
    const agentsSql = `SELECT a.id FROM users a JOIN teams t ON t.id = a.team_id WHERE a.role='agent' AND a.active AND t.manager_id = $1`;
    const qualitySql = `SELECT id FROM users WHERE role='quality' AND active AND lob = $2`;
    if (audience === 'team_leaders') recipientIds = (await query(teamLeadersSql, [user.id])).rows.map((userRow) => userRow.id);
    else if (audience === 'quality') recipientIds = (await query(`SELECT id FROM users WHERE role='quality' AND active AND lob = $1`, [user.lob || ''])).rows.map((userRow) => userRow.id);
    else recipientIds = (await query(`${teamLeadersSql} UNION ${agentsSql} UNION ${qualitySql}`, [user.id, user.lob || ''])).rows.map((userRow) => userRow.id);
  } else throw Errors.forbidden('Only a Team Leader or an Operation Manager can post an update');

  return runInTransaction(async (dbClient) => {
    const { rows: [insertedUpdate] } = await dbClient.query(
      `INSERT INTO team_updates (audience, team_id, author_id, title, content, recipient_ids) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [audience, teamId, user.id, body.title, body.content, recipientIds]);
    await notifyUsers(dbClient, recipientIds, { type: 'update', title: body.title, message: `${user.name}: ${body.content.slice(0, 120)}` }, user.id);
    return (await formatUpdatesForApi([insertedUpdate]))[0];
  });
}

async function markUpdatesAsSeen(user) {
  await query(`UPDATE team_updates SET seen_by = array_append(seen_by, $1) WHERE $1 = ANY(recipient_ids) AND NOT ($1 = ANY(seen_by))`, [user.id]);
}

async function acknowledgeUpdate(user, id) {
  const { rows: [existingUpdate] } = await query('SELECT * FROM team_updates WHERE id = $1', [id]);
  if (!existingUpdate) throw Errors.notFound('Update');
  if (!existingUpdate.recipient_ids.includes(user.id)) throw Errors.notOwner('This update was not sent to you');
  const { rows: [updatedRow] } = await query(
    `UPDATE team_updates SET acknowledged_by = CASE WHEN $2 = ANY(acknowledged_by) THEN acknowledged_by ELSE array_append(acknowledged_by, $2) END,
            seen_by = CASE WHEN $2 = ANY(seen_by) THEN seen_by ELSE array_append(seen_by, $2) END WHERE id = $1 RETURNING *`, [id, user.id]);
  return (await formatUpdatesForApi([updatedRow]))[0];
}

module.exports = { listUpdates, createUpdate, markUpdatesAsSeen, acknowledgeUpdate };
