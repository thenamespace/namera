CREATE TABLE "core"."session_key_grant" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"session_key_id" text NOT NULL,
	"granted_by_actor_id" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."session_key" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"created_by_actor_id" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"policies" jsonb NOT NULL,
	"policy_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_key_id_organization_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "core"."wallet" ADD CONSTRAINT "wallet_id_organization_unique" UNIQUE("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_key_grant_active_actor_session_key_uidx" ON "core"."session_key_grant" ("organization_id","actor_id","session_key_id") WHERE "revoked_at" is null;--> statement-breakpoint
CREATE INDEX "session_key_grant_active_session_key_idx" ON "core"."session_key_grant" ("organization_id","session_key_id") WHERE "revoked_at" is null;--> statement-breakpoint
CREATE INDEX "session_key_grant_granter_organization_idx" ON "core"."session_key_grant" ("granted_by_actor_id","organization_id");--> statement-breakpoint
CREATE INDEX "session_key_grant_revoker_organization_idx" ON "core"."session_key_grant" ("revoked_by_actor_id","organization_id");--> statement-breakpoint
CREATE INDEX "session_key_organization_wallet_status_idx" ON "core"."session_key" ("organization_id","wallet_id","status");--> statement-breakpoint
CREATE INDEX "session_key_creator_organization_idx" ON "core"."session_key" ("created_by_actor_id","organization_id");--> statement-breakpoint
CREATE INDEX "session_key_revoker_organization_idx" ON "core"."session_key" ("revoked_by_actor_id","organization_id");--> statement-breakpoint
ALTER TABLE "core"."session_key_grant" ADD CONSTRAINT "session_key_grant_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_grant" ADD CONSTRAINT "session_key_grant_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_grant" ADD CONSTRAINT "session_key_grant_session_key_organization_fk" FOREIGN KEY ("session_key_id","organization_id") REFERENCES "core"."session_key"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_grant" ADD CONSTRAINT "session_key_grant_granter_organization_fk" FOREIGN KEY ("granted_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_grant" ADD CONSTRAINT "session_key_grant_revoker_organization_fk" FOREIGN KEY ("revoked_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_wallet_organization_fk" FOREIGN KEY ("wallet_id","organization_id") REFERENCES "core"."wallet"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_creator_organization_fk" FOREIGN KEY ("created_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_revoker_organization_fk" FOREIGN KEY ("revoked_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;