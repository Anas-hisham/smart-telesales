const { query, runInTransaction } = require('../../config/db');
const { Errors } = require('../../utils/errors');
const { findUser, findUsers, formatUserForApi, getUserNamesById } = require('../../utils/user');
const { notifyUsers } = require('../../utils/notify');

/** People this user may raise a problem about (the people around him). */
async function listPeopleToEscalateAbout(user) {
  const queryAndParamsForRole = {
    agent: [`u.active AND u.id <> $1 AND (u.id = (SELECT leader_id FROM teams WHERE id = $2) OR u.id = $3
             OR u.id = (SELECT manager_id FROM teams WHERE id = $2))`, [user.id, user.team_id, user.quality_id]],
    team_leader: [`u.active AND (u.team_id = $2 AND u.role = 'agent' OR u.id = (SELECT manager_id FROM teams WHERE id = $2))`, [user.id, user.team_id]],
    quality: [`u.active AND (u.quality_id = $1 OR u.id IN (SELECT leader_id FROM teams t JOIN users a ON a.team_id = t.id WHERE a.quality_id = $1))`, [user.id]],
    operation_manager: [`u.active AND u.id <> $1 AND (u.team_id IN (SELECT id FROM teams WHERE manager_id = $1) OR (u.role = 'quality' AND u.lob = $2))`, [user.id, user.lob || '']],
    admin: [`u.active AND u.id <> $1`, [user.id]],
  }[user.role];
  return findUsers(queryAndParamsForRole[0], queryAndParamsForRole[1], undefined, 'u.role, u.name');
}

/** Who may receive an escalation about `about`: his Team Leader, manager, Quality and the admins (suggested first). */
async function findPossibleRecipients(about, requestingUser) {
  const possibleRecipients = [];
  const addCandidate = (candidate, reason) => { if (candidate && candidate.active && candidate.id !== requestingUser.id && candidate.id !== about.id && !possibleRecipients.some((existing) => existing.user.id === candidate.id)) possibleRecipients.push({ user: formatUserForApi(candidate), reason }); };
  if (about.role === 'agent' || about.role === 'team_leader') {
    const { rows: [team] } = await query('SELECT leader_id, manager_id FROM teams WHERE id = $1', [about.team_id]);
    if (about.role === 'agent' && team) addCandidate(await findUser(team.leader_id), 'His Team Leader');
    if (team?.manager_id) addCandidate(await findUser(team.manager_id), 'Operation Manager of his team');
    if (about.role === 'agent' && about.quality_id) addCandidate(await findUser(about.quality_id), 'His Quality member');
  }
  if (about.role === 'quality') for (const manager of await findUsers(`u.role = 'operation_manager' AND u.lob = $1`, [about.lob])) addCandidate(manager, 'Operation Manager of his line');
  for (const admin of await findUsers(`u.role = 'admin'`)) addCandidate(admin, 'Admin');
  return possibleRecipients;
}

async function listEscalationRecipients(user, aboutId) {
  const about = await findUser(aboutId);
  if (!about) throw Errors.notFound('Person');
  return findPossibleRecipients(about, user);
}

async function loadEscalationsWithSteps(rows, user) {
  if (!rows.length) return [];
  const ids = rows.map((escalationRow) => escalationRow.id);
  const steps = (await query('SELECT * FROM escalation_steps WHERE escalation_id = ANY($1::uuid[]) ORDER BY at', [ids])).rows;
  const names = await getUserNamesById([...rows.flatMap((escalationRow) => [escalationRow.author_id, escalationRow.about_id, escalationRow.handler_id]), ...steps.flatMap((step) => [step.by_id, step.to_id])]);
  const recipientsCache = new Map();
  const getForwardTargets = async (escalationRow) => {
    if (!recipientsCache.has(escalationRow.about_id)) recipientsCache.set(escalationRow.about_id, (await findPossibleRecipients(await findUser(escalationRow.about_id), user)).map((candidate) => candidate.user));
    return recipientsCache.get(escalationRow.about_id);
  };
  return Promise.all(rows.map(async (escalationRow) => {
    const isMyOpenEscalation = escalationRow.status === 'open' && escalationRow.handler_id === user.id;
    const escalationData = {
      id: escalationRow.id, createdAt: escalationRow.created_at, authorId: escalationRow.author_id, authorName: names.get(escalationRow.author_id) || '', aboutId: escalationRow.about_id,
      aboutName: names.get(escalationRow.about_id) || '', title: escalationRow.title, details: escalationRow.details, handlerId: escalationRow.handler_id, status: escalationRow.status,
      steps: steps.filter((step) => step.escalation_id === escalationRow.id).map((step) => {
        const stepData = { id: step.id, at: step.at, byId: step.by_id, byName: names.get(step.by_id) || '', action: step.action };
        if (step.to_id) { stepData.toId = step.to_id; stepData.toName = names.get(step.to_id) || ''; }
        if (step.note) stepData.note = step.note;
        return stepData;
      }),
    };
    return { ...escalationData, _mine: isMyOpenEscalation, _targets: isMyOpenEscalation ? await getForwardTargets(escalationRow) : [] };
  }));
}
const withoutInternalFields = ({ _mine, _targets, ...escalation }) => escalation;
const withMyActions = ({ _mine, _targets, ...escalation }) => ({ ...escalation, myActions: { canForward: _mine, canResolve: _mine, forwardTargets: _targets } });

/** Admin sees all. Others: what they wrote or handled. The person it is about never sees it. */
async function listEscalations(user) {
  const listSql = user.role === 'admin'
    ? 'SELECT * FROM escalations ORDER BY created_at DESC'
    : `SELECT e.* FROM escalations e WHERE e.about_id <> $1 AND (e.author_id = $1 OR e.handler_id = $1
         OR EXISTS (SELECT 1 FROM escalation_steps s WHERE s.escalation_id = e.id AND (s.by_id = $1 OR s.to_id = $1))) ORDER BY e.created_at DESC`;
  const { rows } = await query(listSql, user.role === 'admin' ? [] : [user.id]);
  return (await loadEscalationsWithSteps(rows, user)).map(withMyActions);
}

/** one escalation, read after the transaction is committed */
async function getEscalationById(user, id) {
  const { rows } = await query('SELECT * FROM escalations WHERE id = $1', [id]);
  return withoutInternalFields((await loadEscalationsWithSteps(rows, user))[0]);
}

async function createEscalation(user, body) {
  const about = await findUser(body.aboutId);
  if (!about) throw Errors.notFound('Person');
  if (!(await listPeopleToEscalateAbout(user)).some((person) => person.id === about.id)) throw Errors.forbidden('You cannot raise a problem about this person');
  if (!(await findPossibleRecipients(about, user)).some((candidate) => candidate.user.id === body.recipientId)) {
    throw Errors.validation([{ field: 'recipientId', message: 'This person cannot receive an escalation about him' }]);
  }
  return runInTransaction(async (dbClient) => {
    const { rows: [escalation] } = await dbClient.query(
      `INSERT INTO escalations (author_id, about_id, title, details, handler_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [user.id, about.id, body.title, body.details, body.recipientId]);
    await dbClient.query(`INSERT INTO escalation_steps (escalation_id, by_id, action, to_id) VALUES ($1,$2,'created',$3)`, [escalation.id, user.id, body.recipientId]);
    await notifyUsers(dbClient, [body.recipientId], { type: 'escalation', title: 'New escalation', message: `${user.name} raised: ${body.title}` }, user.id);
    return escalation.id;
  }).then((id) => getEscalationById(user, id));
}

async function lockEscalationForHandler(dbClient, user, id) {
  const { rows: [escalation] } = await dbClient.query('SELECT * FROM escalations WHERE id = $1 FOR UPDATE', [id]);
  if (!escalation) throw Errors.notFound('Escalation');
  if (escalation.handler_id !== user.id) throw Errors.notOwner('You are not the current handler');
  if (escalation.status === 'resolved') throw Errors.conflict('ALREADY_RESOLVED', 'This escalation is already resolved');
  return escalation;
}

async function forwardEscalation(user, id, body) {
  return runInTransaction(async (dbClient) => {
    const escalation = await lockEscalationForHandler(dbClient, user, id);
    const about = await findUser(escalation.about_id, dbClient);
    if (!(await findPossibleRecipients(about, user)).some((candidate) => candidate.user.id === body.toId)) {
      throw Errors.validation([{ field: 'toId', message: 'You cannot pass it to this person' }]);
    }
    await dbClient.query('UPDATE escalations SET handler_id = $2 WHERE id = $1', [id, body.toId]);
    await dbClient.query(`INSERT INTO escalation_steps (escalation_id, by_id, action, to_id, note) VALUES ($1,$2,'forwarded',$3,$4)`, [id, user.id, body.toId, body.note || null]);
    await notifyUsers(dbClient, [body.toId], { type: 'escalation', title: 'An escalation was passed to you', message: escalation.title }, user.id);
    return id;
  }).then((escalationId) => getEscalationById(user, escalationId));
}

async function resolveEscalation(user, id, body) {
  return runInTransaction(async (dbClient) => {
    const escalation = await lockEscalationForHandler(dbClient, user, id);
    await dbClient.query(`UPDATE escalations SET status = 'resolved' WHERE id = $1`, [id]);
    await dbClient.query(`INSERT INTO escalation_steps (escalation_id, by_id, action, note) VALUES ($1,$2,'resolved',$3)`, [id, user.id, body.note || null]);
    await notifyUsers(dbClient, [escalation.author_id], { type: 'escalation', title: 'Your escalation was resolved', message: escalation.title }, user.id);
    return id;
  }).then((escalationId) => getEscalationById(user, escalationId));
}

module.exports = { listPeopleToEscalateAbout, listEscalationRecipients, listEscalations, createEscalation, forwardEscalation, resolveEscalation };
