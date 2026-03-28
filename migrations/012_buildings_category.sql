-- Building type/category: residential, commercial, hospital, school, etc.
ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN buildings.category IS 'e.g. Residential, Commercial, Hospital, School, Government, Other';
