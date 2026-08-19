CREATE TABLE "core"."signature_operation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"session_key_id" text NOT NULL,
	"session_key_grant_id" text NOT NULL,
	"namespace" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"policy_hash" text NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"data" jsonb NOT NULL,
	"failure_code" text,
	"reservation_expires_at" timestamp with time zone NOT NULL,
	"succeeded_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signature_operation_lifecycle_check" CHECK (("status" = 'reserved' AND "failure_code" IS NULL AND "succeeded_at" IS NULL AND "failed_at" IS NULL) OR ("status" = 'succeeded' AND "failure_code" IS NULL AND "succeeded_at" IS NOT NULL AND "failed_at" IS NULL) OR ("status" = 'failed' AND "failure_code" IS NOT NULL AND "succeeded_at" IS NULL AND "failed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "core"."session_key_grant" ADD CONSTRAINT "session_key_grant_signature_operation_unique" UNIQUE("id","session_key_id","actor_id","organization_id");--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_id_wallet_organization_unique" UNIQUE("id","wallet_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signature_operation_actor_idempotency_uidx" ON "core"."signature_operation" ("organization_id","actor_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "signature_operation_organization_status_created_at_idx" ON "core"."signature_operation" ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "signature_operation_wallet_created_at_idx" ON "core"."signature_operation" ("organization_id","wallet_id","created_at");--> statement-breakpoint
CREATE INDEX "signature_operation_session_key_status_created_at_idx" ON "core"."signature_operation" ("organization_id","session_key_id","status","created_at");--> statement-breakpoint
CREATE INDEX "signature_operation_actor_created_at_idx" ON "core"."signature_operation" ("organization_id","actor_id","created_at");--> statement-breakpoint
ALTER TABLE "core"."signature_operation" ADD CONSTRAINT "signature_operation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signature_operation" ADD CONSTRAINT "signature_operation_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signature_operation" ADD CONSTRAINT "signature_operation_wallet_organization_fk" FOREIGN KEY ("wallet_id","organization_id") REFERENCES "core"."wallet"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signature_operation" ADD CONSTRAINT "signature_operation_session_key_wallet_organization_fk" FOREIGN KEY ("session_key_id","wallet_id","organization_id") REFERENCES "core"."session_key"("id","wallet_id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signature_operation" ADD CONSTRAINT "signature_operation_grant_session_key_actor_organization_fk" FOREIGN KEY ("session_key_grant_id","session_key_id","actor_id","organization_id") REFERENCES "core"."session_key_grant"("id","session_key_id","actor_id","organization_id") ON DELETE RESTRICT;