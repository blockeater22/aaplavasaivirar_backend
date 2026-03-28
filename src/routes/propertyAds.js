import { Router } from 'express';
import * as propertyAdController from '../controllers/propertyAdController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();
router.get('/', propertyAdController.list);
router.post('/', requireUser, propertyAdController.create);
export default router;
