CREATE TABLE "auth"."oauth_authorization_code" (
	"id" text PRIMARY KEY,
	"authorization_id" text NOT NULL,
	"client_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text NOT NULL,
	"resource" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_authorization_code_challenge_method_check" CHECK ("code_challenge_method" = 'S256')
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_authorization_request" (
	"id" text PRIMARY KEY,
	"client_id" text NOT NULL,
	"user_id" text,
	"organization_id" text,
	"redirect_uri" text NOT NULL,
	"response_type" text NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text NOT NULL,
	"resource" text NOT NULL,
	"requested_scopes" jsonb NOT NULL,
	"state" text,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"denied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_authorization_request_status_check" CHECK ("status" IN ('pending', 'approved', 'denied', 'expired')),
	CONSTRAINT "oauth_authorization_request_response_type_check" CHECK ("response_type" = 'code'),
	CONSTRAINT "oauth_authorization_request_challenge_method_check" CHECK ("code_challenge_method" = 'S256')
);
--> statement-breakpoint
CREATE TABLE "auth"."mcp_authorization" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"client_id" text NOT NULL,
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
	CONSTRAINT "mcp_authorization_id_client_unique" UNIQUE("id","client_id"),
	CONSTRAINT "mcp_authorization_status_check" CHECK ("status" IN ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_client" (
	"id" text PRIMARY KEY,
	"client_id" text NOT NULL,
	"registration_type" text NOT NULL,
	"client_name" text NOT NULL,
	"client_uri" text,
	"logo_uri" text,
	"redirect_uris" jsonb NOT NULL,
	"grant_types" jsonb NOT NULL,
	"response_types" jsonb NOT NULL,
	"token_endpoint_auth_method" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"status" text NOT NULL,
	"metadata_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_client_registration_type_check" CHECK ("registration_type" IN ('metadata-document', 'pre-registered', 'dynamic')),
	CONSTRAINT "oauth_client_status_check" CHECK ("status" IN ('active', 'disabled')),
	CONSTRAINT "oauth_client_auth_method_check" CHECK ("token_endpoint_auth_method" = 'none')
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_token" (
	"id" text PRIMARY KEY,
	"authorization_id" text NOT NULL,
	"client_id" text NOT NULL,
	"type" text NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" text,
	"parent_id" text,
	"resource" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_token_type_check" CHECK ("type" IN ('access', 'refresh')),
	CONSTRAINT "oauth_token_shape_check" CHECK (("type" = 'access' AND "family_id" IS NULL AND "parent_id" IS NULL AND "consumed_at" IS NULL) OR ("type" = 'refresh' AND "family_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_authorization_code_hash_uidx" ON "auth"."oauth_authorization_code" ("code_hash");--> statement-breakpoint
CREATE INDEX "oauth_authorization_code_authorization_created_idx" ON "auth"."oauth_authorization_code" ("authorization_id","created_at");--> statement-breakpoint
CREATE INDEX "oauth_authorization_request_client_status_idx" ON "auth"."oauth_authorization_request" ("client_id","status");--> statement-breakpoint
CREATE INDEX "oauth_authorization_request_user_created_idx" ON "auth"."oauth_authorization_request" ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_authorization_actor_uidx" ON "auth"."mcp_authorization" ("actor_id");--> statement-breakpoint
CREATE INDEX "mcp_authorization_organization_created_idx" ON "auth"."mcp_authorization" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "mcp_authorization_client_status_idx" ON "auth"."mcp_authorization" ("client_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_client_client_id_uidx" ON "auth"."oauth_client" ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_client_status_idx" ON "auth"."oauth_client" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_token_hash_uidx" ON "auth"."oauth_token" ("token_hash");--> statement-breakpoint
CREATE INDEX "oauth_token_authorization_type_idx" ON "auth"."oauth_token" ("authorization_id","type");--> statement-breakpoint
CREATE INDEX "oauth_token_family_idx" ON "auth"."oauth_token" ("family_id");--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization_code" ADD CONSTRAINT "oauth_authorization_code_client_id_oauth_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization_code" ADD CONSTRAINT "oauth_authorization_code_authorization_client_fk" FOREIGN KEY ("authorization_id","client_id") REFERENCES "auth"."mcp_authorization"("id","client_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization_request" ADD CONSTRAINT "oauth_authorization_request_client_id_oauth_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization_request" ADD CONSTRAINT "oauth_authorization_request_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization_request" ADD CONSTRAINT "oauth_authorization_request_X8Wzkrq6bTrt_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."mcp_authorization" ADD CONSTRAINT "mcp_authorization_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."mcp_authorization" ADD CONSTRAINT "mcp_authorization_client_id_oauth_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."mcp_authorization" ADD CONSTRAINT "mcp_authorization_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."mcp_authorization" ADD CONSTRAINT "mcp_authorization_authorizer_organization_fk" FOREIGN KEY ("authorized_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."mcp_authorization" ADD CONSTRAINT "mcp_authorization_revoker_organization_fk" FOREIGN KEY ("revoked_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_token" ADD CONSTRAINT "oauth_token_client_id_oauth_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_token" ADD CONSTRAINT "oauth_token_authorization_client_fk" FOREIGN KEY ("authorization_id","client_id") REFERENCES "auth"."mcp_authorization"("id","client_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_token" ADD CONSTRAINT "oauth_token_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "auth"."oauth_token"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."actor" DROP CONSTRAINT "actor_type_check", ADD CONSTRAINT "actor_type_check" CHECK ("type" IN ('user', 'api-key', 'mcp'));