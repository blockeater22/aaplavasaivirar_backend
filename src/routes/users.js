import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { requireUser } from '../middleware/auth.js';
import { param } from 'express-validator';
import { validationResult } from 'express-validator';

const router = Router();
const validate = (req, res, next) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ errors: validationResult(req).array() });
  next();
};

router.get('/me', requireUser, userController.me);
router.patch('/me', requireUser, userController.updateMe);
router.get('/me/favorites', requireUser, userController.getFavorites);
router.post('/me/favorites', requireUser, userController.addFavorite);
router.delete('/me/favorites/:shopId', requireUser, param('shopId').isUUID(), validate, userController.removeFavorite);
router.get('/me/search-history', requireUser, userController.getSearchHistory);
router.get('/me/notifications', requireUser, userController.getNotifications);
router.patch('/me/notifications/:id/read', requireUser, param('id').isUUID(), validate, userController.markNotificationRead);

export default router;
