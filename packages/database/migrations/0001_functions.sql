-- Helper function to get current user id
CREATE OR REPLACE FUNCTION auth_current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')
$$;
--> statement-breakpoint

-- Helper function to get current actor type
-- actor can be one of: 'user' | 'api_key' | 'integration'
CREATE OR REPLACE FUNCTION auth_current_actor_type()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.actor_type', true), '')
$$;
--> statement-breakpoint

-- Helper function to get current actor id
CREATE OR REPLACE FUNCTION auth_current_actor_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.actor_id', true), '')
$$;
--> statement-breakpoint

-- Helper function to get current organization id
CREATE OR REPLACE FUNCTION auth_current_organization_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')
$$;
--> statement-breakpoint

-- Helper function to determine if current actor has access to an organization
CREATE OR REPLACE FUNCTION auth_actor_has_org_access(org_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_type text;
BEGIN
  actor_type := public.auth_current_actor_type();

  IF org_id IS NULL THEN
    RETURN false;
  END IF;

  IF actor_type = 'user' THEN
    RETURN EXISTS (
      SELECT 1
      FROM auth.member AS m
      WHERE m.organization_id = org_id
        AND m.user_id = public.auth_current_user_id()
        AND m.removed_at IS NULL
        AND m.deleted_at IS NULL
    );
  END IF;

  RETURN false;
END;
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