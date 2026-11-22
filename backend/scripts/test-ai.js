// node scripts/test-ai.js            -> picks the lead with the most calls and analyzes it with Gemini
// node scripts/test-ai.js <leadId>   -> analyzes that lead
const { pool } = require('../src/config/db');
const { findUser } = require('../src/utils/user');
const aiService = require('../src/modules/ai/ai.service');

async function main() {
  const { rows: [adminRow] } = await pool.query(`SELECT id FROM users WHERE role='admin' AND active LIMIT 1`);
  if (!adminRow) throw new Error('No active admin user found');
  const admin = await findUser(adminRow.id);

  let leadId = process.argv[2];
  if (!leadId) {
    const { rows: [top] } = await pool.query(`SELECT lead_id FROM call_logs GROUP BY lead_id ORDER BY count(*) DESC LIMIT 1`);
    leadId = top?.lead_id || (await pool.query('SELECT id FROM leads LIMIT 1')).rows[0]?.id;
  }
  if (!leadId) throw new Error('No leads in the database');
  console.log('Analyzing lead:', leadId, '... (5-30 seconds)');

  const started = Date.now();
  const { analysis, cached } = await aiService.analyzeLead(admin, leadId, { lang: 'ar_en', refresh: true });
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s (cached: ${cached})\n`);
  console.log(JSON.stringify(analysis, null, 2));
}
main().catch((error) => { console.error('FAILED:', error.code || '', error.message); process.exitCode = 1; }).finally(() => pool.end());
