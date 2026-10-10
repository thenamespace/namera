ALTER TABLE "core"."session_key_operation" DROP CONSTRAINT "session_operation_lease_check", ADD CONSTRAINT "session_operation_lease_check" CHECK (
    ("lease_token" IS NULL OR "lease_expires_at" IS NOT NULL)
    AND ("status" IN ('awaiting-signature', 'signed', 'submitted') OR ("lease_token" IS NULL AND "lease_expires_at" IS NULL)));