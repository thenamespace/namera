ALTER TABLE "core"."signer_provisioning" ADD COLUMN "checkpoint" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_authorization_connection_uidx" ON "core"."credentials" (("data"->>'providerConnectionId')) WHERE "type" = '1claw-customer-authorization';--> statement-breakpoint
ALTER TABLE "core"."credentials" DROP CONSTRAINT "credentials_type_check", ADD CONSTRAINT "credentials_type_check" CHECK ("type" IN ('1claw-agent', '1claw-customer', '1claw-customer-authorization'));--> statement-breakpoint
ALTER TABLE "core"."credentials" DROP CONSTRAINT "credentials_data_check", ADD CONSTRAINT "credentials_data_check" CHECK ((
    jsonb_typeof("data") = 'object'
    AND "data"->'version' = '1'::jsonb
    AND (("type" = '1claw-agent' AND jsonb_typeof("data"->'agentId') = 'string'
    AND length("data"->>'agentId') > 0
    AND "expires_at" IS NULL)
    OR ((("type" = '1claw-customer' AND "expires_at" IS NOT NULL)
      OR ("type" = '1claw-customer-authorization' AND "expires_at" IS NULL
        AND "data"->>'status' IN ('pending', 'ready', 'recovery_required')))
      AND jsonb_typeof("data"->'providerConnectionId') = 'string'
      AND ("data"->>'providerConnectionId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND jsonb_typeof("data"->'providerAppId') = 'string' AND length("data"->>'providerAppId') > 0
      AND jsonb_typeof("data"->'externalConnectionId') = 'string' AND length("data"->>'externalConnectionId') > 0
      AND jsonb_typeof("data"->'customerId') = 'string' AND length("data"->>'customerId') > 0))
  ) IS TRUE);