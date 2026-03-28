-- Allow roadside shops without a building anchor
-- Adds location type + optional road/shopfront fields.

ALTER TABLE shops
  ALTER COLUMN building_id DROP NOT NULL;

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS location_type TEXT NOT NULL DEFAULT 'building';

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS road_name TEXT,
  ADD COLUMN IF NOT EXISTS shopfront_name TEXT,
  ADD COLUMN IF NOT EXISTS landmark TEXT,
  ADD COLUMN IF NOT EXISTS full_address TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shops_location_type_check'
  ) THEN
    ALTER TABLE shops
      ADD CONSTRAINT shops_location_type_check
      CHECK (location_type IN ('building', 'road'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shops_location_building_required_for_building_type'
  ) THEN
    ALTER TABLE shops
      ADD CONSTRAINT shops_location_building_required_for_building_type
      CHECK (location_type = 'road' OR building_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shops_location_type ON shops(location_type);

