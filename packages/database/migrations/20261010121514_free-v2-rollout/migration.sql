-- Preserve active period limits. The application switches at the first anniversary
-- strictly after this deployment marker, including when old periods need catch-up.
UPDATE "billing"."subscription"
SET "data" = "data" || jsonb_build_object('freeV2RolloutAt', CURRENT_TIMESTAMP),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "plan" = 'free' AND "plan_version" = 1
  AND "status" IN ('trialing', 'active', 'past_due')
  AND NOT ("data" ? 'freeV2RolloutAt');
