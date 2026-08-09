CREATE SCHEMA "core";
--> statement-breakpoint
CREATE TABLE "core"."wallet_key" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"algorithm" text NOT NULL,
	"protection_level" text NOT NULL,
	"key_version_name" text NOT NULL,
	"public_key_hex" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_key_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "wallet_key_provider_version_name_unique" UNIQUE("provider","key_version_name")
);
--> statement-breakpoint
CREATE TABLE "core"."wallet" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"wallet_key_id" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_actor_id" text NOT NULL,
	"family" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "wallet_key_organization_status_idx" ON "core"."wallet_key" ("organization_id","status");--> statement-breakpoint
CREATE INDEX "wallet_organization_status_idx" ON "core"."wallet" ("organization_id","status");--> statement-breakpoint
CREATE INDEX "wallet_wallet_key_idx" ON "core"."wallet" ("wallet_key_id");--> statement-breakpoint
CREATE INDEX "wallet_created_by_actor_idx" ON "core"."wallet" ("created_by_actor_id");--> statement-breakpoint
ALTER TABLE "core"."wallet_key" ADD CONSTRAINT "wallet_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet" ADD CONSTRAINT "wallet_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet" ADD CONSTRAINT "wallet_key_organization_fk" FOREIGN KEY ("wallet_key_id","organization_id") REFERENCES "core"."wallet_key"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet" ADD CONSTRAINT "wallet_creator_organization_fk" FOREIGN KEY ("created_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;