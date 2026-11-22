require('dotenv').config();

const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((variableName) => !process.env[variableName]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  accessTtlSec: 15 * 60, // access token lives 15 minutes
  refreshTtlDays: 30,
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map((origin) => origin.trim()).filter(Boolean),
  runJobs: process.env.RUN_JOBS !== 'false',
  geminiApiKey: process.env.GEMINI_API_KEY || '', // optional: AI features answer 503 until it is set
  geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL || '', // optional second model when the first is overloaded
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',

  // business rules
  tz: 'Africa/Cairo',
  expiryDays: 15, // 15-day rule
  cooldownDays: 15, // after a lead leaves a queue, other agents must wait this long before taking it
  poolTakeLimit: Number(process.env.POOL_TAKE_LIMIT) || 100,
  salesTargetPerAgent: Number(process.env.SALES_TARGET_PER_AGENT) || 10, // per month
  lobs: ['REG', 'DJ'], // lines of business
};
