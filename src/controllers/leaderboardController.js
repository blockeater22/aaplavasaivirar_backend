import pool from '../config/db.js';

/** GET /leaderboard ?limit=100&area= (area = optional filter by building address/city) */
export async function getLeaderboard(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const area = req.query.area ? String(req.query.area).trim() : null;
    let query = `SELECT v.id, v.name, v.phone, v.total_verified, v.trust_score, v.kyc_status, v.reward_eligible,
                        b.id as building_id, b.name as building_name, b.address as building_address
                 FROM volunteers v
                 JOIN buildings b ON b.id = v.building_id
                 WHERE v.reward_eligible = true`;
    const params = [];
    if (area) {
      params.push(`%${area}%`);
      query += ` AND (b.address ILIKE $1 OR b.city ILIKE $1 OR b.name ILIKE $1)`;
    }
    query += ` ORDER BY v.total_verified DESC LIMIT ${params.length ? '$' + (params.length + 1) : '$1'}`;
    if (params.length) params.push(limit);
    else params.push(limit);
    const { rows } = await pool.query(query, params);
    return res.json({ leaderboard: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
