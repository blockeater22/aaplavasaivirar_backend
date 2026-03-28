import { Router } from 'express';
import * as leadController from '../controllers/leadController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();
router.post('/', requireUser, leadController.create);
router.get('/', requireUser, leadController.list);
export default router;
