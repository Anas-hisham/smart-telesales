// npm run seed        -> creates the first admin (only if there is none)
// npm run seed:demo   -> also creates a small demo company (operation manager, team leader, quality, agents, a campaign, leads)
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const { initialsOf, colorFor } = require('../src/utils/helpers');
const users = require('../src/modules/users/users.service');
const campaigns = require('../src/modules/campaigns/campaigns.service');

const demo = process.argv.includes('--demo');

(async () => {
  try {
    const admins = await pool.query(`SELECT 1 FROM users WHERE role='admin'`);
    if (!admins.rowCount) {
      const username = (process.env.SEED_ADMIN_USERNAME || 'admin').toLowerCase();
      const name = process.env.SEED_ADMIN_NAME || 'System Admin';
      const { rows: [u] } = await pool.query(
        `INSERT INTO users (username, name, email, password_hash, role, initials, color)
         VALUES ($1,$2,$3,$4,'admin',$5,$6) RETURNING id`,
        [username, name, process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
         await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'ChangeMe#12345', 10), initialsOf(name), '#4F46E5']);
      console.log(`Admin created: ${username} (change the password!) id=${u.id}`);
    } else console.log('An admin already exists, nothing to do.');

    if (demo) {
      const pw = 'Temp#12345';
      const om = await users.create({ username: 'omar.om', password: pw, name: 'Omar Manager', email: 'omar.om@example.com', role: 'operation_manager', lob: 'REG' });
      const tl = await users.create({ username: 'tamer.tl', password: pw, name: 'Tamer Leader', email: 'tamer.tl@example.com', role: 'team_leader', teamName: 'Team Alpha', managerId: om.id });
      const q = await users.create({ username: 'qadir.q', password: pw, name: 'Qadir Quality', email: 'qadir.q@example.com', role: 'quality', lob: 'REG' });
      for (const [u, n] of [['mona.agent', 'Mona Adel'], ['sara.agent', 'Sara Ali']]) {
        await users.create({ username: u, password: pw, name: n, email: `${u}@example.com`, role: 'agent', teamId: tl.teamId, qualityId: q.id });
      }
      await campaigns.create({
        campaignCode: 'ACT-001', name: 'Spring Activation',
        steps: [{ type: 'call', label: 'Call 1', gapDays: 0 }, { type: 'call', label: 'Call 2', gapDays: 2 },
                { type: 'email', label: 'Follow-up email', gapDays: 1 }, { type: 'call', label: 'Call 3', gapDays: 3 }],
      });
      const rows = Array.from({ length: 8 }, (_, i) => [`L${10230 + i}`, 'ACT-001', `Company ${i + 1}`, `Contact ${i + 1}`, `contact${i + 1}@example.com`, `+2010012345${60 + i}`]);
      for (const r of rows) {
        await pool.query(`INSERT INTO leads (lead_code, campaign_code, company_name, contact_name, email, phone) VALUES ($1,$2,$3,$4,$5,$6)`, r);
      }
      console.log(`Demo data created. Every demo user has the password: ${pw}`);
      console.log('Users: omar.om (operation_manager), tamer.tl (team_leader), qadir.q (quality), mona.agent / sara.agent (agents)');
    }
  } catch (e) {
    console.error('Seed failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
