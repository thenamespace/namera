ALTER TABLE "core"."session_key" ADD COLUMN "signing_key_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."session_key" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_signing_key_unique" UNIQUE("signing_key_id");--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_signing_key_organization_fk" FOREIGN KEY ("signing_key_id","organization_id") REFERENCES "core"."signing_key"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_status_check" CHECK ("status" IN ('pending', 'active', 'revoking', 'revoked'));--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_revocation_check" CHECK (
      ("status" IN ('revoking', 'revoked')) = ("revoked_at" IS NOT NULL)
      AND ("revoked_at" IS NULL) = ("revoked_by_actor_id" IS NULL));