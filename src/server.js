/**
 * Local / non-serverless entry — binds HTTP port (Vercel uses api/index.mjs instead).
 */
import 'dotenv/config';
import app from './expressApp.js';
import pool, { ensurePostGIS } from './config/db.js';
import { isConfigured as imagekitConfigured } from './services/imagekitService.js';
import { provider as smsProvider, apiKey as smsApiKey, senderId as smsSenderId } from './config/sms.js';

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || '';

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

if (process.env.NODE_ENV !== 'test') {
  logServiceStatusAndStart().catch((err) => {
    console.error('[Startup] fatal:', err);
    process.exit(1);
  });
}
