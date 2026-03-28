import multer from 'multer';

const storage = multer.memoryStorage();
const limits = { fileSize: 5 * 1024 * 1024 }; // 5 MB per file

const upload = multer({
  storage,
  limits,
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Only images (jpeg, png, webp, gif) allowed'), false);
  },
});

/** Accept up to 5 images under field name "images". Use as: upload.array('images', 5) then validate count in controller. */
export const shopImagesUpload = upload.array('images', 5);
