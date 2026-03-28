import { Router } from 'express';
import * as planController from '../controllers/planController.js';

const router = Router();
router.get('/', planController.list);
export default router;
