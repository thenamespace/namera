CREATE TABLE "core"."feedback" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"organization_id" text,
	"category" text NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"page_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_category_check" CHECK ("category" in ('bug', 'feature_request', 'general')),
	CONSTRAINT "feedback_status_check" CHECK ("status" in ('new', 'in_review', 'planned', 'completed', 'closed')),
	CONSTRAINT "feedback_data_check" CHECK (jsonb_typeof("data") = 'object' AND "data" ? 'version' AND jsonb_typeof("data"->'version') = 'number' AND ("data"->>'version')::numeric >= 1),
	CONSTRAINT "feedback_page_path_check" CHECK ("page_path" is null OR (length("page_path") <= 500 AND "page_path" ~ '^/([^/?#[:space:]][^?#[:space:]]*)?$'))
);
--> statement-breakpoint
CREATE INDEX "feedback_status_id_idx" ON "core"."feedback" ("status","id");--> statement-breakpoint
CREATE INDEX "feedback_category_id_idx" ON "core"."feedback" ("category","id");--> statement-breakpoint
CREATE INDEX "feedback_user_idx" ON "core"."feedback" ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_organization_idx" ON "core"."feedback" ("organization_id");--> statement-breakpoint
ALTER TABLE "core"."feedback" ADD CONSTRAINT "feedback_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."feedback" ADD CONSTRAINT "feedback_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;