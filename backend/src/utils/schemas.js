const { z } = require('zod');

const uuid = z.string().uuid();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
const monthString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');
const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');
const requiredText = (max = 2000) => z.string().trim().min(1, 'Required').max(max);
const optionalText = (max = 4000) => z.string().trim().max(max);

module.exports = { z, uuid, dateString, timeString, monthString, booleanString, requiredText, optionalText };
