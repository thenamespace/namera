CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL CONSTRAINT "user_email_unique" UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"metadata" jsonb NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_normalized_check" CHECK ("email" = lower(btrim("email")))
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"active_organization_id" text,
	"ip_address" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"id_token" text,
	"refresh_token" text,
	"password" text,
	"scope" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY,
	"purpose" text NOT NULL,
	"identifier" text NOT NULL,
	"data" jsonb NOT NULL,
	"token_hash" text NOT NULL,
	"code_hmac" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_identifier_normalized_check" CHECK ("identifier" = lower(btrim("identifier"))),
	CONSTRAINT "verification_attempts_nonnegative_check" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "auth"."organization" (
	"id" text PRIMARY KEY,
	"metadata" jsonb NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."organization_member" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"organization_role_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."organization_role" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"key" text,
	"system_role_id" text,
	"permissions" text[],
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_role_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "organization_role_source_check" CHECK ((
        ("system_role_id" IS NOT NULL AND "key" IS NULL AND "metadata" IS NULL AND "permissions" IS NULL)
        OR
        ("system_role_id" IS NULL AND "key" IS NOT NULL AND "metadata" IS NOT NULL AND "permissions" IS NOT NULL)
      )),
	CONSTRAINT "organization_role_custom_key_not_system_check" CHECK ("system_role_id" IS NOT NULL OR "key" NOT IN ('owner', 'admin', 'member'))
);
--> statement-breakpoint
CREATE TABLE "auth"."system_role" (
	"id" text PRIMARY KEY,
	"key" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"permissions" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."invitation" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"organization_id" text NOT NULL,
	"organization_role_id" text NOT NULL,
	"inviter_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_email_normalized_check" CHECK ("email" = lower(btrim("email")))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_hash_uidx" ON "auth"."session" ("token_hash");--> statement-breakpoint
CREATE INDEX "session_user_active_idx" ON "auth"."session" ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "session_active_user_created_at_idx" ON "auth"."session" ("user_id","created_at" DESC NULLS LAST) WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "session_active_organization_idx" ON "auth"."session" ("active_organization_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "auth"."session" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_uidx" ON "auth"."account" ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "auth"."account" ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_user_idx" ON "auth"."account" ("provider_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_token_hash_uidx" ON "auth"."verification" ("token_hash");--> statement-breakpoint
CREATE INDEX "verification_purpose_identifier_idx" ON "auth"."verification" ("purpose","identifier");--> statement-breakpoint
CREATE INDEX "verification_expires_at_idx" ON "auth"."verification" ("expires_at");--> statement-breakpoint
CREATE INDEX "organization_created_by_idx" ON "auth"."organization" ("created_by_id");--> statement-breakpoint
CREATE INDEX "organization_plan_idx" ON "auth"."organization" ("plan");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_member_active_organization_user_uidx" ON "auth"."organization_member" ("organization_id","user_id") WHERE "removed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "organization_member_user_idx" ON "auth"."organization_member" ("user_id");--> statement-breakpoint
CREATE INDEX "organization_member_active_user_organization_idx" ON "auth"."organization_member" ("user_id","organization_id") WHERE "removed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "organization_member_organization_role_idx" ON "auth"."organization_member" ("organization_role_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_role_organization_system_role_uidx" ON "auth"."organization_role" ("organization_id","system_role_id") WHERE "system_role_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_role_organization_custom_key_uidx" ON "auth"."organization_role" ("organization_id","key") WHERE "system_role_id" IS NULL;--> statement-breakpoint
CREATE INDEX "organization_role_system_role_idx" ON "auth"."organization_role" ("system_role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "system_role_key_uidx" ON "auth"."system_role" ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_pending_email_uidx" ON "auth"."invitation" ("organization_id","email") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "invitation_email_status_idx" ON "auth"."invitation" ("email","status");--> statement-breakpoint
CREATE INDEX "invitation_organization_status_idx" ON "auth"."invitation" ("organization_id","status");--> statement-breakpoint
CREATE INDEX "invitation_organization_role_idx" ON "auth"."invitation" ("organization_role_id","organization_id");--> statement-breakpoint
CREATE INDEX "invitation_expires_at_idx" ON "auth"."invitation" ("expires_at");--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_active_organization_id_organization_id_fkey" FOREIGN KEY ("active_organization_id") REFERENCES "auth"."organization"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."organization" ADD CONSTRAINT "organization_created_by_id_user_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_member" ADD CONSTRAINT "organization_member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_member" ADD CONSTRAINT "organization_member_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_member" ADD CONSTRAINT "organization_member_role_organization_fk" FOREIGN KEY ("organization_role_id","organization_id") REFERENCES "auth"."organization_role"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_role" ADD CONSTRAINT "organization_role_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_role" ADD CONSTRAINT "organization_role_system_role_id_system_role_id_fkey" FOREIGN KEY ("system_role_id") REFERENCES "auth"."system_role"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_role_organization_fk" FOREIGN KEY ("organization_role_id","organization_id") REFERENCES "auth"."organization_role"("id","organization_id") ON DELETE RESTRICT;