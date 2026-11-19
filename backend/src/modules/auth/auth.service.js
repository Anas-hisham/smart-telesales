const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../../config/env');
const { query } = require('../../config/db');
const { Errors } = require('../../utils/errors');
const { sha256 } = require('../../utils/helpers');
const { findUser, formatUserForApi } = require('../../utils/user');

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10); // keeps timing equal for unknown users

async function issueTokens(user) {
  const accessToken = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.accessTtlSec });
  const refreshToken = crypto.randomBytes(48).toString('hex');
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + ($3 || ' days')::interval)`,
    [user.id, sha256(refreshToken), String(env.refreshTtlDays)]
  );
  return { accessToken, refreshToken, expiresIn: env.accessTtlSec };
}

async function login(username, password) {
  const { rows: [userIdRow] } = await query('SELECT id FROM users WHERE lower(username) = lower($1)', [username.trim()]);
  const user = userIdRow ? await findUser(userIdRow.id) : null;
  const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !user.active || !passwordMatches) throw Errors.invalidCredentials();
  return { ...(await issueTokens(user)), user: formatUserForApi(user) };
}

/** The old refresh token dies, a new pair is returned. */
async function refreshSession(refreshToken) {
  const { rows: [refreshTokenRow] } = await query(
    'DELETE FROM refresh_tokens WHERE token_hash = $1 RETURNING user_id, expires_at', [sha256(refreshToken)]);
  if (!refreshTokenRow || new Date(refreshTokenRow.expires_at) < new Date()) throw Errors.tokenExpired();
  const user = await findUser(refreshTokenRow.user_id);
  if (!user || !user.active) throw Errors.tokenExpired();
  return issueTokens(user);
}

/** With a refresh token: this device only. Without: every session of the person. */
async function logout(userId, refreshToken) {
  if (refreshToken) await query('DELETE FROM refresh_tokens WHERE user_id=$1 AND token_hash=$2', [userId, sha256(refreshToken)]);
  else await query('DELETE FROM refresh_tokens WHERE user_id=$1', [userId]);
}

module.exports = { login, refreshSession, logout };
