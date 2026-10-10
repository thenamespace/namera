CREATE TABLE "core"."provider_connections" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_app_id" text NOT NULL,
	"external_connection_id" text,
	"customer_credential_id" text,
	"status" text NOT NULL,
	"data" jsonb NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_connections_provider_check" CHECK ("provider" = '1claw' AND length("provider_app_id") > 0),
	CONSTRAINT "provider_connections_status_check" CHECK ("status" IN ('pending', 'ready', 'disabled')),
	CONSTRAINT "provider_connections_lease_check" CHECK ((("lease_token" IS NULL AND "lease_expires_at" IS NULL) OR (length("lease_token") > 0 AND "lease_expires_at" IS NOT NULL)) IS TRUE),
	CONSTRAINT "provider_connections_data_check" CHECK ((
    jsonb_typeof("data") = 'object' AND "data"->'version' = '1'::jsonb
    AND jsonb_typeof("data"->'oidcSubject') = 'string' AND length("data"->>'oidcSubject') > 0
    AND jsonb_typeof("data"->'email') = 'string' AND "data"->>'email' LIKE '%@%'
    AND (("external_connection_id" IS NULL AND "data"->'customerId' = 'null'::jsonb)
      OR (length("external_connection_id") > 0 AND jsonb_typeof("data"->'customerId') = 'string' AND length("data"->>'customerId') > 0))
    AND ("data"->'bootstrapCompletedAt' = 'null'::jsonb OR (jsonb_typeof("data"->'bootstrapCompletedAt') = 'string' AND length("data"->>'bootstrapCompletedAt') > 0 AND "external_connection_id" IS NOT NULL))
    AND ("data"->'delegationEnabledAt' = 'null'::jsonb OR (jsonb_typeof("data"->'delegationEnabledAt') = 'string' AND length("data"->>'delegationEnabledAt') > 0 AND "customer_credential_id" IS NOT NULL AND "data"->>'bootstrapCompletedAt' IS NOT NULL))
  ) IS TRUE),
	CONSTRAINT "provider_connections_ready_check" CHECK ("status" <> 'ready' OR ("external_connection_id" IS NOT NULL AND "customer_credential_id" IS NOT NULL AND "data"->>'bootstrapCompletedAt' IS NOT NULL AND "data"->>'delegationEnabledAt' IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "core"."credentials" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."signing_key" ADD COLUMN "provider_connection_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_customer_connection_uidx" ON "core"."credentials" (("data"->>'providerConnectionId')) WHERE "type" = '1claw-customer';--> statement-breakpoint
CREATE UNIQUE INDEX "provider_connections_id_org_uidx" ON "core"."provider_connections" ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_connections_org_app_uidx" ON "core"."provider_connections" ("organization_id","provider","provider_app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_connections_remote_uidx" ON "core"."provider_connections" ("provider","provider_app_id","external_connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_connections_subject_uidx" ON "core"."provider_connections" ("provider","provider_app_id",("data"->>'oidcSubject'));--> statement-breakpoint
CREATE INDEX "signing_key_connection_idx" ON "core"."signing_key" ("provider_connection_id","organization_id");--> statement-breakpoint
ALTER TABLE "core"."provider_connections" ADD CONSTRAINT "provider_connections_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."provider_connections" ADD CONSTRAINT "provider_connections_credential_org_fk" FOREIGN KEY ("customer_credential_id","organization_id") REFERENCES "core"."credentials"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signing_key" ADD CONSTRAINT "signing_key_connection_org_fk" FOREIGN KEY ("provider_connection_id","organization_id") REFERENCES "core"."provider_connections"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signing_key" ADD CONSTRAINT "signing_key_connection_provider_check" CHECK ("provider_connection_id" IS NULL OR "data"->>'type' = '1claw');--> statement-breakpoint
ALTER TABLE "core"."credentials" DROP CONSTRAINT "credentials_type_check", ADD CONSTRAINT "credentials_type_check" CHECK ("type" IN ('1claw-agent', '1claw-customer'));--> statement-breakpoint
ALTER TABLE "core"."credentials" DROP CONSTRAINT "credentials_data_check", ADD CONSTRAINT "credentials_data_check" CHECK ((
    jsonb_typeof("data") = 'object'
    AND "data"->'version' = '1'::jsonb
    AND (("type" = '1claw-agent' AND jsonb_typeof("data"->'agentId') = 'string'
    AND length("data"->>'agentId') > 0
    AND "expires_at" IS NULL)
    OR ("type" = '1claw-customer' AND "expires_at" IS NOT NULL
      AND jsonb_typeof("data"->'providerConnectionId') = 'string'
      AND ("data"->>'providerConnectionId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND jsonb_typeof("data"->'providerAppId') = 'string' AND length("data"->>'providerAppId') > 0
      AND jsonb_typeof("data"->'externalConnectionId') = 'string' AND length("data"->>'externalConnectionId') > 0
      AND jsonb_typeof("data"->'customerId') = 'string' AND length("data"->>'customerId') > 0))
  ) IS TRUE);