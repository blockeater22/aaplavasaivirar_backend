-- Volunteers: data-collection workforce (KYC, trust score, rewards)
CREATE TABLE IF NOT EXISTS volunteers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL UNIQUE,
  email          TEXT NOT NULL UNIQUE,
  password       TEXT NOT NULL,
  age            INT NOT NULL,
  gender         TEXT NOT NULL,
  address        TEXT NOT NULL,
  building_id    UUID NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
  aadhar_ref     TEXT,
  trust_score    INT NOT NULL DEFAULT 100 CHECK (trust_score >= 0 AND trust_score <= 100),
  total_verified INT NOT NULL DEFAULT 0,
  kyc_status     TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
  kyc_doc_url    TEXT,
  aadhar_number  TEXT,
  aadhar_front_path TEXT,
  aadhar_back_path  TEXT,
  social_links   JSONB DEFAULT '{}',
  reward_eligible BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_volunteers_phone ON volunteers(phone);
CREATE INDEX IF NOT EXISTS idx_volunteers_total_verified ON volunteers(total_verified DESC);
CREATE INDEX IF NOT EXISTS idx_volunteers_kyc_status ON volunteers(kyc_status);

CREATE TABLE IF NOT EXISTS verification_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE RESTRICT,
  success     BOOLEAN NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

--COMMENT ON COLUMN volunteers.social_links IS 'Optional social profiles for admin verification: e.g. {"facebook":"url","instagram":"handle","linkedin":"url","twitter":"handle"}';

CREATE INDEX IF NOT EXISTS idx_verification_logs_shop ON verification_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_volunteer ON verification_logs(volunteer_id);

-- Temporary OTP store (single-use, short TTL); application must purge after use
CREATE TABLE IF NOT EXISTS otp_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE RESTRICT,
  otp_code    TEXT NOT NULL,
  phone       TEXT NOT NULL,
  otp_expires_at  TIMESTAMPTZ NOT NULL,
  otp_used_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

--Volunteer Report Schema: volunteer can report a shop as fake
CREATE TABLE IF NOT EXISTS volunteer_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE RESTRICT,
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved_fake', 'resolved_valid')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reward claims (Phase 2): Scout, T-Shirt, Hamper, Internship
CREATE TABLE IF NOT EXISTS reward_claims (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE RESTRICT,
  tier        TEXT NOT NULL CHECK (tier IN ('Free', 'Brownz', 'Silver', 'Gold','Platinum', 'Diamond')),
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(volunteer_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_reward_claims_volunteer ON reward_claims(volunteer_id);

CREATE INDEX IF NOT EXISTS idx_otp_requests_shop_expires ON otp_requests(shop_id, otp_expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_requests_volunteer_used ON otp_requests(volunteer_id, otp_used_at);