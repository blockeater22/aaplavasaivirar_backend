-- Track which volunteer added each shop (Mission Control stats: shops listed, buildings touched)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS created_by_volunteer_id UUID REFERENCES volunteers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_shops_created_by_volunteer ON shops(created_by_volunteer_id);

COMMENT ON COLUMN shops.created_by_volunteer_id IS 'Volunteer who created this listing via Add Shop';
