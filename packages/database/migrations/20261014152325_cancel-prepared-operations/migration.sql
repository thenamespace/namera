ALTER TABLE "core"."session_key_operation" DROP CONSTRAINT "session_operation_status_check", ADD CONSTRAINT "session_operation_status_check" CHECK ("status" IN ('awaiting-signature', 'signed', 'submitted', 'confirmed', 'failed', 'expired', 'cancelled'));--> statement-breakpoint
ALTER TABLE "core"."session_key_operation" DROP CONSTRAINT "session_operation_signature_state_check", ADD CONSTRAINT "session_operation_signature_state_check" CHECK (
    CASE WHEN "status" IN ('awaiting-signature', 'expired', 'cancelled')
      THEN COALESCE("data"->'signed' = 'null'::jsonb, false)
      ELSE COALESCE(jsonb_typeof("data"->'signed') = 'object', false)
    END);--> statement-breakpoint
ALTER TABLE "core"."session_key_operation" DROP CONSTRAINT "session_operation_receipt_check", ADD CONSTRAINT "session_operation_receipt_check" CHECK (
    ("status" IN ('confirmed', 'failed')) = ("transaction_hash" IS NOT NULL)
    AND ("status" IN ('confirmed', 'failed', 'expired', 'cancelled')) = ("finished_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "core"."wallet_operation" DROP CONSTRAINT "wallet_operation_status_check", ADD CONSTRAINT "wallet_operation_status_check" CHECK ("status" IN ('awaiting-signature', 'signed', 'submitted', 'confirmed', 'failed', 'expired', 'cancelled'));--> statement-breakpoint
ALTER TABLE "core"."wallet_operation" DROP CONSTRAINT "wallet_operation_signature_state_check", ADD CONSTRAINT "wallet_operation_signature_state_check" CHECK (
    CASE WHEN "status" IN ('awaiting-signature', 'expired', 'cancelled')
      THEN COALESCE("data"->'signed' = 'null'::jsonb, false)
      ELSE COALESCE(jsonb_typeof("data"->'signed') = 'object', false)
    END);--> statement-breakpoint
ALTER TABLE "core"."wallet_operation" DROP CONSTRAINT "wallet_operation_receipt_check", ADD CONSTRAINT "wallet_operation_receipt_check" CHECK (
    ("status" != 'confirmed' OR "transaction_hash" IS NOT NULL)
    AND ("transaction_hash" IS NULL OR "status" IN ('confirmed', 'failed'))
    AND ("status" IN ('confirmed', 'failed', 'expired', 'cancelled')) = ("finished_at" IS NOT NULL));