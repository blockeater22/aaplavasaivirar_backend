import pool from '../config/db.js';

/** GET /property-ads ?user_id= */
export async function list(req, res) {
  try {
    const userId = req.query.user_id || (req.actor && req.actor.id);
    let q = `SELECT id, user_id, title, description, address, image_url, paid_at, created_at,
                    ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat
             FROM property_ads WHERE 1=1`;
    const params = [];
    if (userId) { params.push(userId); q += ` AND user_id = $1`; }
    q += ` ORDER BY created_at DESC LIMIT 100`;
    const { rows } = await pool.query(q, params);
    return res.json({ property_ads: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /property-ads */
export async function create(req, res) {
  try {
    const userId = req.actor.id;
    const { title, description, address, lat, lng, image_url } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const point = (lat != null && lng != null) ? `SRID=4326;POINT(${lng} ${lat})` : null;
    const { rows } = await pool.query(
      `INSERT INTO property_ads (user_id, title, description, address, location, image_url) VALUES ($1, $2, $3, $4, $5::geometry, $6)
       RETURNING id, title, description, address, created_at`,
      [userId, title, description || null, address || null, point, image_url || null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
