ALTER TABLE "core"."wallet_operation" DROP CONSTRAINT "wallet_operation_receipt_check", ADD CONSTRAINT "wallet_operation_receipt_check" CHECK (
    ("status" != 'confirmed' OR "transaction_hash" IS NOT NULL)
    AND ("transaction_hash" IS NULL OR "status" IN ('confirmed', 'failed'))
    AND ("status" IN ('confirmed', 'failed', 'expired')) = ("finished_at" IS NOT NULL));