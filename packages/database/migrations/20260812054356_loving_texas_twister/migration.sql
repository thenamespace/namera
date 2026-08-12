CREATE SCHEMA "audit";
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
ALTER TABLE "core"."wallet" RENAME COLUMN "family" TO "namespace";--> statement-breakpoint
CREATE INDEX "organization_events_organization_created_at_idx" ON "audit"."organization_events" ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_events_organization_event_created_at_idx" ON "audit"."organization_events" ("organization_id","event","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_events_organization_actor_created_at_idx" ON "audit"."organization_events" ("organization_id","actor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_events_resource_created_at_idx" ON "audit"."organization_events" ("organization_id","resource_type","resource_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_events_correlation_id_idx" ON "audit"."organization_events" ("correlation_id");--> statement-breakpoint
CREATE INDEX "user_events_user_created_at_idx" ON "audit"."user_events" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_events_user_event_created_at_idx" ON "audit"."user_events" ("user_id","event","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_events_session_created_at_idx" ON "audit"."user_events" ("session_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_events_correlation_id_idx" ON "audit"."user_events" ("correlation_id");--> statement-breakpoint
ALTER TABLE "audit"."organization_events" ADD CONSTRAINT "organization_events_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "audit"."organization_events" ADD CONSTRAINT "organization_events_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "audit"."user_events" ADD CONSTRAINT "user_events_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;