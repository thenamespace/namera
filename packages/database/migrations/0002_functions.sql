-- Helper function to get current user id
CREATE OR REPLACE FUNCTION auth_current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')
$$;
--> statement-breakpoint


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
      AND m.user_id = public.auth_current_user_id()
      AND m.removed_at IS NULL
      AND m.deleted_at IS NULL
  );
END;
$$;
--> statement-breakpoint

-- Helper function to check if user has required permissions in an organization
CREATE OR REPLACE FUNCTION auth_user_has_permissions_in_org(
  org_id text,
  required_permissions text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.member AS m
    JOIN auth.role AS r
      ON r.id = m.role_id
     AND r.organization_id = m.organization_id
    WHERE m.organization_id = org_id
      AND m.user_id = public.auth_current_user_id()
      AND m.removed_at IS NULL
      AND m.deleted_at IS NULL
      AND r.deleted_at IS NULL
      AND r.permissions @> required_permissions
  )
$$;
--> statement-breakpoint

-- Helper function to check if smart account belongs to an organization
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
--> statement-breakpoint

-- Helper function to check if session key belongs to an organization
CREATE OR REPLACE FUNCTION auth_session_key_in_org(session_key_id text, org_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.session_key AS sk
    WHERE sk.id = session_key_id
      AND sk.organization_id = org_id
  );
END;
$$;
--> statement-breakpoint