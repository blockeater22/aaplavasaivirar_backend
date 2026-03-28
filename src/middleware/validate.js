import { body, param, query, validationResult } from 'express-validator';

export function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// --- Volunteer auth
export const volunteerRegister = [
  body('name').trim().notEmpty().withMessage('name required'),
  body('phone').trim().notEmpty().isLength({ min: 10 }).withMessage('valid phone required'),
  body('email').trim().isEmail().withMessage('valid email required'),
  body('password').isLength({ min: 6 }).withMessage('password min 6 chars'),
  body('age').isInt({ min: 1, max: 120 }).withMessage('age 1-120'),
  body('gender').trim().notEmpty().withMessage('gender required'),
  body('address').trim().notEmpty().withMessage('address required'),
  body('building_id').optional().isUUID().withMessage('building_id must be UUID'),
  body('building').optional().isObject().withMessage('building must be object if creating new'),
  body('referred_by_volunteer_id').optional().isUUID().withMessage('referred_by_volunteer_id must be UUID'),
];

export const volunteerVerifyOtp = [
  body('phone').trim().notEmpty().withMessage('phone required'),
  body('otp').trim().notEmpty().isLength({ min: 4, max: 6 }).withMessage('otp 4-6 digits'),
];

export const kycUpload = [
  body('aadhar_ref').optional().trim(),
  body('kyc_doc_url').optional().trim().isURL().withMessage('kyc_doc_url must be URL'),
  body('social_links').optional().isObject().withMessage('social_links must be object'),
];

// --- Shops
export const shopsNearby = [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('lat required'),
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('lng required'),
  query('radius_m').optional().isInt({ min: 1, max: 5000 }).toInt(),
];

export const shopAdd = [
  body('building_id').optional().isUUID(),
  body('building')
    .optional()
    .custom((value, { req }) => {
      if (value == null || value === '') return true;
      if (typeof value === 'object' && value !== null) return true;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (parsed && typeof parsed === 'object') {
            req.body.building = parsed;
            return true;
          }
        } catch (_) {}
      }
      throw new Error('building must be an object or a valid JSON string');
    }),
  body('location_type')
    .optional()
    .isIn(['building', 'road'])
    .withMessage('location_type must be building or road'),
  body('name').trim().notEmpty().withMessage('name required'),
  body('shop_number').trim().notEmpty().withMessage('shop_number required'),
  body('category_id').optional().isUUID().withMessage('category_id must be a valid UUID'),
  body('category').optional().isString().withMessage('category must be a string').trim().notEmpty().withMessage('category cannot be empty'),
  body('phone').trim().notEmpty().isLength({ min: 10 }).withMessage('valid phone required'),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('valid lat required'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('valid lng required'),
  body('road_name').optional().trim(),
  body('shopfront_name').optional().trim(),
  body('landmark').optional().trim(),
  body('full_address').optional().trim(),
  body().custom((_, { req }) => {
    const cid = req.body.category_id;
    const cat = req.body.category;
    const hasId = cid != null && String(cid).trim().length > 0;
    const hasCat = cat !== undefined && cat !== null && typeof cat === 'string' && String(cat).trim().length > 0;
    if (hasId || hasCat) return true;
    throw new Error('category_id or category required (at least one, non-empty)');
  }),
];

export const shopVerifyOtp = [body('otp').trim().notEmpty().isLength({ min: 4, max: 6 })];

// --- User auth
export const userRegister = [
  body('name').trim().notEmpty(),
  body('phone').trim().notEmpty().isLength({ min: 10 }),
  body('email').optional().trim().isEmail(),
  body('password').optional().isLength({ min: 6 }),
  body('address').trim().notEmpty(),
  body('building_id').isUUID().withMessage('building_id required'),
];

const WHITELIST_CATEGORIES = [
  'shop_owner',
  'property_owner',
  'home_buyer',
  'renter',
  'builder',
  'agent',
  'investor',
  'resident_user',
  'volunteer_interest',
  'other',
];

/** Public marketing waitlist (website) */
export const whitelistSignup = [
  body('full_name').trim().notEmpty().isLength({ min: 2, max: 200 }).withMessage('full name required'),
  body('mobile')
    .trim()
    .notEmpty()
    .customSanitizer((v) => {
      const d = String(v).replace(/\D/g, '');
      if (d.length >= 12 && d.startsWith('91')) return d.slice(-10);
      return d.length >= 10 ? d.slice(-10) : d;
    })
    .isLength({ min: 10, max: 10 })
    .matches(/^[6-9]\d{9}$/)
    .withMessage('valid 10-digit Indian mobile required'),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('valid email if provided'),
  body('full_address').trim().notEmpty().isLength({ min: 8, max: 2000 }).withMessage('full address required'),
  body('building_name').trim().notEmpty().isLength({ min: 2, max: 300 }).withMessage('building name required'),
  body('sub_region').trim().notEmpty().isLength({ min: 2, max: 200 }).withMessage('sub-region required'),
  body('area_locality').trim().notEmpty().isLength({ max: 200 }).withMessage('area / locality required'),
  body('pincode')
    .trim()
    .notEmpty()
    .customSanitizer((v) => String(v).replace(/\D/g, '').slice(0, 6))
    .isLength({ min: 6, max: 6 })
    .withMessage('6-digit pincode required'),
  body('category')
    .trim()
    .notEmpty()
    .isIn(WHITELIST_CATEGORIES)
    .withMessage('invalid category'),
  body('category_other')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 300 })
    .withMessage('category description too long'),
  body().custom((_, { req }) => {
    if (req.body.category === 'other') {
      const o = req.body.category_other;
      if (o == null || String(o).trim().length < 2) {
        throw new Error('Please describe your category when you select Other');
      }
    }
    return true;
  }),
  body('organization_name').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('interest_notes').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
  body('how_heard').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('consent_terms')
    .custom((v) => v === true || v === 'true' || v === 1 || v === '1')
    .withMessage('you must accept the terms to continue'),
];

// --- Common
export const uuidParam = [param('id').isUUID().withMessage('invalid id')];
