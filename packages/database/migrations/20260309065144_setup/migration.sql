-- Roles
CREATE ROLE app_user LOGIN PASSWORD 'CHANGE_ME';
CREATE ROLE app_admin LOGIN PASSWORD 'CHANGE_ME';

-- Change password after initial migration
-- ALTER ROLE app_user WITH PASSWORD 'new_secure_password';
-- ALTER ROLE app_admin WITH PASSWORD 'new_secure_password';

GRANT CONNECT ON DATABASE "agent-wallet" TO app_user;
GRANT CONNECT ON DATABASE "agent-wallet" TO app_admin;

-- Helper functions
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.user_id', true)
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_user = 'app_admin'
$$;