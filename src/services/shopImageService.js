/**
 * Shop images: normalize with Sharp (max 1200px WebP ~0.7) and upload to ImageKit.
 * Client usually sends pre-compressed WebP; server ensures caps + consistent format for ImageKit dynamic delivery.
 *
 * Sharp is loaded lazily — static import pulls a heavy native binary and can stall or timeout
 * Vercel serverless cold starts for routes that never touch images.
 */
import { uploadImage } from './imagekitService.js';

const MAX_WIDTH = 1200;
const WEBP_QUALITY = 72;

async function normalizeListingBuffer(buffer) {
  const { default: sharp } = await import('sharp');
  return sharp(buffer)
    .resize(MAX_WIDTH, null, { withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

/**
 * @param {Buffer} buffer
 * @param {string} _shopId UUID
 * @param {number} index 0-based
 */
export async function processAndUploadOne(buffer, _shopId, index = 0) {
  const resized = await normalizeListingBuffer(buffer);
  const safeName = `img_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}.webp`;
  const result = await uploadImage(resized, safeName, '/shops');
  return result?.url ? { image_url: result.url } : null;
}

/**
 * @param {Array<{ buffer: Buffer }>} files
 * @param {string} shopId
 */
export async function processAndUploadMany(files, shopId) {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const buf = f.buffer || f;
    const row = await processAndUploadOne(buf, shopId, i);
    if (row) results.push(row);
  }
  return results;
}
