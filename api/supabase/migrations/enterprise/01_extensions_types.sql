-- 01_extensions_types.sql
-- SocietyOne enterprise — extensions & shared helpers

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS app;

-- Session context helpers (RLS)
CREATE OR REPLACE FUNCTION app.current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_society_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.society_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_member_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.member_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.role', true), ''), '')
$$;

CREATE OR REPLACE FUNCTION app.is_super_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app.current_role() = 'SUPER_ADMIN'
$$;

CREATE OR REPLACE FUNCTION app.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.row_version IS NOT NULL AND OLD.row_version IS NOT NULL THEN
    NEW.row_version = OLD.row_version + 1;
  END IF;
  RETURN NEW;
END;
$$;
