CREATE TABLE "auth"."oauth_authorization" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"client_id" text NOT NULL,
	"type" text NOT NULL,
	"authorized_by_actor_id" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"resource" text NOT NULL,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_actor_id" text,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_authorization_id_client_unique" UNIQUE("id","client_id"),
	CONSTRAINT "oauth_authorization_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "oauth_authorization_type_check" CHECK ("type" IN ('mcp', 'cli')),
	CONSTRAINT "oauth_authorization_status_check" CHECK ("status" IN ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_device_authorization" (
	"id" text PRIMARY KEY,
	"client_id" text NOT NULL,
	"device_code_hash" text NOT NULL,
	"user_code_hmac" text NOT NULL,
	"claimed_by_user_id" text,
	"organization_id" text,
	"authorization_id" text,
	"requested_scopes" jsonb NOT NULL,
	"resource" text NOT NULL,
	"status" text NOT NULL,
	"polling_interval_seconds" integer NOT NULL,
	"last_polled_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"denied_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_device_authorization_status_check" CHECK ("status" IN ('pending', 'approved', 'denied', 'consumed', 'expired')),
	CONSTRAINT "oauth_device_authorization_poll_interval_check" CHECK ("polling_interval_seconds" >= 5)
);
--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization_code" DROP CONSTRAINT "oauth_authorization_code_authorization_client_fk";--> statement-breakpoint
ALTER TABLE "auth"."oauth_token" DROP CONSTRAINT "oauth_token_authorization_client_fk";--> statement-breakpoint
DROP TABLE "auth"."mcp_authorization";--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_authorization_actor_uidx" ON "auth"."oauth_authorization" ("actor_id");--> statement-breakpoint
CREATE INDEX "oauth_authorization_organization_created_idx" ON "auth"."oauth_authorization" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "oauth_authorization_client_status_idx" ON "auth"."oauth_authorization" ("client_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_device_authorization_device_code_uidx" ON "auth"."oauth_device_authorization" ("device_code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_device_authorization_user_code_uidx" ON "auth"."oauth_device_authorization" ("user_code_hmac");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_device_authorization_authorization_uidx" ON "auth"."oauth_device_authorization" ("authorization_id") WHERE "authorization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "oauth_device_authorization_client_status_expiry_idx" ON "auth"."oauth_device_authorization" ("client_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "oauth_device_authorization_user_status_expiry_idx" ON "auth"."oauth_device_authorization" ("claimed_by_user_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "oauth_device_authorization_organization_created_idx" ON "auth"."oauth_device_authorization" ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization" ADD CONSTRAINT "oauth_authorization_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization" ADD CONSTRAINT "oauth_authorization_client_id_oauth_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization" ADD CONSTRAINT "oauth_authorization_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization" ADD CONSTRAINT "oauth_authorization_authorizer_organization_fk" FOREIGN KEY ("authorized_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization" ADD CONSTRAINT "oauth_authorization_revoker_organization_fk" FOREIGN KEY ("revoked_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_device_authorization" ADD CONSTRAINT "oauth_device_authorization_client_id_oauth_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_device_authorization" ADD CONSTRAINT "oauth_device_authorization_claimed_by_user_id_user_id_fkey" FOREIGN KEY ("claimed_by_user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_device_authorization" ADD CONSTRAINT "oauth_device_authorization_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_device_authorization" ADD CONSTRAINT "oauth_device_authorization_authorization_fk" FOREIGN KEY ("authorization_id","organization_id") REFERENCES "auth"."oauth_authorization"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization_code" ADD CONSTRAINT "oauth_authorization_code_authorization_client_fk" FOREIGN KEY ("authorization_id","client_id") REFERENCES "auth"."oauth_authorization"("id","client_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_token" ADD CONSTRAINT "oauth_token_authorization_client_fk" FOREIGN KEY ("authorization_id","client_id") REFERENCES "auth"."oauth_authorization"("id","client_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."actor" DROP CONSTRAINT "actor_type_check", ADD CONSTRAINT "actor_type_check" CHECK ("type" IN ('user', 'api-key', 'mcp', 'cli'));
