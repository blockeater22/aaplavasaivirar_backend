import { Router } from 'express';
import * as categoryController from '../controllers/categoryController.js';

const router = Router();
router.get('/', categoryController.list);
router.post('/', categoryController.create); // optional: add requireAdmin
export default router;
