const { Errors } = require('../utils/errors');

/** Tiny in-memory limiter (one server instance). rateLimit({ windowMs, max, key: (req) => string }) */
function rateLimit({ windowMs, max, key }) {
  const attemptsByClient = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [clientKey, attemptTimes] of attemptsByClient) { const recentAttemptTimes = attemptTimes.filter((attemptTime) => now - attemptTime < windowMs); recentAttemptTimes.length ? attemptsByClient.set(clientKey, recentAttemptTimes) : attemptsByClient.delete(clientKey); }
  }, windowMs).unref();

  return (req, _res, next) => {
    const clientKey = key(req);
    const now = Date.now();
    const attemptTimes = (attemptsByClient.get(clientKey) || []).filter((attemptTime) => now - attemptTime < windowMs);
    if (attemptTimes.length >= max) return next(Errors.tooMany());
    attemptTimes.push(now);
    attemptsByClient.set(clientKey, attemptTimes);
    next();
  };
}
module.exports = { rateLimit };
