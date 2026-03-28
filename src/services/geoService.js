import pool from '../config/db.js';

/**
 * Find shops within radiusM metres of (lat, lng). Uses PostGIS geography so distance is in metres.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusM default 5 (metres)
 * @returns {Promise<Array<{ id, building_id, name, shop_number, category, phone, is_verified, ... }>>}
 */
export async function shopsNearby(lat, lng, radiusM = 5) {
  const point = `SRID=4326;POINT(${lng} ${lat})`;
  const { rows } = await pool.query(
    `SELECT s.id, s.building_id, s.location_type, s.road_name, s.shopfront_name, s.landmark, s.full_address,
            s.name, s.shop_number, s.category, s.phone, s.is_verified, s.verified_at, s.owner_claimed_at, s.created_at,
            ST_X(s.coordinates::geometry) as lng, ST_Y(s.coordinates::geometry) as lat,
            b.name AS building_name
     FROM shops s
     LEFT JOIN buildings b ON b.id = s.building_id
     WHERE ST_DWithin(s.coordinates::geography, ST_GeomFromEWKT($1)::geography, $2)
     ORDER BY ST_Distance(s.coordinates::geography, ST_GeomFromEWKT($1)::geography)`,
    [point, radiusM]
  );
  return rows;
}

/**
 * Check if any shop exists within radiusM metres (default 5m). For duplicate prevention.
 * Uses geography so the distance parameter is in metres, not degrees.
 * @param {object} [opts] - optional: { excludeShopId, name, category_id, category }. If name/category provided, only matches shops with same name and category (so one building can have multiple shops).
 */
export async function hasShopInRadius(lat, lng, radiusM = 5, excludeShopId = null, opts = {}) {
  const point = `SRID=4326;POINT(${lng} ${lat})`;
  const { name, category_id, category } = opts;
  let q = `SELECT 1 FROM shops WHERE ST_DWithin(coordinates::geography, ST_GeomFromEWKT($1)::geography, $2)`;
  const params = [point, radiusM];
  let idx = 3;
  if (excludeShopId) {
    q += ` AND id != $${idx++}`;
    params.push(excludeShopId);
  }
  if (name != null && String(name).trim() !== '') {
    q += ` AND LOWER(TRIM(name)) = LOWER(TRIM($${idx++}))`;
    params.push(String(name).trim());
  }
  if (category_id != null && category_id !== '') {
    q += ` AND category_id = $${idx++}`;
    params.push(category_id);
  }
  if (category != null && String(category).trim() !== '' && category_id == null) {
    q += ` AND LOWER(TRIM(category)) = LOWER(TRIM($${idx++}))`;
    params.push(String(category).trim());
  }
  q += ` LIMIT 1`;
  const { rows } = await pool.query(q, params);
  return rows.length > 0;
}

/**
 * Find a shop within radiusM that matches location + name + category (duplicate for add-shop). Returns the first match or null.
 */
export async function findDuplicateInRadius(lat, lng, radiusM = 5, opts = {}) {
  const point = `SRID=4326;POINT(${lng} ${lat})`;
  const { name, category_id, category } = opts;
  let q = `SELECT id FROM shops WHERE ST_DWithin(coordinates::geography, ST_GeomFromEWKT($1)::geography, $2)`;
  const params = [point, radiusM];
  let idx = 3;
  if (name != null && String(name).trim() !== '') {
    q += ` AND LOWER(TRIM(name)) = LOWER(TRIM($${idx++}))`;
    params.push(String(name).trim());
  }
  if (category_id != null && category_id !== '') {
    q += ` AND category_id = $${idx++}`;
    params.push(category_id);
  }
  if (category != null && String(category).trim() !== '' && category_id == null) {
    q += ` AND LOWER(TRIM(category)) = LOWER(TRIM($${idx++}))`;
    params.push(String(category).trim());
  }
  q += ` ORDER BY ST_Distance(coordinates::geography, ST_GeomFromEWKT($1)::geography) LIMIT 1`;
  const { rows } = await pool.query(q, params);
  return rows[0] || null;
}

/**
 * Find a building at (lat, lng) within radiusM metres. Returns the nearest one or null.
 * Use before creating a new building to avoid duplicates.
 */
export async function findBuildingAtLocation(lat, lng, radiusM = 10) {
  const point = `SRID=4326;POINT(${lng} ${lat})`;
  const { rows } = await pool.query(
    `SELECT id, name, address, city, state, pincode, country,
            ST_X(coordinates::geometry) as lng, ST_Y(coordinates::geometry) as lat
     FROM buildings
     WHERE ST_DWithin(coordinates::geography, ST_GeomFromEWKT($1)::geography, $2)
     ORDER BY ST_Distance(coordinates::geography, ST_GeomFromEWKT($1)::geography)
     LIMIT 1`,
    [point, radiusM]
  );
  return rows[0] || null;
}

/**
 * Build WKT point for insert/update (EPSG:4326 / WGS84).
 * 6 decimal places ≈ 0.11 m precision; PostGIS geometry stores double precision.
 */
export function wktPoint(lng, lat) {
  const x = Number(lng).toFixed(6);
  const y = Number(lat).toFixed(6);
  return `SRID=4326;POINT(${x} ${y})`;
}
