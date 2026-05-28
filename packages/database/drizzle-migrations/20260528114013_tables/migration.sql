CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"metadata" jsonb NOT NULL,
	"last_login_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"active_organization_id" text,
	"metadata" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"access_token" text,
	"id_token" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"scope" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."organization" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"plan" text NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."organization" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."member" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."member" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."organization_role" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"type" text NOT NULL,
	"key" text NOT NULL,
	"system_role_id" text,
	"permissions" text[] NOT NULL,
	"metadata" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."organization_role" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."system_role" (
	"id" text PRIMARY KEY,
	"key" text NOT NULL,
	"permissions" text[] NOT NULL,
	"metadata" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."system_role" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."invitation" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"organization_id" text NOT NULL,
	"role_id" text NOT NULL,
	"inviter_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "smart_account" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"entrypoint_version" text NOT NULL,
	"kernel_version" text NOT NULL,
	"index" integer NOT NULL,
	"address" text NOT NULL,
	"owner_type" text NOT NULL,
	"owner" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "smart_account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session_key" (
	"id" text PRIMARY KEY,
	"creator_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"smart_account_id" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"serialized_accounts" json NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "session_key" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"notification_preferences" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_event" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"trace_id" text NOT NULL,
	"source" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_event" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"trace_id" text NOT NULL,
	"source" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_uidx" ON "auth"."user" ("email") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_idx" ON "auth"."session" ("token");--> statement-breakpoint
CREATE INDEX "session_user_active_idx" ON "auth"."session" ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "session_activeOrganizationId_idx" ON "auth"."session" ("active_organization_id");--> statement-breakpoint
CREATE INDEX "session_expiresAt_idx" ON "auth"."session" ("expires_at");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "auth"."account" ("user_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_providerId_accountId_idx" ON "auth"."account" ("provider_id","account_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "verification_identifier_idx" ON "auth"."verification" ("identifier");--> statement-breakpoint
CREATE INDEX "organization_created_by_idx" ON "auth"."organization" ("created_by_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "auth"."member" ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "auth"."member" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_user_organization_uidx" ON "auth"."member" ("user_id","organization_id") WHERE "deleted_at" IS NULL AND "removed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "member_active_organization_user_idx" ON "auth"."member" ("organization_id","user_id") WHERE "deleted_at" IS NULL AND "removed_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "role_key_organizationId_idx" ON "auth"."organization_role" ("key","organization_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "role_organization_id_id_uidx" ON "auth"."organization_role" ("organization_id","id");--> statement-breakpoint
CREATE INDEX "role_organizationId_idx" ON "auth"."organization_role" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "system_role_key_key_idx" ON "auth"."system_role" ("key") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "auth"."invitation" ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "auth"."invitation" ("email");--> statement-breakpoint
CREATE INDEX "invitation_organization_status_idx" ON "auth"."invitation" ("organization_id","status");--> statement-breakpoint
CREATE INDEX "invitation_email_status_idx" ON "auth"."invitation" ("email","status");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_pending_organization_email_uidx" ON "auth"."invitation" ("organization_id","email") WHERE "status" = 'pending' AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "smart_account_organizationId_idx" ON "smart_account" ("organization_id");--> statement-breakpoint
CREATE INDEX "smart_account_creatorId_idx" ON "smart_account" ("creator_id");--> statement-breakpoint
CREATE INDEX "smart_account_owner_index_idx" ON "smart_account" ("owner","index" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "smart_account_org_owner_index_idx" ON "smart_account" ("organization_id","owner","index" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "smart_account_address_uidx" ON "smart_account" ("address");--> statement-breakpoint
CREATE UNIQUE INDEX "smart_account_organization_id_id_uidx" ON "smart_account" ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "smart_account_organization_owner_index_uidx" ON "smart_account" ("organization_id","owner","index");--> statement-breakpoint
CREATE INDEX "session_key_organizationId_idx" ON "session_key" ("organization_id");--> statement-breakpoint
CREATE INDEX "session_key_smartAccountId_idx" ON "session_key" ("smart_account_id");--> statement-breakpoint
CREATE INDEX "session_key_organization_smartAccount_idx" ON "session_key" ("organization_id","smart_account_id");--> statement-breakpoint
CREATE INDEX "session_key_creator_idx" ON "session_key" ("creator_id");--> statement-breakpoint
CREATE INDEX "session_key_type_idx" ON "session_key" ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "user_preference_user_id_uidx" ON "user_preferences" ("user_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "organization_event_organization_created_at_idx" ON "organization_event" ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_event_organization_event_type_created_at_idx" ON "organization_event" ("organization_id","event_type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_event_target_created_at_idx" ON "organization_event" ("target_type","target_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_event_organization_target_created_at_idx" ON "organization_event" ("organization_id","target_type","target_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_event_actor_created_at_idx" ON "organization_event" ("actor_type","actor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_event_trace_id_idx" ON "organization_event" ("trace_id");--> statement-breakpoint
CREATE INDEX "organization_event_organization_actor_created_at_idx" ON "organization_event" ("organization_id","actor_type","actor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_event_organization_source_created_at_idx" ON "organization_event" ("organization_id","source","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_event_userId_created_at_idx" ON "user_event" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_event_user_event_type_created_at_idx" ON "user_event" ("user_id","event_type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_event_target_created_at_idx" ON "user_event" ("target_type","target_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_event_user_target_created_at_idx" ON "user_event" ("user_id","target_type","target_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_event_trace_id_idx" ON "user_event" ("trace_id");--> statement-breakpoint
CREATE INDEX "user_event_user_source_created_at_idx" ON "user_event" ("user_id","source","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_active_organization_id_organization_id_fkey" FOREIGN KEY ("active_organization_id") REFERENCES "auth"."organization"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."organization" ADD CONSTRAINT "organization_created_by_id_user_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_role_id_organization_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "auth"."organization_role"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_organization_role_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "auth"."organization_role"("organization_id","id");--> statement-breakpoint
ALTER TABLE "auth"."organization_role" ADD CONSTRAINT "organization_role_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."organization_role" ADD CONSTRAINT "organization_role_system_role_id_system_role_id_fkey" FOREIGN KEY ("system_role_id") REFERENCES "auth"."system_role"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_organization_role_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "auth"."organization_role"("organization_id","id");--> statement-breakpoint
ALTER TABLE "smart_account" ADD CONSTRAINT "smart_account_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "smart_account" ADD CONSTRAINT "smart_account_creator_id_member_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."member"("id");--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_creator_id_member_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."member"("id");--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_smart_account_id_smart_account_id_fkey" FOREIGN KEY ("smart_account_id") REFERENCES "smart_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_organization_smart_account_fk" FOREIGN KEY ("organization_id","smart_account_id") REFERENCES "smart_account"("organization_id","id");--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_event" ADD CONSTRAINT "organization_event_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id");--> statement-breakpoint
ALTER TABLE "user_event" ADD CONSTRAINT "user_event_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id");--> statement-breakpoint


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


CREATE POLICY "user_select" ON "auth"."user" AS PERMISSIVE FOR SELECT TO "app_user" USING ((auth_current_user_id() = "auth"."user"."id") AND ("auth"."user"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "user_update" ON "auth"."user" AS PERMISSIVE FOR UPDATE TO "app_user" USING ((auth_current_user_id() = "auth"."user"."id") AND ("auth"."user"."deleted_at" IS NULL)) WITH CHECK ((auth_current_user_id() = "auth"."user"."id") AND ("auth"."user"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "user_admin_access" ON "auth"."user" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "session_select" ON "auth"."session" AS PERMISSIVE FOR SELECT TO "app_user" USING ((auth_current_user_id() = "auth"."session"."user_id") AND ("auth"."session"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "session_update" ON "auth"."session" AS PERMISSIVE FOR UPDATE TO "app_user" USING ((auth_current_user_id() = "auth"."session"."user_id") AND ("auth"."session"."deleted_at" IS NULL)) WITH CHECK ((auth_current_user_id() = "auth"."session"."user_id") AND ("auth"."session"."deleted_at" IS NULL) AND (("auth"."session"."active_organization_id" IS NULL) OR (auth_actor_has_org_access("auth"."session"."active_organization_id"))));--> statement-breakpoint
CREATE POLICY "session_access" ON "auth"."session" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "account_select" ON "auth"."account" AS PERMISSIVE FOR SELECT TO "app_user" USING ((auth_current_user_id() = "auth"."account"."user_id") AND ("auth"."account"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "account_update" ON "auth"."account" AS PERMISSIVE FOR UPDATE TO "app_user" USING ((auth_current_user_id() = "auth"."account"."user_id") AND ("auth"."account"."deleted_at" IS NULL)) WITH CHECK ((auth_current_user_id() = "auth"."account"."user_id") AND ("auth"."account"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "account_insert" ON "auth"."account" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ((auth_current_user_id() = "auth"."account"."user_id") AND ("auth"."account"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "account_admin_access" ON "auth"."account" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "verification_admin_access" ON "auth"."verification" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "organization_select" ON "auth"."organization" AS PERMISSIVE FOR SELECT TO "app_user" USING ((auth_actor_has_org_access("auth"."organization"."id")) AND ("auth"."organization"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "organization_update" ON "auth"."organization" AS PERMISSIVE FOR UPDATE TO "app_user" USING ((auth_actor_has_org_access("auth"."organization"."id")) AND ("auth"."organization"."deleted_at" IS NULL)) WITH CHECK ((auth_actor_has_org_access("auth"."organization"."id")) AND ("auth"."organization"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "organization_admin_access" ON "auth"."organization" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "member_select" ON "auth"."member" AS PERMISSIVE FOR SELECT TO "app_user" USING ((auth_actor_has_org_access("auth"."member"."organization_id")) AND ("auth"."member"."deleted_at" IS NULL) AND ("auth"."member"."removed_at" IS NULL));--> statement-breakpoint
CREATE POLICY "member_insert" ON "auth"."member" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ((auth_actor_has_org_access("auth"."member"."organization_id")) AND ("auth"."member"."deleted_at" IS NULL) AND ("auth"."member"."removed_at" IS NULL));--> statement-breakpoint
CREATE POLICY "member_update" ON "auth"."member" AS PERMISSIVE FOR UPDATE TO "app_user" USING ((auth_actor_has_org_access("auth"."member"."organization_id")) AND ("auth"."member"."deleted_at" IS NULL)) WITH CHECK ((auth_actor_has_org_access("auth"."member"."organization_id")) AND ("auth"."member"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "member_admin_access" ON "auth"."member" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "role_select" ON "auth"."organization_role" AS PERMISSIVE FOR SELECT TO "app_user" USING ((auth_actor_has_org_access("auth"."organization_role"."organization_id")) AND ("auth"."organization_role"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "role_update" ON "auth"."organization_role" AS PERMISSIVE FOR UPDATE TO "app_user" USING ((auth_actor_has_org_access("auth"."organization_role"."organization_id")) AND ("auth"."organization_role"."deleted_at" IS NULL)) WITH CHECK ((auth_actor_has_org_access("auth"."organization_role"."organization_id")) AND ("auth"."organization_role"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "role_insert" ON "auth"."organization_role" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ((auth_actor_has_org_access("auth"."organization_role"."organization_id")) AND ("auth"."organization_role"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "role_admin_access" ON "auth"."organization_role" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "system_role_select" ON "auth"."system_role" AS PERMISSIVE FOR SELECT TO "app_user" USING (("auth"."system_role"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "system_role_admin_access" ON "auth"."system_role" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "invitation_select" ON "auth"."invitation" AS PERMISSIVE FOR SELECT TO "app_user" USING ((auth_actor_has_org_access("auth"."invitation"."organization_id")) AND ("auth"."invitation"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "invitation_insert" ON "auth"."invitation" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ((auth_actor_has_org_access("auth"."invitation"."organization_id")) AND ("auth"."invitation"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "invitation_update" ON "auth"."invitation" AS PERMISSIVE FOR UPDATE TO "app_user" USING ((auth_actor_has_org_access("auth"."invitation"."organization_id")) AND ("auth"."invitation"."deleted_at" IS NULL)) WITH CHECK ((auth_actor_has_org_access("auth"."invitation"."organization_id")) AND ("auth"."invitation"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "invitation_admin_access" ON "auth"."invitation" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "smart_account_select" ON "smart_account" AS PERMISSIVE FOR SELECT TO "app_user" USING ((auth_actor_has_org_access("smart_account"."organization_id")) AND ("smart_account"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "smart_account_insert" ON "smart_account" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ((auth_current_user_id() = "smart_account"."creator_id") AND (auth_actor_has_org_access("smart_account"."organization_id")) AND ("smart_account"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "smart_account_owner_update" ON "smart_account" AS PERMISSIVE FOR UPDATE TO "app_user" USING ((auth_actor_has_org_access("smart_account"."organization_id")) AND ("smart_account"."deleted_at" IS NULL)) WITH CHECK ((auth_actor_has_org_access("smart_account"."organization_id")) AND ("smart_account"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "smart_account_admin_access" ON "smart_account" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "session_key_select" ON "session_key" AS PERMISSIVE FOR SELECT TO "app_user" USING ((auth_actor_has_org_access("session_key"."organization_id")) AND ("session_key"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "session_key_update" ON "session_key" AS PERMISSIVE FOR UPDATE TO "app_user" USING ((auth_actor_has_org_access("session_key"."organization_id")) AND ("session_key"."deleted_at" IS NULL)) WITH CHECK ((auth_actor_has_org_access("session_key"."organization_id")) AND (auth_smart_account_in_org("session_key"."smart_account_id", "session_key"."organization_id")) AND ("session_key"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "session_key_insert" ON "session_key" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ((auth_current_user_id() = "session_key"."creator_id") AND (auth_actor_has_org_access("session_key"."organization_id")) AND (auth_smart_account_in_org("session_key"."smart_account_id", "session_key"."organization_id")) AND ("session_key"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "session_key_admin_access" ON "session_key" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "user_preference_select" ON "user_preferences" AS PERMISSIVE FOR SELECT TO "app_user" USING ((auth_current_user_id() = "user_preferences"."user_id") AND ("user_preferences"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "user_preference_update" ON "user_preferences" AS PERMISSIVE FOR UPDATE TO "app_user" USING ((auth_current_user_id() = "user_preferences"."user_id") AND ("user_preferences"."deleted_at" IS NULL)) WITH CHECK ((auth_current_user_id() = "user_preferences"."user_id") AND ("user_preferences"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "user_preference_insert" ON "user_preferences" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ((auth_current_user_id() = "user_preferences"."user_id") AND ("user_preferences"."deleted_at" IS NULL));--> statement-breakpoint
CREATE POLICY "user_preference_admin_access" ON "user_preferences" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "organization_event_select" ON "organization_event" AS PERMISSIVE FOR SELECT TO "app_user" USING (auth_actor_has_org_access("organization_event"."organization_id"));--> statement-breakpoint
CREATE POLICY "organization_event_insert" ON "organization_event" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (auth_actor_has_org_access("organization_event"."organization_id"));--> statement-breakpoint
CREATE POLICY "organization_event_admin_access" ON "organization_event" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "user_event_select" ON "user_event" AS PERMISSIVE FOR SELECT TO "app_user" USING (auth_current_user_id() = "user_event"."user_id");--> statement-breakpoint
CREATE POLICY "user_event_insert" ON "user_event" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (auth_current_user_id() = "user_event"."user_id");--> statement-breakpoint
CREATE POLICY "user_event_admin_access" ON "user_event" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);