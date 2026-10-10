CREATE TABLE "core"."credentials" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"encrypted_payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credentials_type_check" CHECK ("type" IN ('1claw-agent')),
	CONSTRAINT "credentials_data_check" CHECK ((
    jsonb_typeof("data") = 'object'
    AND "data"->'version' = '1'::jsonb
    AND jsonb_typeof("data"->'agentId') = 'string'
    AND length("data"->>'agentId') > 0
  ) IS TRUE),
	CONSTRAINT "credentials_encrypted_payload_check" CHECK (length("encrypted_payload") > 0)
);
--> statement-breakpoint
ALTER TABLE "core"."signing_key" ADD COLUMN "credential_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_id_organization_uidx" ON "core"."credentials" ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_organization_agent_uidx" ON "core"."credentials" ("organization_id","type",("data"->>'agentId')) WHERE "type" = '1claw-agent';--> statement-breakpoint
CREATE INDEX "signing_key_credential_organization_idx" ON "core"."signing_key" ("credential_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signing_key_organization_oneclaw_key_uidx" ON "core"."signing_key" ("organization_id",("data"->>'agentId'),("data"->>'providerKeyId'),(("data"->>'keyVersion')::numeric)) WHERE "data"->>'type' = '1claw';--> statement-breakpoint
ALTER TABLE "core"."credentials" ADD CONSTRAINT "credentials_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signing_key" ADD CONSTRAINT "signing_key_credential_organization_fk" FOREIGN KEY ("credential_id","organization_id") REFERENCES "core"."credentials"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signing_key" ADD CONSTRAINT "signing_key_credential_check" CHECK ((
      ("data"->>'type' = '1claw' AND "credential_id" IS NOT NULL)
      OR ("data"->>'type' <> '1claw' AND "credential_id" IS NULL)
    ) IS TRUE);--> statement-breakpoint
ALTER TABLE "core"."signing_key" ADD CONSTRAINT "signing_key_oneclaw_data_check" CHECK ("data"->>'type' <> '1claw' OR (
      "data"->'version' = '1'::jsonb
      AND jsonb_typeof("data"->'agentId') = 'string'
      AND length("data"->>'agentId') > 0
      AND jsonb_typeof("data"->'providerKeyId') = 'string'
      AND length("data"->>'providerKeyId') > 0
      AND CASE WHEN jsonb_typeof("data"->'keyVersion') = 'number'
        THEN ("data"->>'keyVersion')::numeric >= 1
          AND trunc(("data"->>'keyVersion')::numeric) = ("data"->>'keyVersion')::numeric
        ELSE false END
      AND (
        ("algorithm" = 'secp256k1' AND "data"->>'chain' IN ('ethereum', 'bitcoin', 'tron'))
        OR ("algorithm" = 'ed25519' AND "data"->>'chain' IN ('solana', 'xrp', 'cardano'))
      )
    ) IS TRUE);--> statement-breakpoint
ALTER TABLE "core"."signing_key" DROP CONSTRAINT "signing_key_data_type_check", ADD CONSTRAINT "signing_key_data_type_check" CHECK ("data"->>'type' IS NOT NULL AND "data"->>'type' IN ('passkey', 'local-key', 'gcp-kms', 'local-provider', '1claw'));--> statement-breakpoint
ALTER TABLE "core"."signing_key" DROP CONSTRAINT "signing_key_custody_data_check", ADD CONSTRAINT "signing_key_custody_data_check" CHECK (("custody" = 'local' AND "data"->>'type' IN ('passkey', 'local-key')) OR ("custody" = 'namera-managed' AND "data"->>'type' IN ('gcp-kms', 'local-provider', '1claw')));