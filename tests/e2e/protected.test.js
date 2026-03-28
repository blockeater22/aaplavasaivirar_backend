/**
 * E2E: Protected APIs (volunteer token required). Uses seeded test volunteer.
 * Requires DB migrated and DATABASE_URL set.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { getTestVolunteerToken } from './helpers.js';

process.env.NODE_ENV = 'test';
const app = (await import('../../src/expressApp.js')).default;

describe('Protected APIs (volunteer)', () => {
  let token;
  let buildingId;

  before(async () => {
    const t = await getTestVolunteerToken();
    token = t.token;
    buildingId = t.buildingId;
  });

  describe('GET /volunteers/me', () => {
    it('returns 200 with volunteer profile when token valid', async () => {
      const res = await request(app)
        .get('/volunteers/me')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body?.id);
      assert.ok(res.body?.name);
      assert.ok(res.body?.phone);
    });
  });

  describe('GET /buildings (list)', () => {
    it('returns 200 without token (public)', async () => {
      const res = await request(app).get('/buildings');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body?.buildings));
    });
  });

  describe('POST /buildings', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).post('/buildings').send({
        name: 'New Building',
        address: 'Addr',
        city: 'Vasai',
        state: 'Maharashtra',
        country: 'India',
        lat: 19.41,
        lng: 72.81,
      });
      assert.strictEqual(res.status, 401);
    });

    it('returns 201 or 200 when valid body and token (create or reuse)', async () => {
      const res = await request(app)
        .post('/buildings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'E2E New Building ' + Date.now(),
          address: 'Test Address',
          city: 'Vasai',
          state: 'Maharashtra',
          country: 'India',
          lat: 19.412,
          lng: 72.82,
        });
      assert.ok(res.status === 200 || res.status === 201);
      assert.ok(res.body?.id);
      assert.ok(res.body?.name);
    });

    it('returns 400 when required fields missing', async () => {
      const res = await request(app)
        .post('/buildings')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Only Name', lat: 19.4, lng: 72.8 });
      assert.strictEqual(res.status, 400);
    });
  });

  describe('PATCH /buildings/:id', () => {
    it('returns 200 when updating with valid token', async () => {
      const res = await request(app)
        .patch(`/buildings/${buildingId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'E2E Test Building Updated' });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body?.name);
    });
  });

  describe('GET /shops/:id', () => {
    it('returns 404 for non-existent shop UUID', async () => {
      const res = await request(app).get(
        '/shops/00000000-0000-0000-0000-000000000000'
      );
      assert.strictEqual(res.status, 404);
    });
  });

  describe('POST /shops (add shop)', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).post('/shops').send({
        name: 'Shop',
        shop_number: '1',
        category: 'Kirana',
        phone: '9876543210',
        lat: 19.4,
        lng: 72.8,
        building_id: buildingId,
      });
      assert.strictEqual(res.status, 401);
    });

    it('returns 400 when required fields missing', async () => {
      const res = await request(app)
        .post('/shops')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Shop', lat: 19.4, lng: 72.8 });
      assert.strictEqual(res.status, 400);
    });
  });
});
