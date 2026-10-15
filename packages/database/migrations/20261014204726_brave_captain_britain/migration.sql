ALTER TABLE "core"."session_key_operation" DROP CONSTRAINT "session_operation_receipt_check", ADD CONSTRAINT "session_operation_receipt_check" CHECK (
    CASE WHEN "status" = 'failed' AND "transaction_hash" IS NULL
      THEN COALESCE("data"->'submissionRejected' = 'true'::jsonb
        AND "data"->'broadcastAttempted' = 'true'::jsonb, false)
      ELSE ("status" IN ('confirmed', 'failed')) = ("transaction_hash" IS NOT NULL)
    END
    AND ("status" IN ('confirmed', 'failed', 'expired', 'cancelled')) = ("finished_at" IS NOT NULL));