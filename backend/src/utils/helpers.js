const crypto = require('crypto');

const uniqueNonEmpty = (values) => [...new Set((values || []).filter(Boolean))];
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#64748B'];

function getInitials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || '')).toUpperCase();
}
const pickColorForSeed = (seed) => COLORS[parseInt(sha256(String(seed)).slice(0, 6), 16) % COLORS.length];

/** page + pageSize from query, with safe limits */
function readPagination(queryParams, defaultPageSize = 50, maxPageSize = 200) {
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, parseInt(queryParams.pageSize, 10) || defaultPageSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
const roundToFourDecimals = (value) => Math.round(value * 10000) / 10000;
const safeRatio = (numerator, denominator) => (denominator ? roundToFourDecimals(numerator / denominator) : 0);

module.exports = { uniqueNonEmpty, sha256, getInitials, pickColorForSeed, readPagination, roundToFourDecimals, safeRatio };
