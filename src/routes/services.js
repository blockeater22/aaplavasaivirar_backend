import { Router } from 'express';
import * as serviceCatalogController from '../controllers/serviceCatalogController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();
router.get('/', serviceCatalogController.list);
router.post('/', requireUser, serviceCatalogController.create);
export default router;
