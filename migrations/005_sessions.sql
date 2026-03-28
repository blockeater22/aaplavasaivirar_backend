-- Sessions: track login sessions for volunteers, users, and admins
-- Device, location, and session times for security and analytics

CREATE TABLE IF NOT EXISTS sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who: volunteer, user (resident), or admin
  actor_type      TEXT NOT NULL CHECK (actor_type IN ('volunteer', 'user', 'admin')),
  actor_id        UUID NOT NULL,
  -- Device & client
  device_info     JSONB,
  -- device_info can include: device_id, os, os_version, app_version, model, manufacturer, brand
  user_agent      TEXT,
  ip_address      INET,
  -- Location at session start (optional; from app geo or IP)
  location        GEOMETRY(Point, 4326),
  -- Session times
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Optional: refresh token id or hash for invalidation (if using refresh tokens)
  refresh_token_hash TEXT,
  -- Metadata
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_actor ON sessions(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_ended_at ON sessions(ended_at) WHERE ended_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_location ON sessions USING GIST (location) WHERE location IS NOT NULL;

--COMMENT ON TABLE sessions IS 'Tracks login sessions for volunteers, users, and admins: device, location, session times';
--COMMENT ON COLUMN sessions.device_info IS 'JSON: device_id, os, os_version, app_version, model, manufacturer, brand';
--COMMENT ON COLUMN sessions.actor_id IS 'volunteers.id when actor_type=volunteer; users.id when actor_type=user; admins.id when actor_type=admin';
