ALTER TABLE "core"."session_key" DROP CONSTRAINT "session_key_signing_key_organization_fk";--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD COLUMN "signing_key_purpose" text DEFAULT 'session' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "signing_key_id_organization_purpose_uidx" ON "core"."signing_key" ("id","organization_id","purpose");--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_signing_key_purpose_fk" FOREIGN KEY ("signing_key_id","organization_id","signing_key_purpose") REFERENCES "core"."signing_key"("id","organization_id","purpose") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_signing_key_purpose_check" CHECK ("signing_key_purpose" = 'session');--> statement-breakpoint
ALTER TABLE "core"."signing_key" ADD CONSTRAINT "signing_key_session_connection_check" CHECK ("purpose" <> 'session' OR "data"->>'type' <> '1claw' OR "provider_connection_id" IS NOT NULL);