ALTER TABLE "auth"."api_key" ADD COLUMN "permissions" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."api_key" ADD COLUMN "passkey_origins" jsonb DEFAULT '[]' NOT NULL;