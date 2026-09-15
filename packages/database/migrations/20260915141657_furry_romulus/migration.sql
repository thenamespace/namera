ALTER TABLE "auth"."verification" DROP CONSTRAINT "verification_purpose_fields_check", ADD CONSTRAINT "verification_purpose_fields_check" CHECK ((
        "purpose" = 'magic-link-signin'
        AND "token_hash" IS NOT NULL
        AND "code_hmac" IS NOT NULL
      ) OR (
        "purpose" = 'beta-admission'
        AND "token_hash" IS NOT NULL
        AND "code_hmac" IS NULL
      ) OR (
        "purpose" = 'passkey-registration'
        AND "token_hash" IS NULL
        AND "code_hmac" IS NULL
      ));