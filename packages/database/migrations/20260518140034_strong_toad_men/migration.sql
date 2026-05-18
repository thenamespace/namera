CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"access_token" text,
	"access_token_expires_at" timestamp with time zone DEFAULT now(),
	"id_token" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp with time zone DEFAULT now(),
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY,
	"ip_address" text,
	"token" text NOT NULL UNIQUE,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"user_agent" text,
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"last_login_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."organization" (
	"id" text PRIMARY KEY,
	"metadata" json,
	"plan" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."organization" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."member" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"role_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."member" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."invitation" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"role_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"inviter_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."role" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"metadata" json NOT NULL,
	"organization_id" text NOT NULL,
	"permissions" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."role" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "smart_account" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"metadata" json NOT NULL,
	"entrypoint_version" text NOT NULL,
	"kernel_version" text NOT NULL,
	"index" integer NOT NULL,
	"address" text NOT NULL,
	"owner_type" text NOT NULL,
	"owner" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "smart_account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session_key" (
	"id" text PRIMARY KEY,
	"metadata" json NOT NULL,
	"creator_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"smart_account_id" text NOT NULL,
	"serialized_accounts" json NOT NULL,
	"type" text NOT NULL,
	"data" json NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_key" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "auth"."account" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_providerId_accountId_idx" ON "auth"."account" ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "auth"."session" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_uidx" ON "auth"."user" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_identifier_idx" ON "auth"."verification" ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "auth"."organization" ("slug");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "auth"."member" ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "auth"."member" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_user_organization_uidx" ON "auth"."member" ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "auth"."invitation" ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "auth"."invitation" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "role_name_organizationId_idx" ON "auth"."role" ("name","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_organization_id_id_uidx" ON "auth"."role" ("organization_id","id");--> statement-breakpoint
CREATE INDEX "role_organizationId_idx" ON "auth"."role" ("organization_id");--> statement-breakpoint
CREATE INDEX "smart_account_organizationId_idx" ON "smart_account" ("organization_id");--> statement-breakpoint
CREATE INDEX "smart_account_creatorId_idx" ON "smart_account" ("creator_id");--> statement-breakpoint
CREATE INDEX "smart_account_owner_index_idx" ON "smart_account" ("owner","index" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "smart_account_address_uidx" ON "smart_account" ("address");--> statement-breakpoint
CREATE INDEX "session_key_organizationId_idx" ON "session_key" ("organization_id");--> statement-breakpoint
CREATE INDEX "session_key_smartAccountId_idx" ON "session_key" ("smart_account_id");--> statement-breakpoint
CREATE INDEX "session_key_creator_idx" ON "session_key" ("creator_id");--> statement-breakpoint
CREATE INDEX "session_key_type_idx" ON "session_key" ("type");--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_active_organization_id_organization_id_fkey" FOREIGN KEY ("active_organization_id") REFERENCES "auth"."organization"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_organization_role_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "auth"."role"("organization_id","id");--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_organization_role_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "auth"."role"("organization_id","id");--> statement-breakpoint
ALTER TABLE "auth"."role" ADD CONSTRAINT "role_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "smart_account" ADD CONSTRAINT "smart_account_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "smart_account" ADD CONSTRAINT "smart_account_creator_id_user_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_creator_id_user_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_smart_account_id_smart_account_id_fkey" FOREIGN KEY ("smart_account_id") REFERENCES "smart_account"("id") ON DELETE CASCADE;--> statement-breakpoint
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
  );
END;
$$;
--> statement-breakpoint
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
      AND r.permissions @> required_permissions
  )
$$;
--> statement-breakpoint
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
CREATE POLICY "account_select" ON "auth"."account" AS PERMISSIVE FOR SELECT TO "app_user" USING (auth_current_user_id() = "auth"."account"."user_id");--> statement-breakpoint
CREATE POLICY "account_update" ON "auth"."account" AS PERMISSIVE FOR UPDATE TO "app_user" USING (auth_current_user_id() = "auth"."account"."user_id") WITH CHECK (auth_current_user_id() = "auth"."account"."user_id");--> statement-breakpoint
CREATE POLICY "account_insert" ON "auth"."account" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (auth_current_user_id() = "auth"."account"."user_id");--> statement-breakpoint
CREATE POLICY "account_delete" ON "auth"."account" AS PERMISSIVE FOR DELETE TO "app_user" USING (auth_current_user_id() = "auth"."account"."user_id");--> statement-breakpoint
CREATE POLICY "account_admin_access" ON "auth"."account" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "session_select" ON "auth"."session" AS PERMISSIVE FOR SELECT TO "app_user" USING (auth_current_user_id() = "auth"."session"."user_id");--> statement-breakpoint
CREATE POLICY "session_update" ON "auth"."session" AS PERMISSIVE FOR UPDATE TO "app_user" USING (auth_current_user_id() = "auth"."session"."user_id") WITH CHECK ((auth_current_user_id() = "auth"."session"."user_id") AND (("auth"."session"."active_organization_id" IS NULL) OR (auth_user_has_org_access("auth"."session"."active_organization_id"))));--> statement-breakpoint
CREATE POLICY "session_delete" ON "auth"."session" AS PERMISSIVE FOR DELETE TO "app_user" USING (auth_current_user_id() = "auth"."session"."user_id");--> statement-breakpoint
CREATE POLICY "session_access" ON "auth"."session" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "user_select" ON "auth"."user" AS PERMISSIVE FOR SELECT TO "app_user" USING (auth_current_user_id() = "auth"."user"."id");--> statement-breakpoint
CREATE POLICY "user_update" ON "auth"."user" AS PERMISSIVE FOR UPDATE TO "app_user" USING (auth_current_user_id() = "auth"."user"."id") WITH CHECK (auth_current_user_id() = "auth"."user"."id");--> statement-breakpoint
CREATE POLICY "user_adminaccess" ON "auth"."user" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "verification_admin_access" ON "auth"."verification" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "organization_select" ON "auth"."organization" AS PERMISSIVE FOR SELECT TO "app_user" USING (auth_user_has_permissions_in_org("auth"."organization"."id", ARRAY['org:read']::text[]));--> statement-breakpoint
CREATE POLICY "organization_update" ON "auth"."organization" AS PERMISSIVE FOR UPDATE TO "app_user" USING (auth_user_has_permissions_in_org("auth"."organization"."id", ARRAY['org:update']::text[])) WITH CHECK (auth_user_has_permissions_in_org("auth"."organization"."id", ARRAY['org:update']::text[]));--> statement-breakpoint
CREATE POLICY "organization_delete" ON "auth"."organization" AS PERMISSIVE FOR DELETE TO "app_user" USING (auth_user_has_permissions_in_org("auth"."organization"."id", ARRAY['org:delete']::text[]));--> statement-breakpoint
CREATE POLICY "organization_admin_access" ON "auth"."organization" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "member_select" ON "auth"."member" AS PERMISSIVE FOR SELECT TO "app_user" USING (auth_user_has_permissions_in_org("auth"."member"."organization_id", ARRAY['member:read']::text[]));--> statement-breakpoint
CREATE POLICY "member_insert" ON "auth"."member" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (auth_user_has_permissions_in_org("auth"."member"."organization_id", ARRAY['member:invite']::text[]));--> statement-breakpoint
CREATE POLICY "member_update" ON "auth"."member" AS PERMISSIVE FOR UPDATE TO "app_user" USING (auth_user_has_permissions_in_org("auth"."member"."organization_id", ARRAY['member:update']::text[])) WITH CHECK (auth_user_has_permissions_in_org("auth"."member"."organization_id", ARRAY['member:update']::text[]));--> statement-breakpoint
CREATE POLICY "member_delete" ON "auth"."member" AS PERMISSIVE FOR DELETE TO "app_user" USING (auth_user_has_permissions_in_org("auth"."member"."organization_id", ARRAY['member:remove']::text[]));--> statement-breakpoint
CREATE POLICY "member_admin_access" ON "auth"."member" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "invitation_select" ON "auth"."invitation" AS PERMISSIVE FOR SELECT TO "app_user" USING (auth_user_has_permissions_in_org("auth"."invitation"."organization_id", ARRAY['invitation:read']::text[]));--> statement-breakpoint
CREATE POLICY "invitation_insert" ON "auth"."invitation" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (auth_user_has_permissions_in_org("auth"."invitation"."organization_id", ARRAY['invitation:create']::text[]));--> statement-breakpoint
CREATE POLICY "invitation_update" ON "auth"."invitation" AS PERMISSIVE FOR UPDATE TO "app_user" USING (auth_user_has_permissions_in_org("auth"."invitation"."organization_id", ARRAY['invitation:update']::text[])) WITH CHECK (auth_user_has_permissions_in_org("auth"."invitation"."organization_id", ARRAY['invitation:update']::text[]));--> statement-breakpoint
CREATE POLICY "invitation_delete" ON "auth"."invitation" AS PERMISSIVE FOR DELETE TO "app_user" USING (auth_user_has_permissions_in_org("auth"."invitation"."organization_id", ARRAY['invitation:delete']::text[]));--> statement-breakpoint
CREATE POLICY "invitation_admin_access" ON "auth"."invitation" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "role_select" ON "auth"."role" AS PERMISSIVE FOR SELECT TO "app_user" USING (auth_user_has_permissions_in_org("auth"."role"."organization_id", ARRAY['role:read']::text[]));--> statement-breakpoint
CREATE POLICY "role_update" ON "auth"."role" AS PERMISSIVE FOR UPDATE TO "app_user" USING (auth_user_has_permissions_in_org("auth"."role"."organization_id", ARRAY['role:update']::text[])) WITH CHECK (auth_user_has_permissions_in_org("auth"."role"."organization_id", ARRAY['role:update']::text[]));--> statement-breakpoint
CREATE POLICY "role_insert" ON "auth"."role" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (auth_user_has_permissions_in_org("auth"."role"."organization_id", ARRAY['role:create']::text[]));--> statement-breakpoint
CREATE POLICY "role_delete" ON "auth"."role" AS PERMISSIVE FOR DELETE TO "app_user" USING (auth_user_has_permissions_in_org("auth"."role"."organization_id", ARRAY['role:delete']::text[]));--> statement-breakpoint
CREATE POLICY "role_admin_access" ON "auth"."role" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "smart_account_select" ON "smart_account" AS PERMISSIVE FOR SELECT TO "app_user" USING (auth_user_has_permissions_in_org("smart_account"."organization_id", ARRAY['smart_account:read']::text[]));--> statement-breakpoint
CREATE POLICY "smart_account_insert" ON "smart_account" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ((auth_current_user_id() = "smart_account"."creator_id") AND (auth_user_has_permissions_in_org("smart_account"."organization_id", ARRAY['smart_account:create']::text[])));--> statement-breakpoint
CREATE POLICY "smart_account_owner_update" ON "smart_account" AS PERMISSIVE FOR UPDATE TO "app_user" USING (auth_user_has_permissions_in_org("smart_account"."organization_id", ARRAY['smart_account:update']::text[])) WITH CHECK (auth_user_has_permissions_in_org("smart_account"."organization_id", ARRAY['smart_account:update']::text[]));--> statement-breakpoint
CREATE POLICY "smart_account_owner_delete" ON "smart_account" AS PERMISSIVE FOR DELETE TO "app_user" USING (auth_user_has_permissions_in_org("smart_account"."organization_id", ARRAY['smart_account:delete']::text[]));--> statement-breakpoint
CREATE POLICY "smart_account_admin_access" ON "smart_account" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "session_key_select" ON "session_key" AS PERMISSIVE FOR SELECT TO "app_user" USING (auth_user_has_permissions_in_org("session_key"."organization_id", ARRAY['session_key:read']::text[]));--> statement-breakpoint
CREATE POLICY "session_key_update" ON "session_key" AS PERMISSIVE FOR UPDATE TO "app_user" USING ((auth_user_has_permissions_in_org("session_key"."organization_id", ARRAY['session_key:update']::text[])) AND (auth_session_key_in_org("session_key"."id", "session_key"."organization_id"))) WITH CHECK ((auth_user_has_permissions_in_org("session_key"."organization_id", ARRAY['session_key:update']::text[])) AND (auth_smart_account_in_org("session_key"."smart_account_id", "session_key"."organization_id")));--> statement-breakpoint
CREATE POLICY "session_key_insert" ON "session_key" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ((auth_current_user_id() = "session_key"."creator_id") AND (auth_user_has_permissions_in_org("session_key"."organization_id", ARRAY['session_key:create']::text[])) AND (auth_smart_account_in_org("session_key"."smart_account_id", "session_key"."organization_id")));--> statement-breakpoint
CREATE POLICY "session_key_delete" ON "session_key" AS PERMISSIVE FOR DELETE TO "app_user" USING ((auth_user_has_permissions_in_org("session_key"."organization_id", ARRAY['session_key:delete']::text[])) AND (auth_session_key_in_org("session_key"."id", "session_key"."organization_id")));--> statement-breakpoint
CREATE POLICY "session_key_admin_access" ON "session_key" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);
