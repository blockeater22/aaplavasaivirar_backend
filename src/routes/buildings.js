import { Router } from 'express';
import * as buildingController from '../controllers/buildingController.js';
import { requireVolunteer } from '../middleware/auth.js';
import { handleValidation, uuidParam } from '../middleware/validate.js';

const router = Router();
router.get('/', buildingController.list);
router.get('/at', buildingController.at); // must be before /:id
router.get('/:id', uuidParam, handleValidation, buildingController.getById);
router.post('/', requireVolunteer, buildingController.create);
router.patch('/:id', requireVolunteer, uuidParam, handleValidation, buildingController.update);
export default router;
