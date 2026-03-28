import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { signToken, VOLUNTEER_AUD, USER_AUD } from '../middleware/auth.js';
import { createAndSendLoginOtp, verifyLoginOtp } from '../services/otpService.js';
import { createSession } from '../services/sessionService.js';
import { wktPoint } from '../services/geoService.js';
import fs from 'fs';
import { getVolunteerKycDir } from '../config/kycUpload.js';

const SALT_ROUNDS = 10;

const REFERRAL_MIN_VERIFIED = 100; // only volunteers with >= 100 verified shops can refer others

/** POST /auth/volunteer/register */
export async function volunteerRegister(req, res) {
  try {
    const { name, phone, email, password, age, gender, address, building_id, building, referred_by_volunteer_id } = req.body;
    const phoneNorm = String(phone).replace(/\D/g, '').slice(-10);

    let referrerId = referred_by_volunteer_id || null;
    if (referrerId) {
      const { rows: ref } = await pool.query(
        `SELECT id, total_verified FROM volunteers WHERE id = $1`,
        [referrerId]
      );
      if (ref.length === 0) return res.status(400).json({ error: 'Invalid referrer' });
      if (ref[0].total_verified < REFERRAL_MIN_VERIFIED) {
        return res.status(403).json({
          error: `Referrer must have at least ${REFERRAL_MIN_VERIFIED} verified shops to refer new volunteers`,
          required: REFERRAL_MIN_VERIFIED,
          referrer_verified: ref[0].total_verified,
        });
      }
    }

    let bid = building_id;
    if (building && !bid) {
      const { name: bName, address: bAddress, city, state, pincode, country, lat, lng } = building;
      if (!bName || !bAddress || !city || !state || !pincode || !country || lat == null || lng == null) {
        return res.status(400).json({ error: 'building must include name, address, city, state, pincode, country, lat, lng' });
      }
      const point = wktPoint(lng, lat);
      const { rows: bRows } = await pool.query(
        `INSERT INTO buildings (name, address, city, state, pincode, country, coordinates) VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromEWKT($7)) RETURNING id`,
        [bName, bAddress, city, state, pincode, country, point]
      );
      bid = bRows[0].id;
    }
    if (!bid) return res.status(400).json({ error: 'building_id or building required' });

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    try {
      await pool.query(
        `INSERT INTO volunteers (name, phone, email, password, age, gender, address, building_id, referred_by_volunteer_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [name, phoneNorm, email, hash, age, gender, address, bid, referrerId]
      );
    } catch (insertErr) {
      if (insertErr.code === '42703') {
        await pool.query(
          `INSERT INTO volunteers (name, phone, email, password, age, gender, address, building_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [name, phoneNorm, email, hash, age, gender, address, bid]
        );
      } else throw insertErr;
    }
    await createAndSendLoginOtp(phoneNorm, 'volunteer_login');
    return res.status(201).json({ message: 'OTP sent to phone' });
  } catch (err) {
    console.error('[volunteer/register]', err.code || err.name, err.message);
    if (err.code === '23505') return res.status(409).json({ error: 'Phone or email already registered' });
    if (err.code === '42P01') return res.status(500).json({ error: 'Database setup incomplete. Run: npm run migrate' });
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
}

/** POST /auth/volunteer/send-otp — send login OTP to existing volunteer (for login flow). */
export async function volunteerSendOtp(req, res) {
  try {
    const phone = req.body.phone;
    const phoneNorm = String(phone || '').replace(/\D/g, '').slice(-10);
    if (phoneNorm.length < 10) return res.status(400).json({ error: 'Valid phone required' });
    const { rows } = await pool.query(`SELECT id FROM volunteers WHERE phone = $1`, [phoneNorm]);
    if (rows.length === 0) return res.status(404).json({ error: 'Phone not registered. Please register first.' });
    await createAndSendLoginOtp(phoneNorm, 'volunteer_login');
    return res.json({ message: 'OTP sent to phone' });
  } catch (err) {
    if (err.message?.includes('Too many')) return res.status(429).json({ error: err.message });
    return res.status(500).json({ error: err.message || 'Send OTP failed' });
  }
}

/** POST /auth/volunteer/verify-otp */
export async function volunteerVerifyOtp(req, res) {
  try {
    const { phone, otp } = req.body;
    const phoneNorm = String(phone).replace(/\D/g, '').slice(-10);
    const valid = await verifyLoginOtp(phoneNorm, otp, 'volunteer_login');
    if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const { rows } = await pool.query(
      `SELECT id, name, phone, email, building_id, total_verified, kyc_status FROM volunteers WHERE phone = $1`,
      [phoneNorm]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Volunteer not found' });
    const volunteer = rows[0];

    const token = signToken(volunteer.id, VOLUNTEER_AUD);
    const session = await createSession('volunteer', volunteer.id, {
      device_info: req.body.device_info,
      user_agent: req.get('user-agent'),
      ip_address: req.ip,
      location: req.body.lat != null && req.body.lng != null ? { lat: req.body.lat, lng: req.body.lng } : null,
    });

    return res.json({
      token,
      volunteer: {
        id: volunteer.id,
        name: volunteer.name,
        phone: volunteer.phone,
        building_id: volunteer.building_id,
        total_verified: volunteer.total_verified,
        kyc_status: volunteer.kyc_status,
      },
      session_id: session?.id,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Verify failed' });
  }
}

/** POST /auth/volunteer/kyc — multipart: aadhar_number, aadhar_front (file), aadhar_back (file), social_links (JSON string).
 *  Files saved under assets/kyc-docs/aadhar/<volunteer_id>/. Only admin can view/delete.
 */
export async function volunteerKyc(req, res) {
  try {
    const volunteerId = req.actor.id;
    const aadharNumber = req.body.aadhar_number != null ? String(req.body.aadhar_number).trim() : '';
    if (!aadharNumber) return res.status(400).json({ error: 'aadhar_number required' });

    const frontFiles = req.files?.aadhar_front;
    const backFiles = req.files?.aadhar_back;
    if (!frontFiles?.length || !backFiles?.length) {
      return res.status(400).json({ error: 'aadhar_front and aadhar_back images are required' });
    }
    // multer.fields({ maxCount: 1 }) should guarantee exactly one file each,
    // but we still defensively take the first one in case clients send more than expected.
    const frontFile = frontFiles[0];
    const backFile = backFiles[0];

    const frontPath = `${volunteerId}/${frontFile.filename}`;
    const backPath = `${volunteerId}/${backFile.filename}`;

    let socialLinks = null;
    if (req.body.social_links) {
      try {
        const parsed = typeof req.body.social_links === 'string' ? JSON.parse(req.body.social_links) : req.body.social_links;
        if (parsed && typeof parsed === 'object') socialLinks = JSON.stringify(parsed);
      } catch (_) { /* ignore invalid JSON */ }
    }

    await pool.query(
      `UPDATE volunteers SET aadhar_number = $2, aadhar_front_path = $3, aadhar_back_path = $4, social_links = COALESCE($5::jsonb, social_links), kyc_status = 'pending', updated_at = now() WHERE id = $1`,
      [volunteerId, aadharNumber, frontPath, backPath, socialLinks]
    );

    // Cleanup: volunteers can re-submit KYC multiple times, creating multiple files on disk.
    // Admin UI reads only the single front/back paths stored in DB, so keep only the latest files.
    const dir = getVolunteerKycDir(volunteerId);
    try {
      if (fs.existsSync(dir)) {
        const keep = new Set([frontFile.filename, backFile.filename]);
        for (const f of fs.readdirSync(dir)) {
          if (!keep.has(f)) {
            const fp = `${dir}/${f}`;
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
          }
        }
      }
    } catch (cleanupErr) {
      console.warn('[KYC cleanup]', cleanupErr.message);
    }

    return res.json({ message: 'KYC submitted for review' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /auth/user/register */
export async function userRegister(req, res) {
  try {
    const { name, phone, email, password, address, building_id } = req.body;
    const phoneNorm = String(phone).replace(/\D/g, '').slice(-10);
    const passHash = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;
    await pool.query(
      `INSERT INTO users (name, phone, email, password, address, building_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [name, phoneNorm, email || null, passHash, address, building_id]
    );
    await createAndSendLoginOtp(phoneNorm, 'user_login');
    return res.status(201).json({ message: 'OTP sent to phone' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone already registered' });
    return res.status(500).json({ error: err.message });
  }
}

/** POST /auth/user/verify-otp */
export async function userVerifyOtp(req, res) {
  try {
    const { phone, otp } = req.body;
    const phoneNorm = String(phone).replace(/\D/g, '').slice(-10);
    const valid = await verifyLoginOtp(phoneNorm, otp, 'user_login');
    if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const { rows } = await pool.query(`SELECT id, name, phone, email FROM users WHERE phone = $1`, [phoneNorm]);
    if (rows.length === 0) return res.status(401).json({ error: 'User not found' });
    const user = rows[0];

    const token = signToken(user.id, USER_AUD);
    const session = await createSession('user', user.id, {
      device_info: req.body.device_info,
      user_agent: req.get('user-agent'),
      ip_address: req.ip,
      location: req.body.lat != null && req.body.lng != null ? { lat: req.body.lat, lng: req.body.lng } : null,
    });

    return res.json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email },
      session_id: session?.id,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
