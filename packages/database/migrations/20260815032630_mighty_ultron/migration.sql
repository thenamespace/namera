CREATE TABLE "core"."execution_submission" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"session_key_grant_id" text NOT NULL,
	"namespace" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"policy_hash" text NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"data" jsonb NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "execution_submission_id_grant_organization_unique" UNIQUE("id","session_key_grant_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "core"."execution" ADD COLUMN "execution_submission_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."execution" ADD CONSTRAINT "execution_submission_unique" UNIQUE("execution_submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_submission_actor_idempotency_uidx" ON "core"."execution_submission" ("organization_id","actor_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "execution_submission_organization_created_at_idx" ON "core"."execution_submission" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "execution_submission_actor_created_at_idx" ON "core"."execution_submission" ("organization_id","actor_id","created_at");--> statement-breakpoint
CREATE INDEX "execution_submission_status_lease_idx" ON "core"."execution_submission" ("status","lease_expires_at");--> statement-breakpoint
ALTER TABLE "core"."execution" ADD CONSTRAINT "execution_submission_match_fk" FOREIGN KEY ("execution_submission_id","session_key_grant_id","organization_id") REFERENCES "core"."execution_submission"("id","session_key_grant_id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."execution_submission" ADD CONSTRAINT "execution_submission_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."execution_submission" ADD CONSTRAINT "execution_submission_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."execution_submission" ADD CONSTRAINT "execution_submission_grant_organization_fk" FOREIGN KEY ("session_key_grant_id","organization_id") REFERENCES "core"."session_key_grant"("id","organization_id") ON DELETE RESTRICT;