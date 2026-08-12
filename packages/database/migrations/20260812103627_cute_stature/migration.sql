WITH "ranked_verifications" AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "purpose", "identifier"
			ORDER BY "created_at" DESC, "id" DESC
		) AS "position"
	FROM "auth"."verification"
	WHERE "consumed_at" IS NULL AND "revoked_at" IS NULL
)
UPDATE "auth"."verification"
SET "revoked_at" = now(), "updated_at" = now()
FROM "ranked_verifications"
WHERE "auth"."verification"."id" = "ranked_verifications"."id"
	AND "ranked_verifications"."position" > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "verification_pending_identifier_uidx" ON "auth"."verification" ("purpose","identifier") WHERE "consumed_at" IS NULL AND "revoked_at" IS NULL;
