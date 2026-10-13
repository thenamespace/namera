CREATE TABLE "core"."wallet_signature_operation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"signing_key_id" text NOT NULL,
	"owner_binding" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"request" jsonb NOT NULL,
	"status" text DEFAULT 'prepared' NOT NULL,
	"encrypted_result" text,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"succeeded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_signature_lifecycle_check" CHECK (("status" = 'prepared' AND "encrypted_result" IS NULL AND "succeeded_at" IS NULL) OR ("status" = 'succeeded' AND "encrypted_result" IS NOT NULL AND "succeeded_at" IS NOT NULL)),
	CONSTRAINT "wallet_signature_lease_check" CHECK (("lease_token" IS NULL AND "lease_expires_at" IS NULL) OR ("status" = 'prepared' AND "lease_token" IS NOT NULL AND "lease_expires_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_signature_actor_idempotency_uidx" ON "core"."wallet_signature_operation" ("organization_id","actor_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "core"."wallet_signature_operation" ADD CONSTRAINT "wallet_signature_operation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet_signature_operation" ADD CONSTRAINT "wallet_signature_actor_org_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet_signature_operation" ADD CONSTRAINT "wallet_signature_wallet_org_fk" FOREIGN KEY ("wallet_id","organization_id") REFERENCES "core"."wallet"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet_signature_operation" ADD CONSTRAINT "wallet_signature_key_org_fk" FOREIGN KEY ("signing_key_id","organization_id") REFERENCES "core"."signing_key"("id","organization_id") ON DELETE RESTRICT;