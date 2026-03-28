import pool from '../config/db.js';

/** GET /plans */
export async function list(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, code, price_rupees, billing_interval, features, description FROM plans WHERE is_active = true ORDER BY price_rupees`
    );
    return res.json({ plans: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
