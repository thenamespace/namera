CREATE EXTENSION IF NOT EXISTS "pg_trgm";
--> statement-breakpoint
CREATE TABLE "core"."address_metadata" (
	"namespace" text,
	"chain_id" text,
	"address" text,
	"data" jsonb NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"refresh_after" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "address_metadata_pk" PRIMARY KEY("namespace","chain_id","address"),
	CONSTRAINT "address_metadata_data_object_check" CHECK (jsonb_typeof("data") = 'object')
);
--> statement-breakpoint
CREATE INDEX "address_metadata_refresh_after_idx" ON "core"."address_metadata" ("refresh_after");--> statement-breakpoint
CREATE INDEX "address_metadata_display_name_trgm_idx" ON "core"."address_metadata" USING gin (lower("data" #>> '{identity,displayName}') gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "address_metadata_token_symbol_trgm_idx" ON "core"."address_metadata" USING gin (lower("data" #>> '{token,symbol}') gin_trgm_ops);
