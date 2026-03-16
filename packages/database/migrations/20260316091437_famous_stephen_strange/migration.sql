CREATE TABLE "session_key" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text,
	"address" text NOT NULL,
	"smart_account_id" text NOT NULL,
	"serialized_account" text NOT NULL,
	"enc_session_private_key" text NOT NULL,
	"chain" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_key" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "smart_account" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text,
	"entrypoint_version" text NOT NULL,
	"kernel_version" text NOT NULL,
	"index" integer NOT NULL,
	"address" text NOT NULL,
	"owner_type" text NOT NULL,
	"owner_identifier" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "smart_account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "session_key_userId_idx" ON "session_key" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_key_address_uidx" ON "session_key" ("address");--> statement-breakpoint
CREATE INDEX "smart_account_userId_idx" ON "smart_account" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "smart_account_address_uidx" ON "smart_account" ("address");--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_smart_account_id_smart_account_id_fkey" FOREIGN KEY ("smart_account_id") REFERENCES "smart_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "smart_account" ADD CONSTRAINT "smart_account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "session_key_user_select" ON "session_key" AS PERMISSIVE FOR SELECT TO "app_user" USING ("session_key"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "session_key_user_update" ON "session_key" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("session_key"."user_id" = auth_user_id()) WITH CHECK ("session_key"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "session_key_user_insert" ON "session_key" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("session_key"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "session_key_user_delete" ON "session_key" AS PERMISSIVE FOR DELETE TO "app_user" USING ("session_key"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "session_key_admin_access" ON "session_key" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "smart_account_user_select" ON "smart_account" AS PERMISSIVE FOR SELECT TO "app_user" USING ("smart_account"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "smart_account_user_insert" ON "smart_account" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("smart_account"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "smart_account_user_update" ON "smart_account" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("smart_account"."user_id" = auth_user_id()) WITH CHECK ("smart_account"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "smart_account_user_delete" ON "smart_account" AS PERMISSIVE FOR DELETE TO "app_user" USING ("smart_account"."user_id" = auth_user_id());--> statement-breakpoint
CREATE POLICY "smart_account_admin_access" ON "smart_account" AS PERMISSIVE FOR ALL TO "app_admin" USING (true);