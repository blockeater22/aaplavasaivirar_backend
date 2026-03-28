/**
 * Lightweight health check for Vercel — does not import Express or the full app.
 * Avoids cold-start timeout (504) from loading Sharp, routes, DB pool, etc.
 */
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = 200;
  res.end(JSON.stringify({ status: 'ok', service: 'aaplavasaivirar-backend' }));
}
