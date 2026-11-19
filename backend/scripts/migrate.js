// npm run migrate  -> runs every sql/*.sql file once, in name order.
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

(async () => {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const dir = path.join(__dirname, '..', 'sql');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      const done = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [f]);
      if (done.rowCount) { console.log(`skip   ${f}`); continue; }
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
        await client.query('COMMIT');
        console.log(`applied ${f}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
