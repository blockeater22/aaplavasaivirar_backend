/**
 * Vercel serverless entry for the full Express app. Rewrites send non-/api/* paths here;
 * Node may see req.url as /api/index — restore the client path from Vercel headers so
 * routes like /buildings match.
 */
import serverless from 'serverless-http';
import app from '../src/expressApp.js';

function restoreClientPath(req) {
  const internal = req.url || '/';

  try {
    const u = new URL(internal, 'http://localhost');
    if (u.searchParams.has('__vp')) {
      const vp = u.searchParams.get('__vp');
      u.searchParams.delete('__vp');
      const path = vp === '' || vp === null ? '/' : `/${String(vp).replace(/^\/+/, '')}`;
      const q = u.searchParams.toString();
      req.url = path + (q ? `?${q}` : '');
      return;
    }
  } catch {
    // fall through to headers
  }

  const pathOnly = internal.split('?')[0];
  const needsRestore =
    pathOnly === '/api/index' || pathOnly === '/api' || pathOnly === '/';
  if (!needsRestore) return;

  const h = req.headers;
  const raw =
    h['x-vercel-forwarded-path'] ||
    h['x-invoke-path'] ||
    h['x-matched-path'] ||
    h['x-forwarded-uri'];
  if (!raw || typeof raw !== 'string') return;

  let pathname;
  try {
    pathname = raw.startsWith('http') ? new URL(raw).pathname : raw.split('?')[0];
  } catch {
    return;
  }
  if (!pathname || pathname === pathOnly) return;

  const qs = internal.includes('?') ? internal.slice(internal.indexOf('?')) : '';
  req.url = pathname + qs;
}

const handler = serverless(app);

export default function vercelHandler(req, res) {
  restoreClientPath(req);
  return handler(req, res);
}
