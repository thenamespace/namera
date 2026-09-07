CREATE TABLE "core"."session_key_installation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"session_key_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"namespace" text NOT NULL,
	"chain_id" text NOT NULL,
	"entity_id" integer NOT NULL,
	"configuration_hash" text NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"install_user_operation_hash" text,
	"install_transaction_hash" text,
	"uninstall_user_operation_hash" text,
	"uninstall_transaction_hash" text,
	"installed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_installation_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "session_installation_session_chain_unique" UNIQUE("organization_id","session_key_id","chain_id"),
	CONSTRAINT "session_installation_wallet_chain_entity_unique" UNIQUE("organization_id","wallet_id","chain_id","entity_id"),
	CONSTRAINT "session_installation_namespace_check" CHECK ("namespace" = 'eip155' AND "chain_id" ~ '^eip155:[1-9][0-9]*$'),
	CONSTRAINT "session_installation_entity_check" CHECK ("entity_id" BETWEEN 1 AND 2147483646 AND COALESCE(("data"->'authorization'->>'entityId')::integer = "entity_id", false)),
	CONSTRAINT "session_installation_status_check" CHECK ("status" IN ('pending', 'submitted', 'installed', 'revoking', 'revoked', 'failed')),
	CONSTRAINT "session_installation_receipt_check" CHECK (
    ("status" NOT IN ('submitted', 'installed', 'revoking', 'revoked') OR "install_user_operation_hash" IS NOT NULL)
    AND ("status" NOT IN ('installed', 'revoking', 'revoked') OR ("install_transaction_hash" IS NOT NULL AND "installed_at" IS NOT NULL))
    AND ("status" <> 'revoked' OR ("uninstall_user_operation_hash" IS NOT NULL AND "uninstall_transaction_hash" IS NOT NULL AND "revoked_at" IS NOT NULL))
  )
);
--> statement-breakpoint
CREATE INDEX "session_installation_wallet_chain_status_idx" ON "core"."session_key_installation" ("organization_id","wallet_id","chain_id","status");--> statement-breakpoint
CREATE INDEX "session_installation_status_updated_idx" ON "core"."session_key_installation" ("status","updated_at");--> statement-breakpoint
ALTER TABLE "core"."session_key_installation" ADD CONSTRAINT "session_installation_session_wallet_org_fk" FOREIGN KEY ("session_key_id","wallet_id","organization_id") REFERENCES "core"."session_key"("id","wallet_id","organization_id") ON DELETE RESTRICT;