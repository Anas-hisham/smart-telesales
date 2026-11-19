/**
 * Everything "calendar" in this system happens on the Africa/Cairo clock.
 * Dates are plain 'YYYY-MM-DD' strings; instants are stored as UTC timestamptz.
 */
const { tz } = require('../config/env');

const cairoDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Cairo calendar date of an instant -> 'YYYY-MM-DD' */
const toCairoDate = (date = new Date()) => cairoDateFormatter.format(new Date(date));
const getCairoToday = () => toCairoDate(new Date());

const dateStringToUtcDate = (dateString) => new Date(`${dateString}T00:00:00Z`);
const formatIsoDate = (date) => date.toISOString().slice(0, 10);

function addDays(dateStr, days) {
  const date = dateStringToUtcDate(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
}
/** whole days between two 'YYYY-MM-DD' strings (b - a) */
const daysBetween = (fromDate, toDate) => Math.round((dateStringToUtcDate(toDate) - dateStringToUtcDate(fromDate)) / 86400000);

/** Saturday is the first day of the week */
function getWeekStartSaturday(dateStr) {
  const dayOfWeek = dateStringToUtcDate(dateStr).getUTCDay(); // 0 = Sunday ... 6 = Saturday
  return addDays(dateStr, -((dayOfWeek + 1) % 7));
}
const getFirstDayOfMonth = (dateStr) => `${dateStr.slice(0, 7)}-01`;

/** 'YYYY-MM' -> { from, to } (inclusive dates) */
function getMonthRange(month) {
  const from = `${month}-01`;
  const date = dateStringToUtcDate(from);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0); // last day of the month
  return { from, to: formatIsoDate(date) };
}

const addDaysToTimestamp = (iso, days) => new Date(new Date(iso).getTime() + days * 86400000).toISOString();

module.exports = { toCairoDate, getCairoToday, addDays, daysBetween, getWeekStartSaturday, getFirstDayOfMonth, getMonthRange, addDaysToTimestamp };
