/**
 * E2E: Security — protected routes reject missing/invalid/wrong-audience tokens.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { signToken } from '../../src/middleware/auth.js';

process.env.NODE_ENV = 'test';
const app = (await import('../../src/app.js')).default;

describe('Security', () => {
  describe('Protected routes require valid volunteer token', () => {
    it('returns 401 when Authorization header missing', async () => {
      const res = await request(app).get('/volunteers/me');
      assert.strictEqual(res.status, 401);
      assert.ok(res.body?.error?.toLowerCase().includes('authorization') || res.body?.error?.toLowerCase().includes('token'));
    });

    it('returns 401 when Bearer token is invalid', async () => {
      const res = await request(app)
        .get('/volunteers/me')
        .set('Authorization', 'Bearer invalid-token');
      assert.strictEqual(res.status, 401);
    });

    it('returns 401 when token is malformed (no Bearer prefix)', async () => {
      const res = await request(app)
        .get('/volunteers/me')
        .set('Authorization', 'some-token');
      assert.strictEqual(res.status, 401);
    });

    it('returns 403 when token has wrong audience (user instead of volunteer)', async () => {
      const token = signToken('00000000-0000-0000-0000-000000000001', process.env.JWT_USER_AUD || 'user');
      const res = await request(app)
        .get('/volunteers/me')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(res.status, 403);
      assert.ok(res.body?.error?.toLowerCase().includes('volunteer'));
    });
  });

  describe('Admin routes require admin token', () => {
    it('GET /admin/heatmap returns 401 without token', async () => {
      const res = await request(app).get('/admin/heatmap');
      assert.strictEqual(res.status, 401);
    });

    it('GET /admin/heatmap returns 403 with volunteer token', async () => {
      const { getTestVolunteerToken } = await import('./helpers.js');
      const { token } = await getTestVolunteerToken();
      const res = await request(app)
        .get('/admin/heatmap')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(res.status, 403);
    });
  });
});
