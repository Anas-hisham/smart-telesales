const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const env = require('../../config/env');
const { runInTransaction } = require('../../config/db');
const { Errors } = require('../../utils/errors');
const { getInitials, pickColorForSeed } = require('../../utils/helpers');
const { findUser, findUsers, formatUserForApi } = require('../../utils/user');
const { notifyUsers } = require('../../utils/notify');

const hashPassword = (plainPassword) => bcrypt.hash(plainPassword, 10);

async function listUsers(filters, actor) {
  const where = ['TRUE'];
  const sqlParams = [];
  if (!(actor.role === 'admin' && filters.includeDisabled)) where.push('u.active');
  if (filters.role) { sqlParams.push(filters.role); where.push(`u.role = $${sqlParams.length}`); }
  if (filters.teamId) { sqlParams.push(filters.teamId); where.push(`u.team_id = $${sqlParams.length}`); }
  if (filters.lob) { sqlParams.push(filters.lob); where.push(`COALESCE(u.lob, m.lob) = $${sqlParams.length}`); }
  return (await findUsers(where.join(' AND '), sqlParams)).map(formatUserForApi);
}

/** Which optional fields may be sent for which role */
const ALLOWED_FIELDS_BY_ROLE = {
  agent: ['teamId', 'qualityId', 'dailyCallTarget'],
  team_leader: ['teamName', 'managerId'],
  operation_manager: ['lob'],
  quality: ['lob'],
};
const OPTIONAL_FIELDS = ['teamId', 'qualityId', 'dailyCallTarget', 'teamName', 'managerId', 'lob'];

async function createUser(body) {
  const issues = [];
  const addIssue = (field, message) => issues.push({ field, message });

  for (const fieldName of OPTIONAL_FIELDS) {
    if (body[fieldName] !== undefined && body[fieldName] !== null && !ALLOWED_FIELDS_BY_ROLE[body.role].includes(fieldName)) addIssue(fieldName, `Not used for the role ${body.role}`);
  }
  if (body.role === 'operation_manager' || body.role === 'quality') {
    if (!body.lob) addIssue('lob', 'Required for this role');
    else if (!env.lobs.includes(body.lob)) addIssue('lob', `Must be one of ${env.lobs.join(', ')}`);
  }
  if (body.role === 'team_leader' && !body.teamName?.trim()) addIssue('teamName', 'Required for a Team Leader');
  if (body.role === 'agent' && !body.teamId) addIssue('teamId', 'Required for an agent');

  return runInTransaction(async (dbClient) => {
    let team = null;
    if (body.role === 'agent' && body.teamId) {
      const { rows } = await dbClient.query(
        `SELECT t.*, m.lob FROM teams t LEFT JOIN users m ON m.id = t.manager_id WHERE t.id = $1`, [body.teamId]);
      team = rows[0];
      if (!team) addIssue('teamId', 'Unknown team');
    }
    if (team && body.qualityId) {
      const qualityUser = await findUser(body.qualityId, dbClient);
      if (!qualityUser || qualityUser.role !== 'quality' || !qualityUser.active) addIssue('qualityId', 'Not a Quality member');
      else if (!team.lob) addIssue('qualityId', 'The team has no manager yet, so it has no line of business');
      else if (qualityUser.lob !== team.lob) addIssue('qualityId', 'The Quality member is of another line of business');
    }
    if (body.role === 'team_leader' && body.managerId) {
      const managerUser = await findUser(body.managerId, dbClient);
      if (!managerUser || managerUser.role !== 'operation_manager' || !managerUser.active) addIssue('managerId', 'Not an Operation Manager');
    }
    if (issues.length) throw Errors.validation(issues);

    const username = body.username.toLowerCase();
    const email = body.email.toLowerCase();
    const duplicateCheck = await dbClient.query('SELECT lower(username) u, lower(email) e FROM users WHERE lower(username)=$1 OR lower(email)=$2', [username, email]);
    if (duplicateCheck.rows.some((row) => row.u === username)) throw Errors.conflict('USERNAME_TAKEN', 'This username is already used');
    if (duplicateCheck.rows.some((row) => row.e === email)) throw Errors.conflict('EMAIL_TAKEN', 'This email is already used');
    if (body.role === 'team_leader') {
      const sameNameTeam = await dbClient.query('SELECT 1 FROM teams WHERE lower(btrim(name)) = lower(btrim($1))', [body.teamName]);
      if (sameNameTeam.rowCount) throw Errors.conflict('TEAM_NAME_TAKEN', 'This team name is already used');
    }

    const id = randomUUID();
    let teamId = null;
    if (body.role === 'agent') teamId = body.teamId;
    if (body.role === 'team_leader') {
      teamId = randomUUID();
      // user and team point at each other: the FK checks run at COMMIT (deferred constraints)
      await dbClient.query('INSERT INTO teams (id, name, leader_id, manager_id) VALUES ($1,$2,$3,$4)',
        [teamId, body.teamName.trim(), id, body.managerId || null]);
    }
    await dbClient.query(
      `INSERT INTO users (id, username, name, email, password_hash, role, team_id, initials, color, daily_call_target, lob, quality_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, username, body.name.trim(), email, await hashPassword(body.password), body.role, teamId, getInitials(body.name), pickColorForSeed(id),
       body.role === 'agent' ? (body.dailyCallTarget ?? 90) : 0,
       body.role === 'operation_manager' || body.role === 'quality' ? body.lob : null,
       body.role === 'agent' ? body.qualityId || null : null]
    );

    // who is told
    if (body.role === 'agent') {
      await notifyUsers(dbClient, [team.leader_id], { type: 'update', title: 'New agent in your team', message: `${body.name} joined your team` });
      if (body.qualityId) await notifyUsers(dbClient, [body.qualityId], { type: 'update', title: 'New agent to follow', message: `${body.name} is now one of your agents` });
    }
    if (body.role === 'team_leader' && body.managerId) {
      await notifyUsers(dbClient, [body.managerId], { type: 'update', title: 'A team joined your management', message: `Team ${body.teamName.trim()} is now under your management` });
    }
    return formatUserForApi(await findUser(id, dbClient));
  });
}

async function updateUser(id, body) {
  return runInTransaction(async (dbClient) => {
    const { rows: [existingUser] } = await dbClient.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id]);
    if (!existingUser) throw Errors.notFound('User');
    if (body.dailyCallTarget !== undefined && existingUser.role !== 'agent') {
      throw Errors.validation([{ field: 'dailyCallTarget', message: 'Agents only' }]);
    }
    if (body.username && body.username.toLowerCase() !== existingUser.username) {
      const usernameClash = await dbClient.query('SELECT 1 FROM users WHERE lower(username)=$1 AND id<>$2', [body.username.toLowerCase(), id]);
      if (usernameClash.rowCount) throw Errors.conflict('USERNAME_TAKEN', 'This username is already used');
    }
    if (body.email && body.email.toLowerCase() !== existingUser.email) {
      const emailClash = await dbClient.query('SELECT 1 FROM users WHERE lower(email)=$1 AND id<>$2', [body.email.toLowerCase(), id]);
      if (emailClash.rowCount) throw Errors.conflict('EMAIL_TAKEN', 'This email is already used');
    }
    if (body.active === false && existingUser.active) await assertUserHasNoDependents(dbClient, existingUser);

    await dbClient.query(
      `UPDATE users SET username = COALESCE($2, username), name = COALESCE($3, name), email = COALESCE($4, email),
              initials = COALESCE($5, initials), daily_call_target = COALESCE($6, daily_call_target), active = COALESCE($7, active)
       WHERE id = $1`,
      [id, body.username?.toLowerCase() ?? null, body.name?.trim() ?? null, body.email?.toLowerCase() ?? null,
       body.name ? getInitials(body.name) : null, body.dailyCallTarget ?? null, body.active ?? null]
    );
    if (body.active === false) await dbClient.query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]); // kill every session
    return formatUserForApi(await findUser(id, dbClient));
  });
}

/** A person cannot be disabled while somebody still depends on him. */
async function assertUserHasNoDependents(dbClient, user) {
  const blockingReasons = [];
  const countRows = async (sql, sqlParams) => (await dbClient.query(sql, sqlParams)).rows[0].n;
  if (user.role === 'admin' && (await countRows(`SELECT count(*) n FROM users WHERE role='admin' AND active AND id<>$1`, [user.id])) === 0) {
    blockingReasons.push('He is the last active admin');
  }
  if (user.role === 'agent') {
    const leadCount = await countRows('SELECT count(*) n FROM leads WHERE agent_id=$1 AND NOT removed_from_queue', [user.id]);
    if (leadCount) blockingReasons.push(`He still has ${leadCount} lead(s) in his queue: move them with POST /leads/{id}/transfer`);
  }
  if (user.role === 'team_leader') {
    const agentCount = await countRows(`SELECT count(*) n FROM users WHERE role='agent' AND active AND team_id=$1`, [user.team_id]);
    if (agentCount) blockingReasons.push(`His team still has ${agentCount} active agent(s): move them with PUT /agents/{agentId}/team`);
  }
  if (user.role === 'operation_manager') {
    const teamCount = await countRows('SELECT count(*) n FROM teams WHERE manager_id=$1', [user.id]);
    if (teamCount) blockingReasons.push(`He still manages ${teamCount} team(s): move them with PUT /teams/{teamId}/manager`);
  }
  if (user.role === 'quality') {
    const followedAgentCount = await countRows(`SELECT count(*) n FROM users WHERE role='agent' AND active AND quality_id=$1`, [user.id]);
    if (followedAgentCount) blockingReasons.push(`He still follows ${followedAgentCount} agent(s): change them with PUT /agents/{agentId}/quality`);
  }
  if (blockingReasons.length) throw Errors.conflict('USER_HAS_DEPENDENTS', 'This user cannot be disabled yet', blockingReasons.map((reason) => ({ field: 'active', message: reason })));
}

async function resetPassword(id, password) {
  return runInTransaction(async (dbClient) => {
    const updateResult = await dbClient.query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, await hashPassword(password)]);
    if (!updateResult.rowCount) throw Errors.notFound('User');
    await dbClient.query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);
  });
}

module.exports = { listUsers, createUser, updateUser, resetPassword };
