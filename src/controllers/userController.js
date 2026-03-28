import pool from '../config/db.js';

/** GET /users/me */
export async function me(req, res) {
  try {
    const id = req.actor.id;
    const { rows } = await pool.query(
      `SELECT id, name, phone, email, address, building_id, home_location,
              ST_X(home_location::geometry) as home_lng, ST_Y(home_location::geometry) as home_lat
       FROM users WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** PATCH /users/me */
export async function updateMe(req, res) {
  try {
    const id = req.actor.id;
    const { name, email, home_lat, home_lng, address } = req.body;
    const updates = [];
    const values = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (email !== undefined) { updates.push(`email = $${i++}`); values.push(email); }
    if (address !== undefined) { updates.push(`address = $${i++}`); values.push(address); }
    if (home_lat != null && home_lng != null) {
      updates.push(`home_location = ST_SetSRID(ST_MakePoint($${i}, $${i + 1}), 4326)`);
      values.push(parseFloat(home_lng), parseFloat(home_lat));
      i += 2;
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = now() WHERE id = $${i}`, values);
    return res.json({ message: 'Updated' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** GET /users/me/favorites */
export async function getFavorites(req, res) {
  try {
    const userId = req.actor.id;
    const { rows } = await pool.query(
      `SELECT f.id, f.shop_id, f.created_at, s.name, s.category, s.phone, s.is_verified
       FROM user_favorites f JOIN shops s ON s.id = f.shop_id WHERE f.user_id = $1 ORDER BY f.created_at DESC`,
      [userId]
    );
    return res.json({ favorites: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /users/me/favorites */
export async function addFavorite(req, res) {
  try {
    const userId = req.actor.id;
    const { shop_id } = req.body;
    if (!shop_id) return res.status(400).json({ error: 'shop_id required' });
    await pool.query(`INSERT INTO user_favorites (user_id, shop_id) VALUES ($1, $2) ON CONFLICT (user_id, shop_id) DO NOTHING`, [userId, shop_id]);
    return res.status(201).json({ message: 'Added', shop_id });
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'Shop not found' });
    return res.status(500).json({ error: err.message });
  }
}

/** DELETE /users/me/favorites/:shopId */
export async function removeFavorite(req, res) {
  try {
    const userId = req.actor.id;
    const shopId = req.params.shopId;
    await pool.query(`DELETE FROM user_favorites WHERE user_id = $1 AND shop_id = $2`, [userId, shopId]);
    return res.json({ message: 'Removed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** GET /users/me/search-history */
export async function getSearchHistory(req, res) {
  try {
    const userId = req.actor.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const { rows } = await pool.query(
      `SELECT id, query_text, ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat, created_at
       FROM user_search_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return res.json({ history: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** GET /users/me/notifications */
export async function getNotifications(req, res) {
  try {
    const userId = req.actor.id;
    const { type, unread_only } = req.query;
    let q = `SELECT id, title, body, type, read_at, created_at FROM notifications WHERE user_id = $1`;
    const params = [userId];
    if (type) { params.push(type); q += ` AND type = $2`; }
    if (unread_only === '1') q += ` AND read_at IS NULL`;
    q += ` ORDER BY created_at DESC LIMIT 50`;
    const { rows } = await pool.query(q, params);
    return res.json({ notifications: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** PATCH /users/me/notifications/:id/read */
export async function markNotificationRead(req, res) {
  try {
    const userId = req.actor.id;
    const id = req.params.id;
    await pool.query(`UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2`, [id, userId]);
    return res.json({ message: 'Marked read' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
