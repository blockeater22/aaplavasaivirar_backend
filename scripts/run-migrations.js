/**
 * Run SQL migrations in order (001, 002, ...).
 * Usage: node scripts/run-migrations.js
 * Requires: DATABASE_URL in .env
 */
import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'migrations');

const url = process.env.DATABASE_URL;
let poolConfig = { connectionString: url, max: 10 };
if (url) {
  try {
    const u = new URL(url);
    const pwd = u.password != null ? String(u.password) : '';
    poolConfig = {
      host: u.hostname,
      port: u.port || 5432,
      database: u.pathname?.slice(1) || 'vvmc',
      user: u.username || undefined,
      password: pwd,
      max: 10,
    };
  } catch (_) {
    poolConfig = { connectionString: url, max: 10, password: '' };
  }
}
const pool = new pg.Pool(poolConfig);

async function run() {
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const filepath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filepath, 'utf8');
    console.log(`Running ${file}...`);
    try {
      await pool.query(sql);
      console.log(`  OK`);
    } catch (err) {
      if (err.code === '58P01' && file.startsWith('001')) {
        console.error('\n  PostGIS is not installed. Install it with:');
        console.error('    brew install postgis');
        console.error('  Then run: npm run migrate\n');
        process.exit(1);
      }
      throw err;
    }
  }
  await pool.end();
  console.log('Migrations complete.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
