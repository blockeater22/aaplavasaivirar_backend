import pool from '../config/db.js';

function normalizeMobile(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('91')) return digits.slice(-10);
  if (digits.length >= 11 && digits.startsWith('0')) return digits.slice(-10);
  return digits.slice(-10);
}

export async function create(req, res) {
  const {
    full_name,
    mobile,
    email,
    full_address,
    building_name,
    sub_region,
    area_locality,
    pincode,
    category,
    category_other,
    organization_name,
    interest_notes,
    how_heard,
    consent_terms,
    consent_marketing,
  } = req.body;

  const m = normalizeMobile(mobile);
  const ua = req.get('user-agent') || null;

  try {
    const otherText =
      category === 'other' && category_other ? String(category_other).trim() : null;

    const { rows } = await pool.query(
      `INSERT INTO whitelist_signups (
        full_name, mobile, email, full_address, building_name, sub_region, area_locality, pincode, category,
        category_other, organization_name, interest_notes, how_heard,
        consent_terms, consent_marketing, user_agent
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16
      )
      RETURNING id, created_at`,
      [
        full_name.trim(),
        m,
        email?.trim() || null,
        full_address.trim(),
        String(building_name ?? '').trim(),
        String(sub_region ?? '').trim(),
        area_locality.trim(),
        String(pincode).replace(/\D/g, '').slice(0, 10),
        category,
        otherText,
        organization_name?.trim() || null,
        interest_notes?.trim() || null,
        how_heard?.trim() || null,
        Boolean(consent_terms),
        Boolean(consent_marketing),
        ua,
      ]
    );
    return res.status(201).json({
      ok: true,
      message: "You're on the list. We'll be in touch soon.",
      id: rows[0].id,
      created_at: rows[0].created_at,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'This mobile number is already registered on the waitlist.',
        code: 'DUPLICATE_MOBILE',
      });
    }
    console.error('[whitelist]', err);
    return res.status(500).json({ error: 'Could not save your signup. Please try again later.' });
  }
}
