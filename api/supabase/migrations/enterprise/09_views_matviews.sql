-- 09_views_matviews.sql
-- SQL views + materialized views for dashboards/reports

CREATE OR REPLACE VIEW v_invoice_details AS
SELECT
  i.id,
  i.tenant_id,
  i.society_id,
  i.invoice_no,
  i.billing_month,
  i.issue_date,
  i.due_date,
  i.total_amount,
  i.paid_amount,
  i.outstanding,
  i.status_code,
  i.pdf_url,
  m.owner_name AS resident_name,
  m.email AS resident_email,
  m.phone AS resident_phone,
  f.flat_no,
  w.code AS wing_code,
  s.name AS society_name
FROM invoices i
JOIN members m ON m.id = i.member_id
JOIN societies s ON s.id = i.society_id
LEFT JOIN flats f ON f.id = i.flat_id
LEFT JOIN wings w ON w.id = f.wing_id
WHERE i.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_resident_details AS
SELECT
  m.id AS member_id,
  m.tenant_id,
  m.society_id,
  m.owner_name,
  m.email,
  m.phone,
  m.is_active,
  f.flat_no,
  w.code AS wing_code,
  f.parking,
  app.member_outstanding(m.id) AS outstanding_total,
  s.name AS society_name
FROM members m
JOIN societies s ON s.id = m.society_id
LEFT JOIN LATERAL (
  SELECT mf.flat_id
  FROM member_flats mf
  WHERE mf.member_id = m.id AND mf.deleted_at IS NULL AND mf.is_primary
  ORDER BY mf.valid_from DESC
  LIMIT 1
) pmf ON true
LEFT JOIN flats f ON f.id = pmf.flat_id
LEFT JOIN wings w ON w.id = f.wing_id
WHERE m.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_payment_details AS
SELECT
  p.id,
  p.tenant_id,
  p.society_id,
  p.amount,
  p.currency,
  p.mode_code,
  p.status_code,
  p.razorpay_order_id,
  p.razorpay_payment_id,
  p.paid_at,
  p.created_at,
  i.invoice_no,
  i.billing_month,
  m.owner_name AS resident_name,
  r.receipt_no,
  r.pdf_url AS receipt_pdf_url
FROM payments p
JOIN invoices i ON i.id = p.invoice_id
JOIN members m ON m.id = p.member_id
LEFT JOIN receipts r ON r.payment_id = p.id
WHERE p.deleted_at IS NULL;

-- Materialized views (REFRESH CONCURRENTLY requires unique index)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_summary AS
SELECT
  s.tenant_id,
  s.id AS society_id,
  COALESCE(SUM(i.outstanding) FILTER (WHERE i.status_code NOT IN ('CANCELLED', 'PAID') AND i.deleted_at IS NULL), 0) AS outstanding_total,
  COUNT(*) FILTER (WHERE i.status_code NOT IN ('CANCELLED', 'PAID') AND i.outstanding > 0 AND i.deleted_at IS NULL) AS pending_invoices,
  COUNT(*) FILTER (WHERE p.status_code = 'CAPTURED' AND p.created_at::date = CURRENT_DATE) AS payments_today,
  COUNT(*) FILTER (WHERE v.created_at::date = CURRENT_DATE AND v.deleted_at IS NULL) AS visitors_today
FROM societies s
LEFT JOIN invoices i ON i.society_id = s.id
LEFT JOIN payments p ON p.society_id = s.id
LEFT JOIN visitors v ON v.society_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY s.tenant_id, s.id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_dashboard_summary ON mv_dashboard_summary (society_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_collection AS
SELECT
  i.tenant_id,
  i.society_id,
  i.billing_month,
  SUM(i.total_amount) AS billed_amount,
  SUM(i.paid_amount) AS collected_amount,
  SUM(i.outstanding) AS outstanding_amount,
  CASE WHEN SUM(i.total_amount) > 0
    THEN ROUND(SUM(i.paid_amount) / SUM(i.total_amount), 4)
    ELSE 0 END AS collection_pct
FROM invoices i
WHERE i.deleted_at IS NULL AND i.status_code <> 'CANCELLED'
GROUP BY i.tenant_id, i.society_id, i.billing_month;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_monthly_collection
  ON mv_monthly_collection (society_id, billing_month);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_outstanding_report AS
SELECT
  i.tenant_id,
  i.society_id,
  i.member_id,
  m.owner_name,
  i.invoice_no,
  i.billing_month,
  i.due_date,
  i.outstanding,
  i.status_code,
  CURRENT_DATE - i.due_date AS days_overdue
FROM invoices i
JOIN members m ON m.id = i.member_id
WHERE i.deleted_at IS NULL
  AND i.outstanding > 0
  AND i.status_code NOT IN ('CANCELLED', 'PAID');

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_outstanding_report ON mv_outstanding_report (society_id, invoice_no);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_resident_summary AS
SELECT
  m.tenant_id,
  m.society_id,
  m.id AS member_id,
  m.owner_name,
  COUNT(i.id) FILTER (WHERE i.status_code <> 'CANCELLED') AS invoice_count,
  COALESCE(SUM(i.outstanding) FILTER (WHERE i.status_code NOT IN ('CANCELLED', 'PAID')), 0) AS outstanding_total,
  COALESCE(SUM(i.paid_amount), 0) AS lifetime_paid,
  MAX(r.payment_date) AS last_payment_date
FROM members m
LEFT JOIN invoices i ON i.member_id = m.id AND i.deleted_at IS NULL
LEFT JOIN receipts r ON r.member_id = m.id AND r.deleted_at IS NULL
WHERE m.deleted_at IS NULL
GROUP BY m.tenant_id, m.society_id, m.id, m.owner_name;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_resident_summary ON mv_resident_summary (society_id, member_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_payment_summary AS
SELECT
  p.tenant_id,
  p.society_id,
  date_trunc('day', p.created_at)::date AS payment_day,
  p.status_code,
  p.mode_code,
  COUNT(*) AS payment_count,
  SUM(p.amount) AS amount_sum
FROM payments p
WHERE p.deleted_at IS NULL
GROUP BY p.tenant_id, p.society_id, date_trunc('day', p.created_at)::date, p.status_code, p.mode_code;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_payment_summary
  ON mv_payment_summary (society_id, payment_day, status_code, mode_code);

-- Refresh helper (BullMQ cron)
CREATE OR REPLACE FUNCTION app.refresh_reporting_matviews() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_collection;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_outstanding_report;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_resident_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_payment_summary;
END;
$$;
