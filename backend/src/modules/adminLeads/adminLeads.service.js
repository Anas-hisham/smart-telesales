const { query, runInTransaction } = require('../../config/db');
const { Errors } = require('../../utils/errors');
const { readPagination } = require('../../utils/helpers');

const formatLeadForAdmin = (leadRow) => ({
  id: leadRow.id, leadCode: leadRow.lead_code, campaignCode: leadRow.campaign_code, companyName: leadRow.company_name, contactName: leadRow.contact_name,
  phone: leadRow.phone, email: leadRow.email,
  agentId: leadRow.removed_from_queue ? null : leadRow.agent_id, agentName: leadRow.removed_from_queue ? null : leadRow.agent_name,
  inPool: leadRow.removed_from_queue, hasSale: !!leadRow.has_sale, status: leadRow.status, assignedAt: leadRow.assigned_at, round: leadRow.round,
});
const ADMIN_LEAD_SELECT = `SELECT l.*, u.name AS agent_name, EXISTS (SELECT 1 FROM sales s WHERE s.lead_id = l.id) AS has_sale
                FROM leads l LEFT JOIN users u ON u.id = l.agent_id`;

async function listLeadsForAdmin(filters) {
  const sqlParams = [];
  const where = ['TRUE'];
  if (filters.filter === 'pool') where.push('l.removed_from_queue');
  if (filters.filter === 'assigned') where.push('NOT l.removed_from_queue');
  if (filters.q) {
    sqlParams.push(`%${filters.q.trim()}%`);
    where.push(`(l.lead_code ILIKE $1 OR l.company_name ILIKE $1 OR l.contact_name ILIKE $1 OR l.email ILIKE $1)`);
  }
  const { page, pageSize, offset } = readPagination(filters);
  const whereClause = where.join(' AND ');
  const total = (await query(`SELECT count(*) n FROM leads l WHERE ${whereClause}`, sqlParams)).rows[0].n;
  const counts = (await query(`SELECT count(*) FILTER (WHERE removed_from_queue) pool, count(*) FILTER (WHERE NOT removed_from_queue) assigned FROM leads`)).rows[0];
  const { rows } = await query(`${ADMIN_LEAD_SELECT} WHERE ${whereClause} ORDER BY l.created_at DESC, l.lead_code LIMIT ${pageSize} OFFSET ${offset}`, sqlParams);
  return { items: rows.map(formatLeadForAdmin), total, page, pageSize, poolCount: counts.pool, assignedCount: counts.assigned };
}

async function getValidCampaignCode(code) {
  const normalizedCode = code.trim().toUpperCase();
  const campaignRow = await query('SELECT 1 FROM workflows WHERE campaign_code = $1', [normalizedCode]);
  if (!campaignRow.rowCount) throw Errors.validation([{ field: 'campaignCode', message: 'Unknown campaign' }]);
  return normalizedCode;
}

async function addSingleLead(body) {
  const campaign = await getValidCampaignCode(body.campaignCode);
  const existingLead = await query('SELECT 1 FROM leads WHERE lower(lead_code) = lower($1)', [body.leadCode]);
  if (existingLead.rowCount) throw Errors.conflict('CODE_TAKEN', 'This lead id is already used');
  const { rows: [insertedLead] } = await query(
    `INSERT INTO leads (lead_code, campaign_code, company_name, contact_name, phone, email) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [body.leadCode, campaign, body.companyName.trim(), body.contactName.trim(), (body.phone || '').trim(), body.email.trim()]);
  return formatLeadForAdmin((await query(`${ADMIN_LEAD_SELECT} WHERE l.id = $1`, [insertedLead.id])).rows[0]);
}

// ─────────── paste import ───────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lines: Lead ID, Company name, Full name, Email, Phone(optional) separated by tab / comma / semicolon */
async function parsePastedLeadLines(text) {
  const accepted = [];
  const rejected = [];
  const seen = new Set();
  const lines = text.split(/\r?\n/);
  if (lines.length > 5000) throw Errors.validation([{ field: 'text', message: 'At most 5000 lines at a time' }]);

  const parsed = [];
  lines.forEach((raw, lineIndex) => {
    if (!raw.trim()) return;
    const cells = (raw.includes('\t') ? raw.split('\t') : raw.split(/[;,]/)).map((cell) => cell.trim());
    if (cells[0].replace(/\s/g, '').toLowerCase() === 'leadid') return; // header line
    parsed.push({ line: lineIndex + 1, raw, leadCode: cells[0] || '', companyName: cells[1] || '', contactName: cells[2] || '', email: cells[3] || '', phone: cells[4] || '' });
  });

  const codes = parsed.map((parsedLine) => parsedLine.leadCode.toLowerCase()).filter(Boolean);
  const existing = new Set((await query('SELECT lower(lead_code) c FROM leads WHERE lower(lead_code) = ANY($1::text[])', [codes])).rows.map((existingRow) => existingRow.c));

  for (const parsedLine of parsed) {
    let reason = null;
    if (!/^[A-Za-z0-9]{1,40}$/.test(parsedLine.leadCode)) reason = 'The lead id must be letters and digits only';
    else if (!parsedLine.companyName) reason = 'Company name is missing';
    else if (!parsedLine.contactName) reason = 'Full name is missing';
    else if (!EMAIL_REGEX.test(parsedLine.email)) reason = 'The email is not valid';
    else if (parsedLine.phone.length > 40) reason = 'The phone is too long';
    else if (seen.has(parsedLine.leadCode.toLowerCase())) reason = 'The same lead id is repeated in the pasted rows';
    else if (existing.has(parsedLine.leadCode.toLowerCase())) reason = 'This lead id already exists';
    if (reason) { rejected.push({ line: parsedLine.line, raw: parsedLine.raw, leadCode: parsedLine.leadCode, reason }); continue; }
    seen.add(parsedLine.leadCode.toLowerCase());
    accepted.push({ line: parsedLine.line, leadCode: parsedLine.leadCode, companyName: parsedLine.companyName, contactName: parsedLine.contactName, email: parsedLine.email, phone: parsedLine.phone });
  }
  return { accepted, rejected };
}

async function previewLeadImport(body) {
  await getValidCampaignCode(body.campaignCode);
  return parsePastedLeadLines(body.text);
}

async function importLeadsFromPaste(body) {
  const campaign = await getValidCampaignCode(body.campaignCode);
  const { accepted, rejected } = await parsePastedLeadLines(body.text); // everything is checked again on save
  let created = 0;
  if (accepted.length) {
    const insertResult = await query(
      `INSERT INTO leads (lead_code, campaign_code, company_name, contact_name, email, phone)
       SELECT t.c, $2, t.co, t.ct, t.e, t.p FROM unnest($1::text[], $3::text[], $4::text[], $5::text[], $6::text[]) AS t(c, co, ct, e, p)
       ON CONFLICT (lower(lead_code)) DO NOTHING`,
      [accepted.map((acceptedLine) => acceptedLine.leadCode), campaign, accepted.map((acceptedLine) => acceptedLine.companyName), accepted.map((acceptedLine) => acceptedLine.contactName),
      accepted.map((acceptedLine) => acceptedLine.email), accepted.map((acceptedLine) => acceptedLine.phone)]);
    created = insertResult.rowCount;
  }
  return { created, rejected };
}

/** Delete for good (a recorded sale does not block the admin). Their arranged meetings are cancelled. */
async function deleteLeadsPermanently(ids) {
  return runInTransaction(async (dbClient) => {
    const { rows } = await dbClient.query(
      `SELECT l.id FROM leads l WHERE l.id = ANY($1::uuid[]) ORDER BY l.id FOR UPDATE OF l`, [ids]);
    const found = new Map(rows.map((row) => [row.id, row]));
    const deleted = [];
    const skipped = [];
    for (const id of ids) {
      const foundLead = found.get(id);
      if (!foundLead) skipped.push({ id, reason: 'NOT_FOUND' });
      else deleted.push(id);
    }
    if (deleted.length) {
      await dbClient.query(`UPDATE meetings SET status = 'cancelled' WHERE lead_id = ANY($1::uuid[]) AND status = 'arranged'`, [deleted]);
      await dbClient.query('DELETE FROM sales WHERE lead_id = ANY($1::uuid[])', [deleted]);
      await dbClient.query('DELETE FROM leads WHERE id = ANY($1::uuid[])', [deleted]);
    }
    return { deleted, skipped };
  });
}

module.exports = { listLeadsForAdmin, addSingleLead, previewLeadImport, importLeadsFromPaste, deleteLeadsPermanently };
