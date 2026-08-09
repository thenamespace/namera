CREATE TABLE "auth"."actor" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actor_type_check" CHECK ("type" IN ('user'))
);
--> statement-breakpoint
ALTER TABLE "auth"."organization_member" ADD COLUMN "actor_id" text;--> statement-breakpoint
INSERT INTO "auth"."actor" (
	"id",
	"organization_id",
	"type",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"organization_id",
	'user',
	"created_at",
	"updated_at"
FROM "auth"."organization_member";--> statement-breakpoint
UPDATE "auth"."organization_member"
SET "actor_id" = "id"
WHERE "actor_id" IS NULL;--> statement-breakpoint
ALTER TABLE "auth"."organization_member" ALTER COLUMN "actor_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "actor_id_organization_uidx" ON "auth"."actor" ("id","organization_id");--> statement-breakpoint
CREATE INDEX "actor_organization_type_idx" ON "auth"."actor" ("organization_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_member_actor_uidx" ON "auth"."organization_member" ("actor_id");--> statement-breakpoint
ALTER TABLE "auth"."actor" ADD CONSTRAINT "actor_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_member" ADD CONSTRAINT "organization_member_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;
