-- Society gate QR + extended visitor check-in fields (QR form → visitors table).

ALTER TABLE societies
  ADD COLUMN IF NOT EXISTS gate_qr_token varchar(64),
  ADD COLUMN IF NOT EXISTS gate_qr_generated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ux_societies_gate_qr_token
  ON societies (gate_qr_token)
  WHERE gate_qr_token IS NOT NULL;

ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS flat_id uuid,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS visit_type varchar(64),
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS wing_code varchar(16),
  ADD COLUMN IF NOT EXISTS flat_no varchar(32),
  ADD COLUMN IF NOT EXISTS vehicle_type varchar(32),
  ADD COLUMN IF NOT EXISTS vehicle_no varchar(32),
  ADD COLUMN IF NOT EXISTS pass_number varchar(32),
  ADD COLUMN IF NOT EXISTS check_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS device_id varchar(128);

DO $$ BEGIN
  ALTER TABLE visitors
    ADD CONSTRAINT visitors_flat_id_fkey
    FOREIGN KEY (flat_id) REFERENCES flats(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS ix_visitors_society_flat_created
  ON visitors (society_id, flat_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_visitors_society_wing_flat
  ON visitors (society_id, wing_code, flat_no)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_visitors_society_pass_number
  ON visitors (society_id, pass_number)
  WHERE pass_number IS NOT NULL;
