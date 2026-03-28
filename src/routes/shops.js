import { Router } from 'express';
import * as shopController from '../controllers/shopController.js';
import { requireVolunteer } from '../middleware/auth.js';
import { shopImagesUpload } from '../middleware/uploadShopImages.js';
import { handleValidation, shopsNearby, shopAdd, shopVerifyOtp, uuidParam } from '../middleware/validate.js';

const router = Router();

router.get('/nearby', shopsNearby, handleValidation, shopController.getNearby);
router.get('/search', shopController.search);
router.get('/:id', uuidParam, handleValidation, shopController.getById);

router.post('/', requireVolunteer, shopImagesUpload, shopAdd, handleValidation, shopController.addShop);
router.patch('/:id', requireVolunteer, uuidParam, handleValidation, shopController.updateShop);
router.post('/:id/request-otp', requireVolunteer, uuidParam, handleValidation, shopController.requestOtp);
router.post('/:id/verify-otp', requireVolunteer, uuidParam, shopVerifyOtp, handleValidation, shopController.verifyOtp);
router.post('/:id/claim', uuidParam, handleValidation, shopController.claimShop);

export default router;
