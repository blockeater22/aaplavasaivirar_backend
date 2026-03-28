/**
 * E2E: Health and basic connectivity.
 * Run: npm run test:e2e (or NODE_ENV=test node --test tests/e2e/health.test.js)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';

process.env.NODE_ENV = 'test';
const app = (await import('../../src/app.js')).default;

describe('Health', () => {
  it('GET /health returns 200 and status ok', async () => {
    const res = await request(app).get('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body?.status, 'ok');
    assert.ok(res.body?.service);
  });

  it('GET /nonexistent returns 404', async () => {
    const res = await request(app).get('/nonexistent');
    assert.strictEqual(res.status, 404);
  });
});
