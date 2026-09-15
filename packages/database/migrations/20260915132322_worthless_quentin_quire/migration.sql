CREATE TABLE "audit"."beta_invite_events" (
	"id" text PRIMARY KEY,
	"invite_id" text NOT NULL,
	"event" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit"."beta_invite_events" ADD CONSTRAINT "beta_invite_events_invite_id_beta_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "auth"."beta_invite"("id");