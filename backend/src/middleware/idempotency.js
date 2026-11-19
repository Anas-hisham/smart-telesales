const { query } = require('../config/db');
const { Errors } = require('../utils/errors');

/**
 * Put on POST routes that must never run twice (double click).
 * Same Idempotency-Key + same user + same route -> the FIRST answer is replayed.
 */
function preventDuplicateRequests() {
  return async (req, res, next) => {
    try {
      const key = req.get('Idempotency-Key');
      if (!key) return next();
      if (key.length > 200) throw Errors.validation([{ field: 'Idempotency-Key', message: 'Too long' }]);
      const route = `${req.method} ${req.baseUrl}${req.route.path}`;
      const keyParams = [req.user.id, route, key];

      // a request that died half way must not block the key forever
      await query(`DELETE FROM idempotency_keys WHERE user_id=$1 AND route=$2 AND key=$3
                   AND state='in_progress' AND created_at < now() - interval '60 seconds'`, keyParams);

      const insertResult = await query(
        `INSERT INTO idempotency_keys (user_id, route, key) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING key`, keyParams);
      if (!insertResult.rowCount) {
        const { rows: [savedRequest] } = await query(
          `SELECT state, status_code, response FROM idempotency_keys WHERE user_id=$1 AND route=$2 AND key=$3`, keyParams);
        if (savedRequest && savedRequest.state === 'done') {
          res.set('Idempotent-Replayed', 'true');
          return res.status(savedRequest.status_code).json(savedRequest.response);
        }
        throw Errors.conflict('REQUEST_IN_PROGRESS', 'The same request is still being processed');
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        const isSuccessStatus = res.statusCode >= 200 && res.statusCode < 300;
        const savingPromise = isSuccessStatus
          ? query(`UPDATE idempotency_keys SET state='done', status_code=$4, response=$5 WHERE user_id=$1 AND route=$2 AND key=$3`,
                  [...keyParams, res.statusCode, JSON.stringify(body)])
          : query(`DELETE FROM idempotency_keys WHERE user_id=$1 AND route=$2 AND key=$3`, keyParams); // failed -> the key can be reused
        savingPromise.catch(() => {}).finally(() => originalJson(body));
        return res;
      };
      next();
    } catch (error) { next(error); }
  };
}
module.exports = { preventDuplicateRequests };
