CREATE TABLE "core"."session_key_operation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"installation_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"chain_id" text NOT NULL,
	"kind" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" text DEFAULT 'awaiting-signature' NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"transaction_hash" text,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_operation_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "session_operation_actor_idempotency_unique" UNIQUE("organization_id","actor_id","idempotency_key"),
	CONSTRAINT "session_operation_kind_check" CHECK ("kind" IN ('install', 'uninstall')),
	CONSTRAINT "session_operation_status_check" CHECK ("status" IN ('awaiting-signature', 'signed', 'submitted', 'confirmed', 'failed', 'expired')),
	CONSTRAINT "session_operation_chain_check" CHECK (COALESCE("data"->'prepared'->>'chainId' = "chain_id", false)),
	CONSTRAINT "session_operation_signature_state_check" CHECK (
    CASE WHEN "status" IN ('awaiting-signature', 'expired')
      THEN COALESCE("data"->'signed' = 'null'::jsonb, false)
      ELSE COALESCE(jsonb_typeof("data"->'signed') = 'object', false)
    END),
	CONSTRAINT "session_operation_signed_binding_check" CHECK (
    "data"->'signed' = 'null'::jsonb OR COALESCE(
      (("data"->'signed'->'userOperation') - 'signature') = (("data"->'prepared'->'userOperation') - 'signature')
      AND (("data"->'signed') - 'userOperation' - 'userOperationHash') = (("data"->'prepared') - 'userOperation' - 'context'), false)),
	CONSTRAINT "session_operation_receipt_check" CHECK (
    ("status" IN ('confirmed', 'failed')) = ("transaction_hash" IS NOT NULL)
    AND ("status" IN ('confirmed', 'failed', 'expired')) = ("finished_at" IS NOT NULL)),
	CONSTRAINT "session_operation_lease_check" CHECK (
    ("lease_token" IS NULL OR "lease_expires_at" IS NOT NULL)
    AND ("status" IN ('signed', 'submitted') OR ("lease_token" IS NULL AND "lease_expires_at" IS NULL)))
);
--> statement-breakpoint
ALTER TABLE "core"."session_key_installation" ADD CONSTRAINT "session_installation_id_wallet_chain_org_unique" UNIQUE("id","wallet_id","chain_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_operation_one_pending_unique" ON "core"."session_key_operation" ("wallet_id","chain_id") WHERE "status" IN ('awaiting-signature', 'signed', 'submitted');--> statement-breakpoint
CREATE INDEX "session_operation_reconcile_idx" ON "core"."session_key_operation" ("status","lease_expires_at");--> statement-breakpoint
CREATE INDEX "session_operation_expiry_idx" ON "core"."session_key_operation" ("expires_at") WHERE "status" = 'awaiting-signature';--> statement-breakpoint
CREATE INDEX "session_operation_installation_created_idx" ON "core"."session_key_operation" ("organization_id","installation_id","created_at");--> statement-breakpoint
ALTER TABLE "core"."session_key_operation" ADD CONSTRAINT "session_operation_actor_org_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_operation" ADD CONSTRAINT "session_operation_installation_chain_org_fk" FOREIGN KEY ("installation_id","wallet_id","chain_id","organization_id") REFERENCES "core"."session_key_installation"("id","wallet_id","chain_id","organization_id") ON DELETE RESTRICT;