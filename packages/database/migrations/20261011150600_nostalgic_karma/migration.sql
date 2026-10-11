CREATE TABLE "jobs"."analytics_jobs" (
	"id" text PRIMARY KEY,
	"dedupe_key" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_token" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_jobs_dedupe_key_uidx" ON "jobs"."analytics_jobs" ("dedupe_key");--> statement-breakpoint
CREATE INDEX "analytics_jobs_available_at_idx" ON "jobs"."analytics_jobs" ("available_at") WHERE "delivered_at" IS NULL;
