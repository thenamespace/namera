CREATE SCHEMA "jobs";
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
CREATE UNIQUE INDEX "email_jobs_idempotency_key_uidx" ON "jobs"."email_jobs" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "email_jobs_status_available_at_idx" ON "jobs"."email_jobs" ("status","available_at");--> statement-breakpoint
CREATE INDEX "email_jobs_lease_expires_at_idx" ON "jobs"."email_jobs" ("lease_expires_at");--> statement-breakpoint
CREATE INDEX "email_jobs_expires_at_idx" ON "jobs"."email_jobs" ("expires_at");