import pool from '../config/db.js';

/** GET /events ?type=&from=&to=&lat=&lng=&radius_m= */
export async function list(req, res) {
  try {
    const { type, from, to, lat, lng, radius_m } = req.query;
    let query = `SELECT e.id, e.title, e.type, e.description, e.image_url, e.event_date, e.event_time, e.event_duration, e.event_duration_unit,
                        e.is_public, e.is_verified, e.is_featured, e.address, e.landmark,
                        ST_X(e.location::geometry) as lng, ST_Y(e.location::geometry) as lat,
                        e.created_by, e.created_at
                 FROM events e WHERE 1=1`;
    const params = [];
    let n = 0;
    if (type) {
      n++; params.push(type);
      query += ` AND e.type = $${n}`;
    }
    if (from) {
      n++; params.push(from);
      query += ` AND e.event_date >= $${n}`;
    }
    if (to) {
      n++; params.push(to);
      query += ` AND e.event_date <= $${n}`;
    }
    if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
      const radius = radius_m ? parseInt(radius_m, 10) : 5000;
      n++; params.push(parseFloat(lng));
      n++; params.push(parseFloat(lat));
      n++; params.push(radius);
      query += ` AND ST_DWithin(e.location::geography, ST_SetSRID(ST_MakePoint($${n - 2}, $${n - 1}), 4326)::geography, $${n})`;
    }
    query += ` ORDER BY e.event_date, e.event_time LIMIT 100`;
    const { rows } = await pool.query(query, params);
    return res.json({ events: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /events */
export async function create(req, res) {
  try {
    const userId = req.actor.id;
    const {
      title, type, description, image_url, video_url, document_url, link, tags,
      is_public, location, address, landmark, event_date, event_time, event_duration, event_duration_unit,
    } = req.body;
    const lat = location?.lat ?? req.body.lat;
    const lng = location?.lng ?? req.body.lng;
    if (lat == null || lng == null) return res.status(400).json({ error: 'location (lat, lng) required' });
    const point = `SRID=4326;POINT(${lng} ${lat})`;
    const { rows } = await pool.query(
      `INSERT INTO events (title, type, description, image_url, video_url, document_url, link, tags, is_public, created_by, location, address, landmark, event_date, event_time, event_duration, event_duration_unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ST_GeomFromEWKT($11), $12, $13, $14, $15, $16, $17)
       RETURNING id, title, type, event_date, event_time, created_at`,
      [
        title, type, description || '', image_url || null, video_url || null, document_url || null, link || null,
        tags || [], is_public ?? false, userId, point, address || '', landmark || '',
        event_date, event_time, event_duration || 60, event_duration_unit || 'minutes',
      ]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
