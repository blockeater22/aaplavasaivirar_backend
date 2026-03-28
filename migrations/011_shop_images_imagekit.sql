-- ImageKit: store one URL per image; small/medium/large served via URL transforms
ALTER TABLE shop_images ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE shop_images ALTER COLUMN image_id_small DROP NOT NULL;
ALTER TABLE shop_images ALTER COLUMN image_id_medium DROP NOT NULL;
ALTER TABLE shop_images ALTER COLUMN image_id_large DROP NOT NULL;
