import pool from '../config/db.js';
import { wktPoint, findBuildingAtLocation } from '../services/geoService.js';

/** GET /buildings ?lat=&lng=&radius_m= */
export async function list(req, res) {
  try {
    const { lat, lng, radius_m } = req.query;
    if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
      const radius = radius_m ? parseInt(radius_m, 10) : 1000;
      const lngNum = parseFloat(lng);
      const latNum = parseFloat(lat);
      const { rows } = await pool.query(
        `SELECT id, name, address, city, state, pincode, country, category,
                ST_X(coordinates::geometry) as lng, ST_Y(coordinates::geometry) as lat
         FROM buildings
         WHERE ST_DWithin(coordinates::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
         ORDER BY ST_Distance(coordinates::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)
         LIMIT 200`,
        [lngNum, latNum, radius]
      );
      return res.json({ buildings: rows });
    }
    const { rows } = await pool.query(
      `SELECT id, name, address, city, state, pincode, country, category,
              ST_X(coordinates::geometry) as lng, ST_Y(coordinates::geometry) as lat
       FROM buildings ORDER BY name LIMIT 200`
    );
    return res.json({ buildings: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** GET /buildings/at ?lat=&lng=&radius_m= — nearest building at point (for map center / geo-fence). Returns one or 404. */
export async function at(req, res) {
  try {
    const { lat, lng, radius_m } = req.query;
    if (lat == null || lng == null || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
      return res.status(400).json({ error: 'lat and lng required' });
    }
    const radius = radius_m ? parseInt(radius_m, 10) : 30;
    const building = await findBuildingAtLocation(parseFloat(lat), parseFloat(lng), radius);
    if (!building) return res.status(404).json({ error: 'No building within radius' });
    return res.json(building);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** GET /buildings/:id */
export async function getById(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT id, name, address, city, state, pincode, country, category,
              ST_X(coordinates::geometry) as lng, ST_Y(coordinates::geometry) as lat,
              created_at, updated_at
       FROM buildings WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Building not found' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /buildings — create building (volunteer). Body: name, address, city, state, pincode?, country, category?, lat, lng. Reuses existing building if one exists within 10m. */
export async function create(req, res) {
  try {
    const { name, address, city, state, pincode, country, category, lat, lng } = req.body;
    if (!name?.trim() || !address?.trim() || !city?.trim() || !state?.trim() || !country?.trim()) {
      return res.status(400).json({ error: 'name, address, city, state, country required' });
    }
    if (lat == null || lng == null || Number.isNaN(parseFloat(lat)) || Number.isNaN(parseFloat(lng))) {
      return res.status(400).json({ error: 'lat and lng required' });
    }
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const existing = await findBuildingAtLocation(latNum, lngNum, 10);
    if (existing) {
      return res.status(200).json({ ...existing, existing_at_location: true });
    }
    const point = wktPoint(lngNum, latNum);
    const pincodeVal = pincode != null ? String(pincode).trim() : '';
    const categoryVal = category != null && String(category).trim() !== '' ? String(category).trim() : null;
    const { rows } = await pool.query(
      `INSERT INTO buildings (name, address, city, state, pincode, country, category, coordinates)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeomFromEWKT($8))
       RETURNING id, name, address, city, state, pincode, country, category,
                 ST_X(coordinates::geometry) as lng, ST_Y(coordinates::geometry) as lat`,
      [name.trim(), address.trim(), city.trim(), state.trim(), pincodeVal, country.trim(), categoryVal, point]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** PATCH /buildings/:id — update building (volunteer). Body: name?, address?, city?, state?, pincode?, country?, category?, lat?, lng? */
export async function update(req, res) {
  try {
    const { id } = req.params;
    const { name, address, city, state, pincode, country, category, lat, lng } = req.body;
    const updates = [];
    const values = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name.trim()); }
    if (address !== undefined) { updates.push(`address = $${i++}`); values.push(address.trim()); }
    if (city !== undefined) { updates.push(`city = $${i++}`); values.push(city.trim()); }
    if (state !== undefined) { updates.push(`state = $${i++}`); values.push(state.trim()); }
    if (pincode !== undefined) { updates.push(`pincode = $${i++}`); values.push(String(pincode).trim()); }
    if (country !== undefined) { updates.push(`country = $${i++}`); values.push(country.trim()); }
    if (category !== undefined) {
      updates.push(`category = $${i++}`);
      values.push(category != null && String(category).trim() !== '' ? String(category).trim() : null);
    }
    if (lat != null && lng != null && !Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lng))) {
      const point = wktPoint(parseFloat(lng), parseFloat(lat));
      updates.push(`coordinates = ST_GeomFromEWKT($${i++})`);
      values.push(point);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    updates.push(`updated_at = now()`);
    const { rows } = await pool.query(
      `UPDATE buildings SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, name, address, city, state, pincode, country, category,
                ST_X(coordinates::geometry) as lng, ST_Y(coordinates::geometry) as lat`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Building not found' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
