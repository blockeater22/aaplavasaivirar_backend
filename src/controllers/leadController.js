import pool from '../config/db.js';

/** POST /leads — record lead (resident contacted pro/builder) */
export async function create(req, res) {
  try {
    const fromUserId = req.actor.id;
    const { to_entity_type, to_entity_id, listing_type } = req.body;
    if (!['service_pro', 'builder'].includes(to_entity_type)) {
      return res.status(400).json({ error: 'to_entity_type must be service_pro or builder' });
    }
    if (!to_entity_id) return res.status(400).json({ error: 'to_entity_id required' });
    const { rows } = await pool.query(
      `INSERT INTO leads (from_user_id, to_entity_type, to_entity_id, listing_type) VALUES ($1, $2, $3, $4)
       RETURNING id, to_entity_type, to_entity_id, created_at`,
      [fromUserId, to_entity_type, to_entity_id, listing_type || null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** GET /leads — list leads for current pro/builder (by to_entity) */
export async function list(req, res) {
  try {
    const userId = req.actor.id;
    const { to_entity_type } = req.query;
    let q = `SELECT id, from_user_id, to_entity_type, to_entity_id, listing_type, created_at FROM leads WHERE (to_entity_type = 'service_pro' AND to_entity_id = $1) OR (to_entity_type = 'builder' AND to_entity_id = $1)`;
    const params = [userId];
    if (to_entity_type) { params.push(to_entity_type); q += ` AND to_entity_type = $2`; }
    q += ` ORDER BY created_at DESC LIMIT 100`;
    const { rows } = await pool.query(q, params);
    return res.json({ leads: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
