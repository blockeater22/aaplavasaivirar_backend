import crypto from 'crypto';
import pool from '../config/db.js';
import { sendSms } from '../config/sms.js';

const TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || '10', 10);
const MAX_PER_PHONE_PER_HOUR = parseInt(process.env.OTP_MAX_PER_PHONE_PER_HOUR || '5', 10);

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp + (process.env.JWT_SECRET || 'salt')).digest('hex');
}

function generateOtp(length = 4) {
  const digits = '0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += digits[Math.floor(Math.random() * 10)];
  return out;
}

/**
 * Create and send login OTP (volunteer or user). Stores hash in login_otps.
 */
export async function createAndSendLoginOtp(phone, purpose) {
  if (!['volunteer_login', 'user_login'].includes(purpose)) {
    throw new Error('Invalid purpose');
  }
  const phoneNorm = String(phone).replace(/\D/g, '').slice(-10);
  if (phoneNorm.length < 10) throw new Error('Invalid phone');

  const { rows: rate } = await pool.query(
    `SELECT COUNT(*)::int as c FROM login_otps WHERE phone = $1 AND created_at > now() - interval '1 hour'`,
    [phoneNorm]
  );
  if (rate[0].c >= MAX_PER_PHONE_PER_HOUR) {
    throw new Error('Too many OTP requests. Try later.');
  }

  await pool.query(`DELETE FROM login_otps WHERE phone = $1 AND purpose = $2`, [phoneNorm, purpose]);

  const otp = generateOtp(6);
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  await pool.query(
    `INSERT INTO login_otps (phone, otp_hash, purpose, expires_at) VALUES ($1, $2, $3, $4)`,
    [phoneNorm, otpHash, purpose, expiresAt]
  );

  console.log(`[OTP] ${purpose} for ${phoneNorm}: ${otp} (valid ${TTL_MINUTES} min)`);

  const msg = `Your VVMC verification code is ${otp}. Valid for ${TTL_MINUTES} minutes.`;
  const result = await sendSms(phoneNorm, msg);
  if (!result.ok) throw new Error(result.error || 'SMS failed');
  return { ok: true };
}

/**
 * Verify login OTP and delete it (single use).
 */
export async function verifyLoginOtp(phone, otp, purpose) {
  const phoneNorm = String(phone).replace(/\D/g, '').slice(-10);
  const otpHash = hashOtp(String(otp).trim());
  const { rows } = await pool.query(
    `SELECT id FROM login_otps WHERE phone = $1 AND purpose = $2 AND otp_hash = $3 AND expires_at > now()`,
    [phoneNorm, purpose, otpHash]
  );
  if (rows.length === 0) return null;
  await pool.query(`DELETE FROM login_otps WHERE phone = $1 AND purpose = $2`, [phoneNorm, purpose]);
  return rows[0].id;
}

/**
 * Shop verification OTP: create and send to shop owner phone. Store in otp_requests.
 */
export async function createAndSendShopOtp(shopId, phone, volunteerId) {
  const phoneNorm = String(phone).replace(/\D/g, '').slice(-10);
  if (phoneNorm.length < 10) throw new Error('Invalid phone');

  const otp = generateOtp(4);
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  await pool.query(
    `INSERT INTO otp_requests (shop_id, volunteer_id, phone, otp_code, otp_expires_at) VALUES ($1, $2, $3, $4, $5)`,
    [shopId, volunteerId, phoneNorm, otp, expiresAt]
  );

  const msg = `Your VVMC shop verification code is ${otp}. Valid ${TTL_MINUTES} min. Do not share.`;
  const result = await sendSms(phoneNorm, msg);
  if (!result.ok) throw new Error(result.error || 'SMS failed');
  return { ok: true };
}

/**
 * Verify shop OTP. Returns true if valid; marks otp_used_at and creates verification_log.
 */
export async function verifyShopOtp(shopId, otp, volunteerId) {
  const otpTrim = String(otp).trim();
  const { rows } = await pool.query(
    `SELECT id FROM otp_requests WHERE shop_id = $1 AND volunteer_id = $2 AND otp_code = $3 AND otp_expires_at > now() AND otp_used_at IS NULL`,
    [shopId, volunteerId, otpTrim]
  );
  if (rows.length === 0) return false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE otp_requests SET otp_used_at = now() WHERE id = $1`, [rows[0].id]);
    await client.query(
      `INSERT INTO verification_logs (shop_id, volunteer_id, success) VALUES ($1, $2, true)`,
      [shopId, volunteerId]
    );
    await client.query(`UPDATE shops SET is_verified = true, verified_at = now() WHERE id = $1`, [shopId]);
    await client.query(`UPDATE volunteers SET total_verified = total_verified + 1 WHERE id = $1`, [volunteerId]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return true;
}
