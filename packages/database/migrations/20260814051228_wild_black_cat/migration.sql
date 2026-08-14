CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "billing";
--> statement-breakpoint
CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "jobs";
--> statement-breakpoint
CREATE SCHEMA "notification";
--> statement-breakpoint
CREATE TABLE "audit"."organization_events" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text,
	"event" text NOT NULL,
	"source" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"data" jsonb NOT NULL,
	"correlation_id" text NOT NULL,
	"request_id" text,
	"trace_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_events_resource_pair_check" CHECK (("resource_type" IS NULL AND "resource_id" IS NULL) OR ("resource_type" IS NOT NULL AND "resource_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "audit"."user_events" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"session_id" text,
	"event" text NOT NULL,
	"source" text NOT NULL,
	"data" jsonb NOT NULL,
	"correlation_id" text NOT NULL,
	"request_id" text,
	"trace_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."actor" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actor_type_check" CHECK ("type" IN ('user'))
);
--> statement-breakpoint
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
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."organization_member" (
	"id" text PRIMARY KEY,
	"actor_id" text NOT NULL,
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
CREATE TABLE "billing"."account" (
	"organization_id" text PRIMARY KEY,
	"provider" text,
	"provider_customer_id" text,
	"billing_email" text,
	"currency" text DEFAULT 'usd' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_account_provider_customer_check" CHECK (("provider" IS NULL AND "provider_customer_id" IS NULL) OR ("provider" IS NOT NULL AND "provider_customer_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "billing"."provider_event" (
	"id" text PRIMARY KEY,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"type" text NOT NULL,
	"livemode" boolean NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_created_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_provider_event_attempts_check" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "billing"."subscription" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"provider" text,
	"provider_subscription_id" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"plan_version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"ended_at" timestamp with time zone,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_subscription_plan_version_check" CHECK ("plan_version" >= 1),
	CONSTRAINT "billing_subscription_period_check" CHECK (("current_period_start" IS NULL AND "current_period_end" IS NULL) OR ("current_period_start" IS NOT NULL AND "current_period_end" IS NOT NULL AND "current_period_end" > "current_period_start")),
	CONSTRAINT "billing_subscription_provider_check" CHECK (("provider" IS NULL AND "provider_subscription_id" IS NULL) OR ("provider" IS NOT NULL AND "provider_subscription_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "core"."wallet_key" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"algorithm" text NOT NULL,
	"protection_level" text NOT NULL,
	"public_key_hex" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_key_id_organization_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "core"."wallet" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"wallet_key_id" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_actor_id" text NOT NULL,
	"namespace" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs"."email_jobs" (
	"id" text PRIMARY KEY,
	"type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"encrypted_payload" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"provider_message_id" text,
	"sent_at" timestamp with time zone,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_jobs_attempts_nonnegative_check" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notification"."notifications" (
	"id" text PRIMARY KEY,
	"organization_id" text,
	"actor_id" text,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"correlation_id" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_actor_organization_check" CHECK ("actor_id" IS NULL OR "organization_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "notification"."notification_preferences" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"organization_id" text,
	"category" text NOT NULL,
	"topic" text NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification"."notification_recipients" (
	"notification_id" text,
	"user_id" text,
	"email_job_id" text,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_recipients_pk" PRIMARY KEY("notification_id","user_id")
);
--> statement-breakpoint
CREATE INDEX "organization_events_organization_created_at_idx" ON "audit"."organization_events" ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_events_organization_event_created_at_idx" ON "audit"."organization_events" ("organization_id","event","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_events_organization_actor_created_at_idx" ON "audit"."organization_events" ("organization_id","actor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_events_resource_created_at_idx" ON "audit"."organization_events" ("organization_id","resource_type","resource_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_events_correlation_id_idx" ON "audit"."organization_events" ("correlation_id");--> statement-breakpoint
CREATE INDEX "user_events_user_created_at_idx" ON "audit"."user_events" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_events_user_event_created_at_idx" ON "audit"."user_events" ("user_id","event","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_events_session_created_at_idx" ON "audit"."user_events" ("session_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_events_correlation_id_idx" ON "audit"."user_events" ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "actor_id_organization_uidx" ON "auth"."actor" ("id","organization_id");--> statement-breakpoint
CREATE INDEX "actor_organization_type_idx" ON "auth"."actor" ("organization_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_hash_uidx" ON "auth"."session" ("token_hash");--> statement-breakpoint
CREATE INDEX "session_user_active_idx" ON "auth"."session" ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "session_active_user_created_at_idx" ON "auth"."session" ("user_id","created_at" DESC NULLS LAST) WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "session_active_organization_idx" ON "auth"."session" ("active_organization_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "auth"."session" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_uidx" ON "auth"."account" ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "auth"."account" ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_user_idx" ON "auth"."account" ("provider_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_token_hash_uidx" ON "auth"."verification" ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_pending_identifier_uidx" ON "auth"."verification" ("purpose","identifier") WHERE "consumed_at" IS NULL AND "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "verification_purpose_identifier_idx" ON "auth"."verification" ("purpose","identifier");--> statement-breakpoint
CREATE INDEX "verification_expires_at_idx" ON "auth"."verification" ("expires_at");--> statement-breakpoint
CREATE INDEX "organization_created_by_idx" ON "auth"."organization" ("created_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_member_active_organization_user_uidx" ON "auth"."organization_member" ("organization_id","user_id") WHERE "removed_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_member_actor_uidx" ON "auth"."organization_member" ("actor_id");--> statement-breakpoint
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
CREATE UNIQUE INDEX "billing_account_provider_customer_uidx" ON "billing"."account" ("provider","provider_customer_id") WHERE "provider_customer_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_provider_event_provider_id_uidx" ON "billing"."provider_event" ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "billing_provider_event_status_created_at_idx" ON "billing"."provider_event" ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscription_current_organization_uidx" ON "billing"."subscription" ("organization_id") WHERE "status" IN ('trialing', 'active', 'past_due');--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscription_provider_subscription_uidx" ON "billing"."subscription" ("provider","provider_subscription_id") WHERE "provider_subscription_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "billing_subscription_organization_created_at_idx" ON "billing"."subscription" ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "billing_subscription_status_period_end_idx" ON "billing"."subscription" ("status","current_period_end");--> statement-breakpoint
CREATE INDEX "wallet_key_organization_status_idx" ON "core"."wallet_key" ("organization_id","status");--> statement-breakpoint
CREATE INDEX "wallet_organization_status_idx" ON "core"."wallet" ("organization_id","status");--> statement-breakpoint
CREATE INDEX "wallet_wallet_key_idx" ON "core"."wallet" ("wallet_key_id");--> statement-breakpoint
CREATE INDEX "wallet_created_by_actor_idx" ON "core"."wallet" ("created_by_actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_jobs_idempotency_key_uidx" ON "jobs"."email_jobs" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "email_jobs_status_available_at_idx" ON "jobs"."email_jobs" ("status","available_at");--> statement-breakpoint
CREATE INDEX "email_jobs_lease_expires_at_idx" ON "jobs"."email_jobs" ("lease_expires_at");--> statement-breakpoint
CREATE INDEX "email_jobs_expires_at_idx" ON "jobs"."email_jobs" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_idempotency_key_uidx" ON "notification"."notifications" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notifications_organization_created_at_idx" ON "notification"."notifications" ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_organization_type_created_at_idx" ON "notification"."notifications" ("organization_id","type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_resource_created_at_idx" ON "notification"."notifications" ("resource_type","resource_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_expires_at_idx" ON "notification"."notifications" ("expires_at") WHERE "expires_at" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_global_uidx" ON "notification"."notification_preferences" ("user_id","category","topic","channel") WHERE "organization_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_organization_uidx" ON "notification"."notification_preferences" ("user_id","organization_id","category","topic","channel") WHERE "organization_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_recipients_email_job_uidx" ON "notification"."notification_recipients" ("email_job_id");--> statement-breakpoint
CREATE INDEX "notification_recipients_user_received_at_idx" ON "notification"."notification_recipients" ("user_id","received_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_recipients_user_unread_received_at_idx" ON "notification"."notification_recipients" ("user_id","received_at" DESC NULLS LAST) WHERE "read_at" IS NULL AND "archived_at" IS NULL;--> statement-breakpoint
ALTER TABLE "audit"."organization_events" ADD CONSTRAINT "organization_events_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "audit"."organization_events" ADD CONSTRAINT "organization_events_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "audit"."user_events" ADD CONSTRAINT "user_events_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."actor" ADD CONSTRAINT "actor_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_active_organization_id_organization_id_fkey" FOREIGN KEY ("active_organization_id") REFERENCES "auth"."organization"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."organization" ADD CONSTRAINT "organization_created_by_id_user_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_member" ADD CONSTRAINT "organization_member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_member" ADD CONSTRAINT "organization_member_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_member" ADD CONSTRAINT "organization_member_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_member" ADD CONSTRAINT "organization_member_role_organization_fk" FOREIGN KEY ("organization_role_id","organization_id") REFERENCES "auth"."organization_role"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_role" ADD CONSTRAINT "organization_role_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_role" ADD CONSTRAINT "organization_role_system_role_id_system_role_id_fkey" FOREIGN KEY ("system_role_id") REFERENCES "auth"."system_role"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_role_organization_fk" FOREIGN KEY ("organization_role_id","organization_id") REFERENCES "auth"."organization_role"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."account" ADD CONSTRAINT "account_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."subscription" ADD CONSTRAINT "subscription_organization_id_account_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "billing"."account"("organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet_key" ADD CONSTRAINT "wallet_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet" ADD CONSTRAINT "wallet_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet" ADD CONSTRAINT "wallet_key_organization_fk" FOREIGN KEY ("wallet_key_id","organization_id") REFERENCES "core"."wallet_key"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet" ADD CONSTRAINT "wallet_creator_organization_fk" FOREIGN KEY ("created_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notifications" ADD CONSTRAINT "notifications_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notifications" ADD CONSTRAINT "notifications_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notification_recipients" ADD CONSTRAINT "notification_recipients_notification_id_notifications_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notification"."notifications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification"."notification_recipients" ADD CONSTRAINT "notification_recipients_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notification_recipients" ADD CONSTRAINT "notification_recipients_email_job_id_email_jobs_id_fkey" FOREIGN KEY ("email_job_id") REFERENCES "jobs"."email_jobs"("id") ON DELETE SET NULL;