const { Pool, types } = require('pg');
const env = require('./env');

// date -> 'YYYY-MM-DD' (not a JS Date), bigint/count -> number, numeric -> number
types.setTypeParser(1082, (value) => value);
types.setTypeParser(20, (value) => parseInt(value, 10));
types.setTypeParser(1700, (value) => parseFloat(value));

const isLocal = /@(localhost|127\.0\.0\.1)/.test(env.databaseUrl);

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000, // Neon may need a few seconds to wake up
  ssl: isLocal ? false : { rejectUnauthorized: true }, // Neon URLs also carry sslmode=require
});
pool.on('error', (error) => console.error('[pg] idle client error:', error.message));

const query = (text, params) => pool.query(text, params);

/** Run fn(client) inside one transaction. Commit on success, rollback on error. */
async function runInTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, runInTransaction };
