/**
 * AaplaVasaiVirar Backend — VVMC Hyper-local Platform
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import pool, { ensurePostGIS } from './config/db.js';
import { isConfigured as imagekitConfigured } from './services/imagekitService.js';
import { provider as smsProvider, apiKey as smsApiKey, senderId as smsSenderId } from './config/sms.js';

import authRoutes from './routes/auth.js';
import shopsRoutes from './routes/shops.js';
import volunteersRoutes from './routes/volunteers.js';
import leaderboardRoutes from './routes/leaderboard.js';
import adminRoutes from './routes/admin.js';
import sessionsRoutes from './routes/sessions.js';
import buildingsRoutes from './routes/buildings.js';
import eventsRoutes from './routes/events.js';
import plansRoutes from './routes/plans.js';
import subscriptionsRoutes from './routes/subscriptions.js';
import usersRoutes from './routes/users.js';
import servicesRoutes from './routes/services.js';
import leadsRoutes from './routes/leads.js';
import propertyAdsRoutes from './routes/propertyAds.js';
import reportsRoutes from './routes/reports.js';
import categoriesRoutes from './routes/categories.js';
import whitelistRoutes from './routes/whitelist.js';

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || '';

app.use(helmet());
app.use(cors());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'aaplavasaivirar-backend' });
});

app.use('/auth', authRoutes);
app.use('/shops', shopsRoutes);
app.use('/volunteers', volunteersRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/admin', adminRoutes);
app.use('/sessions', sessionsRoutes);
app.use('/buildings', buildingsRoutes);
app.use('/events', eventsRoutes);
app.use('/plans', plansRoutes);
app.use('/subscriptions', subscriptionsRoutes);
app.use('/users', usersRoutes);
app.use('/services', servicesRoutes);
app.use('/leads', leadsRoutes);
app.use('/property-ads', propertyAdsRoutes);
app.use('/reports', reportsRoutes);
app.use('/categories', categoriesRoutes);
app.use('/whitelist', whitelistRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

async function logServiceStatusAndStart() {
  const lines = [];
  lines.push('=== VV Backend Startup ===');
  lines.push(`[ENV] node_env=${process.env.NODE_ENV || 'development'} port=${PORT}`);

  if (!DATABASE_URL) {
    lines.push('[DB] DATABASE_URL missing');
  } else {
    try {
      const u = new URL(DATABASE_URL);
      lines.push(`[DB] target host=${u.hostname} port=${u.port || '5432'} database=${u.pathname?.slice(1) || 'postgres'}`);
    } catch {
      lines.push('[DB] target from DATABASE_URL (unparsed)');
    }
  }

  try {
    const { rows } = await pool.query('SELECT current_database() AS db, version() AS version');
    await ensurePostGIS();
    const db = rows?.[0]?.db || 'unknown';
    const version = rows?.[0]?.version || '';
    const pgVersion = version.split(',')[0] || version;
    lines.push(`[DB] connected ok (db=${db})`);
    lines.push(`[Postgres] ${pgVersion}`);
    lines.push('[PostGIS] extension check ok');

    // Log all user tables visible in this DB so it's clear what DATABASE_URL points to.
    const { rows: tableRows } = await pool.query(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_type = 'BASE TABLE'
         AND table_schema NOT IN ('pg_catalog', 'information_schema')
       ORDER BY table_schema, table_name`
    );
    lines.push(`[DB] tables found: ${tableRows.length}`);
    if (tableRows.length === 0) {
      lines.push('[DB] no user tables found (run migrations?)');
    } else {
      for (const t of tableRows) {
        lines.push(`[DB] table: ${t.table_schema}.${t.table_name}`);
      }
    }
  } catch (err) {
    lines.push(`[DB] connection failed: ${err.message}`);
  }

  lines.push(`[ImageKit] ${imagekitConfigured() ? 'configured' : 'not configured (image uploads disabled)'}`);
  lines.push(`[SMS] provider=${smsProvider} sender_id=${smsSenderId} api_key=${smsApiKey ? 'set' : 'missing (OTP send will be skipped)'}`);
  lines.push('==========================');
  for (const line of lines) console.log(line);

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

// Vercel runs the app as a serverless function (see api/index.mjs); do not bind a port here.
const isVercel = Boolean(process.env.VERCEL);
if (process.env.NODE_ENV !== 'test' && !isVercel) {
  logServiceStatusAndStart().catch((err) => {
    console.error('[Startup] fatal:', err);
    process.exit(1);
  });
}

export default app;
