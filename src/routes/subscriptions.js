import { Router } from 'express';
import * as subscriptionController from '../controllers/subscriptionController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();
router.get('/', requireUser, subscriptionController.list);
router.post('/', requireUser, subscriptionController.create);
export default router;
