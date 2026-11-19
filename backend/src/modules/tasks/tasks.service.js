const { query, runInTransaction } = require('../../config/db');
const { Errors } = require('../../utils/errors');
const { uniqueNonEmpty } = require('../../utils/helpers');
const { findUsers, formatUserForApi, getUserNamesById } = require('../../utils/user');
const { notifyUsers } = require('../../utils/notify');

const formatTaskForApi = (taskRow, names) => ({
  id: taskRow.id, authorId: taskRow.author_id, authorName: names.get(taskRow.author_id) || '', title: taskRow.title, description: taskRow.description,
  createdAt: taskRow.created_at, deadline: taskRow.deadline, assignedTo: taskRow.assigned_to, completedBy: taskRow.completed_by, seenBy: taskRow.seen_by,
});
const formatTasksForApi = async (rows) => { const authorNames = await getUserNamesById(rows.map((taskRow) => taskRow.author_id)); return rows.map((taskRow) => formatTaskForApi(taskRow, authorNames)); };

/** Team leader -> agents of his team. Operation manager -> team leaders and agents of his teams. */
async function listAssignableUsers(user) {
  if (user.role === 'team_leader') return (await findUsers(`u.role='agent' AND u.active AND u.team_id = $1`, [user.team_id])).map(formatUserForApi);
  return (await findUsers(
    `u.active AND u.role IN ('team_leader','agent') AND u.team_id IN (SELECT id FROM teams WHERE manager_id = $1)`, [user.id], undefined, `u.role, u.name`)).map(formatUserForApi);
}

async function listTasks(user) {
  const { rows } = await query('SELECT * FROM tasks WHERE author_id = $1 OR $1 = ANY(assigned_to) ORDER BY created_at DESC', [user.id]);
  return formatTasksForApi(rows);
}

async function createTask(user, body) {
  const allowed = new Set((await listAssignableUsers(user)).map((assignee) => assignee.id));
  const ids = uniqueNonEmpty(body.assignedTo);
  const notAllowedIds = ids.filter((personId) => !allowed.has(personId));
  if (notAllowedIds.length) throw Errors.validation(notAllowedIds.map((personId) => ({ field: 'assignedTo', message: `Person ${personId} cannot get a task from you` })));
  return runInTransaction(async (dbClient) => {
    const { rows: [insertedTask] } = await dbClient.query(
      `INSERT INTO tasks (author_id, title, description, deadline, assigned_to) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [user.id, body.title, body.description || '', body.deadline, ids]);
    await notifyUsers(dbClient, ids, { type: 'task', title: 'New task', message: `${body.title} (deadline ${body.deadline})` }, user.id);
    return (await formatTasksForApi([insertedTask]))[0];
  });
}

async function markTasksAsSeen(user) {
  await query(`UPDATE tasks SET seen_by = array_append(seen_by, $1) WHERE $1 = ANY(assigned_to) AND NOT ($1 = ANY(seen_by))`, [user.id]);
}

/** Mark my part done / not done */
async function toggleTaskCompletion(user, id) {
  const { rows: [task] } = await query('SELECT * FROM tasks WHERE id = $1', [id]);
  if (!task) throw Errors.notFound('Task');
  if (!task.assigned_to.includes(user.id)) throw Errors.notOwner('This task is not assigned to you');
  const { rows: [updatedTask] } = await query(
    `UPDATE tasks SET completed_by = CASE WHEN $2 = ANY(completed_by) THEN array_remove(completed_by, $2) ELSE array_append(completed_by, $2) END WHERE id = $1 RETURNING *`,
    [id, user.id]);
  return (await formatTasksForApi([updatedTask]))[0];
}

module.exports = { listAssignableUsers, listTasks, createTask, markTasksAsSeen, toggleTaskCompletion };
