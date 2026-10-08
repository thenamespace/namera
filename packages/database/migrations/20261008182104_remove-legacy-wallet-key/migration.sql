DO $$
BEGIN
  LOCK TABLE "core"."wallet_key" IN ACCESS EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM "core"."wallet_key") THEN
    RAISE EXCEPTION 'core.wallet_key still contains legacy rows; archive or migrate them before removing the table';
  END IF;
  DROP TABLE "core"."wallet_key";
END
$$;
