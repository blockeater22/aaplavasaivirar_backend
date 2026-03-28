-- Users (residents): for User App, events, reports, subscriptions
-- Must run before 004 (events and reports reference users(id))
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL UNIQUE,
  email          TEXT,
  password       TEXT,
  home_location  GEOMETRY(Point, 4326),
  address        TEXT NOT NULL,
  building_id    UUID NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_home_location ON users USING GIST (home_location) WHERE home_location IS NOT NULL;
