/**
 * Cloudflare Images: upload buffer, get image id. Serve via imagedelivery.net.
 * Requires: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_IMAGES_API_TOKEN, CLOUDFLARE_IMAGES_DELIVERY_BASE
 * Uses global FormData + Blob so Node fetch sends multipart correctly.
 */
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_IMAGES_API_TOKEN;
const DELIVERY_BASE = process.env.CLOUDFLARE_IMAGES_DELIVERY_BASE || '';

export function isConfigured() {
  return Boolean(ACCOUNT_ID && API_TOKEN && DELIVERY_BASE);
}

/**
 * Upload a single image buffer to Cloudflare Images. Returns image id or null on failure.
 * @param {Buffer} buffer
 * @param {string} [filename] optional
 * @returns {Promise<string|null>} image id
 */
export async function uploadImage(buffer, filename = 'image.jpg') {
  if (!ACCOUNT_ID || !API_TOKEN) return null;
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1`;
  const form = new FormData();
  form.append('file', new Blob([buffer]), filename);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      body: form,
    });
    const data = await res.json();
    if (data.success && data.result?.id) return data.result.id;
    console.error('[Cloudflare Images]', data.errors || data);
    const is5403 = data.errors?.some?.((e) => e.code === 5403);
    if (is5403) {
      console.warn(
        '[Cloudflare Images] 5403 fix: (1) Use Account ID from dashboard right sidebar (Overview), not Zone ID. (2) Token template: "Read and write to Cloudflare Stream and Images". (3) Enable Images: sidebar → Images (may require plan). Account ID length:',
        ACCOUNT_ID?.length ?? 0,
        '(expected 32)'
      );
    }
    return null;
  } catch (err) {
    console.error('[Cloudflare Images]', err.message);
    return null;
  }
}

/**
 * Build delivery URL for an image id. Uses default variant "public" if not set.
 * @param {string} imageId
 * @param {'small'|'medium'|'large'|'public'} [variant] default 'public'
 */
export function imageUrl(imageId, variant = 'public') {
  if (!DELIVERY_BASE || !imageId) return null;
  const base = DELIVERY_BASE.replace(/\/$/, '');
  return `${base}/${imageId}/${variant}`;
}

/**
 * Return { small, medium, large } URLs for a shop image row.
 */
export function shopImageUrls(row) {
  if (!row) return null;
  return {
    small: imageUrl(row.image_id_small, 'public'),
    medium: imageUrl(row.image_id_medium, 'public'),
    large: imageUrl(row.image_id_large, 'public'),
  };
}
