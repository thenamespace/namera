CREATE TABLE "core"."signing_key" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"purpose" text NOT NULL,
	"custody" text NOT NULL,
	"algorithm" text NOT NULL,
	"public_key_hex" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signing_key_purpose_check" CHECK ("purpose" IN ('wallet-root', 'session')),
	CONSTRAINT "signing_key_custody_check" CHECK ("custody" IN ('local', 'namera-managed')),
	CONSTRAINT "signing_key_algorithm_check" CHECK ("algorithm" IN ('p256', 'secp256k1', 'ed25519')),
	CONSTRAINT "signing_key_status_check" CHECK ("status" IN ('active', 'disabled', 'destroyed')),
	CONSTRAINT "signing_key_public_key_hex_check" CHECK ("public_key_hex" ~ '^0x[0-9a-f]+$' AND mod(length("public_key_hex") - 2, 2) = 0),
	CONSTRAINT "signing_key_data_object_check" CHECK (jsonb_typeof("data") = 'object'),
	CONSTRAINT "signing_key_data_type_check" CHECK ("data"->>'type' IS NOT NULL AND "data"->>'type' IN ('passkey', 'local-key', 'gcp-kms')),
	CONSTRAINT "signing_key_custody_data_check" CHECK (("custody" = 'local' AND "data"->>'type' IN ('passkey', 'local-key')) OR ("custody" = 'namera-managed' AND "data"->>'type' = 'gcp-kms')),
	CONSTRAINT "signing_key_passkey_check" CHECK ("data"->>'type' <> 'passkey' OR ("purpose" = 'wallet-root' AND "algorithm" = 'p256'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "signing_key_id_organization_uidx" ON "core"."signing_key" ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signing_key_organization_public_key_uidx" ON "core"."signing_key" ("organization_id","algorithm","public_key_hex");--> statement-breakpoint
CREATE INDEX "signing_key_organization_purpose_status_idx" ON "core"."signing_key" ("organization_id","purpose","status");--> statement-breakpoint
ALTER TABLE "core"."signing_key" ADD CONSTRAINT "signing_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;