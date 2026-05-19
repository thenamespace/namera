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