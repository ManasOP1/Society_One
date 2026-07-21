-- 11_rls_policies.sql
-- Enable RLS on society-scoped tables. Nest must SET LOCAL app.* per request/tx.

ALTER TABLE societies ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE flats ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE society_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE society_settings ENABLE ROW LEVEL SECURITY;

-- SUPER_ADMIN: full access
CREATE POLICY super_admin_all_societies ON societies
  FOR ALL USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

CREATE POLICY super_admin_all_invoices ON invoices
  FOR ALL USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

CREATE POLICY super_admin_all_payments ON payments
  FOR ALL USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

CREATE POLICY super_admin_all_receipts ON receipts
  FOR ALL USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

CREATE POLICY super_admin_all_members ON members
  FOR ALL USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

CREATE POLICY super_admin_all_visitors ON visitors
  FOR ALL USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

CREATE POLICY super_admin_all_complaints ON complaints
  FOR ALL USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

CREATE POLICY super_admin_all_audit ON audit_logs
  FOR ALL USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

-- SOCIETY_ADMIN / COMMITTEE_MEMBER: society scope
CREATE POLICY society_admin_societies ON societies
  FOR SELECT USING (
    app.current_role() IN ('SOCIETY_ADMIN', 'COMMITTEE_MEMBER')
    AND id = app.current_society_id()
    AND tenant_id = app.current_tenant_id()
  );

CREATE POLICY society_admin_members ON members
  FOR ALL USING (
    app.current_role() IN ('SOCIETY_ADMIN', 'COMMITTEE_MEMBER')
    AND society_id = app.current_society_id()
    AND tenant_id = app.current_tenant_id()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    app.current_role() IN ('SOCIETY_ADMIN', 'COMMITTEE_MEMBER')
    AND society_id = app.current_society_id()
    AND tenant_id = app.current_tenant_id()
  );

CREATE POLICY society_admin_invoices ON invoices
  FOR ALL USING (
    app.current_role() IN ('SOCIETY_ADMIN', 'COMMITTEE_MEMBER')
    AND society_id = app.current_society_id()
    AND tenant_id = app.current_tenant_id()
  )
  WITH CHECK (
    app.current_role() IN ('SOCIETY_ADMIN', 'COMMITTEE_MEMBER')
    AND society_id = app.current_society_id()
    AND tenant_id = app.current_tenant_id()
  );

CREATE POLICY society_admin_payments ON payments
  FOR ALL USING (
    app.current_role() IN ('SOCIETY_ADMIN', 'COMMITTEE_MEMBER')
    AND society_id = app.current_society_id()
    AND tenant_id = app.current_tenant_id()
  )
  WITH CHECK (
    app.current_role() IN ('SOCIETY_ADMIN', 'COMMITTEE_MEMBER')
    AND society_id = app.current_society_id()
    AND tenant_id = app.current_tenant_id()
  );

CREATE POLICY society_admin_receipts ON receipts
  FOR SELECT USING (
    app.current_role() IN ('SOCIETY_ADMIN', 'COMMITTEE_MEMBER')
    AND society_id = app.current_society_id()
  );

CREATE POLICY society_admin_settings ON society_settings
  FOR ALL USING (
    app.current_role() = 'SOCIETY_ADMIN'
    AND society_id = app.current_society_id()
  )
  WITH CHECK (
    app.current_role() = 'SOCIETY_ADMIN'
    AND society_id = app.current_society_id()
  );

-- RESIDENT: own member_id only for money; society for notices/events
CREATE POLICY resident_own_invoices ON invoices
  FOR SELECT USING (
    app.current_role() = 'RESIDENT'
    AND society_id = app.current_society_id()
    AND member_id = app.current_member_id()
    AND deleted_at IS NULL
  );

CREATE POLICY resident_own_payments ON payments
  FOR SELECT USING (
    app.current_role() = 'RESIDENT'
    AND society_id = app.current_society_id()
    AND member_id = app.current_member_id()
  );

CREATE POLICY resident_own_receipts ON receipts
  FOR SELECT USING (
    app.current_role() = 'RESIDENT'
    AND society_id = app.current_society_id()
    AND member_id = app.current_member_id()
  );

CREATE POLICY resident_own_complaints ON complaints
  FOR ALL USING (
    app.current_role() = 'RESIDENT'
    AND society_id = app.current_society_id()
    AND member_id = app.current_member_id()
  )
  WITH CHECK (
    app.current_role() = 'RESIDENT'
    AND society_id = app.current_society_id()
    AND member_id = app.current_member_id()
  );

CREATE POLICY resident_society_notices ON notices
  FOR SELECT USING (
    app.current_role() IN ('RESIDENT', 'SOCIETY_ADMIN', 'COMMITTEE_MEMBER', 'SECURITY_GUARD')
    AND society_id = app.current_society_id()
    AND deleted_at IS NULL
  );

CREATE POLICY resident_society_events ON society_events
  FOR SELECT USING (
    app.current_role() IN ('RESIDENT', 'SOCIETY_ADMIN', 'COMMITTEE_MEMBER')
    AND society_id = app.current_society_id()
    AND deleted_at IS NULL
  );

-- SECURITY_GUARD: visitors only within society
CREATE POLICY guard_visitors ON visitors
  FOR ALL USING (
    app.current_role() IN ('SECURITY_GUARD', 'SOCIETY_ADMIN')
    AND society_id = app.current_society_id()
    AND tenant_id = app.current_tenant_id()
  )
  WITH CHECK (
    app.current_role() IN ('SECURITY_GUARD', 'SOCIETY_ADMIN')
    AND society_id = app.current_society_id()
    AND tenant_id = app.current_tenant_id()
  );

-- Residents may insert expected visitors for their flat
CREATE POLICY resident_visitors_insert ON visitors
  FOR INSERT WITH CHECK (
    app.current_role() = 'RESIDENT'
    AND society_id = app.current_society_id()
    AND member_id = app.current_member_id()
  );

CREATE POLICY resident_visitors_select ON visitors
  FOR SELECT USING (
    app.current_role() = 'RESIDENT'
    AND society_id = app.current_society_id()
    AND (member_id = app.current_member_id() OR member_id IS NULL)
  );

-- Force RLS for table owners in Supabase: use non-bypass roles for app_runtime
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ... TO app_runtime;
-- ALTER ROLE app_runtime NOSUPERUSER NOBYPASSRLS;
