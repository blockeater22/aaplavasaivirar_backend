#!/usr/bin/env node
/**
 * Load test the API: start app on a random port, run autocannon against
 * key endpoints, print latency and throughput.
 *
 * Prerequisites: npm run migrate, DATABASE_URL set (for protected route).
 * Run: npm run load-test
 */
process.env.NODE_ENV = 'test';

import 'dotenv/config';
import http from 'http';
import autocannon from 'autocannon';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CONNECTIONS = parseInt(process.env.LOAD_CONNECTIONS || '10', 10);
const DURATION_SEC = parseInt(process.env.LOAD_DURATION || '5', 10);
const PIPELINING = parseInt(process.env.LOAD_PIPELINING || '1', 10);

function runAutocannon(opts) {
  return new Promise((resolve, reject) => {
    const instance = autocannon(
      { ...opts, connections: opts.connections ?? CONNECTIONS, duration: opts.duration ?? DURATION_SEC, pipelining: opts.pipelining ?? PIPELINING },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    if (typeof autocannon.track === 'function') {
      try {
        autocannon.track(instance, { renderProgressBar: true });
      } catch (_) {}
    }
  });
}

function printResult(label, result) {
  const rps = result.requests.average ?? 0;
  const lat = result.latency;
  const p50 = lat?.p50 ?? 0;
  const p99 = lat?.p99 ?? 0;
  const errors = result.errors || 0;
  const timeouts = result.timeouts || 0;
  const non2xx = result.non2xx || 0;
  console.log(`  ${label}`);
  console.log(`    Requests/sec: ${rps.toFixed(1)}  |  Latency p50: ${Number(p50).toFixed(2)}ms  p99: ${Number(p99).toFixed(2)}ms`);
  if (errors + timeouts + non2xx > 0) {
    console.log(`    Errors: ${errors}  Timeouts: ${timeouts}  Non-2xx: ${non2xx}`);
  }
  console.log('');
}

async function main() {
  const app = (await import(join(__dirname, '..', 'src', 'expressApp.js'))).default;
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  console.log('\n--- Load test (connections=%d, duration=%ds) ---\n', CONNECTIONS, DURATION_SEC);

  try {
    const health = await runAutocannon({ url: `${base}/health` });
    printResult('GET /health', health);

    const nearby = await runAutocannon({
      url: `${base}/shops/nearby?lat=19.4&lng=72.8&radius_m=500`,
    });
    printResult('GET /shops/nearby', nearby);

    const buildings = await runAutocannon({ url: `${base}/buildings` });
    printResult('GET /buildings', buildings);

    const categories = await runAutocannon({ url: `${base}/categories` });
    printResult('GET /categories', categories);

    const leaderboard = await runAutocannon({ url: `${base}/leaderboard` });
    printResult('GET /leaderboard', leaderboard);

    let token;
    try {
      const { getTestVolunteerToken } = await import(join(__dirname, '..', 'tests', 'e2e', 'helpers.js'));
      token = (await getTestVolunteerToken()).token;
    } catch (_) {
      console.log('  GET /volunteers/me  (skipped: no DB/token)\n');
    }

    if (token) {
      const me = await runAutocannon({
        url: `${base}/volunteers/me`,
        headers: { Authorization: `Bearer ${token}` },
      });
      printResult('GET /volunteers/me (auth)', me);
    }
  } finally {
    server.close();
  }

  console.log('--- Done ---\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
