-- Buildings: physical structures in VVMC
CREATE TABLE IF NOT EXISTS buildings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  address    TEXT NOT NULL,
  city       TEXT NOT NULL,
  state      TEXT NOT NULL,
  pincode    TEXT NOT NULL,
  country    TEXT NOT NULL,
  coordinates GEOMETRY(Point, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buildings_coordinates ON buildings USING GIST (coordinates);

-- Shops: ground-floor businesses (hyper-local, 50m accuracy)
CREATE TABLE IF NOT EXISTS shops (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id       UUID NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
  name              TEXT NOT NULL,
  shop_number       TEXT NOT NULL,
  category          TEXT NOT NULL,
  phone             TEXT NOT NULL,
  coordinates       GEOMETRY(Point, 4326) NOT NULL,
  is_verified       BOOLEAN NOT NULL DEFAULT false,
  verified_at       TIMESTAMPTZ,
  owner_claimed_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shops_building_id ON shops(building_id);
CREATE INDEX IF NOT EXISTS idx_shops_coordinates ON shops USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS idx_shops_phone ON shops(phone);
CREATE INDEX IF NOT EXISTS idx_shops_is_verified ON shops(is_verified);
