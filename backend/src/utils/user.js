const { pool } = require('../config/db');

// A user row plus his line of business (agents / team leaders take their team manager's line).
const USER_SELECT = `
  SELECT u.*, COALESCE(u.lob, m.lob) AS eff_lob
  FROM users u
  LEFT JOIN teams t ON t.id = u.team_id
  LEFT JOIN users m ON m.id = t.manager_id`;

/** DB row -> the "User" object of the API */
function formatUserForApi(userRow) {
  if (!userRow) return null;
  const apiUser = { id: userRow.id, username: userRow.username, name: userRow.name, email: userRow.email, role: userRow.role };
  if (userRow.team_id && (userRow.role === 'agent' || userRow.role === 'team_leader')) apiUser.teamId = userRow.team_id;
  apiUser.initials = userRow.initials;
  apiUser.color = userRow.color;
  apiUser.dailyCallTarget = userRow.daily_call_target;
  if (userRow.eff_lob) apiUser.lob = userRow.eff_lob;
  if (userRow.role === 'agent' && userRow.quality_id) apiUser.qualityId = userRow.quality_id;
  apiUser.active = userRow.active;
  return apiUser;
}

async function findUser(id, db = pool) {
  const { rows } = await db.query(`${USER_SELECT} WHERE u.id = $1`, [id]);
  return rows[0] || null;
}
async function findUsers(where = 'TRUE', params = [], db = pool, order = 'u.name') {
  const { rows } = await db.query(`${USER_SELECT} WHERE ${where} ORDER BY ${order}`, params);
  return rows;
}
/** id -> name map for a list of user ids */
async function getUserNamesById(ids, db = pool) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) return new Map();
  const { rows } = await db.query('SELECT id, name FROM users WHERE id = ANY($1::uuid[])', [uniqueIds]);
  return new Map(rows.map((userRow) => [userRow.id, userRow.name]));
}

module.exports = { USER_SELECT, formatUserForApi, findUser, findUsers, getUserNamesById };
