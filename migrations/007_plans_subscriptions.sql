-- Plans: single source of truth for subscription tiers
CREATE TABLE IF NOT EXISTS plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL UNIQUE,
  code             TEXT NOT NULL UNIQUE,
  price_rupees     INT NOT NULL CHECK (price_rupees > 0),
  billing_interval TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
  features         JSONB DEFAULT '[]',
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_code ON plans(code);

INSERT INTO plans (name, code, price_rupees, billing_interval, description, features) VALUES
  ('Service Pro', 'service_pro', 49, 'monthly', 'List services; monthly + lead charges', '["service_listing","lead_charges"]'),
  ('Business Pro', 'business_pro', 199, 'monthly', 'Shop owner upgrade', '["claimed_shop_upgrade","priority_listing"]'),
  ('Builder', 'builder', 999, 'monthly', 'Property ads + pay-per-lead', '["property_ads","pay_per_lead"]')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_id);

-- Login OTPs for volunteer/user auth (single-use, short TTL)
CREATE TABLE IF NOT EXISTS login_otps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT NOT NULL,
  otp_hash   TEXT NOT NULL,
  purpose    TEXT NOT NULL CHECK (purpose IN ('volunteer_login', 'user_login')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_otps_phone_purpose ON login_otps(phone, purpose);
CREATE INDEX IF NOT EXISTS idx_login_otps_expires ON login_otps(expires_at);
