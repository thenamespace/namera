CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "billing";
--> statement-breakpoint
CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "jobs";
--> statement-breakpoint
CREATE SCHEMA "notification";
--> statement-breakpoint
CREATE TABLE "audit"."organization_events" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text,
	"event" text NOT NULL,
	"source" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"data" jsonb NOT NULL,
	"correlation_id" text NOT NULL,
	"request_id" text,
	"trace_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_events_resource_pair_check" CHECK (("resource_type" IS NULL AND "resource_id" IS NULL) OR ("resource_type" IS NOT NULL AND "resource_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "audit"."user_events" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"session_id" text,
	"event" text NOT NULL,
	"source" text NOT NULL,
	"data" jsonb NOT NULL,
	"correlation_id" text NOT NULL,
	"request_id" text,
	"trace_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."actor" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actor_type_check" CHECK ("type" IN ('user', 'api-key', 'mcp', 'cli'))
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL CONSTRAINT "user_email_unique" UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"metadata" jsonb NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_normalized_check" CHECK ("email" = lower(btrim("email")))
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"active_organization_id" text,
	"ip_address" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"id_token" text,
	"refresh_token" text,
	"password" text,
	"scope" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY,
	"purpose" text NOT NULL,
	"identifier" text NOT NULL,
	"data" jsonb NOT NULL,
	"token_hash" text,
	"code_hmac" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_identifier_normalized_check" CHECK ("identifier" = lower(btrim("identifier"))),
	CONSTRAINT "verification_purpose_fields_check" CHECK ((
        "purpose" = 'magic-link-signin'
        AND "token_hash" IS NOT NULL
        AND "code_hmac" IS NOT NULL
      ) OR (
        "purpose" = 'passkey-registration'
        AND "token_hash" IS NULL
        AND "code_hmac" IS NULL
      )),
	CONSTRAINT "verification_attempts_nonnegative_check" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_authorization_code" (
	"id" text PRIMARY KEY,
	"authorization_id" text NOT NULL,
	"client_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text NOT NULL,
	"resource" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_authorization_code_challenge_method_check" CHECK ("code_challenge_method" = 'S256')
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_authorization_request" (
	"id" text PRIMARY KEY,
	"client_id" text NOT NULL,
	"user_id" text,
	"organization_id" text,
	"redirect_uri" text NOT NULL,
	"response_type" text NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text NOT NULL,
	"resource" text NOT NULL,
	"requested_scopes" jsonb NOT NULL,
	"state" text,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"denied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_authorization_request_status_check" CHECK ("status" IN ('pending', 'approved', 'denied', 'expired')),
	CONSTRAINT "oauth_authorization_request_response_type_check" CHECK ("response_type" = 'code'),
	CONSTRAINT "oauth_authorization_request_challenge_method_check" CHECK ("code_challenge_method" = 'S256')
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_authorization" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"client_id" text NOT NULL,
	"type" text NOT NULL,
	"authorized_by_actor_id" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"resource" text NOT NULL,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_actor_id" text,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_authorization_id_client_unique" UNIQUE("id","client_id"),
	CONSTRAINT "oauth_authorization_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "oauth_authorization_type_check" CHECK ("type" IN ('mcp', 'cli')),
	CONSTRAINT "oauth_authorization_status_check" CHECK ("status" IN ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_client" (
	"id" text PRIMARY KEY,
	"client_id" text NOT NULL,
	"registration_type" text NOT NULL,
	"client_name" text NOT NULL,
	"client_uri" text,
	"logo_uri" text,
	"redirect_uris" jsonb NOT NULL,
	"grant_types" jsonb NOT NULL,
	"response_types" jsonb NOT NULL,
	"token_endpoint_auth_method" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"status" text NOT NULL,
	"metadata_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_client_registration_type_check" CHECK ("registration_type" IN ('metadata-document', 'pre-registered', 'dynamic')),
	CONSTRAINT "oauth_client_status_check" CHECK ("status" IN ('active', 'disabled')),
	CONSTRAINT "oauth_client_auth_method_check" CHECK ("token_endpoint_auth_method" = 'none')
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_device_authorization" (
	"id" text PRIMARY KEY,
	"client_id" text NOT NULL,
	"device_code_hash" text NOT NULL,
	"user_code_hmac" text NOT NULL,
	"claimed_by_user_id" text,
	"organization_id" text,
	"authorization_id" text,
	"requested_scopes" jsonb NOT NULL,
	"resource" text NOT NULL,
	"status" text NOT NULL,
	"polling_interval_seconds" integer NOT NULL,
	"last_polled_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"denied_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_device_authorization_status_check" CHECK ("status" IN ('pending', 'approved', 'denied', 'consumed', 'expired')),
	CONSTRAINT "oauth_device_authorization_poll_interval_check" CHECK ("polling_interval_seconds" >= 5)
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_token" (
	"id" text PRIMARY KEY,
	"authorization_id" text NOT NULL,
	"client_id" text NOT NULL,
	"type" text NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" text,
	"parent_id" text,
	"resource" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_token_type_check" CHECK ("type" IN ('access', 'refresh')),
	CONSTRAINT "oauth_token_shape_check" CHECK (("type" = 'access' AND "family_id" IS NULL AND "parent_id" IS NULL AND "consumed_at" IS NULL) OR ("type" = 'refresh' AND "family_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "auth"."organization" (
	"id" text PRIMARY KEY,
	"metadata" jsonb NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."organization_member" (
	"id" text PRIMARY KEY,
	"actor_id" text NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"organization_role_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."organization_role" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"key" text,
	"system_role_id" text,
	"permissions" text[],
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_role_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "organization_role_source_check" CHECK ((
        ("system_role_id" IS NOT NULL AND "key" IS NULL AND "metadata" IS NULL AND "permissions" IS NULL)
        OR
        ("system_role_id" IS NULL AND "key" IS NOT NULL AND "metadata" IS NOT NULL AND "permissions" IS NOT NULL)
      )),
	CONSTRAINT "organization_role_custom_key_not_system_check" CHECK ("system_role_id" IS NOT NULL OR "key" NOT IN ('owner', 'admin', 'member'))
);
--> statement-breakpoint
CREATE TABLE "auth"."system_role" (
	"id" text PRIMARY KEY,
	"key" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"permissions" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."invitation" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"organization_id" text NOT NULL,
	"organization_role_id" text NOT NULL,
	"inviter_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_email_normalized_check" CHECK ("email" = lower(btrim("email")))
);
--> statement-breakpoint
CREATE TABLE "billing"."account" (
	"organization_id" text PRIMARY KEY,
	"provider" text,
	"provider_customer_id" text,
	"billing_email" text,
	"currency" text DEFAULT 'usd' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_account_provider_customer_check" CHECK (("provider" IS NULL AND "provider_customer_id" IS NULL) OR ("provider" IS NOT NULL AND "provider_customer_id" IS NOT NULL))
);
--> statement-breakpoint
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
CREATE TABLE "billing"."provider_event" (
	"id" text PRIMARY KEY,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"type" text NOT NULL,
	"livemode" boolean NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_created_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_provider_event_attempts_check" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "billing"."subscription" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"provider" text,
	"provider_subscription_id" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"plan_version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"ended_at" timestamp with time zone,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_subscription_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "billing_subscription_plan_version_check" CHECK ("plan_version" >= 1),
	CONSTRAINT "billing_subscription_period_check" CHECK (("current_period_start" IS NULL AND "current_period_end" IS NULL) OR ("current_period_start" IS NOT NULL AND "current_period_end" IS NOT NULL AND "current_period_end" > "current_period_start")),
	CONSTRAINT "billing_subscription_provider_check" CHECK (("provider" IS NULL AND "provider_subscription_id" IS NULL) OR ("provider" IS NOT NULL AND "provider_subscription_id" IS NOT NULL))
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
CREATE TABLE "core"."execution" (
	"id" text PRIMARY KEY,
	"execution_submission_id" text NOT NULL CONSTRAINT "execution_submission_unique" UNIQUE,
	"organization_id" text NOT NULL,
	"session_key_grant_id" text NOT NULL,
	"namespace" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."execution_submission" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"session_key_grant_id" text NOT NULL,
	"session_key_id" text NOT NULL,
	"installation_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"namespace" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"policy_hash" text NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"data" jsonb NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "execution_submission_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "execution_submission_id_grant_organization_unique" UNIQUE("id","session_key_grant_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "core"."session_key_grant" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"session_key_id" text NOT NULL,
	"granted_by_actor_id" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_key_grant_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "session_key_grant_id_actor_organization_unique" UNIQUE("id","actor_id","organization_id"),
	CONSTRAINT "session_key_grant_signature_operation_unique" UNIQUE("id","session_key_id","actor_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "core"."session_key_policy_reservation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"session_key_id" text NOT NULL,
	"policy_id" text NOT NULL,
	"execution_submission_id" text,
	"signature_operation_id" text,
	"state_key" text NOT NULL,
	"reservation_version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_key_policy_reservation_operation_check" CHECK (num_nonnulls("execution_submission_id", "signature_operation_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "core"."session_key_policy_state" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"session_key_id" text NOT NULL,
	"policy_id" text NOT NULL,
	"state_key" text NOT NULL,
	"state_version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_key_policy_state_scope_unique" UNIQUE("organization_id","session_key_id","policy_id","state_key")
);
--> statement-breakpoint
CREATE TABLE "core"."session_key" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"signing_key_id" text NOT NULL CONSTRAINT "session_key_signing_key_unique" UNIQUE,
	"created_by_actor_id" text NOT NULL,
	"namespace" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"policies" jsonb NOT NULL,
	"policy_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_key_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "session_key_id_wallet_organization_unique" UNIQUE("id","wallet_id","organization_id"),
	CONSTRAINT "session_key_status_check" CHECK ("status" IN ('pending', 'active', 'revoking', 'revoked')),
	CONSTRAINT "session_key_revocation_check" CHECK (
      ("status" IN ('revoking', 'revoked')) = ("revoked_at" IS NOT NULL)
      AND ("revoked_at" IS NULL) = ("revoked_by_actor_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "core"."session_key_installation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"session_key_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"namespace" text NOT NULL,
	"chain_id" text NOT NULL,
	"entity_id" integer NOT NULL,
	"configuration_hash" text NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"install_user_operation_hash" text,
	"install_transaction_hash" text,
	"uninstall_user_operation_hash" text,
	"uninstall_transaction_hash" text,
	"installed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_installation_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "session_installation_id_session_org_unique" UNIQUE("id","session_key_id","organization_id"),
	CONSTRAINT "session_installation_id_wallet_chain_org_unique" UNIQUE("id","wallet_id","chain_id","organization_id"),
	CONSTRAINT "session_installation_session_chain_unique" UNIQUE("organization_id","session_key_id","chain_id"),
	CONSTRAINT "session_installation_wallet_chain_entity_unique" UNIQUE("organization_id","wallet_id","chain_id","entity_id"),
	CONSTRAINT "session_installation_namespace_check" CHECK ("namespace" = 'eip155' AND "chain_id" ~ '^eip155:[1-9][0-9]*$'),
	CONSTRAINT "session_installation_entity_check" CHECK ("entity_id" BETWEEN 1 AND 2147483646 AND COALESCE(("data"->'authorization'->>'entityId')::integer = "entity_id", false)),
	CONSTRAINT "session_installation_status_check" CHECK ("status" IN ('pending', 'submitted', 'installed', 'revoking', 'revoked', 'failed')),
	CONSTRAINT "session_installation_receipt_check" CHECK (
    ("status" NOT IN ('submitted', 'installed', 'revoking', 'revoked') OR "install_user_operation_hash" IS NOT NULL)
    AND ("status" NOT IN ('installed', 'revoking', 'revoked') OR ("install_transaction_hash" IS NOT NULL AND "installed_at" IS NOT NULL))
    AND ("status" <> 'revoked' OR ("uninstall_user_operation_hash" IS NOT NULL AND "uninstall_transaction_hash" IS NOT NULL AND "revoked_at" IS NOT NULL))
  )
);
--> statement-breakpoint
CREATE TABLE "core"."session_key_operation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"installation_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"chain_id" text NOT NULL,
	"kind" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" text DEFAULT 'awaiting-signature' NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"transaction_hash" text,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_operation_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "session_operation_actor_idempotency_unique" UNIQUE("organization_id","actor_id","idempotency_key"),
	CONSTRAINT "session_operation_kind_check" CHECK ("kind" IN ('install', 'uninstall')),
	CONSTRAINT "session_operation_status_check" CHECK ("status" IN ('awaiting-signature', 'signed', 'submitted', 'confirmed', 'failed', 'expired')),
	CONSTRAINT "session_operation_chain_check" CHECK (COALESCE("data"->'prepared'->>'chainId' = "chain_id", false)),
	CONSTRAINT "session_operation_signature_state_check" CHECK (
    CASE WHEN "status" IN ('awaiting-signature', 'expired')
      THEN COALESCE("data"->'signed' = 'null'::jsonb, false)
      ELSE COALESCE(jsonb_typeof("data"->'signed') = 'object', false)
    END),
	CONSTRAINT "session_operation_signed_binding_check" CHECK (
    "data"->'signed' = 'null'::jsonb OR COALESCE(
      (("data"->'signed'->'userOperation') - 'signature') = (("data"->'prepared'->'userOperation') - 'signature')
      AND (("data"->'signed') - 'userOperation' - 'userOperationHash') = (("data"->'prepared') - 'userOperation' - 'context'), false)),
	CONSTRAINT "session_operation_receipt_check" CHECK (
    ("status" IN ('confirmed', 'failed')) = ("transaction_hash" IS NOT NULL)
    AND ("status" IN ('confirmed', 'failed', 'expired')) = ("finished_at" IS NOT NULL)),
	CONSTRAINT "session_operation_lease_check" CHECK (
    ("lease_token" IS NULL OR "lease_expires_at" IS NOT NULL)
    AND ("status" IN ('signed', 'submitted') OR ("lease_token" IS NULL AND "lease_expires_at" IS NULL)))
);
--> statement-breakpoint
CREATE TABLE "core"."signing_key" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"purpose" text NOT NULL,
	"custody" text NOT NULL,
	"algorithm" text NOT NULL,
	"public_key_hex" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signing_key_purpose_check" CHECK ("purpose" IN ('wallet-root', 'session')),
	CONSTRAINT "signing_key_custody_check" CHECK ("custody" IN ('local', 'namera-managed')),
	CONSTRAINT "signing_key_algorithm_check" CHECK ("algorithm" IN ('p256', 'secp256k1', 'ed25519')),
	CONSTRAINT "signing_key_status_check" CHECK ("status" IN ('active', 'disabled', 'destroyed')),
	CONSTRAINT "signing_key_public_key_hex_check" CHECK ("public_key_hex" ~ '^0x[0-9a-f]+$' AND mod(length("public_key_hex") - 2, 2) = 0),
	CONSTRAINT "signing_key_data_object_check" CHECK (jsonb_typeof("data") = 'object'),
	CONSTRAINT "signing_key_data_type_check" CHECK ("data"->>'type' IS NOT NULL AND "data"->>'type' IN ('passkey', 'local-key', 'gcp-kms', 'local-provider')),
	CONSTRAINT "signing_key_custody_data_check" CHECK (("custody" = 'local' AND "data"->>'type' IN ('passkey', 'local-key')) OR ("custody" = 'namera-managed' AND "data"->>'type' IN ('gcp-kms', 'local-provider'))),
	CONSTRAINT "signing_key_passkey_check" CHECK ("data"->>'type' <> 'passkey' OR ("purpose" = 'wallet-root' AND "algorithm" = 'p256'))
);
--> statement-breakpoint
CREATE TABLE "core"."signature_operation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"session_key_id" text NOT NULL,
	"session_key_grant_id" text NOT NULL,
	"namespace" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"policy_hash" text NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"data" jsonb NOT NULL,
	"failure_code" text,
	"reservation_expires_at" timestamp with time zone NOT NULL,
	"succeeded_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signature_operation_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "signature_operation_lifecycle_check" CHECK (("status" = 'reserved' AND "failure_code" IS NULL AND "succeeded_at" IS NULL AND "failed_at" IS NULL) OR ("status" = 'succeeded' AND "failure_code" IS NULL AND "succeeded_at" IS NOT NULL AND "failed_at" IS NULL) OR ("status" = 'failed' AND "failure_code" IS NOT NULL AND "succeeded_at" IS NULL AND "failed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "core"."wallet_key" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"algorithm" text NOT NULL,
	"protection_level" text NOT NULL,
	"public_key_hex" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_key_id_organization_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "core"."wallet" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"signing_key_id" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_actor_id" text NOT NULL,
	"namespace" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_id_organization_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "jobs"."email_jobs" (
	"id" text PRIMARY KEY,
	"type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"encrypted_payload" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"provider_message_id" text,
	"sent_at" timestamp with time zone,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_jobs_attempts_nonnegative_check" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notification"."notifications" (
	"id" text PRIMARY KEY,
	"organization_id" text,
	"actor_id" text,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"correlation_id" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_actor_organization_check" CHECK ("actor_id" IS NULL OR "organization_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "notification"."notification_preferences" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"organization_id" text,
	"category" text NOT NULL,
	"topic" text NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification"."notification_recipients" (
	"notification_id" text,
	"user_id" text,
	"email_job_id" text,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_recipients_pk" PRIMARY KEY("notification_id","user_id")
);
--> statement-breakpoint
CREATE INDEX "organization_events_organization_created_at_idx" ON "audit"."organization_events" ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_events_organization_event_created_at_idx" ON "audit"."organization_events" ("organization_id","event","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_events_organization_actor_created_at_idx" ON "audit"."organization_events" ("organization_id","actor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_events_resource_created_at_idx" ON "audit"."organization_events" ("organization_id","resource_type","resource_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "organization_events_correlation_id_idx" ON "audit"."organization_events" ("correlation_id");--> statement-breakpoint
CREATE INDEX "user_events_user_created_at_idx" ON "audit"."user_events" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_events_user_event_created_at_idx" ON "audit"."user_events" ("user_id","event","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_events_session_created_at_idx" ON "audit"."user_events" ("session_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_events_correlation_id_idx" ON "audit"."user_events" ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "actor_id_organization_uidx" ON "auth"."actor" ("id","organization_id");--> statement-breakpoint
CREATE INDEX "actor_organization_type_idx" ON "auth"."actor" ("organization_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_hash_uidx" ON "auth"."session" ("token_hash");--> statement-breakpoint
CREATE INDEX "session_user_active_idx" ON "auth"."session" ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "session_active_user_created_at_idx" ON "auth"."session" ("user_id","created_at" DESC NULLS LAST) WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "session_active_organization_idx" ON "auth"."session" ("active_organization_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "auth"."session" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_uidx" ON "auth"."account" ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "auth"."account" ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_user_idx" ON "auth"."account" ("provider_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_key_actor_uidx" ON "auth"."api_key" ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_key_hash_uidx" ON "auth"."api_key" ("key_hash");--> statement-breakpoint
CREATE INDEX "api_key_organization_created_idx" ON "auth"."api_key" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "api_key_organization_last_used_idx" ON "auth"."api_key" ("organization_id","last_used_at");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_token_hash_uidx" ON "auth"."verification" ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_pending_identifier_uidx" ON "auth"."verification" ("purpose","identifier") WHERE "consumed_at" IS NULL AND "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "verification_purpose_identifier_idx" ON "auth"."verification" ("purpose","identifier");--> statement-breakpoint
CREATE INDEX "verification_expires_at_idx" ON "auth"."verification" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_authorization_code_hash_uidx" ON "auth"."oauth_authorization_code" ("code_hash");--> statement-breakpoint
CREATE INDEX "oauth_authorization_code_authorization_created_idx" ON "auth"."oauth_authorization_code" ("authorization_id","created_at");--> statement-breakpoint
CREATE INDEX "oauth_authorization_request_client_status_idx" ON "auth"."oauth_authorization_request" ("client_id","status");--> statement-breakpoint
CREATE INDEX "oauth_authorization_request_user_created_idx" ON "auth"."oauth_authorization_request" ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_authorization_actor_uidx" ON "auth"."oauth_authorization" ("actor_id");--> statement-breakpoint
CREATE INDEX "oauth_authorization_organization_created_idx" ON "auth"."oauth_authorization" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "oauth_authorization_client_status_idx" ON "auth"."oauth_authorization" ("client_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_client_client_id_uidx" ON "auth"."oauth_client" ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_client_status_idx" ON "auth"."oauth_client" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_device_authorization_device_code_uidx" ON "auth"."oauth_device_authorization" ("device_code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_device_authorization_user_code_uidx" ON "auth"."oauth_device_authorization" ("user_code_hmac");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_device_authorization_authorization_uidx" ON "auth"."oauth_device_authorization" ("authorization_id") WHERE "authorization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "oauth_device_authorization_client_status_expiry_idx" ON "auth"."oauth_device_authorization" ("client_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "oauth_device_authorization_user_status_expiry_idx" ON "auth"."oauth_device_authorization" ("claimed_by_user_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "oauth_device_authorization_organization_created_idx" ON "auth"."oauth_device_authorization" ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_token_hash_uidx" ON "auth"."oauth_token" ("token_hash");--> statement-breakpoint
CREATE INDEX "oauth_token_authorization_type_idx" ON "auth"."oauth_token" ("authorization_id","type");--> statement-breakpoint
CREATE INDEX "oauth_token_family_idx" ON "auth"."oauth_token" ("family_id");--> statement-breakpoint
CREATE INDEX "organization_created_by_idx" ON "auth"."organization" ("created_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_member_active_organization_user_uidx" ON "auth"."organization_member" ("organization_id","user_id") WHERE "removed_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_member_actor_uidx" ON "auth"."organization_member" ("actor_id");--> statement-breakpoint
CREATE INDEX "organization_member_user_idx" ON "auth"."organization_member" ("user_id");--> statement-breakpoint
CREATE INDEX "organization_member_active_user_organization_idx" ON "auth"."organization_member" ("user_id","organization_id") WHERE "removed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "organization_member_organization_role_idx" ON "auth"."organization_member" ("organization_role_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_role_organization_system_role_uidx" ON "auth"."organization_role" ("organization_id","system_role_id") WHERE "system_role_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_role_organization_custom_key_uidx" ON "auth"."organization_role" ("organization_id","key") WHERE "system_role_id" IS NULL;--> statement-breakpoint
CREATE INDEX "organization_role_system_role_idx" ON "auth"."organization_role" ("system_role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "system_role_key_uidx" ON "auth"."system_role" ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_pending_email_uidx" ON "auth"."invitation" ("organization_id","email") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "invitation_email_status_idx" ON "auth"."invitation" ("email","status");--> statement-breakpoint
CREATE INDEX "invitation_organization_status_idx" ON "auth"."invitation" ("organization_id","status");--> statement-breakpoint
CREATE INDEX "invitation_organization_role_idx" ON "auth"."invitation" ("organization_role_id","organization_id");--> statement-breakpoint
CREATE INDEX "invitation_expires_at_idx" ON "auth"."invitation" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_account_provider_customer_uidx" ON "billing"."account" ("provider","provider_customer_id") WHERE "provider_customer_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "billing_meter_balance_organization_period_idx" ON "billing"."meter_balance" ("organization_id","period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_open_organization_uidx" ON "billing"."period" ("organization_id") WHERE "status" = 'open';--> statement-breakpoint
CREATE INDEX "billing_period_organization_starts_at_idx" ON "billing"."period" ("organization_id","starts_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "billing_period_status_ends_at_idx" ON "billing"."period" ("status","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_provider_event_provider_id_uidx" ON "billing"."provider_event" ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "billing_provider_event_status_created_at_idx" ON "billing"."provider_event" ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscription_current_organization_uidx" ON "billing"."subscription" ("organization_id") WHERE "status" IN ('trialing', 'active', 'past_due');--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscription_provider_subscription_uidx" ON "billing"."subscription" ("provider","provider_subscription_id") WHERE "provider_subscription_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "billing_subscription_organization_created_at_idx" ON "billing"."subscription" ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "billing_subscription_status_period_end_idx" ON "billing"."subscription" ("status","current_period_end");--> statement-breakpoint
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
CREATE INDEX "address_metadata_refresh_after_idx" ON "core"."address_metadata" ("refresh_after");--> statement-breakpoint
CREATE INDEX "address_metadata_display_name_trgm_idx" ON "core"."address_metadata" USING gin (lower("data" #>> '{identity,displayName}') gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "address_metadata_token_symbol_trgm_idx" ON "core"."address_metadata" USING gin (lower("data" #>> '{token,symbol}') gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "execution_organization_created_at_idx" ON "core"."execution" ("organization_id","created_at","id");--> statement-breakpoint
CREATE INDEX "execution_session_key_grant_created_at_idx" ON "core"."execution" ("organization_id","session_key_grant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_submission_actor_idempotency_uidx" ON "core"."execution_submission" ("organization_id","actor_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "execution_submission_organization_created_at_idx" ON "core"."execution_submission" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "execution_submission_actor_created_at_idx" ON "core"."execution_submission" ("organization_id","actor_id","created_at");--> statement-breakpoint
CREATE INDEX "execution_submission_status_lease_idx" ON "core"."execution_submission" ("status","lease_expires_at");--> statement-breakpoint
CREATE INDEX "execution_submission_status_expiry_idx" ON "core"."execution_submission" ("status","expires_at");--> statement-breakpoint
CREATE INDEX "execution_submission_installation_org_idx" ON "core"."execution_submission" ("installation_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_key_grant_active_actor_session_key_uidx" ON "core"."session_key_grant" ("organization_id","actor_id","session_key_id") WHERE "revoked_at" is null;--> statement-breakpoint
CREATE INDEX "session_key_grant_active_session_key_idx" ON "core"."session_key_grant" ("organization_id","session_key_id") WHERE "revoked_at" is null;--> statement-breakpoint
CREATE INDEX "session_key_grant_granter_organization_idx" ON "core"."session_key_grant" ("granted_by_actor_id","organization_id");--> statement-breakpoint
CREATE INDEX "session_key_grant_revoker_organization_idx" ON "core"."session_key_grant" ("revoked_by_actor_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_key_policy_reservation_execution_scope_uidx" ON "core"."session_key_policy_reservation" ("organization_id","execution_submission_id","policy_id","state_key") WHERE "execution_submission_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "session_key_policy_reservation_signature_scope_uidx" ON "core"."session_key_policy_reservation" ("organization_id","signature_operation_id","policy_id","state_key") WHERE "signature_operation_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "session_key_policy_reservation_session_status_idx" ON "core"."session_key_policy_reservation" ("organization_id","session_key_id","status");--> statement-breakpoint
CREATE INDEX "session_key_policy_reservation_status_expiry_idx" ON "core"."session_key_policy_reservation" ("status","expires_at");--> statement-breakpoint
CREATE INDEX "session_key_organization_wallet_status_idx" ON "core"."session_key" ("organization_id","wallet_id","status");--> statement-breakpoint
CREATE INDEX "session_key_creator_organization_idx" ON "core"."session_key" ("created_by_actor_id","organization_id");--> statement-breakpoint
CREATE INDEX "session_key_revoker_organization_idx" ON "core"."session_key" ("revoked_by_actor_id","organization_id");--> statement-breakpoint
CREATE INDEX "session_installation_wallet_chain_status_idx" ON "core"."session_key_installation" ("organization_id","wallet_id","chain_id","status");--> statement-breakpoint
CREATE INDEX "session_installation_status_updated_idx" ON "core"."session_key_installation" ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "session_operation_one_pending_unique" ON "core"."session_key_operation" ("wallet_id","chain_id") WHERE "status" IN ('awaiting-signature', 'signed', 'submitted');--> statement-breakpoint
CREATE INDEX "session_operation_reconcile_idx" ON "core"."session_key_operation" ("status","lease_expires_at");--> statement-breakpoint
CREATE INDEX "session_operation_expiry_idx" ON "core"."session_key_operation" ("expires_at") WHERE "status" = 'awaiting-signature';--> statement-breakpoint
CREATE INDEX "session_operation_installation_created_idx" ON "core"."session_key_operation" ("organization_id","installation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "signing_key_id_organization_uidx" ON "core"."signing_key" ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signing_key_organization_public_key_uidx" ON "core"."signing_key" ("organization_id","algorithm","public_key_hex");--> statement-breakpoint
CREATE INDEX "signing_key_organization_purpose_status_idx" ON "core"."signing_key" ("organization_id","purpose","status");--> statement-breakpoint
CREATE UNIQUE INDEX "signature_operation_actor_idempotency_uidx" ON "core"."signature_operation" ("organization_id","actor_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "signature_operation_organization_status_created_at_idx" ON "core"."signature_operation" ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "signature_operation_wallet_created_at_idx" ON "core"."signature_operation" ("organization_id","wallet_id","created_at");--> statement-breakpoint
CREATE INDEX "signature_operation_session_key_status_created_at_idx" ON "core"."signature_operation" ("organization_id","session_key_id","status","created_at");--> statement-breakpoint
CREATE INDEX "signature_operation_actor_created_at_idx" ON "core"."signature_operation" ("organization_id","actor_id","created_at");--> statement-breakpoint
CREATE INDEX "wallet_key_organization_status_idx" ON "core"."wallet_key" ("organization_id","status");--> statement-breakpoint
CREATE INDEX "wallet_organization_status_idx" ON "core"."wallet" ("organization_id","status");--> statement-breakpoint
CREATE INDEX "wallet_signing_key_idx" ON "core"."wallet" ("signing_key_id");--> statement-breakpoint
CREATE INDEX "wallet_created_by_actor_idx" ON "core"."wallet" ("created_by_actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_jobs_idempotency_key_uidx" ON "jobs"."email_jobs" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "email_jobs_status_available_at_idx" ON "jobs"."email_jobs" ("status","available_at");--> statement-breakpoint
CREATE INDEX "email_jobs_lease_expires_at_idx" ON "jobs"."email_jobs" ("lease_expires_at");--> statement-breakpoint
CREATE INDEX "email_jobs_expires_at_idx" ON "jobs"."email_jobs" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_idempotency_key_uidx" ON "notification"."notifications" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notifications_organization_created_at_idx" ON "notification"."notifications" ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_organization_type_created_at_idx" ON "notification"."notifications" ("organization_id","type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_resource_created_at_idx" ON "notification"."notifications" ("resource_type","resource_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_expires_at_idx" ON "notification"."notifications" ("expires_at") WHERE "expires_at" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_global_uidx" ON "notification"."notification_preferences" ("user_id","category","topic","channel") WHERE "organization_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_organization_uidx" ON "notification"."notification_preferences" ("user_id","organization_id","category","topic","channel") WHERE "organization_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_recipients_email_job_uidx" ON "notification"."notification_recipients" ("email_job_id");--> statement-breakpoint
CREATE INDEX "notification_recipients_user_received_at_idx" ON "notification"."notification_recipients" ("user_id","received_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_recipients_user_unread_received_at_idx" ON "notification"."notification_recipients" ("user_id","received_at" DESC NULLS LAST) WHERE "read_at" IS NULL AND "archived_at" IS NULL;--> statement-breakpoint
ALTER TABLE "audit"."organization_events" ADD CONSTRAINT "organization_events_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "audit"."organization_events" ADD CONSTRAINT "organization_events_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "audit"."user_events" ADD CONSTRAINT "user_events_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."actor" ADD CONSTRAINT "actor_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_active_organization_id_organization_id_fkey" FOREIGN KEY ("active_organization_id") REFERENCES "auth"."organization"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."api_key" ADD CONSTRAINT "api_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."api_key" ADD CONSTRAINT "api_key_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."api_key" ADD CONSTRAINT "api_key_creator_organization_fk" FOREIGN KEY ("created_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."api_key" ADD CONSTRAINT "api_key_revoker_organization_fk" FOREIGN KEY ("revoked_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization_code" ADD CONSTRAINT "oauth_authorization_code_client_id_oauth_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization_code" ADD CONSTRAINT "oauth_authorization_code_authorization_client_fk" FOREIGN KEY ("authorization_id","client_id") REFERENCES "auth"."oauth_authorization"("id","client_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization_request" ADD CONSTRAINT "oauth_authorization_request_client_id_oauth_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization_request" ADD CONSTRAINT "oauth_authorization_request_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization_request" ADD CONSTRAINT "oauth_authorization_request_X8Wzkrq6bTrt_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization" ADD CONSTRAINT "oauth_authorization_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization" ADD CONSTRAINT "oauth_authorization_client_id_oauth_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization" ADD CONSTRAINT "oauth_authorization_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization" ADD CONSTRAINT "oauth_authorization_authorizer_organization_fk" FOREIGN KEY ("authorized_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_authorization" ADD CONSTRAINT "oauth_authorization_revoker_organization_fk" FOREIGN KEY ("revoked_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_device_authorization" ADD CONSTRAINT "oauth_device_authorization_client_id_oauth_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_device_authorization" ADD CONSTRAINT "oauth_device_authorization_claimed_by_user_id_user_id_fkey" FOREIGN KEY ("claimed_by_user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_device_authorization" ADD CONSTRAINT "oauth_device_authorization_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_device_authorization" ADD CONSTRAINT "oauth_device_authorization_authorization_fk" FOREIGN KEY ("authorization_id","organization_id") REFERENCES "auth"."oauth_authorization"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_token" ADD CONSTRAINT "oauth_token_client_id_oauth_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_token" ADD CONSTRAINT "oauth_token_authorization_client_fk" FOREIGN KEY ("authorization_id","client_id") REFERENCES "auth"."oauth_authorization"("id","client_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."oauth_token" ADD CONSTRAINT "oauth_token_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "auth"."oauth_token"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization" ADD CONSTRAINT "organization_created_by_id_user_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_member" ADD CONSTRAINT "organization_member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_member" ADD CONSTRAINT "organization_member_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_member" ADD CONSTRAINT "organization_member_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_member" ADD CONSTRAINT "organization_member_role_organization_fk" FOREIGN KEY ("organization_role_id","organization_id") REFERENCES "auth"."organization_role"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_role" ADD CONSTRAINT "organization_role_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."organization_role" ADD CONSTRAINT "organization_role_system_role_id_system_role_id_fkey" FOREIGN KEY ("system_role_id") REFERENCES "auth"."system_role"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_role_organization_fk" FOREIGN KEY ("organization_role_id","organization_id") REFERENCES "auth"."organization_role"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."account" ADD CONSTRAINT "account_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."meter_balance" ADD CONSTRAINT "billing_meter_balance_period_organization_fk" FOREIGN KEY ("period_id","organization_id") REFERENCES "billing"."period"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."period" ADD CONSTRAINT "billing_period_subscription_organization_fk" FOREIGN KEY ("subscription_id","organization_id") REFERENCES "billing"."subscription"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."subscription" ADD CONSTRAINT "subscription_organization_id_account_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "billing"."account"("organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."subscription_item" ADD CONSTRAINT "billing_subscription_item_subscription_organization_fk" FOREIGN KEY ("subscription_id","organization_id") REFERENCES "billing"."subscription"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."usage_delivery" ADD CONSTRAINT "billing_usage_delivery_event_organization_fk" FOREIGN KEY ("usage_event_id","organization_id") REFERENCES "billing"."usage_event"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."usage_event" ADD CONSTRAINT "billing_usage_event_period_organization_fk" FOREIGN KEY ("period_id","organization_id") REFERENCES "billing"."period"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."usage_event" ADD CONSTRAINT "billing_usage_event_reservation_scope_fk" FOREIGN KEY ("reservation_id","organization_id","period_id","meter_key") REFERENCES "billing"."usage_reservation"("id","organization_id","period_id","meter_key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."usage_event" ADD CONSTRAINT "billing_usage_event_reversal_organization_fk" FOREIGN KEY ("reverses_usage_event_id","organization_id") REFERENCES "billing"."usage_event"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "billing"."usage_reservation" ADD CONSTRAINT "billing_usage_reservation_period_organization_fk" FOREIGN KEY ("period_id","organization_id") REFERENCES "billing"."period"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."execution" ADD CONSTRAINT "execution_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."execution" ADD CONSTRAINT "execution_submission_match_fk" FOREIGN KEY ("execution_submission_id","session_key_grant_id","organization_id") REFERENCES "core"."execution_submission"("id","session_key_grant_id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."execution" ADD CONSTRAINT "execution_session_key_grant_organization_fk" FOREIGN KEY ("session_key_grant_id","organization_id") REFERENCES "core"."session_key_grant"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."execution_submission" ADD CONSTRAINT "execution_submission_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."execution_submission" ADD CONSTRAINT "execution_submission_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."execution_submission" ADD CONSTRAINT "execution_submission_grant_organization_fk" FOREIGN KEY ("session_key_grant_id","session_key_id","actor_id","organization_id") REFERENCES "core"."session_key_grant"("id","session_key_id","actor_id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."execution_submission" ADD CONSTRAINT "execution_submission_installation_session_org_fk" FOREIGN KEY ("installation_id","session_key_id","organization_id") REFERENCES "core"."session_key_installation"("id","session_key_id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_grant" ADD CONSTRAINT "session_key_grant_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_grant" ADD CONSTRAINT "session_key_grant_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_grant" ADD CONSTRAINT "session_key_grant_session_key_organization_fk" FOREIGN KEY ("session_key_id","organization_id") REFERENCES "core"."session_key"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_grant" ADD CONSTRAINT "session_key_grant_granter_organization_fk" FOREIGN KEY ("granted_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_grant" ADD CONSTRAINT "session_key_grant_revoker_organization_fk" FOREIGN KEY ("revoked_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_policy_reservation" ADD CONSTRAINT "session_key_policy_reservation_nVDxi0fCRhWe_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_policy_reservation" ADD CONSTRAINT "session_key_policy_reservation_session_key_organization_fk" FOREIGN KEY ("session_key_id","organization_id") REFERENCES "core"."session_key"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_policy_reservation" ADD CONSTRAINT "session_key_policy_reservation_signature_organization_fk" FOREIGN KEY ("signature_operation_id","organization_id") REFERENCES "core"."signature_operation"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_policy_reservation" ADD CONSTRAINT "session_key_policy_reservation_submission_organization_fk" FOREIGN KEY ("execution_submission_id","organization_id") REFERENCES "core"."execution_submission"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_policy_state" ADD CONSTRAINT "session_key_policy_state_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_policy_state" ADD CONSTRAINT "session_key_policy_state_session_key_organization_fk" FOREIGN KEY ("session_key_id","organization_id") REFERENCES "core"."session_key"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_signing_key_organization_fk" FOREIGN KEY ("signing_key_id","organization_id") REFERENCES "core"."signing_key"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_wallet_organization_fk" FOREIGN KEY ("wallet_id","organization_id") REFERENCES "core"."wallet"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_creator_organization_fk" FOREIGN KEY ("created_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key" ADD CONSTRAINT "session_key_revoker_organization_fk" FOREIGN KEY ("revoked_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_installation" ADD CONSTRAINT "session_installation_session_wallet_org_fk" FOREIGN KEY ("session_key_id","wallet_id","organization_id") REFERENCES "core"."session_key"("id","wallet_id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_operation" ADD CONSTRAINT "session_operation_actor_org_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."session_key_operation" ADD CONSTRAINT "session_operation_installation_chain_org_fk" FOREIGN KEY ("installation_id","wallet_id","chain_id","organization_id") REFERENCES "core"."session_key_installation"("id","wallet_id","chain_id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signing_key" ADD CONSTRAINT "signing_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signature_operation" ADD CONSTRAINT "signature_operation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signature_operation" ADD CONSTRAINT "signature_operation_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signature_operation" ADD CONSTRAINT "signature_operation_wallet_organization_fk" FOREIGN KEY ("wallet_id","organization_id") REFERENCES "core"."wallet"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signature_operation" ADD CONSTRAINT "signature_operation_session_key_wallet_organization_fk" FOREIGN KEY ("session_key_id","wallet_id","organization_id") REFERENCES "core"."session_key"("id","wallet_id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."signature_operation" ADD CONSTRAINT "signature_operation_grant_session_key_actor_organization_fk" FOREIGN KEY ("session_key_grant_id","session_key_id","actor_id","organization_id") REFERENCES "core"."session_key_grant"("id","session_key_id","actor_id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet_key" ADD CONSTRAINT "wallet_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet" ADD CONSTRAINT "wallet_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet" ADD CONSTRAINT "wallet_signing_key_organization_fk" FOREIGN KEY ("signing_key_id","organization_id") REFERENCES "core"."signing_key"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core"."wallet" ADD CONSTRAINT "wallet_creator_organization_fk" FOREIGN KEY ("created_by_actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notifications" ADD CONSTRAINT "notifications_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notifications" ADD CONSTRAINT "notifications_actor_organization_fk" FOREIGN KEY ("actor_id","organization_id") REFERENCES "auth"."actor"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notification_recipients" ADD CONSTRAINT "notification_recipients_notification_id_notifications_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notification"."notifications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification"."notification_recipients" ADD CONSTRAINT "notification_recipients_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification"."notification_recipients" ADD CONSTRAINT "notification_recipients_email_job_id_email_jobs_id_fkey" FOREIGN KEY ("email_job_id") REFERENCES "jobs"."email_jobs"("id") ON DELETE SET NULL;