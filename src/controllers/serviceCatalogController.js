import pool from '../config/db.js';

/** GET /services ?shop_id=&user_id=&category= */
export async function list(req, res) {
  try {
    const { shop_id, user_id, category } = req.query;
    let q = `SELECT sc.id, sc.shop_id, sc.user_id, sc.category, sc.skill, sc.description, sc.created_at`;
    const params = [];
    const cond = [];
    if (shop_id) { params.push(shop_id); cond.push(`sc.shop_id = $${params.length}`); }
    if (user_id) { params.push(user_id); cond.push(`sc.user_id = $${params.length}`); }
    if (category) { params.push(category); cond.push(`sc.category = $${params.length}`); }
    if (cond.length) q += ` FROM service_catalog sc WHERE ` + cond.join(' AND ');
    else q += ` FROM service_catalog sc`;
    q += ` ORDER BY sc.created_at DESC LIMIT 100`;
    const { rows } = await pool.query(q, params);
    return res.json({ services: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /services */
export async function create(req, res) {
  try {
    const { shop_id, user_id, category, skill, description } = req.body;
    const actorId = req.actor.id;
    const uid = user_id || actorId;
    if (!category) return res.status(400).json({ error: 'category required' });
    if (!shop_id && !uid) return res.status(400).json({ error: 'shop_id or user_id required' });
    const { rows } = await pool.query(
      `INSERT INTO service_catalog (shop_id, user_id, category, skill, description) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, shop_id, user_id, category, skill, description, created_at`,
      [shop_id || null, uid, category, skill || null, description || null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
