-- 06_partitioned_ledgers.sql
-- RANGE partitions for high-volume tables.
-- NOTE: Create parent tables matching Prisma, then attach partitions.
-- Run after base tables exist (or create parents here first).

-- Helper: create monthly partitions for a year
CREATE OR REPLACE FUNCTION app.ensure_month_partitions(
  p_parent regclass,
  p_year int,
  p_ts_column text DEFAULT 'created_at'
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  m int;
  start_ts timestamptz;
  end_ts timestamptz;
  part_name text;
  parent_name text := p_parent::text;
BEGIN
  FOR m IN 1..12 LOOP
    start_ts := make_timestamptz(p_year, m, 1, 0, 0, 0, 'UTC');
    end_ts := start_ts + interval '1 month';
    part_name := format('%s_y%sm%s', replace(parent_name, '.', '_'), p_year, lpad(m::text, 2, '0'));
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF %s FOR VALUES FROM (%L) TO (%L)',
      part_name, parent_name, start_ts, end_ts
    );
  END LOOP;
END;
$$;

-- Example attachment after converting tables to partitioned:
-- ALTER TABLE payments RENAME TO payments_legacy;
-- CREATE TABLE payments (LIKE payments_legacy INCLUDING ALL) PARTITION BY RANGE (created_at);
-- SELECT app.ensure_month_partitions('payments', 2026);
-- SELECT app.ensure_month_partitions('payment_transactions', 2026);
-- SELECT app.ensure_month_partitions('payment_webhooks', 2026);  -- use received_at
-- SELECT app.ensure_month_partitions('audit_logs', 2026);
-- SELECT app.ensure_month_partitions('activity_logs', 2026);
-- SELECT app.ensure_month_partitions('notifications', 2026);

-- Default partition catch-all
-- CREATE TABLE IF NOT EXISTS payments_default PARTITION OF payments DEFAULT;
