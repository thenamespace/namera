CREATE TABLE "auth"."api_key" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"created_by_actor_id" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"key_hash" text NOT NULL,
	"key_start" text NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_id_organization_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "api_key_actor_uidx" ON "auth"."api_key" ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_key_hash_uidx" ON "auth"."api_key" ("key_hash");--> statement-breakpoint
CREATE INDEX "api_key_organization_created_idx" ON "auth"."api_key" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "api_key_organization_last_used_idx" ON "auth"."api_key" ("organization_id","last_used_at");--> statement-breakpoint
ALTER TABLE "auth"."api_key" ADD CONSTRAINT "api_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."api_key" ADD CONSTRAINT "api_key_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."api_key" ADD CONSTRAINT "api_key_creator_organization_fk" FOREIGN KEY ("created_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."api_key" ADD CONSTRAINT "api_key_revoker_organization_fk" FOREIGN KEY ("revoked_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."actor" DROP CONSTRAINT "actor_type_check", ADD CONSTRAINT "actor_type_check" CHECK ("type" IN ('user', 'api-key'));