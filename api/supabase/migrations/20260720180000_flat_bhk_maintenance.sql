-- BHK type and per-flat maintenance for variable billing by unit size.

ALTER TABLE flats
  ADD COLUMN IF NOT EXISTS bhk_type VARCHAR(16),
  ADD COLUMN IF NOT EXISTS maintenance_amount NUMERIC(14, 2);

COMMENT ON COLUMN flats.bhk_type IS 'ONE_BHK | TWO_BHK | THREE_BHK';
COMMENT ON COLUMN flats.maintenance_amount IS 'Monthly maintenance charged for this flat when generating invoices';

ALTER TABLE society_settings
  ADD COLUMN IF NOT EXISTS maintenance_amount_1_bhk NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maintenance_amount_2_bhk NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maintenance_amount_3_bhk NUMERIC(14, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN society_settings.maintenance_amount_1_bhk IS 'Default monthly maintenance for 1 BHK flats';
COMMENT ON COLUMN society_settings.maintenance_amount_2_bhk IS 'Default monthly maintenance for 2 BHK flats';
COMMENT ON COLUMN society_settings.maintenance_amount_3_bhk IS 'Default monthly maintenance for 3 BHK flats';
