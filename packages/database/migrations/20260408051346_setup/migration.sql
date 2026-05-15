-- Create permission role
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_roles
        WHERE rolname = 'app_rw'
    ) THEN
        CREATE ROLE app_rw;
    END IF;
END
$$;


-- Create login roles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_roles
        WHERE rolname = 'app_user'
    ) THEN
        CREATE ROLE app_user
        LOGIN
        PASSWORD 'CHANGE_ME'
        NOBYPASSRLS;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_roles
        WHERE rolname = 'app_admin'
    ) THEN
        CREATE ROLE app_admin
        LOGIN
        PASSWORD 'CHANGE_ME'
        NOBYPASSRLS;
    END IF;
END
$$;


-- Attach permission role
GRANT app_rw TO app_user;
GRANT app_rw TO app_admin;


-- Ensure schemas exist
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS public;


-- Grant schema access to permission role
GRANT USAGE ON SCHEMA public TO app_rw;
GRANT USAGE ON SCHEMA auth TO app_rw;


-- Allow operations on existing tables
GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO app_rw;

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA auth
TO app_rw;


-- Allow sequence usage
GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO app_rw;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA auth
TO app_rw;


-- Ensure future tables automatically grant access
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;

ALTER DEFAULT PRIVILEGES IN SCHEMA auth
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;


-- Ensure future sequences automatically grant access
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO app_rw;

ALTER DEFAULT PRIVILEGES IN SCHEMA auth
GRANT USAGE, SELECT ON SEQUENCES TO app_rw;

-- Create helper function to get current user id
CREATE OR REPLACE FUNCTION auth_current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')
$$;

-- Helper function to get user's role in an organization
CREATE OR REPLACE FUNCTION auth_user_role_in_org(org_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_role text;
BEGIN
  SELECT m.role INTO current_role
  FROM auth.member AS m
  WHERE m.organization_id = org_id
    AND m.user_id = public.auth_user_id()
  LIMIT 1;

  RETURN current_role;
END;
$$;

-- Helper function to check if user has access to an organization
CREATE OR REPLACE FUNCTION auth_user_has_org_access(org_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM auth.member AS m
    WHERE m.organization_id = org_id
      AND m.user_id = public.auth_user_id()
  );
END;
$$;

-- Helper function to check if user has a role in an organization
CREATE OR REPLACE FUNCTION auth_user_has_role_in_org(org_id text, allowed_roles text[])
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM auth.member AS m
    WHERE m.organization_id = org_id
      AND m.user_id = public.auth_user_id()
      AND m.role = ANY(allowed_roles)
  );
END;
$$;

-- Helper function to seed a user as an owner in an organization, it checks the following things:
-- 1. seed_user_id is the current authenticated user
-- 2. seed_role is 'owner'
-- 3. the organization does not have any members, so this user is the first member for org.
CREATE OR REPLACE FUNCTION auth_org_can_seed_owner(org_id text, seed_user_id text, seed_role text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN seed_user_id = public.auth_user_id()
    AND seed_role = 'owner'
    AND NOT EXISTS (
      SELECT 1
      FROM auth.member AS m
      WHERE m.organization_id = org_id
    );
END;
$$;

-- Helper function to check if a smart account belongs to an organization
CREATE OR REPLACE FUNCTION auth_smart_account_in_org(smart_account_id text, org_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.smart_account AS sa
    WHERE sa.id = smart_account_id
      AND sa.organization_id = org_id
  );
END;
$$;
