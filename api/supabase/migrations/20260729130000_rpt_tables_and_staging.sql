-- Methods: #1 #6 #16 #30
-- Staging for bulk member import; job-maintained rpt_* summary tables.
-- Matviews live in enterprise/09_views_matviews.sql — refresh via app.refresh_reporting_matviews().

CREATE TABLE IF NOT EXISTS rpt_society_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  society_id uuid NOT NULL,
  report_date date NOT NULL,
  invoices_issued int NOT NULL DEFAULT 0,
  collected_amount numeric(14, 2) NOT NULL DEFAULT 0,
  outstanding_amount numeric(14, 2) NOT NULL DEFAULT 0,
  payments_count int NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (society_id, report_date)
);

CREATE INDEX IF NOT EXISTS ix_rpt_society_daily_tenant_society_date
  ON rpt_society_daily (tenant_id, society_id, report_date);

CREATE TABLE IF NOT EXISTS rpt_society_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  society_id uuid NOT NULL,
  billing_month varchar(7) NOT NULL,
  billed_amount numeric(14, 2) NOT NULL DEFAULT 0,
  collected_amount numeric(14, 2) NOT NULL DEFAULT 0,
  outstanding_amount numeric(14, 2) NOT NULL DEFAULT 0,
  collection_pct numeric(7, 4) NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (society_id, billing_month)
);

CREATE INDEX IF NOT EXISTS ix_rpt_society_monthly_tenant_society_month
  ON rpt_society_monthly (tenant_id, society_id, billing_month);

-- Staging/temp for bulk member import (hot UI stays off this table). Method #1
CREATE TABLE IF NOT EXISTS stg_member_import (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  society_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  row_no int NOT NULL,
  owner_name text NOT NULL,
  email citext NOT NULL,
  phone text,
  password text NOT NULL,
  wing text NOT NULL,
  flat_no text NOT NULL,
  area_sqft numeric(10, 2),
  bhk_type varchar(16),
  parking text,
  maintenance_amount numeric(14, 2),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_stg_member_import_job
  ON stg_member_import (job_id, row_no);

CREATE INDEX IF NOT EXISTS ix_stg_member_import_society
  ON stg_member_import (society_id, job_id);
