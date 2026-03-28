/**
 * KYC upload: volunteer Aadhar images saved under assets/kyc-docs/aadhar/<volunteer_id>/
 * Only admin can view/delete. Requires requireVolunteer to run first (req.actor.id).
 */
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(path.dirname(__dirname), '..', 'assets', 'kyc-docs', 'aadhar');

export function getKycAadharRoot() {
  return ROOT;
}

/** Relative path from ROOT for a volunteer: <volunteer_id>/ */
export function getVolunteerKycDir(volunteerId) {
  return path.join(ROOT, volunteerId);
}

/** Full path to a stored file (for serve/delete). pathRelative is e.g. "<volunteer_id>/front-123.jpg" */
export function getKycFilePath(pathRelative) {
  const safe = pathRelative.replace(/\.\./g, '').replace(/^\/+/, '');
  return path.join(ROOT, safe);
}

const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const volunteerId = req.actor?.id;
    if (!volunteerId) return cb(new Error('Volunteer auth required'));
    const dir = path.join(ROOT, volunteerId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const field = file.fieldname; // aadhar_front or aadhar_back
    const ext = (file.mimetype === 'image/png') ? 'png' : (file.mimetype === 'image/webp') ? 'webp' : 'jpg';
    cb(null, `${field}-${Date.now()}.${ext}`);
  },
});

export const kycUploadMulter = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, or WebP images allowed'));
    }
    cb(null, true);
  },
}).fields([
  { name: 'aadhar_front', maxCount: 1 },
  { name: 'aadhar_back', maxCount: 1 },
]);
