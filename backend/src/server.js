const env = require('./config/env');
const { pool } = require('./config/db');
const app = require('./app');

const server = app.listen(env.port, () => {
  console.log(`SalesFlow API listening on :${env.port} (${env.nodeEnv})`);
});

if (env.runJobs) {
  try { require('./jobs').start(); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
}

// graceful stop (hosting platforms send SIGTERM on deploy)
function shutdown(signal) {
  console.log(`${signal} received, closing...`);
  server.close(async () => { await pool.end().catch(() => {}); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => console.error('[unhandledRejection]', error));
