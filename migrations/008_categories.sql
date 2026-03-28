-- Categories: single source of truth for shop types (Medical, Salon, Fruits, etc.)
-- Makes adding new categories easy (admin or API) without touching shop schema
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active_order ON categories(is_active, display_order) WHERE is_active = true;

-- Seed common categories (easy to extend)
INSERT INTO categories (name, slug, display_order) VALUES
  ('Medical', 'medical', 1),
  ('Salon', 'salon', 2),
  ('Fruits', 'fruits', 3),
  ('Vegetables', 'vegetables', 4),
  ('General Store', 'general-store', 5),
  ('Kirana', 'kirana', 6),
  ('Bakery', 'bakery', 7),
  ('Restaurant', 'restaurant', 8),
  ('Pharmacy', 'pharmacy', 9),
  ('Hardware', 'hardware', 10),
  ('Electronics', 'electronics', 11),
  ('Tailor', 'tailor', 12),
  ('Plumber', 'plumber', 13),
  ('Electrician', 'electrician', 14),
  ('Other', 'other', 99)
ON CONFLICT (slug) DO NOTHING;

-- Link shops to categories (keep existing category text column for backward compatibility / display)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_shops_category_id ON shops(category_id);
