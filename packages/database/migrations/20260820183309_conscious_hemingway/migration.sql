CREATE TABLE "billing"."meter_balance" (
	"organization_id" text NOT NULL,
	"period_id" text,
	"meter_key" text,
	"meter_version" integer NOT NULL,
	"unit" text NOT NULL,
	"included_amount" bigint NOT NULL,
	"hard_limit_amount" bigint,
	"consumed_amount" bigint DEFAULT 0 NOT NULL,
	"reserved_amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_meter_balance_pk" PRIMARY KEY("period_id","meter_key"),
	CONSTRAINT "billing_meter_balance_version_check" CHECK ("meter_version" >= 1),
	CONSTRAINT "billing_meter_balance_amounts_check" CHECK ("included_amount" >= 0 AND "consumed_amount" >= 0 AND "reserved_amount" >= 0),
	CONSTRAINT "billing_meter_balance_hard_limit_check" CHECK ("hard_limit_amount" IS NULL OR ("hard_limit_amount" >= "included_amount" AND "consumed_amount" + "reserved_amount" <= "hard_limit_amount"))
);
--> statement-breakpoint
CREATE TABLE "billing"."period" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"plan" text NOT NULL,
	"plan_version" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_period_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "billing_period_subscription_window_unique" UNIQUE("subscription_id","starts_at","ends_at"),
	CONSTRAINT "billing_period_plan_version_check" CHECK ("plan_version" >= 1),
	CONSTRAINT "billing_period_window_check" CHECK ("ends_at" > "starts_at"),
	CONSTRAINT "billing_period_lifecycle_check" CHECK (("status" = 'open' AND "closed_at" IS NULL) OR ("status" = 'closed' AND "closed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "billing"."subscription_item" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"component_key" text NOT NULL,
	"billing_mode" text NOT NULL,
	"provider" text NOT NULL,
	"provider_subscription_item_id" text NOT NULL,
	"provider_price_id" text NOT NULL,
	"quantity" bigint,
	"status" text DEFAULT 'active' NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_subscription_item_mode_quantity_check" CHECK (("billing_mode" = 'licensed' AND "quantity" IS NOT NULL AND "quantity" >= 0) OR ("billing_mode" = 'metered' AND "quantity" IS NULL)),
	CONSTRAINT "billing_subscription_item_lifecycle_check" CHECK (("status" = 'active' AND "removed_at" IS NULL) OR ("status" = 'removed' AND "removed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "billing"."usage_delivery" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"usage_event_id" text NOT NULL,
	"provider" text NOT NULL,
	"destination" text NOT NULL,
	"provider_customer_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider_usage_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_error" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_usage_delivery_event_destination_unique" UNIQUE("usage_event_id","provider","destination"),
	CONSTRAINT "billing_usage_delivery_provider_idempotency_unique" UNIQUE("provider","idempotency_key"),
	CONSTRAINT "billing_usage_delivery_attempts_check" CHECK ("attempts" >= 0),
	CONSTRAINT "billing_usage_delivery_lifecycle_check" CHECK (("status" = 'delivered' AND "delivered_at" IS NOT NULL) OR ("status" IN ('pending', 'retrying', 'failed') AND "delivered_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "billing"."usage_event" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"period_id" text NOT NULL,
	"meter_key" text NOT NULL,
	"meter_version" integer NOT NULL,
	"unit" text NOT NULL,
	"amount" bigint NOT NULL,
	"direction" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"reservation_id" text,
	"idempotency_key" text NOT NULL,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"reverses_usage_event_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_usage_event_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "billing_usage_event_organization_idempotency_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "billing_usage_event_version_check" CHECK ("meter_version" >= 1),
	CONSTRAINT "billing_usage_event_amount_check" CHECK ("amount" > 0),
	CONSTRAINT "billing_usage_event_reversal_check" CHECK (("direction" = 'debit' AND "reverses_usage_event_id" IS NULL) OR ("direction" = 'credit' AND "reverses_usage_event_id" IS NOT NULL)),
	CONSTRAINT "billing_usage_event_not_self_reversal_check" CHECK ("reverses_usage_event_id" IS NULL OR "reverses_usage_event_id" <> "id")
);
--> statement-breakpoint
CREATE TABLE "billing"."usage_reservation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"period_id" text NOT NULL,
	"meter_key" text NOT NULL,
	"meter_version" integer NOT NULL,
	"unit" text NOT NULL,
	"amount" bigint NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_usage_reservation_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "billing_usage_reservation_settlement_reference_unique" UNIQUE("id","organization_id","period_id","meter_key"),
	CONSTRAINT "billing_usage_reservation_source_unique" UNIQUE("period_id","meter_key","source_type","source_id"),
	CONSTRAINT "billing_usage_reservation_version_check" CHECK ("meter_version" >= 1),
	CONSTRAINT "billing_usage_reservation_amount_check" CHECK ("amount" > 0),
	CONSTRAINT "billing_usage_reservation_lifecycle_check" CHECK (("status" = 'active' AND "settled_at" IS NULL AND "released_at" IS NULL) OR ("status" = 'settled' AND "settled_at" IS NOT NULL AND "released_at" IS NULL) OR ("status" IN ('released', 'expired') AND "settled_at" IS NULL AND "released_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "billing"."subscription" ADD CONSTRAINT "billing_subscription_id_organization_unique" UNIQUE("id","organization_id");--> statement-breakpoint
CREATE INDEX "billing_meter_balance_organization_period_idx" ON "billing"."meter_balance" ("organization_id","period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_open_organization_uidx" ON "billing"."period" ("organization_id") WHERE "status" = 'open';--> statement-breakpoint
CREATE INDEX "billing_period_organization_starts_at_idx" ON "billing"."period" ("organization_id","starts_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "billing_period_status_ends_at_idx" ON "billing"."period" ("status","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscription_item_provider_item_uidx" ON "billing"."subscription_item" ("provider","provider_subscription_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscription_item_active_component_uidx" ON "billing"."subscription_item" ("subscription_id","component_key") WHERE "status" = 'active';--> statement-breakpoint
CREATE INDEX "billing_subscription_item_organization_component_idx" ON "billing"."subscription_item" ("organization_id","component_key");--> statement-breakpoint
CREATE INDEX "billing_usage_delivery_status_next_attempt_idx" ON "billing"."usage_delivery" ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "billing_usage_delivery_organization_created_at_idx" ON "billing"."usage_delivery" ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "billing_usage_event_reservation_uidx" ON "billing"."usage_event" ("reservation_id") WHERE "reservation_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_usage_event_debit_source_uidx" ON "billing"."usage_event" ("period_id","meter_key","source_type","source_id") WHERE "direction" = 'debit';--> statement-breakpoint
CREATE INDEX "billing_usage_event_organization_period_meter_occurred_idx" ON "billing"."usage_event" ("organization_id","period_id","meter_key","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "billing_usage_event_source_idx" ON "billing"."usage_event" ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "billing_usage_reservation_organization_period_status_idx" ON "billing"."usage_reservation" ("organization_id","period_id","status");--> statement-breakpoint
CREATE INDEX "billing_usage_reservation_status_expires_at_idx" ON "billing"."usage_reservation" ("status","expires_at");--> statement-breakpoint
ALTER TABLE "billing"."meter_balance" ADD CONSTRAINT "billing_meter_balance_period_organization_fk" FOREIGN KEY ("period_id","organization_id") REFERENCES "billing"."period"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."period" ADD CONSTRAINT "billing_period_subscription_organization_fk" FOREIGN KEY ("subscription_id","organization_id") REFERENCES "billing"."subscription"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."subscription_item" ADD CONSTRAINT "billing_subscription_item_subscription_organization_fk" FOREIGN KEY ("subscription_id","organization_id") REFERENCES "billing"."subscription"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."usage_delivery" ADD CONSTRAINT "billing_usage_delivery_event_organization_fk" FOREIGN KEY ("usage_event_id","organization_id") REFERENCES "billing"."usage_event"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."usage_event" ADD CONSTRAINT "billing_usage_event_period_organization_fk" FOREIGN KEY ("period_id","organization_id") REFERENCES "billing"."period"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."usage_event" ADD CONSTRAINT "billing_usage_event_reservation_scope_fk" FOREIGN KEY ("reservation_id","organization_id","period_id","meter_key") REFERENCES "billing"."usage_reservation"("id","organization_id","period_id","meter_key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."usage_event" ADD CONSTRAINT "billing_usage_event_reversal_organization_fk" FOREIGN KEY ("reverses_usage_event_id","organization_id") REFERENCES "billing"."usage_event"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."usage_reservation" ADD CONSTRAINT "billing_usage_reservation_period_organization_fk" FOREIGN KEY ("period_id","organization_id") REFERENCES "billing"."period"("id","organization_id") ON DELETE RESTRICT;