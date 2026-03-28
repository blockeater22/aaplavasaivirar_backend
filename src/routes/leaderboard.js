import { Router } from 'express';
import * as leaderboardController from '../controllers/leaderboardController.js';

const router = Router();
router.get('/', leaderboardController.getLeaderboard);
export default router;
