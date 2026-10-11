CREATE TABLE "core"."address_catalog" (
	"id" text PRIMARY KEY,
	"namespace" text NOT NULL,
	"slug" text NOT NULL,
	"search" text[] NOT NULL,
	"search_text" text NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "address_catalog_namespace_slug_unique" UNIQUE("namespace","slug"),
	CONSTRAINT "address_catalog_id_namespace_unique" UNIQUE("id","namespace"),
	CONSTRAINT "address_catalog_namespace_check" CHECK ("namespace" = 'eip155'),
	CONSTRAINT "address_catalog_status_check" CHECK ("status" IN ('draft', 'published', 'archived')),
	CONSTRAINT "address_catalog_revision_check" CHECK ("revision" > 0),
	CONSTRAINT "address_catalog_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "address_catalog_data_check" CHECK ((
    jsonb_typeof("data") = 'object'
    AND "data"->'version' = '1'::jsonb
    AND "data"->>'type' IN ('erc20', 'contract')
    AND jsonb_typeof("data"->'display') = 'object'
    AND jsonb_typeof("data"->'details') = 'object'
    AND ("data"->>'type' <> 'erc20' OR jsonb_typeof("data"->'details'->'symbol') = 'string')
    AND NOT ("data" ?| ARRAY['abi', 'abiOverride', 'interfaceId'])
  ) IS TRUE)
);
--> statement-breakpoint
CREATE TABLE "core"."address_catalog_entry" (
	"id" text PRIMARY KEY,
	"catalog_id" text NOT NULL,
	"namespace" text NOT NULL,
	"chain_id" text NOT NULL,
	"address" text NOT NULL,
	"interface_id" text,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'disabled' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "address_catalog_entry_address_unique" UNIQUE("namespace","chain_id","address"),
	CONSTRAINT "address_catalog_entry_namespace_check" CHECK ("namespace" = 'eip155'),
	CONSTRAINT "address_catalog_entry_chain_check" CHECK ("chain_id" IN (
    'eip155:1', 'eip155:10', 'eip155:8453', 'eip155:42161',
    'eip155:84532', 'eip155:421614', 'eip155:11155111', 'eip155:11155420'
  )),
	CONSTRAINT "address_catalog_entry_address_check" CHECK ("address" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "address_catalog_entry_status_check" CHECK ("status" IN ('active', 'deprecated', 'disabled')),
	CONSTRAINT "address_catalog_entry_revision_check" CHECK ("revision" > 0),
	CONSTRAINT "address_catalog_entry_data_check" CHECK ((
    jsonb_typeof("data") = 'object'
    AND "data"->'version' = '1'::jsonb
    AND "data"->>'type' IN ('erc20', 'contract')
    AND NOT ("data" ?| ARRAY['abi', 'abiOverride', 'interfaceId'])
    AND CASE WHEN "data"->>'type' = 'erc20' THEN
      jsonb_typeof("data"->'decimals') = 'number'
      AND "data"->>'decimals' ~ '^(0|[1-9][0-9]{0,2})$'
      AND ("data"->>'decimals')::numeric BETWEEN 0 AND 255
    ELSE NOT ("data" ? 'decimals') END
  ) IS TRUE)
);
--> statement-breakpoint
CREATE TABLE "core"."contract_interface" (
	"id" text PRIMARY KEY,
	"format" text NOT NULL,
	"document" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_interface_format_hash_unique" UNIQUE("format","content_hash"),
	CONSTRAINT "contract_interface_format_check" CHECK ("format" = 'evm-abi'),
	CONSTRAINT "contract_interface_document_check" CHECK (jsonb_typeof("document") = 'array'),
	CONSTRAINT "contract_interface_hash_check" CHECK ("content_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE INDEX "address_catalog_search_trgm_idx" ON "core"."address_catalog" USING gin ("search_text" gin_trgm_ops) WHERE "status" = 'published';--> statement-breakpoint
CREATE INDEX "address_catalog_entry_catalog_idx" ON "core"."address_catalog_entry" ("catalog_id","namespace");--> statement-breakpoint
CREATE INDEX "address_catalog_entry_active_catalog_chain_idx" ON "core"."address_catalog_entry" ("catalog_id","chain_id") WHERE "status" = 'active';--> statement-breakpoint
CREATE INDEX "address_catalog_entry_interface_idx" ON "core"."address_catalog_entry" ("interface_id");--> statement-breakpoint
ALTER TABLE "core"."address_catalog_entry" ADD CONSTRAINT "address_catalog_entry_interface_id_contract_interface_id_fkey" FOREIGN KEY ("interface_id") REFERENCES "core"."contract_interface"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."address_catalog_entry" ADD CONSTRAINT "address_catalog_entry_catalog_namespace_fk" FOREIGN KEY ("catalog_id","namespace") REFERENCES "core"."address_catalog"("id","namespace") ON DELETE RESTRICT;