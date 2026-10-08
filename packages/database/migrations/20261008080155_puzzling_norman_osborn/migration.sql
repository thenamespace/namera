CREATE TABLE "audit"."platform_events" (
	"id" text PRIMARY KEY,
	"actor_member_id" text,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."platform_invitation" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_member_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_invitation_role_check" CHECK ("role" in ('operator', 'viewer')),
	CONSTRAINT "platform_invitation_email_check" CHECK ("email" = lower(trim("email"))),
	CONSTRAINT "platform_invitation_accepted_check" CHECK (("accepted_at" is null) = ("accepted_by_user_id" is null)),
	CONSTRAINT "platform_invitation_terminal_check" CHECK ("accepted_at" is null or "revoked_at" is null),
	CONSTRAINT "platform_invitation_expiry_check" CHECK ("expires_at" > "created_at")
);
--> statement-breakpoint
CREATE TABLE "auth"."platform_member" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_member_role_check" CHECK ("role" in ('owner', 'operator', 'viewer')),
	CONSTRAINT "platform_member_status_check" CHECK ("status" in ('active', 'suspended', 'removed')),
	CONSTRAINT "platform_member_owner_active_check" CHECK ("role" <> 'owner' or "status" = 'active')
);
--> statement-breakpoint
CREATE INDEX "platform_events_actor_created_idx" ON "audit"."platform_events" ("actor_member_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_invitation_token_uidx" ON "auth"."platform_invitation" ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_invitation_pending_email_uidx" ON "auth"."platform_invitation" ("email") WHERE "accepted_at" is null and "revoked_at" is null;--> statement-breakpoint
CREATE INDEX "platform_invitation_inviter_idx" ON "auth"."platform_invitation" ("invited_by_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_member_user_uidx" ON "auth"."platform_member" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_member_owner_uidx" ON "auth"."platform_member" ("role") WHERE "role" = 'owner';--> statement-breakpoint
ALTER TABLE "audit"."platform_events" ADD CONSTRAINT "platform_events_actor_member_id_platform_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "auth"."platform_member"("id");--> statement-breakpoint
ALTER TABLE "auth"."platform_invitation" ADD CONSTRAINT "platform_invitation_bRtBcAnvKmDz_fkey" FOREIGN KEY ("invited_by_member_id") REFERENCES "auth"."platform_member"("id");--> statement-breakpoint
ALTER TABLE "auth"."platform_invitation" ADD CONSTRAINT "platform_invitation_accepted_by_user_id_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "auth"."platform_member" ADD CONSTRAINT "platform_member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id");