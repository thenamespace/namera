ALTER TABLE "core"."wallet_key" DROP CONSTRAINT "wallet_key_provider_version_name_unique";--> statement-breakpoint
ALTER TABLE "core"."wallet_key" DROP COLUMN "key_version_name";