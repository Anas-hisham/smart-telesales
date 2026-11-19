/** Date helpers (local calendar days, not UTC). */
// ---------------------------------------------------------------------------
// Meetings / templates helpers
// ---------------------------------------------------------------------------
/** Local YYYY-MM-DD (matches what the date input stores in Meeting.date). */
export const localDay = (dateOrTimestamp: Date | number = Date.now()) => {
  const date = new Date(dateOrTimestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const startOfDay = (dateOrTimestamp: Date | number) => { const date = new Date(dateOrTimestamp); date.setHours(0, 0, 0, 0); return date; };

export const endOfDay = (dateOrTimestamp: Date | number) => { const date = new Date(dateOrTimestamp); date.setHours(23, 59, 59, 999); return date; };

/** 15 min / 5h 20m / 2d 5h  -  short, human duration. */
export function formatDuration(milliseconds: number): string {
  const mins = Math.max(1, Math.round(milliseconds / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) { const minutes = mins % 60; return minutes ? `${hours}h ${minutes}m` : `${hours}h`; }
  const days = Math.floor(hours / 24); const remainingHours = hours % 24;
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

const padWithZero = (value: number) => String(value).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (not UTC, so the sale lands on the day the user sees). */
export const localDateStr = (date: Date = new Date()) => `${date.getFullYear()}-${padWithZero(date.getMonth() + 1)}-${padWithZero(date.getDate())}`;

export const currentMonthKey = () => localDateStr().slice(0, 7);

export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${padWithZero(date.getMonth() + 1)}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
