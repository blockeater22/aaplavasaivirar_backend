import fs from 'fs';
import path from 'path';
import pool from '../config/db.js';
import { getKycFilePath } from '../config/kycUpload.js';

/** GET /admin/heatmap — geo-aggregated counts (rounded lat/lng grid) */
export async function heatmap(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT ROUND(ST_Y(coordinates::geometry)::numeric, 3) as lat,
             ROUND(ST_X(coordinates::geometry)::numeric, 3) as lng,
             COUNT(*)::int as count
      FROM shops
      GROUP BY 1, 2
      ORDER BY count DESC
      LIMIT 500
    `);
    return res.json({ heatmap: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** GET /admin/volunteers — includes KYC paths (only admin can see); docs served via GET kyc-docs */
export async function listVolunteers(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT v.id, v.name, v.phone, v.email, v.kyc_status, v.trust_score, v.total_verified, v.social_links,
              v.aadhar_number, v.aadhar_front_path, v.aadhar_back_path, v.created_at,
              b.name as building_name, b.address as building_address
       FROM volunteers v
       LEFT JOIN buildings b ON b.id = v.building_id
       ORDER BY v.created_at DESC`
    );
    return res.json({ volunteers: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** GET /admin/volunteers/:id/kyc-docs/:doc — serve Aadhar image (front | back). Admin only. */
export async function getKycDoc(req, res) {
  try {
    const { id, doc } = req.params;
    if (!['front', 'back'].includes(doc)) return res.status(400).json({ error: 'doc must be front or back' });
    const col = doc === 'front' ? 'aadhar_front_path' : 'aadhar_back_path';
    const { rows } = await pool.query(
      `SELECT ${col} as path FROM volunteers WHERE id = $1`,
      [id]
    );
    if (rows.length === 0 || !rows[0].path) return res.status(404).json({ error: 'KYC doc not found' });
    const filePath = getKycFilePath(rows[0].path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** DELETE /admin/volunteers/:id/kyc-docs/:doc — delete Aadhar image (front | back) and clear path in DB. Admin only. */
export async function deleteKycDoc(req, res) {
  try {
    const { id, doc } = req.params;
    if (!['front', 'back'].includes(doc)) return res.status(400).json({ error: 'doc must be front or back' });
    const col = doc === 'front' ? 'aadhar_front_path' : 'aadhar_back_path';
    const { rows } = await pool.query(
      `SELECT ${col} as path FROM volunteers WHERE id = $1`,
      [id]
    );
    if (rows.length === 0 || !rows[0].path) return res.status(404).json({ error: 'KYC doc not found' });
    const filePath = getKycFilePath(rows[0].path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.query(
      `UPDATE volunteers SET ${col} = NULL, updated_at = now() WHERE id = $1`,
      [id]
    );
    return res.json({ message: 'KYC doc deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** PATCH /admin/volunteers/:id/kyc */
export async function updateKyc(req, res) {
  try {
    const { id } = req.params;
    const { kyc_status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(kyc_status)) {
      return res.status(400).json({ error: 'kyc_status must be pending, approved, or rejected' });
    }
    const { rowCount } = await pool.query(
      `UPDATE volunteers SET kyc_status = $2, updated_at = now() WHERE id = $1`,
      [id, kyc_status]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Volunteer not found' });
    return res.json({ message: 'KYC status updated', kyc_status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
