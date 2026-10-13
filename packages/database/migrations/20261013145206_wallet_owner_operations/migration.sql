CREATE TABLE "core"."wallet_operation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
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
	CONSTRAINT "wallet_operation_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "wallet_operation_actor_idempotency_unique" UNIQUE("organization_id","actor_id","idempotency_key"),
	CONSTRAINT "wallet_operation_kind_check" CHECK ("kind" IN ('set-primary-name')),
	CONSTRAINT "wallet_operation_status_check" CHECK ("status" IN ('awaiting-signature', 'signed', 'submitted', 'confirmed', 'failed', 'expired')),
	CONSTRAINT "wallet_operation_chain_check" CHECK (COALESCE("data"->'prepared'->>'chainId' = "chain_id", false)),
	CONSTRAINT "wallet_operation_signature_state_check" CHECK (
    CASE WHEN "status" IN ('awaiting-signature', 'expired')
      THEN COALESCE("data"->'signed' = 'null'::jsonb, false)
      ELSE COALESCE(jsonb_typeof("data"->'signed') = 'object', false)
    END),
	CONSTRAINT "wallet_operation_signed_binding_check" CHECK (
    "data"->'signed' = 'null'::jsonb OR COALESCE(
      (("data"->'signed'->'userOperation') - 'signature') = (("data"->'prepared'->'userOperation') - 'signature')
      AND (("data"->'signed') - 'userOperation' - 'userOperationHash') = (("data"->'prepared') - 'userOperation' - 'context'), false)),
	CONSTRAINT "wallet_operation_receipt_check" CHECK (
    ("status" IN ('confirmed', 'failed')) = ("transaction_hash" IS NOT NULL)
    AND ("status" IN ('confirmed', 'failed', 'expired')) = ("finished_at" IS NOT NULL)),
	CONSTRAINT "wallet_operation_lease_check" CHECK (
    ("lease_token" IS NULL OR "lease_expires_at" IS NOT NULL)
    AND ("status" IN ('awaiting-signature', 'signed', 'submitted') OR ("lease_token" IS NULL AND "lease_expires_at" IS NULL)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_operation_one_pending_unique" ON "core"."wallet_operation" ("wallet_id","chain_id") WHERE "status" IN ('awaiting-signature', 'signed', 'submitted');--> statement-breakpoint
CREATE INDEX "wallet_operation_reconcile_idx" ON "core"."wallet_operation" ("status","lease_expires_at");--> statement-breakpoint
CREATE INDEX "wallet_operation_expiry_idx" ON "core"."wallet_operation" ("expires_at") WHERE "status" = 'awaiting-signature';--> statement-breakpoint
CREATE INDEX "wallet_operation_wallet_created_idx" ON "core"."wallet_operation" ("organization_id","wallet_id","created_at");--> statement-breakpoint
ALTER TABLE "core"."wallet_operation" ADD CONSTRAINT "wallet_operation_actor_org_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet_operation" ADD CONSTRAINT "wallet_operation_wallet_org_fk" FOREIGN KEY ("wallet_id","organization_id") REFERENCES "core"."wallet"("id","organization_id") ON DELETE RESTRICT;