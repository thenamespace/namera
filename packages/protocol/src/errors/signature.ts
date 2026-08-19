import { Schema } from "effect";

export const EvmSignatureErrorCode = Schema.Literals([
  "ACCOUNT_RECONSTRUCTION_FAILED",
  "ACCOUNT_ADDRESS_MISMATCH",
  "SIGNING_FAILED",
]);

export class EvmSignatureError extends Schema.TaggedError<EvmSignatureError>()(
  "EvmSignatureError",
  {
    code: EvmSignatureErrorCode,
    cause: Schema.Defect(),
  },
) {}

export const SignatureErrorCode = Schema.Literals([
  "NO_AUTHORIZED_SESSION_KEY",
  "POLICY_DENIED",
  "SIGNING_FAILED",
  "SIGNATURE_UNAVAILABLE",
  "IDEMPOTENCY_CONFLICT",
]);

export class SignatureError extends Schema.TaggedError<SignatureError>()(
  "SignatureError",
  {
    code: SignatureErrorCode,
    policyCode: Schema.optional(Schema.String),
  },
  { httpApiStatus: 409 },
) {}

export type EvmSignatureErrorCode = typeof EvmSignatureErrorCode.Type;
export type SignatureErrorCode = typeof SignatureErrorCode.Type;
