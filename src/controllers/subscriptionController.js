import pool from '../config/db.js';

/** GET /subscriptions — list for current user (user auth) */
export async function list(req, res) {
  try {
    const userId = req.actor.id;
    const { rows } = await pool.query(
      `SELECT s.id, s.plan_id, s.plan, s.starts_at, s.ends_at, p.name as plan_name, p.code as plan_code
       FROM subscriptions s
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 ORDER BY s.starts_at DESC`,
      [userId]
    );
    return res.json({ subscriptions: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /subscriptions — create (plan_id or plan rupees) */
export async function create(req, res) {
  try {
    const userId = req.actor.id;
    const { plan_id, plan } = req.body;
    let planRupees = plan;
    if (plan_id) {
      const { rows } = await pool.query(`SELECT price_rupees FROM plans WHERE id = $1 AND is_active = true`, [plan_id]);
      if (rows.length === 0) return res.status(400).json({ error: 'Invalid plan_id' });
      planRupees = rows[0].price_rupees;
    }
    if (!planRupees || ![49, 199, 999].includes(Number(planRupees))) {
      return res.status(400).json({ error: 'plan_id or plan (49|199|999) required' });
    }
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + 1);
    const { rows } = await pool.query(
      `INSERT INTO subscriptions (user_id, plan_id, plan, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, plan_id, plan, starts_at, ends_at`,
      [userId, plan_id || null, planRupees, startsAt, endsAt]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
