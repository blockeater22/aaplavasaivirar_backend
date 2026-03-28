import pool from '../config/db.js';
import { getTierForCount, getNextTier, listClaimedTiers, claimTier } from '../services/rewardService.js';

/** GET /volunteers/me */
export async function me(req, res) {
  try {
    const id = req.actor.id;
    const { rows } = await pool.query(
      `SELECT id, name, phone, email, building_id, age, gender, address, trust_score, total_verified, kyc_status, reward_eligible, created_at, aadhar_number
       FROM volunteers WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const v = rows[0];
    const has_kyc_submitted = !!(v.aadhar_number);
    const currentTier = getTierForCount(v.total_verified);
    const next = getNextTier(v.total_verified);
    const claimed = await listClaimedTiers(id);
    let stats = { shops_listed: 0, buildings_mapped: 0, badges_earned: claimed.length };
    try {
      const { rows: srows } = await pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM shops WHERE created_by_volunteer_id = $1) AS shops_listed,
           (SELECT COUNT(DISTINCT building_id)::int FROM shops WHERE created_by_volunteer_id = $1) AS buildings_mapped,
           (SELECT COUNT(*)::int FROM reward_claims WHERE volunteer_id = $1) AS badges_earned`,
        [id]
      );
      if (srows[0]) stats = { ...stats, ...srows[0] };
    } catch (e) {
      if (e.code !== '42703') throw e;
    }
    return res.json({
      ...v,
      has_kyc_submitted: has_kyc_submitted,
      current_tier: currentTier,
      next_tier: next.nextTier,
      remaining_for_next: next.remaining,
      reward_claims: claimed,
      stats,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /volunteers/me/rewards/claim — claim tier */
export async function claimReward(req, res) {
  try {
    const volunteerId = req.actor.id;
    const { tier } = req.body;
    if (!tier) return res.status(400).json({ error: 'tier required' });
    const result = await claimTier(volunteerId, tier);
    if (!result.ok) return res.status(400).json({ error: result.error });
    return res.json({ message: 'Reward claimed', tier });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
