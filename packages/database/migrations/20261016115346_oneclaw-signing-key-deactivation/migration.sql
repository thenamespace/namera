CREATE TABLE "jobs"."signing_key_deactivation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"signing_key_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"last_error_code" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signing_key_deactivation_status_check" CHECK ("status" IN ('pending', 'completed', 'needs-attention')),
	CONSTRAINT "signing_key_deactivation_attempts_check" CHECK ("attempts" >= 0),
	CONSTRAINT "signing_key_deactivation_lease_check" CHECK (("lease_token" IS NULL) = ("lease_expires_at" IS NULL)
        AND ("status" = 'pending' OR "lease_token" IS NULL)),
	CONSTRAINT "signing_key_deactivation_completed_check" CHECK (("status" = 'completed') = ("completed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "signing_key_deactivation_signer_org_uidx" ON "jobs"."signing_key_deactivation" ("signing_key_id","organization_id");--> statement-breakpoint
CREATE INDEX "signing_key_deactivation_due_idx" ON "jobs"."signing_key_deactivation" ("available_at","id") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "signing_key_deactivation_lease_idx" ON "jobs"."signing_key_deactivation" ("lease_expires_at") WHERE "status" = 'pending';--> statement-breakpoint
ALTER TABLE "jobs"."signing_key_deactivation" ADD CONSTRAINT "signing_key_deactivation_signer_org_fk" FOREIGN KEY ("signing_key_id","organization_id") REFERENCES "core"."signing_key"("id","organization_id") ON DELETE RESTRICT;
--> statement-breakpoint
-- Backfill revoked sessions without making provider calls. Signer IDs are stable
-- UUIDv7 identifiers and can also identify these jobs and audit rows in separate tables.
WITH disabled AS (
  UPDATE core.signing_key AS signer
  SET status = 'disabled', updated_at = now()
  WHERE signer.purpose = 'session'
    AND signer.custody = 'namera-managed'
    AND signer.data->>'type' = '1claw'
    AND signer.status IN ('active', 'disabled')
    AND EXISTS (
      SELECT 1 FROM core.session_key AS session
      WHERE session.signing_key_id = signer.id
        AND session.organization_id = signer.organization_id
        AND session.status IN ('revoking', 'revoked')
    )
  RETURNING signer.id, signer.organization_id
), queued AS (
  INSERT INTO jobs.signing_key_deactivation (id, organization_id, signing_key_id)
  SELECT id, organization_id, id FROM disabled
  ON CONFLICT (signing_key_id, organization_id) DO NOTHING
  RETURNING id, organization_id, signing_key_id
)
INSERT INTO audit.organization_events (
  id, organization_id, actor_id, event, source, resource_type, resource_id, data, correlation_id
)
SELECT id, organization_id, NULL, 'signing_key.deactivation_requested', 'system',
  'signing-key', signing_key_id, '{"version":1,"provider":"1claw"}'::jsonb,
  'migration:oneclaw-deactivation:' || id
FROM queued;
