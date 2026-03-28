/**
 * ImageKit: upload images, serve with on-the-fly transforms (small/medium/large).
 * Requires: IMAGEKIT_PRIVATE_KEY (from dashboard). Optional: IMAGEKIT_PUBLIC_KEY, IMAGEKIT_URL_ENDPOINT for URL building.
 */
import ImageKit from '@imagekit/nodejs';
import { toFile } from '@imagekit/nodejs';

const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

let imagekit = null;
if (privateKey) {
  imagekit = new ImageKit({ privateKey });
}

export function isConfigured() {
  return Boolean(imagekit);
}

/**
 * Upload a single image buffer to ImageKit. Returns { url, filePath } or null.
 * @param {Buffer} buffer
 * @param {string} [fileName] e.g. shop_123.jpg
 * @param {string} [folder] e.g. /shops
 */
export async function uploadImage(buffer, fileName, folder = '/shops') {
  if (!imagekit) return null;
  try {
    const file = await toFile(buffer, fileName || `shop_${Date.now()}.jpg`);
    const result = await imagekit.files.upload({
      file,
      fileName: fileName || `shop_${Date.now()}.jpg`,
      folder,
    });
    return { url: result.url, filePath: result.filePath };
  } catch (err) {
    console.error('[ImageKit]', err.message);
    return null;
  }
}

/**
 * Build transformed URLs for small (200px), medium (800px), large (1200px) width.
 * @param {string} imageUrl - full ImageKit URL from upload
 * @returns {{ small: string, medium: string, large: string }|null}
 */
export function imageUrlVariants(imageUrl) {
  if (!imageUrl || !imageUrl.trim()) return null;
  const base = imageUrl.split('?')[0];
  return {
    small: `${base}?tr=w-200,fo-auto`,
    medium: `${base}?tr=w-800,fo-auto`,
    large: `${base}?tr=w-1200,fo-auto`,
  };
}
