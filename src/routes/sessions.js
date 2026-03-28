import { Router } from 'express';
import * as sessionController from '../controllers/sessionController.js';
import { authMiddleware } from '../middleware/auth.js';
import { param } from 'express-validator';
import { validationResult } from 'express-validator';

const router = Router();

function requireAuth(req, res, next) {
  authMiddleware(req, res, () => {
    if (!req.actor) return res.status(401).json({ error: 'Unauthorized' });
    next();
  });
}

router.get('/me', requireAuth, sessionController.me);
router.delete('/:id', requireAuth, param('id').isUUID(), (req, res, next) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ errors: validationResult(req).array() });
  next();
}, sessionController.endOne);

export default router;
