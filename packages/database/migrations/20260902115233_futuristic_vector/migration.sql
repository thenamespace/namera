ALTER TABLE "core"."wallet" DROP CONSTRAINT "wallet_key_organization_fk";--> statement-breakpoint
DROP INDEX "core"."wallet_wallet_key_idx";--> statement-breakpoint
ALTER TABLE "core"."wallet" ADD COLUMN "signing_key_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."wallet" DROP COLUMN "wallet_key_id";--> statement-breakpoint
CREATE INDEX "wallet_signing_key_idx" ON "core"."wallet" ("signing_key_id");--> statement-breakpoint
ALTER TABLE "core"."wallet" ADD CONSTRAINT "wallet_signing_key_organization_fk" FOREIGN KEY ("signing_key_id","organization_id") REFERENCES "core"."signing_key"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signing_key" DROP CONSTRAINT "signing_key_data_type_check", ADD CONSTRAINT "signing_key_data_type_check" CHECK ("data"->>'type' IS NOT NULL AND "data"->>'type' IN ('passkey', 'local-key', 'gcp-kms', 'local-provider'));--> statement-breakpoint
ALTER TABLE "core"."signing_key" DROP CONSTRAINT "signing_key_custody_data_check", ADD CONSTRAINT "signing_key_custody_data_check" CHECK (("custody" = 'local' AND "data"->>'type' IN ('passkey', 'local-key')) OR ("custody" = 'namera-managed' AND "data"->>'type' IN ('gcp-kms', 'local-provider')));