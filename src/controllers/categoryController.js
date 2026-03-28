import pool from '../config/db.js';

/** GET /categories — list active categories for dropdowns / add-shop */
export async function list(req, res) {
  try {
    const { include_inactive } = req.query;
    let q = `SELECT id, name, slug, description, display_order FROM categories`;
    if (include_inactive !== '1') q += ` WHERE is_active = true`;
    q += ` ORDER BY display_order, name`;
    const { rows } = await pool.query(q);
    return res.json({ categories: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /categories — add new category (admin only; optional later) */
export async function create(req, res) {
  try {
    const { name, slug, description, display_order } = req.body;
    const nameStr = name != null ? String(name).trim() : '';
    if (!nameStr) return res.status(400).json({ error: 'name required (non-empty string)' });
    const s = (slug || nameStr).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const rawOrder = display_order != null ? display_order : 0;
    const order = Number.isFinite(Number(rawOrder)) ? parseInt(Number(rawOrder), 10) : 0;
    const { rows } = await pool.query(
      `INSERT INTO categories (name, slug, description, display_order) VALUES ($1, $2, $3, $4)
       RETURNING id, name, slug, description, display_order`,
      [nameStr, s || 'other', description || null, order]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category with this name or slug exists' });
    return res.status(500).json({ error: err.message });
  }
}
