-- Referral rule: only volunteers with >= 100 verified shops can refer new volunteers
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS referred_by_volunteer_id UUID REFERENCES volunteers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_volunteers_referred_by ON volunteers(referred_by_volunteer_id);

COMMENT ON COLUMN volunteers.referred_by_volunteer_id IS 'Set when volunteer was referred; referrer must have total_verified >= 100 at time of signup';
