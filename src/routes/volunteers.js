import { Router } from 'express';
import * as volunteerController from '../controllers/volunteerController.js';
import { requireVolunteer } from '../middleware/auth.js';

const router = Router();

router.get('/me', requireVolunteer, volunteerController.me);
router.post('/me/rewards/claim', requireVolunteer, volunteerController.claimReward);

export default router;
