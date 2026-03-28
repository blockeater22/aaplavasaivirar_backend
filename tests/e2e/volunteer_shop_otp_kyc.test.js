/**
 * E2E: Volunteer flows
 * 1) Add shop -> request OTP -> verify OTP (shop becomes verified)
 * 2) Submit KYC (Aadhar front/back uploads) -> volunteer now has_kyc_submitted=true
 *
 * Notes:
 * - SMS is stubbed when SMS_API_KEY is not set (sendSms returns ok).
 * - Shop image uploads are optional and depend on ImageKit env; test only asserts core flow.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { signToken } from '../../src/middleware/auth.js';

import { getTestVolunteerToken } from './helpers.js';

import 'dotenv/config';

process.env.NODE_ENV = 'test';
const app = (await import('../../src/app.js')).default;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.join(__dirname, '.tmp');

let pool;

function ensureTestPng(filePath) {
  if (fs.existsSync(filePath)) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // 1x1 transparent PNG
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X9YkAAAAASUVORK5CYII=';
  fs.writeFileSync(filePath, Buffer.from(pngBase64, 'base64'));
}

describe('Volunteer shop OTP + KYC E2E', () => {
  let token;
  let volunteerId;
  let buildingId;
  let categoryId;

  const ownerPhone = '8888888888';

  let shopId = null;

  before(async () => {
    if (!pool) {
      pool = (await import('../../src/config/db.js')).default;
    }

    // Seeded volunteer + building.
    const t = await getTestVolunteerToken();
    token = t.token;
    volunteerId = t.volunteerId;
    buildingId = t.buildingId;

    // Pick an active category.
    const { rows } = await pool.query(
      `SELECT id FROM categories WHERE is_active = true ORDER BY display_order ASC LIMIT 1`
    );
    assert.ok(rows?.[0]?.id, 'Expected at least one active category in DB');
    categoryId = rows[0].id;

    // Reset KYC state for this volunteer so the test is idempotent.
    await pool.query(
      `UPDATE volunteers
       SET aadhar_number = NULL,
           aadhar_front_path = NULL,
           aadhar_back_path = NULL,
           kyc_status = 'pending',
           updated_at = now()
       WHERE id = $1`,
      [volunteerId]
    );
  });

  it('POST /shops add shop (no images) succeeds', async () => {
    const shopName = `E2E Shop ${Date.now()}`;
    const shopNumber = `S-${Date.now().toString().slice(-6)}`;

    const res = await request(app)
      .post('/shops')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: shopName,
        shop_number: shopNumber,
        category_id: categoryId,
        phone: ownerPhone,
        lat: 19.4,
        lng: 72.8,
        building_id: buildingId,
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body?.id, 'Expected shop id in response');
    shopId = res.body.id;
  });

  it('Shop verify flow: request OTP -> verify OTP -> shop is_verified=true', async () => {
    assert.ok(shopId, 'shopId should be set from previous test');

    // Request OTP to shop owner phone.
    const reqOtpRes = await request(app)
      .post(`/shops/${shopId}/request-otp`)
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(reqOtpRes.status, 200);

    // OTP is stored in otp_requests (plain otp_code) for shop verification.
    const { rows } = await pool.query(
      `SELECT otp_code
       FROM otp_requests
       WHERE shop_id = $1 AND volunteer_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [shopId, volunteerId]
    );
    assert.ok(rows?.[0]?.otp_code, 'Expected otp_code stored in otp_requests');
    const otp = rows[0].otp_code;

    const verifyRes = await request(app)
      .post(`/shops/${shopId}/verify-otp`)
      .set('Authorization', `Bearer ${token}`)
      .send({ otp });

    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.body?.message, 'Shop verified');

    // Confirm shop updated.
    const shopRes = await request(app).get(`/shops/${shopId}`);
    assert.strictEqual(shopRes.status, 200);
    assert.strictEqual(shopRes.body?.is_verified, true);

    // Confirm verification log created.
    const { rows: logs } = await pool.query(
      `SELECT success
       FROM verification_logs
       WHERE shop_id = $1 AND volunteer_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [shopId, volunteerId]
    );
    assert.ok(logs?.[0]?.success === true, 'Expected success=true verification log');
  });

  it('POST /auth/volunteer/kyc uploads Aadhar front/back and sets kyc_status=pending', async () => {
    const pngPath = path.join(tmpDir, 'test-aadhar-front.png');
    ensureTestPng(pngPath);

    const res = await request(app)
      .post('/auth/volunteer/kyc')
      .set('Authorization', `Bearer ${token}`)
      .field('aadhar_number', '123412341234')
      .attach('aadhar_front', pngPath)
      .attach('aadhar_back', pngPath);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body?.message, 'KYC submitted for review');

    // Confirm volunteer profile updated.
    const meRes = await request(app)
      .get('/volunteers/me')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body?.has_kyc_submitted, true);
    assert.strictEqual(meRes.body?.kyc_status, 'pending');
    assert.ok(meRes.body?.aadhar_number, 'Expected aadhar_number to be set');
  });

  it('Admin can fetch KYC docs and approve kyc_status', async () => {
    const adminToken = signToken(volunteerId, process.env.JWT_ADMIN_AUD || 'admin');

    const frontRes = await request(app)
      .get(`/admin/volunteers/${volunteerId}/kyc-docs/front`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(frontRes.status, 200);

    const backRes = await request(app)
      .get(`/admin/volunteers/${volunteerId}/kyc-docs/back`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(backRes.status, 200);

    const approveRes = await request(app)
      .patch(`/admin/volunteers/${volunteerId}/kyc`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ kyc_status: 'approved' });
    assert.strictEqual(approveRes.status, 200);

    const meRes = await request(app)
      .get('/volunteers/me')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body?.kyc_status, 'approved');
  });
});

