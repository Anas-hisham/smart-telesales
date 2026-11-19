const { ApiError } = require('../utils/errors');
const env = require('../config/env');

// unique indexes of the schema -> API error codes
const UNIQUE_CONSTRAINT_ERRORS = {
  users_username_uq: ['USERNAME_TAKEN', 'This username is already used'],
  users_email_uq: ['EMAIL_TAKEN', 'This email is already used'],
  teams_name_uq: ['TEAM_NAME_TAKEN', 'This team name is already used'],
  leads_code_uq: ['CODE_TAKEN', 'This lead id is already used'],
  workflows_campaign_code_key: ['CAMPAIGN_CODE_EXISTS', 'This campaign code is already used'],
};

const sendError = (res, status, code, message, details) =>
  res.status(status).json({ error: { code, message, ...(details?.length ? { details } : {}) } });

function notFoundHandler(_req, res) {
  sendError(res, 404, 'NOT_FOUND', 'Route not found');
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) return sendError(res, err.status, err.code, err.message, err.details);
  if (err.type === 'entity.parse.failed') return sendError(res, 422, 'VALIDATION_FAILED', 'The body is not valid JSON');
  if (err.type === 'entity.too.large') return sendError(res, 422, 'VALIDATION_FAILED', 'The body is too large');
  if (err.code === '23505') {
    const [code, message] = UNIQUE_CONSTRAINT_ERRORS[err.constraint] || ['CONFLICT', 'This already exists'];
    return sendError(res, 409, code, message);
  }
  if (err.code === '22P02') return sendError(res, 404, 'NOT_FOUND', 'Item not found'); // malformed uuid in the URL
  if (err.code === '23503') return sendError(res, 409, 'CONFLICT', 'This item is still used by other data');

  console.error('[error]', err);
  sendError(res, 500, 'INTERNAL_ERROR', env.nodeEnv === 'production' ? 'Something went wrong' : err.message);
}

module.exports = { errorHandler, notFoundHandler };
