-- Waitlist: sub-region vs area, building name (anchor), free-text when category = other
ALTER TABLE whitelist_signups
  ADD COLUMN IF NOT EXISTS building_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sub_region TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category_other TEXT;

COMMENT ON COLUMN whitelist_signups.building_name IS 'Society / tower / building — primary map anchor';
COMMENT ON COLUMN whitelist_signups.sub_region IS 'Micro-area, e.g. Samelpada';
COMMENT ON COLUMN whitelist_signups.category_other IS 'Required when category = other';
