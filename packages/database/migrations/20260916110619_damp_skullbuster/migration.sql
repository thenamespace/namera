CREATE TABLE "audit"."waitlist_events" (
	"id" text PRIMARY KEY,
	"waitlist_id" text NOT NULL,
	"previous_status" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_event_transition_check" CHECK ("previous_status" in ('pending', 'completed') AND "status" in ('pending', 'completed') AND "previous_status" <> "status")
);
--> statement-breakpoint
CREATE TABLE "auth"."waitlist" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "waitlist_email_normalized_check" CHECK ("email" = lower(btrim("email"))),
	CONSTRAINT "waitlist_status_check" CHECK ("status" in ('pending', 'completed')),
	CONSTRAINT "waitlist_completed_check" CHECK (("status" = 'completed') = ("completed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX "waitlist_events_entry_idx" ON "audit"."waitlist_events" ("waitlist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_email_uidx" ON "auth"."waitlist" ("email");--> statement-breakpoint
CREATE INDEX "waitlist_status_id_idx" ON "auth"."waitlist" ("status","id");--> statement-breakpoint
ALTER TABLE "audit"."waitlist_events" ADD CONSTRAINT "waitlist_events_waitlist_id_waitlist_id_fkey" FOREIGN KEY ("waitlist_id") REFERENCES "auth"."waitlist"("id");