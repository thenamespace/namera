DROP INDEX "core"."execution_organization_created_at_idx";--> statement-breakpoint
CREATE INDEX "execution_organization_created_at_idx" ON "core"."execution" ("organization_id","created_at","id");