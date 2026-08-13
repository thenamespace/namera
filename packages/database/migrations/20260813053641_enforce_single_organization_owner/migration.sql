CREATE FUNCTION "auth"."enforce_single_organization_owner"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."removed_at" IS NULL AND EXISTS (
    SELECT 1
    FROM "auth"."organization_role" AS organization_role
    JOIN "auth"."system_role" AS system_role
      ON system_role."id" = organization_role."system_role_id"
    WHERE organization_role."id" = NEW."organization_role_id"
      AND system_role."key" = 'owner'
  ) THEN
    PERFORM 1
    FROM "auth"."organization"
    WHERE "id" = NEW."organization_id"
    FOR UPDATE;

    IF EXISTS (
      SELECT 1
      FROM "auth"."organization_member" AS organization_member
      JOIN "auth"."organization_role" AS organization_role
        ON organization_role."id" = organization_member."organization_role_id"
      JOIN "auth"."system_role" AS system_role
        ON system_role."id" = organization_role."system_role_id"
      WHERE organization_member."organization_id" = NEW."organization_id"
        AND organization_member."removed_at" IS NULL
        AND organization_member."id" <> NEW."id"
        AND system_role."key" = 'owner'
    ) THEN
      RAISE EXCEPTION 'organization can have only one active owner'
        USING ERRCODE = '23505',
          CONSTRAINT = 'organization_member_single_owner';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "organization_member_single_owner_trigger"
BEFORE INSERT OR UPDATE OF "organization_id", "organization_role_id", "removed_at"
ON "auth"."organization_member"
FOR EACH ROW
EXECUTE FUNCTION "auth"."enforce_single_organization_owner"();
