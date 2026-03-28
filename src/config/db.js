/**
 * Postgres + PostGIS client using `postgres` package.
 *
 * Compatibility layer:
 * - pool.query(text, params)
 * - pool.connect() -> client.query()/release()
 * so existing controllers/services keep working without refactor.
 */
import postgres from 'postgres';

// For tests, isolate DB writes by pointing NODE_ENV=test to TEST_DATABASE_URL.
const effectiveConnectionString =
  process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

/**
 * Accepts DATABASE_URL that may contain unencoded special chars in password (e.g. ? @ / #).
 * Rebuilds a valid URL by URL-encoding only the password segment.
 */
function normalizeDatabaseUrl(input) {
  if (!input || typeof input !== 'string') return input;
  try {
    // Already valid URL
    // eslint-disable-next-line no-new
    new URL(input);
    return input;
  } catch {
    // Try to recover malformed credential part: scheme://user:pass@host...
    const m = input.match(/^([a-z]+:\/\/)([^:\/?#]+):([^@]+)@(.+)$/i);
    if (!m) return input;
    const [, scheme, user, password, rest] = m;
    const encodedPass = encodeURIComponent(password);
    return `${scheme}${user}:${encodedPass}@${rest}`;
  }
}

const connectionString = normalizeDatabaseUrl(effectiveConnectionString);

// `postgres` handles pool internally. Serverless (Vercel): keep pool small to avoid exhausting DB connections.
const poolMax = process.env.VERCEL ? 2 : 10;
const sql = postgres(connectionString, {
  max: poolMax,
  idle_timeout: 30,
  connect_timeout: 30,
});

const pool = {
  async query(text, params = []) {
    const result = await sql.unsafe(text, params);
    // `postgres` returns an array-like Result (no `{ rows }` like `pg`).
    // Convert to a pg-compatible shape so existing code keeps working.
    if (result && typeof result === 'object') {
      return {
        rows: result,
        rowCount: typeof result.count === 'number' ? result.count : undefined,
      };
    }
    return { rows: [], rowCount: 0 };
  },

  async connect() {
    const reserved = await sql.reserve();
    return {
      query(text, params = []) {
        return reserved.unsafe(text, params).then((result) => {
          if (result && typeof result === 'object') {
            return {
              rows: result,
              rowCount: typeof result.count === 'number' ? result.count : undefined,
            };
          }
          return { rows: [], rowCount: 0 };
        });
      },
      release() {
        return reserved.release();
      },
    };
  },
};

/** Ensure PostGIS is available (run after first connect). */
export async function ensurePostGIS() {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
  } finally {
    await client.release();
  }
}

export default pool;
