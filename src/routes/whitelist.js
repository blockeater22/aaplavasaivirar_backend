import { Router } from 'express';
import { body } from 'express-validator';
import { handleValidation, whitelistSignup } from '../middleware/validate.js';
import * as whitelistController from '../controllers/whitelistController.js';

const router = Router();

router.post('/', ...whitelistSignup, handleValidation, whitelistController.create);

export default router;
