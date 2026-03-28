import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireVolunteer } from '../middleware/auth.js';
import { handleValidation, volunteerRegister, volunteerVerifyOtp, userRegister } from '../middleware/validate.js';
import { kycUploadMulter } from '../config/kycUpload.js';

const router = Router();

router.post('/volunteer/register', volunteerRegister, handleValidation, authController.volunteerRegister);
router.post('/volunteer/send-otp', (req, res, next) => {
  const { body } = req;
  if (!body?.phone || String(body.phone).replace(/\D/g, '').length < 10) {
    return res.status(400).json({ error: 'Valid phone required' });
  }
  next();
}, authController.volunteerSendOtp);
router.post('/volunteer/verify-otp', volunteerVerifyOtp, handleValidation, authController.volunteerVerifyOtp);
router.post('/volunteer/kyc', requireVolunteer, (req, res, next) => {
  kycUploadMulter(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'File upload failed' });
    next();
  });
}, authController.volunteerKyc);

router.post('/user/register', userRegister, handleValidation, authController.userRegister);
router.post('/user/verify-otp', volunteerVerifyOtp, handleValidation, authController.userVerifyOtp);

export default router;
