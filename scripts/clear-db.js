/**
 * Clear all application data (keeps schema). Use for local dev reset.
 * Usage: node scripts/clear-db.js
 * Requires: DATABASE_URL in .env
 */
import 'dotenv/config';
import pg from 'pg';

const url = process.env.DATABASE_URL;
let poolConfig = { connectionString: url };
if (url) {
  try {
    const u = new URL(url);
    poolConfig = {
      host: u.hostname,
      port: u.port || 5432,
      database: u.pathname?.slice(1) || 'vvmc',
      user: u.username || undefined,
      password: u.password != null ? String(u.password) : '',
    };
  } catch (_) {
    poolConfig = { connectionString: url, password: '' };
  }
}
const pool = new pg.Pool(poolConfig);

const TABLES = [
  'login_otps',
  'verification_logs',
  'volunteer_reports',
  'reward_claims',
  'otp_requests',
  'reports',
  'user_favorites',
  'user_search_history',
  'notifications',
  'leads',
  'service_catalog',
  'property_ads',
  'events',
  'subscriptions',
  'sessions',
  'shop_images',
  'shops',
  'volunteers',
  'users',
  'buildings',
  'categories',
  'plans',
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of TABLES) {
      try {
        await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        console.log(`  Cleared ${table}`);
      } catch (e) {
        if (e.code === '42P01') console.log(`  Skip ${table} (table does not exist)`);
        else throw e;
      }
    }
    await client.query('COMMIT');
    console.log('DB cleared.');

    // Re-seed plans and categories (same client, no transaction)
    await client.query(`
      INSERT INTO plans (name, code, price_rupees, billing_interval, description, features) VALUES
        ('Service Pro', 'service_pro', 49, 'monthly', 'List services; monthly + lead charges', '["service_listing","lead_charges"]'),
        ('Business Pro', 'business_pro', 199, 'monthly', 'Shop owner upgrade', '["claimed_shop_upgrade","priority_listing"]'),
        ('Builder', 'builder', 999, 'monthly', 'Property ads + pay-per-lead', '["property_ads","pay_per_lead"]')
      ON CONFLICT (code) DO NOTHING
    `);
    await client.query(`
      INSERT INTO categories (name, slug, display_order) VALUES
        ('Medical', 'medical', 1), ('Salon', 'salon', 2), ('Fruits', 'fruits', 3), ('Vegetables', 'vegetables', 4),
        ('General Store', 'general-store', 5), ('Kirana', 'kirana', 6), ('Bakery', 'bakery', 7), ('Restaurant', 'restaurant', 8),
        ('Pharmacy', 'pharmacy', 9), ('Hardware', 'hardware', 10), ('Electronics', 'electronics', 11), ('Tailor', 'tailor', 12),
        ('Plumber', 'plumber', 13), ('Electrician', 'electrician', 14), ('Other', 'other', 99)
      ON CONFLICT (slug) DO NOTHING
    `);
    console.log('Re-seeded plans and categories.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
