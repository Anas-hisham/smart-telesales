const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node scripts/run-sql.js <file.sql>');
  const sql = fs.readFileSync(path.resolve(file), 'utf8');
  await pool.query(sql);
  console.log(`OK: ${file} executed`);
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name IN ('ai_knowledge','lead_ai_analyses') ORDER BY 1`);
  console.log('AI tables in database:', rows.map((row) => row.table_name).join(', ') || '(none)');
}

main()
  .catch((error) => { console.error('FAILED:', error.message); process.exitCode = 1; })
  .finally(() => pool.end());