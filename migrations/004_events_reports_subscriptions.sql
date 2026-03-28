-- Events: cricket matches, rallies, community (Phase 3)
CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  type        TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url   TEXT,
  video_url   TEXT,
  document_url TEXT,
  link        TEXT,
  tags        TEXT[],
  is_public   BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  location    GEOMETRY(Point, 4326) NOT NULL,
  address     TEXT NOT NULL,
  landmark    TEXT NOT NULL,
  event_date  DATE NOT NULL,
  event_time  TIME NOT NULL,
  event_duration  INT NOT NULL,
  event_duration_unit  TEXT NOT NULL CHECK (event_duration_unit IN ('minutes', 'hours', 'days')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_location ON events USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_event_time ON events(event_time);
CREATE INDEX IF NOT EXISTS idx_events_event_duration ON events(event_duration);
CREATE INDEX IF NOT EXISTS idx_events_event_duration_unit ON events(event_duration_unit);

-- Reports: "Reported Fake" shops — affects volunteer leaderboard/rewards if >10%
CREATE TABLE IF NOT EXISTS reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved_fake', 'resolved_valid')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_shop ON reports(shop_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);

-- Subscriptions (Phase 3): ₹49 / ₹199 / ₹999 plans
-- Optional: add users table for residents; here we reference a generic user_id.
CREATE TABLE IF NOT EXISTS subscriptions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL,
  plan      INT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at   TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
