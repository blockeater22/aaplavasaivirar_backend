import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const VOLUNTEER_AUD = process.env.JWT_VOLUNTEER_AUD || 'volunteer';
const USER_AUD = process.env.JWT_USER_AUD || 'user';
const ADMIN_AUD = process.env.JWT_ADMIN_AUD || 'admin';

/**
 * Verify JWT and set req.actor = { type, id }.
 * Token payload: { sub: uuid, aud: 'volunteer'|'user'|'admin' }
 */
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.actor = { type: payload.aud, id: payload.sub };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Require volunteer. */
export function requireVolunteer(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.actor?.type !== VOLUNTEER_AUD) {
      return res.status(403).json({ error: 'Volunteer only' });
    }
    next();
  });
}

/** Require user (resident). */
export function requireUser(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.actor?.type !== USER_AUD) {
      return res.status(403).json({ error: 'User only' });
    }
    next();
  });
}

/** Require admin (aud = admin). */
export function requireAdmin(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.actor?.type !== ADMIN_AUD) {
      return res.status(403).json({ error: 'Admin only' });
    }
    next();
  });
}

/** Optional auth: set req.actor if token present, else leave unset. */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.actor = { type: payload.aud, id: payload.sub };
  } catch (_) {}
  next();
}

/** Issue JWT for volunteer/user/admin. */
export function signToken(sub, aud, options = {}) {
  return jwt.sign(
    { sub, aud },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: options.expiresIn || '7d' }
  );
}

export { JWT_SECRET, VOLUNTEER_AUD, USER_AUD, ADMIN_AUD };
