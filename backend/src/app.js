const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const { query } = require('./config/db');
const routes = require('./modules');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1); // behind the hosting proxy: real client IP for the login limiter
app.use(helmet());
app.use(cors({ origin: env.corsOrigins.includes('*') ? true : env.corsOrigins, exposedHeaders: ['Idempotent-Replayed'] }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  try { await query('SELECT 1'); res.json({ status: 'ok' }); }
  catch (error) { res.status(503).json({ status: 'db_down' }); }
});

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
