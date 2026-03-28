import { listSessions, endSession } from '../services/sessionService.js';

/** GET /sessions/me */
export async function me(req, res) {
  try {
    const { type, id } = req.actor;
    const includeEnded = req.query.ended === '1';
    const sessions = await listSessions(type, id, includeEnded);
    return res.json({ sessions });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** DELETE /sessions/:id */
export async function endOne(req, res) {
  try {
    const { type, id } = req.actor;
    const sessionId = req.params.id;
    const ok = await endSession(sessionId, type, id);
    if (!ok) return res.status(404).json({ error: 'Session not found' });
    return res.json({ message: 'Session ended' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
