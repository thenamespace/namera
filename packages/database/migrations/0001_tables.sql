-- Account Table
-- Represents a user's account in Namera such as Email, Google, etc.
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"access_token" text,
	"id_token" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"scope" text,
	"access_token_expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Session Table
-- Represents a user's session
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY,
	"ip_address" text,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone DEFAULT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- User Table
-- Represents a unique user in Namera
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"metadata" json DEFAULT {} NOT NULL,
	"last_login_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Verification Table
-- This table is only managed by the admin, and is used store temporary verification codes
-- like google linking state, email verification, etc.
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Organization Table
-- Represents an organization
CREATE TABLE "auth"."organization" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"metadata" json,
	"plan" text NOT NULL,
	"slug" text NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."organization" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Organization Member Table
-- Represents a user's membership in an organization
CREATE TABLE "auth"."member" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"role_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."member" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Invitation Table
-- Represents an invitation to join an organization
CREATE TABLE "auth"."invitation" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"role_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"inviter_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Organization Role Table
-- Represents an organization role tied to a set of permissions
CREATE TABLE "auth"."role" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"metadata" json NOT NULL,
	"organization_id" text NOT NULL,
	"permissions" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."role" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Smart Account Table
ALTER TABLE "auth"."role" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "smart_account" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"metadata" json NOT NULL,
	"entrypoint_version" text NOT NULL,
	"kernel_version" text NOT NULL,
	"index" integer NOT NULL,
	"address" text NOT NULL,
	"owner_type" text NOT NULL,
	"owner" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "smart_account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Session Key Table
-- Represents a session key associated with a org's smart account
CREATE TABLE "session_key" (
	"id" text PRIMARY KEY,
	"metadata" json NOT NULL,
	"creator_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"smart_account_id" text NOT NULL,
	"serialized_accounts" json NOT NULL,
	"type" text NOT NULL,
	"data" json NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT NULL
);
--> statement-breakpoint
ALTER TABLE "session_key" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint



-- Create indexes
CREATE INDEX "account_userId_idx" ON "auth"."account" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_providerId_accountId_idx" ON "auth"."account" ("provider_id","account_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_idx" ON "auth"."session" ("token");--> statement-breakpoint
CREATE INDEX "session_user_active_idx" ON "auth"."session" ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "session_activeOrganizationId_idx" ON "auth"."session" ("active_organization_id");--> statement-breakpoint
CREATE INDEX "session_expiresAt_idx" ON "auth"."session" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_uidx" ON "auth"."user" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_identifier_idx" ON "auth"."verification" ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "auth"."organization" (lower("slug"));--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "auth"."member" ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "auth"."member" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_user_organization_uidx" ON "auth"."member" ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "auth"."invitation" ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "auth"."invitation" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "role_name_organizationId_idx" ON "auth"."role" ("name","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_organization_id_id_uidx" ON "auth"."role" ("organization_id","id");--> statement-breakpoint
CREATE INDEX "role_organizationId_idx" ON "auth"."role" ("organization_id");--> statement-breakpoint
CREATE INDEX "smart_account_organizationId_idx" ON "smart_account" ("organization_id");--> statement-breakpoint
CREATE INDEX "smart_account_creatorId_idx" ON "smart_account" ("creator_id");--> statement-breakpoint
CREATE INDEX "smart_account_owner_index_idx" ON "smart_account" ("owner","index" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "smart_account_address_uidx" ON "smart_account" ("address");--> statement-breakpoint
CREATE INDEX "session_key_organizationId_idx" ON "session_key" ("organization_id");--> statement-breakpoint
CREATE INDEX "session_key_smartAccountId_idx" ON "session_key" ("smart_account_id");--> statement-breakpoint
CREATE INDEX "session_key_creator_idx" ON "session_key" ("creator_id");--> statement-breakpoint
CREATE INDEX "session_key_type_idx" ON "session_key" ("type");--> statement-breakpoint


-- Create Constraints
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_active_organization_id_organization_id_fkey" FOREIGN KEY ("active_organization_id") REFERENCES "auth"."organization"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "auth"."organization" ADD CONSTRAINT "organization_created_by_id_user_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_organization_role_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "auth"."role"("organization_id","id");--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_organization_role_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "auth"."role"("organization_id","id");--> statement-breakpoint
ALTER TABLE "auth"."role" ADD CONSTRAINT "role_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "smart_account" ADD CONSTRAINT "smart_account_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "smart_account" ADD CONSTRAINT "smart_account_creator_id_user_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_creator_id_user_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_smart_account_id_smart_account_id_fkey" FOREIGN KEY ("smart_account_id") REFERENCES "smart_account"("id") ON DELETE CASCADE;--> statement-breakpoint