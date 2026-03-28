-- Shop images: 2–5 images per shop, each with small / medium / large (Cloudflare)
CREATE TABLE IF NOT EXISTS shop_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  image_id_small  TEXT NOT NULL,
  image_id_medium TEXT NOT NULL,
  image_id_large  TEXT NOT NULL,
  position        INT NOT NULL DEFAULT 1 CHECK (position >= 1 AND position <= 5),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, position)
);

CREATE INDEX IF NOT EXISTS idx_shop_images_shop ON shop_images(shop_id);
