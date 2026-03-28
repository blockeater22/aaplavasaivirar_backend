import pool from '../config/db.js';

/**
 * Create session on login.
 */
export async function createSession(actorType, actorId, opts = {}) {
  const {
    device_info = null,
    user_agent = null,
    ip_address = null,
    location = null, // { lat, lng } or null
  } = opts;
  let locationWkt = null;
  if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
    locationWkt = `SRID=4326;POINT(${location.lng} ${location.lat})`;
  }
  const { rows } = await pool.query(
    `INSERT INTO sessions (actor_type, actor_id, device_info, user_agent, ip_address, location)
     VALUES ($1, $2, $3, $4, $5, $6::geometry)
     RETURNING id, started_at, last_activity_at`,
    [
      actorType,
      actorId,
      device_info ? JSON.stringify(device_info) : null,
      user_agent || null,
      ip_address || null,
      locationWkt,
    ]
  );
  return rows[0];
}

/**
 * List active (and optionally ended) sessions for actor.
 */
export async function listSessions(actorType, actorId, includeEnded = false) {
  let q = `SELECT id, device_info, user_agent, started_at, ended_at, last_activity_at,
                  ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat
           FROM sessions
           WHERE actor_type = $1 AND actor_id = $2`;
  if (!includeEnded) q += ` AND ended_at IS NULL`;
  q += ` ORDER BY last_activity_at DESC`;
  const { rows } = await pool.query(q, [actorType, actorId]);
  return rows;
}

/**
 * End session (logout this device).
 */
export async function endSession(sessionId, actorType, actorId) {
  const { rowCount } = await pool.query(
    `UPDATE sessions SET ended_at = now(), updated_at = now() WHERE id = $1 AND actor_type = $2 AND actor_id = $3`,
    [sessionId, actorType, actorId]
  );
  return rowCount > 0;
}

/**
 * Touch last_activity_at for current request (optional).
 */
export async function touchSession(sessionId) {
  await pool.query(
    `UPDATE sessions SET last_activity_at = now(), updated_at = now() WHERE id = $1`,
    [sessionId]
  );
}
