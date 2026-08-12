CREATE SCHEMA "notification";
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
CREATE UNIQUE INDEX "notifications_idempotency_key_uidx" ON "notification"."notifications" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notifications_organization_created_at_idx" ON "notification"."notifications" ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_organization_type_created_at_idx" ON "notification"."notifications" ("organization_id","type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_resource_created_at_idx" ON "notification"."notifications" ("resource_type","resource_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_expires_at_idx" ON "notification"."notifications" ("expires_at") WHERE "expires_at" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_global_uidx" ON "notification"."notification_preferences" ("user_id","category","channel") WHERE "organization_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_organization_uidx" ON "notification"."notification_preferences" ("user_id","organization_id","category","channel") WHERE "organization_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_recipients_email_job_uidx" ON "notification"."notification_recipients" ("email_job_id");--> statement-breakpoint
CREATE INDEX "notification_recipients_user_received_at_idx" ON "notification"."notification_recipients" ("user_id","received_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_recipients_user_unread_received_at_idx" ON "notification"."notification_recipients" ("user_id","received_at" DESC NULLS LAST) WHERE "read_at" IS NULL AND "archived_at" IS NULL;--> statement-breakpoint
ALTER TABLE "notification"."notifications" ADD CONSTRAINT "notifications_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notifications" ADD CONSTRAINT "notifications_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notification_recipients" ADD CONSTRAINT "notification_recipients_notification_id_notifications_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notification"."notifications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification"."notification_recipients" ADD CONSTRAINT "notification_recipients_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notification_recipients" ADD CONSTRAINT "notification_recipients_email_job_id_email_jobs_id_fkey" FOREIGN KEY ("email_job_id") REFERENCES "jobs"."email_jobs"("id") ON DELETE SET NULL;