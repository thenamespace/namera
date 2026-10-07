ALTER TABLE "auth"."account" ADD COLUMN "provider_email" text;--> statement-breakpoint
CREATE UNIQUE INDEX "account_google_user_uidx" ON "auth"."account" ("user_id") WHERE "provider_id" = 'google';--> statement-breakpoint
ALTER TABLE "auth"."verification" DROP CONSTRAINT "verification_purpose_fields_check", ADD CONSTRAINT "verification_purpose_fields_check" CHECK ((
        "purpose" = 'magic-link-signin'
        AND "token_hash" IS NOT NULL
        AND "code_hmac" IS NOT NULL
      ) OR (
        "purpose" IN ('beta-admission', 'google-auth')
        AND "token_hash" IS NOT NULL
        AND "code_hmac" IS NULL
      ) OR (
        "purpose" = 'passkey-registration'
        AND "token_hash" IS NULL
        AND "code_hmac" IS NULL
      ));