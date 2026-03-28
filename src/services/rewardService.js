import pool from '../config/db.js';

// Tiers from DB: Free, Brownz, Silver, Gold, Platinum, Diamond
const TIER_THRESHOLDS = [
  { tier: 'Free', minVerified: 0 },
  { tier: 'Brownz', minVerified: 25 },
  { tier: 'Silver', minVerified: 100 },
  { tier: 'Gold', minVerified: 250 },
  { tier: 'Platinum', minVerified: 500 },
  { tier: 'Diamond', minVerified: 1000 },
];

export function getTierForCount(totalVerified) {
  let current = TIER_THRESHOLDS[0];
  for (const t of TIER_THRESHOLDS) {
    if (totalVerified >= t.minVerified) current = t;
  }
  return current.tier;
}

/**
 * Next tier and how many more verifications needed.
 */
export function getNextTier(totalVerified) {
  for (const t of TIER_THRESHOLDS) {
    if (totalVerified < t.minVerified) {
      return { nextTier: t.tier, remaining: t.minVerified - totalVerified };
    }
  }
  return { nextTier: null, remaining: 0 };
}

/**
 * Check if volunteer can claim a tier (kyc approved, reward_eligible).
 */
export async function canClaimTier(volunteerId, tier) {
  const { rows } = await pool.query(
    `SELECT kyc_status, reward_eligible, total_verified FROM volunteers WHERE id = $1`,
    [volunteerId]
  );
  if (rows.length === 0) return { ok: false, error: 'Volunteer not found' };
  const v = rows[0];
  if (v.kyc_status !== 'approved') return { ok: false, error: 'KYC not approved' };
  if (!v.reward_eligible) return { ok: false, error: 'Not eligible for rewards' };
  const th = TIER_THRESHOLDS.find((t) => t.tier === tier);
  if (!th) return { ok: false, error: 'Invalid tier' };
  if (v.total_verified < th.minVerified) {
    return { ok: false, error: `Need ${th.minVerified} verified shops for ${tier}` };
  }
  return { ok: true };
}

/**
 * Claim tier (insert reward_claims). Idempotent (UNIQUE volunteer_id, tier).
 */
export async function claimTier(volunteerId, tier) {
  const check = await canClaimTier(volunteerId, tier);
  if (!check.ok) return check;
  try {
    await pool.query(
      `INSERT INTO reward_claims (volunteer_id, tier) VALUES ($1, $2) ON CONFLICT (volunteer_id, tier) DO NOTHING`,
      [volunteerId, tier]
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * List claimed tiers for volunteer.
 */
export async function listClaimedTiers(volunteerId) {
  const { rows } = await pool.query(
    `SELECT tier, claimed_at FROM reward_claims WHERE volunteer_id = $1 ORDER BY claimed_at`,
    [volunteerId]
  );
  return rows;
}
