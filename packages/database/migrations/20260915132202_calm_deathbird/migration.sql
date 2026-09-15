CREATE TABLE "auth"."beta_invite" (
	"id" text PRIMARY KEY,
	"code_hmac" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"redeemed_at" timestamp with time zone,
	"redeemed_by" text,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "beta_invite_redemption_check" CHECK (("redeemed_at" IS NULL) = ("redeemed_by" IS NULL)),
	CONSTRAINT "beta_invite_terminal_check" CHECK ("redeemed_at" IS NULL OR "revoked_at" IS NULL),
	CONSTRAINT "beta_invite_expiry_check" CHECK ("expires_at" > "created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "beta_invite_code_hmac_uidx" ON "auth"."beta_invite" ("code_hmac");--> statement-breakpoint
ALTER TABLE "auth"."beta_invite" ADD CONSTRAINT "beta_invite_redeemed_by_user_id_fkey" FOREIGN KEY ("redeemed_by") REFERENCES "auth"."user"("id");