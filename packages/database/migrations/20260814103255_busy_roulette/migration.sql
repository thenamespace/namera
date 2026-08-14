CREATE TABLE "core"."session_key_policy_reservation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"session_key_id" text NOT NULL,
	"policy_id" text NOT NULL,
	"execution_id" text NOT NULL,
	"state_key" text NOT NULL,
	"reservation_version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_key_policy_reservation_execution_scope_unique" UNIQUE("organization_id","execution_id","policy_id","state_key")
);
--> statement-breakpoint
CREATE TABLE "core"."session_key_policy_state" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"session_key_id" text NOT NULL,
	"policy_id" text NOT NULL,
	"state_key" text NOT NULL,
	"state_version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_key_policy_state_scope_unique" UNIQUE("organization_id","session_key_id","policy_id","state_key")
);
--> statement-breakpoint
CREATE INDEX "session_key_policy_reservation_session_status_idx" ON "core"."session_key_policy_reservation" ("organization_id","session_key_id","status");--> statement-breakpoint
CREATE INDEX "session_key_policy_reservation_status_expiry_idx" ON "core"."session_key_policy_reservation" ("status","expires_at");--> statement-breakpoint
ALTER TABLE "core"."session_key_policy_reservation" ADD CONSTRAINT "session_key_policy_reservation_nVDxi0fCRhWe_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_policy_reservation" ADD CONSTRAINT "session_key_policy_reservation_session_key_organization_fk" FOREIGN KEY ("session_key_id","organization_id") REFERENCES "core"."session_key"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_policy_state" ADD CONSTRAINT "session_key_policy_state_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_policy_state" ADD CONSTRAINT "session_key_policy_state_session_key_organization_fk" FOREIGN KEY ("session_key_id","organization_id") REFERENCES "core"."session_key"("id","organization_id") ON DELETE RESTRICT;