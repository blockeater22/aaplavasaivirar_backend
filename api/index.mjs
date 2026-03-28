/**
 * Vercel serverless entry: all routes are rewritten here (see vercel.json).
 */
import serverless from 'serverless-http';
import app from '../src/app.js';

const handler = serverless(app, {
  binary: ['image/*', 'application/octet-stream'],
});

export default handler;
