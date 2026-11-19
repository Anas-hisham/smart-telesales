const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { Errors } = require('../utils/errors');
const { findUser } = require('../utils/user');

/** Reads "Authorization: Bearer <token>", loads the fresh user into req.user (a DB row). */
async function authenticate(req, _res, next) {
  try {
    const bearerMatch = (req.get('authorization') || '').match(/^Bearer (.+)$/i);
    if (!bearerMatch) throw Errors.unauthenticated();
    let payload;
    try {
      payload = jwt.verify(bearerMatch[1], env.jwtSecret);
    } catch (error) {
      throw error.name === 'TokenExpiredError' ? Errors.tokenExpired() : Errors.unauthenticated('Invalid token');
    }
    const user = await findUser(payload.sub);
    if (!user || !user.active) throw Errors.unauthenticated();
    req.user = user;
    next();
  } catch (error) { next(error); }
}

/** requireRole('admin', 'team_leader') */
const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(Errors.forbidden('Your role cannot do this'));

module.exports = { authenticate, requireRole };
