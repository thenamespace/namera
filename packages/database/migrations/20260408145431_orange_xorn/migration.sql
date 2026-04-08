CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"access_token" text,
	"access_token_expires_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id_token" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scope" text,
	"user_id" text NOT NULL,
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
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "smart_account" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text,
	"entrypoint_version" text NOT NULL,
	"kernel_version" text NOT NULL,
	"index" integer NOT NULL,
	"address" text NOT NULL,
	"owner_type" text NOT NULL,
	"owner" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "smart_account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session_key" (
	"id" text PRIMARY KEY,
	"type" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"smart_account_id" text NOT NULL,
	"serialized_accounts" json NOT NULL,
	"data" json NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_key" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "auth"."account" ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "auth"."session" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_identifier_idx" ON "auth"."verification" ("identifier");--> statement-breakpoint
CREATE INDEX "smart_account_userId_idx" ON "smart_account" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "smart_account_address_uidx" ON "smart_account" ("address");--> statement-breakpoint
CREATE INDEX "session_key_userId_idx" ON "session_key" ("user_id");--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "smart_account" ADD CONSTRAINT "smart_account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_smart_account_id_smart_account_id_fkey" FOREIGN KEY ("smart_account_id") REFERENCES "smart_account"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "account_user_select" ON "auth"."account" AS PERMISSIVE FOR SELECT TO "app_user" USING ("auth"."account"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "account_user_update" ON "auth"."account" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("auth"."account"."user_id" = auth_user_id()) WITH CHECK ("auth"."account"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "account_user_delete" ON "auth"."account" AS PERMISSIVE FOR DELETE TO "app_user" USING ("auth"."account"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "account_admin_access" ON "auth"."account" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "session_user_select" ON "auth"."session" AS PERMISSIVE FOR SELECT TO "app_user" USING ("auth"."session"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "session_user_update" ON "auth"."session" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("auth"."session"."user_id" = auth_user_id()) WITH CHECK ("auth"."session"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "session_user_delete" ON "auth"."session" AS PERMISSIVE FOR DELETE TO "app_user" USING ("auth"."session"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "session_admin_access" ON "auth"."session" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "user_self_select" ON "auth"."user" AS PERMISSIVE FOR SELECT TO "app_user" USING ("auth"."user"."id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "user_self_update" ON "auth"."user" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("auth"."user"."id" = auth_user_id()) WITH CHECK ("auth"."user"."id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "user_admin_access" ON "auth"."user" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "verification_user_select" ON "auth"."verification" AS PERMISSIVE FOR SELECT TO "app_user" USING (true);--> statement-breakpoint
CREATE POLICY "verification_user_update" ON "auth"."verification" AS PERMISSIVE FOR UPDATE TO "app_user" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "verification_user_delete" ON "auth"."verification" AS PERMISSIVE FOR DELETE TO "app_user" USING (true);--> statement-breakpoint
CREATE POLICY "verification_user_insert" ON "auth"."verification" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "verification_admin_access" ON "auth"."verification" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "smart_account_user_select" ON "smart_account" AS PERMISSIVE FOR SELECT TO "app_user" USING ("smart_account"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "smart_account_user_insert" ON "smart_account" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("smart_account"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "smart_account_user_update" ON "smart_account" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("smart_account"."user_id" = auth_user_id()) WITH CHECK ("smart_account"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "smart_account_user_delete" ON "smart_account" AS PERMISSIVE FOR DELETE TO "app_user" USING ("smart_account"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "smart_account_admin_access" ON "smart_account" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "session_key_user_select" ON "session_key" AS PERMISSIVE FOR SELECT TO "app_user" USING ("session_key"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "session_key_user_update" ON "session_key" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("session_key"."user_id" = auth_user_id()) WITH CHECK ("session_key"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "session_key_user_insert" ON "session_key" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("session_key"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "session_key_user_delete" ON "session_key" AS PERMISSIVE FOR DELETE TO "app_user" USING ("session_key"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "session_key_admin_access" ON "session_key" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);