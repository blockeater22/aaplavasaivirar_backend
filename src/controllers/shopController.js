import pool from '../config/db.js';
import { shopsNearby, hasShopInRadius, findDuplicateInRadius, findBuildingAtLocation, wktPoint } from '../services/geoService.js';
import { createAndSendShopOtp, verifyShopOtp } from '../services/otpService.js';
import { processAndUploadMany } from '../services/shopImageService.js';
import { isConfigured as imagekitConfigured, imageUrlVariants } from '../services/imagekitService.js';
import { imageUrl as cloudflareImageUrl } from '../services/cloudflareImagesService.js';

function mapShopImageRow(r) {
  if (!r.image_url) {
    return {
      small: cloudflareImageUrl(r.image_id_small, 'public'),
      medium: cloudflareImageUrl(r.image_id_medium, 'public'),
      large: cloudflareImageUrl(r.image_id_large, 'public'),
      position: r.position,
    };
  }
  const url = r.image_url;
  // Legacy: any non-ImageKit URL (e.g. old Supabase Storage) — same URL for all sizes
  if (url.includes('supabase.co') && !url.includes('ik.imagekit.io')) {
    return { small: url, medium: url, large: url, position: r.position };
  }
  const v = imageUrlVariants(url);
  return v ? { ...v, position: r.position } : { small: url, medium: url, large: url, position: r.position };
}

/** GET /shops/nearby ?lat=&lng=&radius_m=5 */
export async function getNearby(req, res) {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius_m = req.query.radius_m ? parseInt(req.query.radius_m, 10) : 5;
    const list = await shopsNearby(lat, lng, radius_m);
    return res.json({ shops: list });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /shops — add shop (volunteer). Multipart: fields + optional images (max 5). Validate 5m duplicate. */
export async function addShop(req, res) {
  try {
    const volunteerId = req.actor.id;
    const body = req.body || {};
    const building = typeof body.building === 'string' ? (body.building ? JSON.parse(body.building) : null) : body.building;
    const building_id = body.building_id;
    const name = body.name;
    const shop_number = body.shop_number;
    const category_id = body.category_id;
    const category = body.category;
    const phone = body.phone;
    const lat = parseFloat(body.lat);
    const lng = parseFloat(body.lng);
    const point = wktPoint(lng, lat);
    const location_type = body.location_type || (building_id || building ? 'building' : 'road');
    const road_name = body.road_name ?? null;
    const shopfront_name = body.shopfront_name ?? null;
    const landmark = body.landmark ?? null;
    const full_address = body.full_address ?? null;
    const files = req.files && Array.isArray(req.files) ? req.files : [];
    if (files.length > 0) console.log('[addShop] received', files.length, 'image(s)');
    if (files.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 images allowed' });
    }

    let bid = building_id || null;
    if (location_type === 'building') {
      if (building && !bid) {
        const { name: bName, address: bAddress, city, state, pincode, country } = building;
        const hasName = bName != null && String(bName).trim() !== '';
        const hasAddress = bAddress != null && String(bAddress).trim() !== '';
        const hasCity = city != null && String(city).trim() !== '';
        const hasState = state != null && String(state).trim() !== '';
        const hasCountry = country != null && String(country).trim() !== '';
        if (!hasName || !hasAddress || !hasCity || !hasState || !hasCountry) {
          return res.status(400).json({ error: 'building needs name, address, city, state, country (pincode optional)' });
        }
        const existingBuilding = await findBuildingAtLocation(lat, lng, 10);
        if (existingBuilding) {
          bid = existingBuilding.id;
        } else {
          const pincodeVal = pincode != null && String(pincode).trim() !== '' ? String(pincode).trim() : '';
          const { rows: bRows } = await pool.query(
            `INSERT INTO buildings (name, address, city, state, pincode, country, coordinates) VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromEWKT($7)) RETURNING id`,
            [String(bName).trim(), String(bAddress).trim(), String(city).trim(), String(state).trim(), pincodeVal, String(country).trim(), point]
          );
          bid = bRows[0].id;
        }
      }
      if (!bid) return res.status(400).json({ error: 'building_id or building required for building location_type' });
    } else {
      // Road/shopfront mode: building is optional, but we need a human-readable address to verify.
      if (full_address == null || String(full_address).trim() === '') {
        return res.status(400).json({ error: 'full_address required for road location_type' });
      }
    }

    let catId = null;
    let catText = category || '';
    if (category_id) {
      const { rows: cr } = await pool.query(`SELECT id, name FROM categories WHERE id = $1 AND is_active = true`, [category_id]);
      if (cr.length === 0) return res.status(400).json({ error: 'Invalid category_id' });
      catId = cr[0].id;
      catText = cr[0].name;
    } else if (category) {
      catText = String(category).trim();
    }
    if (!catText) return res.status(400).json({ error: 'category_id or category required' });

    const duplicate = await findDuplicateInRadius(lat, lng, 5, {
      name: name?.trim(),
      category_id: catId || undefined,
      category: catText || undefined,
    });
    if (duplicate) {
      return res.status(409).json({
        error: 'A shop with this name and category already exists within 5m. Use PATCH to update.',
        existing_shop_id: duplicate.id,
      });
    }

    let rows;
    if (catId != null) {
      try {
        const r = await pool.query(
          `INSERT INTO shops (
              building_id, location_type, road_name, shopfront_name, landmark, full_address,
              name, shop_number, category_id, category, phone, coordinates, created_by_volunteer_id
            )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, ST_GeomFromEWKT($12), $13)
           RETURNING id, building_id, location_type, road_name, shopfront_name, landmark, full_address,
                     name, shop_number, category_id, category, phone, is_verified, created_at`,
          [bid, location_type, road_name, shopfront_name, landmark, full_address, name, shop_number, catId, catText, phone, point, volunteerId]
        );
        rows = r.rows;
      } catch (e) {
        if (e.code === '42703') {
          const msg = String(e.message || '');
          const missingLocation =
            msg.includes('location_type') ||
            msg.includes('road_name') ||
            msg.includes('shopfront_name') ||
            msg.includes('landmark') ||
            msg.includes('full_address');
          // Backward compatibility: created_by_volunteer_id may be missing if migration 013 wasn't applied.
          if (msg.includes('created_by_volunteer_id')) {
            if (missingLocation) {
              // Legacy schema: no location_type/road columns, and no created_by_volunteer_id.
              const r = await pool.query(
                `INSERT INTO shops (building_id, name, shop_number, category_id, category, phone, coordinates)
                 VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromEWKT($7))
                 RETURNING id, building_id, name, shop_number, category_id, category, phone, is_verified, created_at`,
                [bid, name, shop_number, catId, catText, phone, point]
              );
              rows = r.rows;
            } else {
              const r = await pool.query(
                `INSERT INTO shops (
                    building_id, location_type, road_name, shopfront_name, landmark, full_address,
                    name, shop_number, category_id, category, phone, coordinates
                  )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, ST_GeomFromEWKT($12))
                 RETURNING id, building_id, location_type, road_name, shopfront_name, landmark, full_address,
                           name, shop_number, category_id, category, phone, is_verified, created_at`,
                [bid, location_type, road_name, shopfront_name, landmark, full_address, name, shop_number, catId, catText, phone, point]
              );
              rows = r.rows;
            }
          } else {
            if (missingLocation) {
              // Legacy schema: no location_type/road columns, but created_by_volunteer_id may exist.
              const r = await pool.query(
                `INSERT INTO shops (building_id, name, shop_number, category_id, category, phone, coordinates, created_by_volunteer_id)
                 VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromEWKT($7), $8)
                 RETURNING id, building_id, name, shop_number, category_id, category, phone, is_verified, created_at`,
                [bid, name, shop_number, catId, catText, phone, point, volunteerId]
              );
              rows = r.rows;
            } else {
              // category_id column missing (backward compatibility); keep created_by_volunteer_id if it exists
              const r = await pool.query(
                `INSERT INTO shops (building_id, location_type, road_name, shopfront_name, landmark, full_address, name, shop_number, category, phone, coordinates, created_by_volunteer_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ST_GeomFromEWKT($11), $12)
                 RETURNING id, building_id, location_type, road_name, shopfront_name, landmark, full_address,
                           name, shop_number, category, phone, is_verified, created_at`,
                [bid, location_type, road_name, shopfront_name, landmark, full_address, name, shop_number, catText, phone, point, volunteerId]
              );
              rows = r.rows;
            }
          }
        } else throw e;
      }
    } else {
      try {
        const r = await pool.query(
          `INSERT INTO shops (
              building_id, location_type, road_name, shopfront_name, landmark, full_address,
              name, shop_number, category, phone, coordinates, created_by_volunteer_id
            )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ST_GeomFromEWKT($11), $12)
           RETURNING id, building_id, location_type, road_name, shopfront_name, landmark, full_address,
                     name, shop_number, category, phone, is_verified, created_at`,
          [bid, location_type, road_name, shopfront_name, landmark, full_address, name, shop_number, catText, phone, point, volunteerId]
        );
        rows = r.rows;
      } catch (e) {
        if (e.code === '42703') {
          const msg = String(e.message || '');
          const missingLocation =
            msg.includes('location_type') ||
            msg.includes('road_name') ||
            msg.includes('shopfront_name') ||
            msg.includes('landmark') ||
            msg.includes('full_address');

          if (msg.includes('created_by_volunteer_id')) {
            if (missingLocation) {
              // Legacy schema: category text + no location/road + no created_by_volunteer_id.
              const r = await pool.query(
                `INSERT INTO shops (building_id, name, shop_number, category, phone, coordinates)
                 VALUES ($1, $2, $3, $4, $5, ST_GeomFromEWKT($6))
                 RETURNING id, building_id, name, shop_number, category, phone, is_verified, created_at`,
                [bid, name, shop_number, catText, phone, point]
              );
              rows = r.rows;
            } else {
              const r = await pool.query(
                `INSERT INTO shops (building_id, location_type, road_name, shopfront_name, landmark, full_address, name, shop_number, category, phone, coordinates)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ST_GeomFromEWKT($11))
                 RETURNING id, building_id, location_type, road_name, shopfront_name, landmark, full_address,
                           name, shop_number, category, phone, is_verified, created_at`,
                [bid, location_type, road_name, shopfront_name, landmark, full_address, name, shop_number, catText, phone, point]
              );
              rows = r.rows;
            }
          } else if (missingLocation) {
            // Legacy schema: no location/road columns, but created_by_volunteer_id may exist.
            const r = await pool.query(
              `INSERT INTO shops (building_id, name, shop_number, category, phone, coordinates, created_by_volunteer_id)
               VALUES ($1, $2, $3, $4, $5, ST_GeomFromEWKT($6), $7)
               RETURNING id, building_id, name, shop_number, category, phone, is_verified, created_at`,
              [bid, name, shop_number, catText, phone, point, volunteerId]
            );
            rows = r.rows;
          } else {
            // Unknown 42703; rethrow so we see the real missing column.
            throw e;
          }
        } else throw e;
      }
    }
    const shopId = rows[0].id;
    const canUploadImages = files.length > 0 && files.length <= 5 && imagekitConfigured();
    if (canUploadImages) {
      try {
        const uploaded = await processAndUploadMany(files, shopId);
        for (let i = 0; i < uploaded.length; i++) {
          const u = uploaded[i];
          await pool.query(
            `INSERT INTO shop_images (shop_id, image_url, image_id_small, image_id_medium, image_id_large, position) VALUES ($1, $2, NULL, NULL, NULL, $3)`,
            [shopId, u.image_url, i + 1]
          );
        }
        if (uploaded.length < files.length) {
          console.warn('[addShop] Only', uploaded.length, 'of', files.length, 'images uploaded');
        }
      } catch (imgErr) {
        console.error('[shop images]', imgErr);
      }
    } else if (files.length > 0) {
      console.warn('[addShop] Images skipped: set IMAGEKIT_PRIVATE_KEY (and ImageKit keys in .env)');
    }
    const shop = rows[0];
    const { rows: imgRows } = await pool.query(
      `SELECT image_url, image_id_small, image_id_medium, image_id_large, position FROM shop_images WHERE shop_id = $1 ORDER BY position`,
      [shopId]
    );
    shop.images = imgRows.map(mapShopImageRow);
    return res.status(201).json(shop);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** GET /shops/:id — shop detail with image URLs (small, medium, large). */
export async function getById(req, res) {
  try {
    const shopId = req.params.id;
    const { rows: shopRows } = await pool.query(
      `SELECT id, building_id, location_type, road_name, shopfront_name, landmark, full_address,
              name, shop_number, category_id, category, phone, is_verified, verified_at, owner_claimed_at, created_at,
              ST_X(coordinates::geometry) as lng, ST_Y(coordinates::geometry) as lat
       FROM shops WHERE id = $1`,
      [shopId]
    );
    if (shopRows.length === 0) return res.status(404).json({ error: 'Shop not found' });
    const shop = shopRows[0];
    const { rows: imgRows } = await pool.query(
      `SELECT image_url, image_id_small, image_id_medium, image_id_large, position FROM shop_images WHERE shop_id = $1 ORDER BY position`,
      [shopId]
    );
    shop.images = imgRows.map(mapShopImageRow);
    return res.json(shop);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /shops/:id/request-otp — send OTP to shop owner */
export async function requestOtp(req, res) {
  try {
    const volunteerId = req.actor.id;
    const shopId = req.params.id;
    const { rows } = await pool.query(
      `SELECT id, phone FROM shops WHERE id = $1`,
      [shopId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
    await createAndSendShopOtp(shopId, rows[0].phone, volunteerId);
    return res.json({ message: 'OTP sent to shop owner phone' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /shops/:id/verify-otp */
export async function verifyOtp(req, res) {
  try {
    const volunteerId = req.actor.id;
    const shopId = req.params.id;
    const { otp } = req.body;
    const ok = await verifyShopOtp(shopId, otp, volunteerId);
    if (!ok) return res.status(400).json({ error: 'Invalid or expired OTP' });
    return res.json({ message: 'Shop verified' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** GET /shops/search — public: text + optional lat,lng,radius */
export async function search(req, res) {
  try {
    const { q, lat, lng, radius_m } = req.query;
    const params = [];
    let where = '';
    if (q && String(q).trim()) {
      params.push(`%${String(q).trim()}%`);
      where = `WHERE (s.name ILIKE $1 OR s.category ILIKE $1)`;
    }
    if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
      const radius = radius_m ? parseInt(radius_m, 10) : 500;
      const n = params.length;
      params.push(parseFloat(lng), parseFloat(lat), radius);
      const geo = `ST_DWithin(s.coordinates::geography, ST_SetSRID(ST_MakePoint($${n + 1}, $${n + 2}), 4326)::geography, $${n + 3})`;
      where = where ? where + ' AND ' + geo : 'WHERE ' + geo;
    }
    const query = `SELECT s.id, s.building_id, s.name, s.shop_number, s.category, s.phone, s.is_verified, s.verified_at,
                          ST_X(s.coordinates::geometry) as lng, ST_Y(s.coordinates::geometry) as lat
                   FROM shops s ${where} ORDER BY s.name LIMIT 100`;
    const { rows } = await pool.query(query, params);
    return res.json({ shops: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /shops/:id/claim — owner claims with same phone (OTP or token). Simplified: body.phone matches shop.phone */
export async function claimShop(req, res) {
  try {
    const shopId = req.params.id;
    const { phone } = req.body;
    const phoneNorm = String(phone || '').replace(/\D/g, '').slice(-10);
    const { rows } = await pool.query(
      `UPDATE shops SET owner_claimed_at = now(), updated_at = now() WHERE id = $1 AND phone = $2 RETURNING id`,
      [shopId, phoneNorm]
    );
    if (rows.length === 0) return res.status(400).json({ error: 'Shop not found or phone does not match' });
    return res.json({ message: 'Shop claimed', shop_id: rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** PATCH /shops/:id — update shop (volunteer or owner). Body: name, shop_number, category, phone, lat, lng. */
export async function updateShop(req, res) {
  try {
    const shopId = req.params.id;
    const allowed = ['name', 'shop_number', 'category', 'phone'];
    const updates = [];
    const values = [];
    let i = 1;
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        updates.push(`${k} = $${i++}`);
        values.push(req.body[k]);
      }
    }
    const lat = req.body.lat !== undefined && req.body.lat !== '' ? parseFloat(req.body.lat) : null;
    const lng = req.body.lng !== undefined && req.body.lng !== '' ? parseFloat(req.body.lng) : null;
    if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      const point = wktPoint(lng, lat);
      updates.push(`coordinates = ST_GeomFromEWKT($${i++})`);
      values.push(point);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(shopId);
    const { rows } = await pool.query(
      `UPDATE shops SET ${updates.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING id, name, shop_number, category, phone`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
