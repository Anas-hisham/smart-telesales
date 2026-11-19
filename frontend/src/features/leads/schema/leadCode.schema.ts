/** Lead code rules: how a lead code is cleaned, compared and validated. */
export const MAX_ROWS_PER_IMPORT = 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\u00AD]/g;

/** Trim, drop invisible characters / surrounding quotes (Excel and web pages add them) and collapse spaces. This is what gets stored. */
export const cleanLeadCode = (code: string) =>
  code.replace(INVISIBLE, '').normalize('NFKC').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim().replace(/\s+/g, ' ');

/** A lead id is accepted only when it is made of letters and digits and nothing else (no spaces, dashes or symbols). */
export const isValidLeadCode = (code: string) => /^[\p{L}\p{N}]+$/u.test(cleanLeadCode(code));

export const isValidEmail = (email: string) => EMAIL_RE.test(email);
