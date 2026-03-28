/**
 * E2E test helpers: create test volunteer and issue JWT for protected routes.
 * Uses real DB (DATABASE_URL); run migrations first (npm run migrate).
 */
import 'dotenv/config';
import pool from '../../src/config/db.js';
import { signToken } from '../../src/middleware/auth.js';
import bcrypt from 'bcryptjs';

const TEST_VOLUNTEER_PHONE = '9999999999';
const TEST_VOLUNTEER_EMAIL = 'e2e-volunteer@test.local';

/**
 * Ensure a test building and volunteer exist; return { token, volunteerId, buildingId }.
 * Safe to call multiple times (idempotent by phone).
 */
export async function getTestVolunteerToken() {
  const client = await pool.connect();
  try {
    let buildingId;
    const { rows: bRows } = await client.query(
      `SELECT id FROM buildings WHERE name = 'E2E Test Building' LIMIT 1`
    );
    if (bRows.length > 0) {
      buildingId = bRows[0].id;
    } else {
      const { rows: ins } = await client.query(
        `INSERT INTO buildings (name, address, city, state, pincode, country, coordinates)
         VALUES ('E2E Test Building', 'Test St', 'Vasai', 'Maharashtra', '401203', 'India', ST_GeomFromEWKT('SRID=4326;POINT(72.8 19.4)'))
         RETURNING id`
      );
      buildingId = ins[0].id;
    }

    let volunteerId;
    const { rows: vRows } = await client.query(
      `SELECT id FROM volunteers WHERE phone = $1`,
      [TEST_VOLUNTEER_PHONE]
    );
    if (vRows.length > 0) {
      volunteerId = vRows[0].id;
    } else {
      const hash = await bcrypt.hash('testpass123', 10);
      try {
        const { rows: ins } = await client.query(
          `INSERT INTO volunteers (name, phone, email, password, age, gender, address, building_id)
           VALUES ($1, $2, $3, $4, 25, 'other', 'Test Address', $5) RETURNING id`,
          ['E2E Volunteer', TEST_VOLUNTEER_PHONE, TEST_VOLUNTEER_EMAIL, hash, buildingId]
        );
        volunteerId = ins[0].id;
      } catch (err) {
        if (err.code === '23505') {
          const { rows: again } = await client.query(
            `SELECT id FROM volunteers WHERE phone = $1`,
            [TEST_VOLUNTEER_PHONE]
          );
          if (again.length > 0) volunteerId = again[0].id;
          else throw err;
        } else throw err;
      }
    }

    const token = signToken(volunteerId, process.env.JWT_VOLUNTEER_AUD || 'volunteer');
    return { token, volunteerId, buildingId };
  } finally {
    client.release();
  }
}
