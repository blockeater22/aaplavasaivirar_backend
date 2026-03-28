/**
 * E2E: Public APIs — no auth required. Validate response shape and status.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';

process.env.NODE_ENV = 'test';
const app = (await import('../../src/expressApp.js')).default;

describe('Public APIs', () => {
  describe('GET /shops/nearby', () => {
    it('returns 400 when lat/lng missing', async () => {
      const res = await request(app).get('/shops/nearby');
      assert.strictEqual(res.status, 400);
    });

    it('returns 200 with shops array when lat/lng valid', async () => {
      const res = await request(app)
        .get('/shops/nearby')
        .query({ lat: 19.4, lng: 72.8, radius_m: 500 });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body?.shops));
    });
  });

  describe('GET /shops/search', () => {
    it('returns 200 with results or empty', async () => {
      const res = await request(app).get('/shops/search').query({ q: 'test' });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body?.shops ?? res.body?.results ?? []));
    });
  });

  describe('GET /buildings', () => {
    it('returns 200 with buildings array', async () => {
      const res = await request(app).get('/buildings');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body?.buildings));
    });

    it('returns 200 when querying by lat/lng', async () => {
      const res = await request(app)
        .get('/buildings')
        .query({ lat: 19.4, lng: 72.8, radius_m: 500 });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body?.buildings));
    });
  });

  describe('GET /buildings/at', () => {
    it('returns 400 when lat/lng missing', async () => {
      const res = await request(app).get('/buildings/at');
      assert.strictEqual(res.status, 400);
    });

    it('returns 200 or 404 when lat/lng valid', async () => {
      const res = await request(app)
        .get('/buildings/at')
        .query({ lat: 19.4, lng: 72.8, radius_m: 100 });
      assert.ok(res.status === 200 || res.status === 404);
      if (res.status === 200) assert.ok(res.body?.id);
    });
  });

  describe('GET /buildings/:id', () => {
    it('returns 400 for invalid UUID', async () => {
      const res = await request(app).get('/buildings/not-a-uuid');
      assert.strictEqual(res.status, 400);
    });

    it('returns 404 for non-existent UUID', async () => {
      const res = await request(app).get(
        '/buildings/00000000-0000-0000-0000-000000000000'
      );
      assert.strictEqual(res.status, 404);
    });
  });

  describe('GET /categories', () => {
    it('returns 200 with categories array', async () => {
      const res = await request(app).get('/categories');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body?.categories ?? res.body));
    });
  });

  describe('GET /leaderboard', () => {
    it('returns 200', async () => {
      const res = await request(app).get('/leaderboard');
      assert.strictEqual(res.status, 200);
    });
  });
});
