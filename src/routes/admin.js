import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/auth.js';
import { param, body, validationResult } from 'express-validator';

const router = Router();
router.use(requireAdmin);

router.get('/heatmap', adminController.heatmap);
router.get('/volunteers', adminController.listVolunteers);
router.get('/volunteers/:id/kyc-docs/:doc', adminController.getKycDoc);
router.delete('/volunteers/:id/kyc-docs/:doc', adminController.deleteKycDoc);
router.patch('/volunteers/:id/kyc',
  param('id').isUUID(),
  body('kyc_status').isIn(['pending', 'approved', 'rejected']),
  (req, res, next) => {
    const err = validationResult(req);
    if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
    next();
  },
  adminController.updateKyc
);

export default router;
