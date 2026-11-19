const { pool } = require('../config/db');

/**
 * Which agents may this person see?
 *  agent -> himself | team_leader -> his team | operation_manager -> agents of his teams
 *  quality -> agents he follows | admin -> null (= everybody)
 */
async function visibleAgentIds(user, db = pool) {
  switch (user.role) {
    case 'admin': return null;
    case 'agent': return [user.id];
    case 'team_leader':
      return (await db.query(`SELECT id FROM users WHERE role='agent' AND team_id=$1`, [user.team_id])).rows.map((row) => row.id);
    case 'operation_manager':
      return (await db.query(
        `SELECT a.id FROM users a JOIN teams t ON t.id=a.team_id WHERE a.role='agent' AND t.manager_id=$1`, [user.id])).rows.map((row) => row.id);
    case 'quality':
      return (await db.query(`SELECT id FROM users WHERE role='agent' AND quality_id=$1`, [user.id])).rows.map((row) => row.id);
    default: return [];
  }
}

/** Can `user` see this agent (a user row with role agent)? */
async function canSeeAgent(user, agentRow, db = pool) {
  if (user.role === 'admin') return true;
  if (user.role === 'agent') return user.id === agentRow.id;
  if (user.role === 'team_leader') return user.team_id && agentRow.team_id === user.team_id;
  if (user.role === 'quality') return agentRow.quality_id === user.id;
  if (user.role === 'operation_manager') {
    const { rowCount } = await db.query('SELECT 1 FROM teams WHERE id=$1 AND manager_id=$2', [agentRow.team_id, user.id]);
    return rowCount > 0;
  }
  return false;
}

module.exports = { visibleAgentIds, canSeeAgent };
