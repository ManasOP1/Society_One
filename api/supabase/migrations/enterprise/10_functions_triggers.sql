-- 10_functions_triggers.sql
-- Billing, numbering, audit, invoice totals, notifications

-- Atomic invoice number: PREFIX-YYYY-####
CREATE OR REPLACE FUNCTION app.next_document_number(
  p_tenant_id uuid,
  p_society_id uuid,
  p_seq_type text,
  p_year int,
  p_prefix text
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_next int;
BEGIN
  INSERT INTO number_sequences (id, tenant_id, society_id, seq_type, year, next_value, updated_at)
  VALUES (gen_random_uuid(), p_tenant_id, p_society_id, p_seq_type, p_year, 2, now())
  ON CONFLICT (society_id, seq_type, year)
  DO UPDATE SET next_value = number_sequences.next_value + 1, updated_at = now()
  RETURNING next_value - 1 INTO v_next;

  IF v_next IS NULL THEN
    SELECT next_value - 1 INTO v_next FROM number_sequences
    WHERE society_id = p_society_id AND seq_type = p_seq_type AND year = p_year;
  END IF;

  RETURN p_prefix || '-' || p_year::text || '-' || lpad(v_next::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION app.generate_invoice_number(
  p_tenant_id uuid, p_society_id uuid, p_year int
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE v_prefix text;
BEGIN
  SELECT invoice_prefix INTO v_prefix FROM society_settings WHERE society_id = p_society_id;
  RETURN app.next_document_number(p_tenant_id, p_society_id, 'INVOICE', p_year, COALESCE(v_prefix, 'INV'));
END;
$$;

CREATE OR REPLACE FUNCTION app.generate_receipt_number(
  p_tenant_id uuid, p_society_id uuid, p_year int
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE v_prefix text;
BEGIN
  SELECT receipt_prefix INTO v_prefix FROM society_settings WHERE society_id = p_society_id;
  RETURN app.next_document_number(p_tenant_id, p_society_id, 'RECEIPT', p_year, COALESCE(v_prefix, 'REC'));
END;
$$;

-- Outstanding = total - paid (clamp)
CREATE OR REPLACE FUNCTION app.recalc_invoice_totals() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_sum numeric(14,2);
BEGIN
  IF TG_TABLE_NAME = 'invoice_lines' THEN
    SELECT COALESCE(SUM(CASE WHEN is_deduction THEN -amount ELSE amount END), 0)
      INTO v_sum FROM invoice_lines WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

    UPDATE invoices SET
      maintenance_subtotal = v_sum,
      total_amount = v_sum + arrears_subtotal + late_fee + previous_outstanding - advance,
      outstanding = GREATEST(
        (v_sum + arrears_subtotal + late_fee + previous_outstanding - advance) - paid_amount,
        0
      ),
      updated_at = now()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- invoices row update of paid_amount
  NEW.outstanding := GREATEST(NEW.total_amount - NEW.paid_amount, 0);
  IF NEW.paid_amount <= 0 THEN
    NEW.status_code := CASE WHEN NEW.status_code = 'CANCELLED' THEN 'CANCELLED'
      WHEN NEW.due_date < CURRENT_DATE THEN 'OVERDUE' ELSE 'PENDING' END;
  ELSIF NEW.paid_amount >= NEW.total_amount THEN
    NEW.status_code := 'PAID';
  ELSE
    NEW.status_code := 'PARTIAL';
  END IF;
  RETURN NEW;
END;
$$;

-- Penalty for overdue
CREATE OR REPLACE FUNCTION app.calculate_penalty(
  p_society_id uuid,
  p_due_date date,
  p_outstanding numeric
) RETURNS numeric
LANGUAGE plpgsql STABLE AS $$
DECLARE v_fee numeric(14,2);
BEGIN
  IF p_outstanding <= 0 OR p_due_date >= CURRENT_DATE THEN
    RETURN 0;
  END IF;
  SELECT late_fee_amount INTO v_fee FROM society_settings WHERE society_id = p_society_id;
  RETURN COALESCE(v_fee, 0);
END;
$$;

-- Outstanding for member
CREATE OR REPLACE FUNCTION app.member_outstanding(p_member_id uuid)
RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(outstanding), 0)
  FROM invoices
  WHERE member_id = p_member_id
    AND deleted_at IS NULL
    AND status_code NOT IN ('CANCELLED', 'PAID');
$$;

-- Monthly bill generation (set-based; Nest/BullMQ may call per society)
CREATE OR REPLACE FUNCTION app.generate_monthly_bills(
  p_tenant_id uuid,
  p_society_id uuid,
  p_billing_month text -- YYYY-MM
) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_year int := split_part(p_billing_month, '-', 1)::int;
  v_month int := split_part(p_billing_month, '-', 2)::int;
  v_due_day int;
  v_settings society_settings%ROWTYPE;
  v_count int := 0;
  r record;
  v_inv_id uuid;
  v_inv_no text;
  v_total numeric(14,2);
  v_due date;
BEGIN
  SELECT * INTO v_settings FROM society_settings WHERE society_id = p_society_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'society_settings missing'; END IF;
  v_due_day := LEAST(GREATEST(v_settings.due_day, 1), 28);
  v_due := make_date(v_year, v_month, v_due_day);

  FOR r IN
    SELECT m.id AS member_id, mf.flat_id
    FROM members m
    LEFT JOIN LATERAL (
      SELECT flat_id FROM member_flats
      WHERE member_id = m.id AND deleted_at IS NULL AND is_primary
      ORDER BY valid_from DESC LIMIT 1
    ) mf ON true
    WHERE m.society_id = p_society_id AND m.is_active AND m.deleted_at IS NULL
  LOOP
    IF EXISTS (
      SELECT 1 FROM invoices
      WHERE society_id = p_society_id AND member_id = r.member_id
        AND billing_month = p_billing_month AND deleted_at IS NULL
    ) THEN
      CONTINUE;
    END IF;

    v_total := COALESCE(v_settings.maintenance_amount, 0)
      + COALESCE(v_settings.municipal_dues, 0)
      + COALESCE(v_settings.admin_expenses, 0)
      + COALESCE(v_settings.sinking_funds, 0)
      + COALESCE(v_settings.building_maintenance, 0)
      + COALESCE(v_settings.parking_charges, 0)
      + COALESCE(v_settings.non_occupancy_charges, 0);

    v_inv_id := gen_random_uuid();
    v_inv_no := app.generate_invoice_number(p_tenant_id, p_society_id, v_year);

    INSERT INTO invoices (
      id, tenant_id, society_id, member_id, flat_id, invoice_no, billing_month, year,
      issue_date, due_date, maintenance_subtotal, arrears_subtotal, late_fee,
      previous_outstanding, advance, total_amount, paid_amount, outstanding, status_code
    ) VALUES (
      v_inv_id, p_tenant_id, p_society_id, r.member_id, r.flat_id, v_inv_no, p_billing_month, v_year,
      make_date(v_year, v_month, 1), v_due, v_total, 0, 0,
      app.member_outstanding(r.member_id), 0, v_total + app.member_outstanding(r.member_id),
      0, v_total + app.member_outstanding(r.member_id), 'PENDING'
    );

    INSERT INTO invoice_lines (id, tenant_id, society_id, invoice_id, line_no, code, description, amount)
    SELECT gen_random_uuid(), p_tenant_id, p_society_id, v_inv_id, 1, 'MAINT', 'Maintenance Charges', v_settings.maintenance_amount
    WHERE v_settings.maintenance_amount > 0;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Generic audit writer
CREATE OR REPLACE FUNCTION app.write_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_logs (
    id, tenant_id, society_id, actor_id, action, entity_type, entity_id, details, created_at
  ) VALUES (
    gen_random_uuid(),
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.society_id, OLD.society_id),
    app.current_user_id(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    left(row_to_json(COALESCE(NEW, OLD))::text, 2000),
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- On payment CAPTURED → ensure receipt stub (service may fill PDF later)
CREATE OR REPLACE FUNCTION app.on_payment_status_update() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_receipt_no text;
  v_year int;
BEGIN
  IF NEW.status_code = 'CAPTURED' AND (OLD.status_code IS DISTINCT FROM 'CAPTURED') THEN
    INSERT INTO payment_transactions (
      id, tenant_id, society_id, payment_id, event_type, amount, status_code, created_at
    ) VALUES (
      gen_random_uuid(), NEW.tenant_id, NEW.society_id, NEW.id,
      'STATUS_CAPTURED', NEW.amount, 'CAPTURED', now()
    );

    IF NOT EXISTS (SELECT 1 FROM receipts WHERE payment_id = NEW.id) THEN
      v_year := EXTRACT(YEAR FROM COALESCE(NEW.paid_at, now()))::int;
      v_receipt_no := app.generate_receipt_number(NEW.tenant_id, NEW.society_id, v_year);
      INSERT INTO receipts (
        id, tenant_id, society_id, invoice_id, payment_id, member_id, receipt_no,
        amount, late_fee, total_paid, payment_date, mode_code, billing_month
      )
      SELECT gen_random_uuid(), NEW.tenant_id, NEW.society_id, NEW.invoice_id, NEW.id, NEW.member_id,
             v_receipt_no, NEW.amount, 0, NEW.amount, CURRENT_DATE, NEW.mode_code, i.billing_month
      FROM invoices i WHERE i.id = NEW.invoice_id;

      UPDATE invoices SET
        paid_amount = paid_amount + NEW.amount,
        updated_at = now()
      WHERE id = NEW.invoice_id;
    END IF;

    INSERT INTO notifications (
      id, tenant_id, society_id, channel_code, recipient, subject, body, status_code, created_at
    )
    SELECT gen_random_uuid(), NEW.tenant_id, NEW.society_id, 'WHATSAPP',
           COALESCE(m.phone, m.email, 'unknown'),
           'Payment received',
           'Payment of ' || NEW.amount::text || ' captured for invoice.',
           'QUEUED', now()
    FROM members m WHERE m.id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach updated_at triggers (call after tables exist)
-- CREATE TRIGGER trg_societies_updated BEFORE UPDATE ON societies
--   FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
-- Repeat for all tables with updated_at.
