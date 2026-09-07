ALTER TABLE "auth"."verification" ALTER COLUMN "token_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."verification" ALTER COLUMN "code_hmac" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."verification" ADD CONSTRAINT "verification_purpose_fields_check" CHECK ((
        "purpose" = 'magic-link-signin'
        AND "token_hash" IS NOT NULL
        AND "code_hmac" IS NOT NULL
      ) OR (
        "purpose" = 'passkey-registration'
        AND "token_hash" IS NULL
        AND "code_hmac" IS NULL
      ));