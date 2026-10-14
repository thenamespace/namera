CREATE TABLE "core"."signer_provisioning" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"provider" text NOT NULL,
	"purpose" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"signing_key_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"status" text NOT NULL,
	"stage" text NOT NULL,
	"signer" jsonb,
	"resource_id" text,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signer_provisioning_status_check" CHECK ("status" IN ('pending', 'remote_started', 'ready', 'recovery_required', 'completed')),
	CONSTRAINT "signer_provisioning_purpose_check" CHECK ("purpose" IN ('wallet-root', 'session')),
	CONSTRAINT "signer_provisioning_lease_check" CHECK (("lease_token" IS NULL) = ("lease_expires_at" IS NULL)),
	CONSTRAINT "signer_provisioning_result_check" CHECK (("status" = 'completed') = ("resource_id" IS NOT NULL)),
	CONSTRAINT "signer_provisioning_signer_check" CHECK (("status" IN ('ready', 'completed')) = ("signer" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "signer_provisioning_request_uidx" ON "core"."signer_provisioning" ("organization_id","actor_id","provider","purpose","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "signer_provisioning_signing_key_uidx" ON "core"."signer_provisioning" ("signing_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signer_provisioning_credential_uidx" ON "core"."signer_provisioning" ("credential_id");--> statement-breakpoint
CREATE INDEX "signer_provisioning_recovery_idx" ON "core"."signer_provisioning" ("organization_id","status","created_at");--> statement-breakpoint
ALTER TABLE "core"."signer_provisioning" ADD CONSTRAINT "signer_provisioning_uLW12sREYGlq_fkey" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;