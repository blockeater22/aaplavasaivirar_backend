-- User Module: favorites, search history, notifications
CREATE TABLE IF NOT EXISTS user_favorites (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id   UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);

CREATE TABLE IF NOT EXISTS user_search_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_text   TEXT,
  location     GEOMETRY(Point, 4326),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_search_history_user ON user_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_search_history_created ON user_search_history(created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  body      TEXT,
  type      TEXT NOT NULL DEFAULT 'event',
  read_at   TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read_at);

-- Business Module: service catalog (Service Pro — ₹49 + lead charges)
CREATE TABLE IF NOT EXISTS service_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID REFERENCES shops(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  skill       TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_catalog_owner CHECK (shop_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_service_catalog_shop ON service_catalog(shop_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_user ON service_catalog(user_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON service_catalog(category);

-- Leads: pay-per-lead for Service Pro and Builder
CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  to_entity_type  TEXT NOT NULL CHECK (to_entity_type IN ('service_pro', 'builder')),
  to_entity_id    UUID NOT NULL,
  listing_type    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_from_user ON leads(from_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_to_entity ON leads(to_entity_type, to_entity_id);

-- Event Module: payment gate for featured posts (add columns only)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS featured_paid_at TIMESTAMPTZ;

-- Builder / Ads: property ads (high-value ads + pay-per-lead)
CREATE TABLE IF NOT EXISTS property_ads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title       TEXT NOT NULL,
  description TEXT,
  location    GEOMETRY(Point, 4326),
  address     TEXT,
  image_url   TEXT,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_ads_user ON property_ads(user_id);
CREATE INDEX IF NOT EXISTS idx_property_ads_location ON property_ads USING GIST (location) WHERE location IS NOT NULL;

-- Optional: link subscriptions to users (add FK if not already)
-- ALTER TABLE subscriptions ADD CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id);

-- Index for reports by user (if reports use user_id)
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
