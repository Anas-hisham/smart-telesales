/** Percent with one decimal (0 when the denominator is 0). */
export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
