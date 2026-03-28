/**
 * E2E: Auth endpoints — validation and behaviour (no real SMS).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';

process.env.NODE_ENV = 'test';
const app = (await import('../../src/app.js')).default;

describe('Auth', () => {
  describe('POST /auth/volunteer/send-otp', () => {
    it('returns 400 when phone missing or invalid', async () => {
      let res = await request(app).post('/auth/volunteer/send-otp').send({});
      assert.strictEqual(res.status, 400);

      res = await request(app).post('/auth/volunteer/send-otp').send({ phone: '12' });
      assert.strictEqual(res.status, 400);
    });

    it('returns 404 for unregistered phone', async () => {
      const res = await request(app)
        .post('/auth/volunteer/send-otp')
        .send({ phone: '8888888888' });
      assert.strictEqual(res.status, 404);
    });
  });

  describe('POST /auth/volunteer/verify-otp', () => {
    it('returns 400 when body invalid (validation)', async () => {
      const res = await request(app)
        .post('/auth/volunteer/verify-otp')
        .send({ phone: '1234567890', otp: '1' });
      assert.strictEqual(res.status, 400);
    });
  });

  describe('POST /auth/volunteer/register', () => {
    it('returns 400 when required fields missing', async () => {
      const res = await request(app).post('/auth/volunteer/register').send({
        name: 'Test',
        phone: '9876543210',
      });
      assert.strictEqual(res.status, 400);
    });
  });
});
