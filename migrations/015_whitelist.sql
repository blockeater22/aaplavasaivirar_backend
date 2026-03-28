-- Early-access / investor waitlist signups (public marketing site)
CREATE TABLE IF NOT EXISTS whitelist_signups (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name             TEXT NOT NULL,
  mobile                VARCHAR(15) NOT NULL,
  email                 TEXT,
  full_address          TEXT NOT NULL,
  area_locality         TEXT NOT NULL,
  pincode               VARCHAR(10) NOT NULL,
  category              VARCHAR(40) NOT NULL
    CHECK (category IN (
      'shop_owner',
      'property_owner',
      'home_buyer',
      'renter',
      'builder',
      'agent',
      'investor',
      'resident_user',
      'volunteer_interest',
      'other'
    )),
  organization_name     TEXT,
  interest_notes        TEXT,
  how_heard             TEXT,
  consent_terms         BOOLEAN NOT NULL DEFAULT FALSE,
  consent_marketing     BOOLEAN NOT NULL DEFAULT FALSE,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT whitelist_signups_mobile_unique UNIQUE (mobile)
);

CREATE INDEX IF NOT EXISTS idx_whitelist_signups_category ON whitelist_signups (category);
CREATE INDEX IF NOT EXISTS idx_whitelist_signups_created_at ON whitelist_signups (created_at DESC);

COMMENT ON TABLE whitelist_signups IS 'Marketing waitlist; one row per mobile for de-duplication';
