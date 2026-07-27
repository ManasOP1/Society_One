-- MyGate-aligned pillars: Gate security, Helpdesk/Amenities, Polls, Ledger/Tax
-- Idempotent — safe to re-run. Tuned for hot-path OTP/QR + open-alert lookups.

-- ─── Extend existing visitors / complaints ───────────────────────────
ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS pass_id uuid,
  ADD COLUMN IF NOT EXISTS category_code varchar(32) NOT NULL DEFAULT 'GUEST',
  ADD COLUMN IF NOT EXISTS entry_at timestamptz,
  ADD COLUMN IF NOT EXISTS exit_at timestamptz;

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS assigned_to_id uuid;

CREATE INDEX IF NOT EXISTS ix_visitors_society_status_entry
  ON visitors (society_id, status_code, entry_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_complaints_assigned_open
  ON complaints (society_id, assigned_to_id, status_code)
  WHERE deleted_at IS NULL AND status_code NOT IN ('RESOLVED', 'REJECTED');

-- ─── Visitor passes (pre-approve OTP / QR) ───────────────────────────
CREATE TABLE IF NOT EXISTS visitor_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  flat_id uuid REFERENCES flats(id) ON DELETE SET NULL,
  category_code varchar(32) NOT NULL DEFAULT 'GUEST',
  guest_name text NOT NULL,
  guest_phone text,
  vehicle_no text,
  pass_code varchar(12) NOT NULL,
  qr_token text NOT NULL UNIQUE,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  max_entries int NOT NULL DEFAULT 1,
  entries_used int NOT NULL DEFAULT 0,
  status_code varchar(32) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (society_id, pass_code)
);

-- Guard OTP scan: equality on society + code among active, non-expired
CREATE INDEX IF NOT EXISTS ix_visitor_passes_active_lookup
  ON visitor_passes (society_id, pass_code)
  WHERE deleted_at IS NULL AND status_code = 'ACTIVE';

CREATE INDEX IF NOT EXISTS ix_visitor_passes_valid_until
  ON visitor_passes (society_id, status_code, valid_until)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_visitor_passes_member
  ON visitor_passes (society_id, member_id, created_at DESC);

-- ─── Append-only gate events (denormalized for list speed) ───────────
CREATE TABLE IF NOT EXISTS gate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE RESTRICT,
  pass_id uuid REFERENCES visitor_passes(id) ON DELETE SET NULL,
  visitor_id uuid,
  staff_id uuid,
  event_type varchar(32) NOT NULL,
  category_code varchar(32),
  actor_user_id uuid,
  flat_label text,
  person_name text,
  vehicle_no text,
  photo_url text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_gate_events_society_created
  ON gate_events (society_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_gate_events_society_type
  ON gate_events (society_id, event_type, created_at DESC);

-- BRIN for large time-series scans (cheap, fast range)
CREATE INDEX IF NOT EXISTS brin_gate_events_created
  ON gate_events USING BRIN (created_at);

-- ─── Staff roster + attendance ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE RESTRICT,
  flat_id uuid REFERENCES flats(id) ON DELETE SET NULL,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  role_code varchar(32) NOT NULL,
  id_proof_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_staff_society_active
  ON staff_profiles (society_id, is_active, role_code)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS staff_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE RESTRICT,
  check_in_at timestamptz NOT NULL,
  check_out_at timestamptz,
  gate_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_staff_attendance_society
  ON staff_attendance (society_id, check_in_at DESC);

CREATE INDEX IF NOT EXISTS ix_staff_attendance_open
  ON staff_attendance (staff_id, check_in_at DESC)
  WHERE check_out_at IS NULL;

ALTER TABLE gate_events
  DROP CONSTRAINT IF EXISTS gate_events_staff_id_fkey;
ALTER TABLE gate_events
  ADD CONSTRAINT gate_events_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE SET NULL;

-- ─── Panic alerts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS panic_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  flat_label text NOT NULL,
  message text,
  status_code varchar(32) NOT NULL DEFAULT 'OPEN',
  acked_by_id uuid,
  acked_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_panic_open
  ON panic_alerts (society_id, created_at DESC)
  WHERE status_code = 'OPEN';

CREATE INDEX IF NOT EXISTS ix_panic_society_status
  ON panic_alerts (society_id, status_code, created_at DESC);

-- ─── Complaint assignment history ────────────────────────────────────
CREATE TABLE IF NOT EXISTS complaint_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE RESTRICT,
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE RESTRICT,
  event_type varchar(32) NOT NULL,
  from_status varchar(32),
  to_status varchar(32),
  assigned_to_id uuid,
  note text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_complaint_events_complaint
  ON complaint_events (complaint_id, created_at);

-- ─── Amenities + bookings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE RESTRICT,
  code varchar(64) NOT NULL,
  name text NOT NULL,
  description text,
  location text,
  capacity int,
  hourly_charge numeric(14,2) NOT NULL DEFAULT 0,
  slot_minutes int NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (society_id, code)
);

CREATE TABLE IF NOT EXISTS amenity_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE RESTRICT,
  amenity_id uuid NOT NULL REFERENCES amenities(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  flat_id uuid REFERENCES flats(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  charge_amount numeric(14,2) NOT NULL DEFAULT 0,
  status_code varchar(32) NOT NULL DEFAULT 'CONFIRMED',
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (ends_at > starts_at)
);

-- Overlap search: bookings for amenity in a time window
CREATE INDEX IF NOT EXISTS ix_amenity_bookings_range
  ON amenity_bookings (amenity_id, starts_at, ends_at)
  WHERE deleted_at IS NULL AND status_code IN ('PENDING', 'CONFIRMED');

CREATE INDEX IF NOT EXISTS ix_amenity_bookings_member
  ON amenity_bookings (society_id, member_id, starts_at DESC);

-- ─── Democratic polls ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  status_code varchar(32) NOT NULL DEFAULT 'OPEN',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  vote_mode varchar(16) NOT NULL DEFAULT 'ONE',
  created_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_polls_society_status
  ON polls (society_id, status_code, ends_at)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  vote_count int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_poll_options_poll ON poll_options (poll_id, sort_order);

CREATE TABLE IF NOT EXISTS poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, member_id, option_id)
);

CREATE INDEX IF NOT EXISTS ix_poll_votes_member ON poll_votes (poll_id, member_id);

-- ─── Double-entry ledger + tax logs ──────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE RESTRICT,
  code varchar(32) NOT NULL,
  name text NOT NULL,
  type_code varchar(16) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (society_id, code)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE RESTRICT,
  entry_date date NOT NULL,
  memo text,
  source_type varchar(32) NOT NULL,
  source_id uuid,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  created_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ledger_entries_society_date
  ON ledger_entries (society_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS ix_ledger_entries_source
  ON ledger_entries (society_id, source_type, source_id);

CREATE TABLE IF NOT EXISTS ledger_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES ledger_entries(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0,
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX IF NOT EXISTS ix_ledger_lines_account ON ledger_lines (account_id);
CREATE INDEX IF NOT EXISTS ix_ledger_lines_entry ON ledger_lines (entry_id);

CREATE TABLE IF NOT EXISTS tax_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE RESTRICT,
  tax_type varchar(16) NOT NULL,
  period_month varchar(7) NOT NULL,
  taxable_amount numeric(14,2) NOT NULL,
  tax_amount numeric(14,2) NOT NULL,
  reference_no text,
  source_type varchar(32),
  source_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_tax_logs_period
  ON tax_logs (society_id, tax_type, period_month);

-- Link visitors.pass_id if not already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visitors_pass_id_fkey'
  ) THEN
    ALTER TABLE visitors
      ADD CONSTRAINT visitors_pass_id_fkey
      FOREIGN KEY (pass_id) REFERENCES visitor_passes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Fast validate pass by OTP (guard app)
CREATE OR REPLACE FUNCTION app.validate_visitor_pass(
  p_society_id uuid,
  p_pass_code text
) RETURNS visitor_passes
LANGUAGE plpgsql AS $$
DECLARE
  v visitor_passes%ROWTYPE;
BEGIN
  SELECT * INTO v
  FROM visitor_passes
  WHERE society_id = p_society_id
    AND pass_code = p_pass_code
    AND deleted_at IS NULL
    AND status_code = 'ACTIVE'
    AND valid_from <= now()
    AND valid_until >= now()
    AND entries_used < max_entries
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_PASS' USING ERRCODE = 'P0002';
  END IF;

  UPDATE visitor_passes
  SET entries_used = entries_used + 1,
      status_code = CASE WHEN entries_used + 1 >= max_entries THEN 'USED' ELSE status_code END,
      updated_at = now()
  WHERE id = v.id
  RETURNING * INTO v;

  RETURN v;
END;
$$;

ANALYZE visitor_passes;
ANALYZE gate_events;
ANALYZE panic_alerts;
ANALYZE amenity_bookings;
