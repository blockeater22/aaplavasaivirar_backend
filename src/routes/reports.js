import { Router } from 'express';
import pool from '../config/db.js';
import { requireUser } from '../middleware/auth.js';
import { body } from 'express-validator';
import { validationResult } from 'express-validator';

const router = Router();

router.post('/',
  requireUser,
  body('shop_id').isUUID(),
  body('reason').optional().trim(),
  (req, res, next) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ errors: validationResult(req).array() });
    next();
  },
  async (req, res) => {
    try {
      const userId = req.actor.id;
      const { shop_id, reason } = req.body;
      await pool.query(
        `INSERT INTO reports (shop_id, user_id, reason) VALUES ($1, $2, $3)`,
        [shop_id, userId, reason || null]
      );
      return res.status(201).json({ message: 'Report submitted' });
    } catch (err) {
      if (err.code === '23503') return res.status(404).json({ error: 'Shop not found' });
      return res.status(500).json({ error: err.message });
    }
  }
);

export default router;
