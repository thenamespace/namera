CREATE TABLE "core"."execution" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"session_key_grant_id" text NOT NULL,
	"namespace" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD COLUMN "namespace" text NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."session_key_grant" ADD CONSTRAINT "session_key_grant_id_organization_unique" UNIQUE("id","organization_id");--> statement-breakpoint
CREATE INDEX "execution_organization_created_at_idx" ON "core"."execution" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "execution_session_key_grant_created_at_idx" ON "core"."execution" ("organization_id","session_key_grant_id","created_at");--> statement-breakpoint
ALTER TABLE "core"."execution" ADD CONSTRAINT "execution_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."execution" ADD CONSTRAINT "execution_session_key_grant_organization_fk" FOREIGN KEY ("session_key_grant_id","organization_id") REFERENCES "core"."session_key_grant"("id","organization_id") ON DELETE RESTRICT;