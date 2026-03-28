import { Router } from 'express';
import * as eventController from '../controllers/eventController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();
router.get('/', eventController.list);
router.post('/', requireUser, eventController.create);
export default router;
