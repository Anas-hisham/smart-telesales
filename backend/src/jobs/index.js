const { runOnce } = require('./jobs');

const EVERY_MS = 30 * 1000;
let running = false;

function start() {
  const timer = setInterval(async () => {
    if (running) return; // never overlap
    running = true;
    try {
      const result = await runOnce();
      if (result && (result.expired || result.finished || result.reminders)) console.log('[jobs]', result);
    } catch (error) {
      console.error('[jobs] failed:', error.message);
    } finally { running = false; }
  }, EVERY_MS);
  timer.unref();
  console.log(`[jobs] started (every ${EVERY_MS / 1000}s)`);
}

module.exports = { start };
