import { Schema } from "effect";

export class SessionKeyNotFoundError extends Schema.TaggedError<SessionKeyNotFoundError>()(
  "SessionKeyError",
  { code: Schema.Literal("SESSION_KEY_NOT_FOUND") },
  { httpApiStatus: 404 },
) {}

export class SessionKeyCreationError extends Schema.TaggedError<SessionKeyCreationError>()(
  "SessionKeyCreationError",
  {
    code: Schema.Literals([
      "TIME_WINDOW_EXPIRED",
      "POLICY_CARDINALITY_EXCEEDED",
      "WALLET_NOT_ACTIVE",
      "WALLET_NAMESPACE_MISMATCH",
      "LOCAL_SIGNER_INVALID",
      "SIGNER_ALREADY_REGISTERED",
      "WALLET_OWNER_UNAVAILABLE",
      "ONCHAIN_PREPARATION_FAILED",
      "NETWORK_PAUSED",
      "MANAGED_SESSION_KEYS_UNAVAILABLE",
      "PROVIDER_SETUP_FAILED",
      "PROVIDER_RECOVERY_REQUIRED",
    ]),
  },
  { httpApiStatus: 409 },
) {}

export class SessionKeyOperationError extends Schema.TaggedError<SessionKeyOperationError>()(
  "SessionKeyOperationError",
  {
    code: Schema.Literals([
      "INSTALLATION_UNAVAILABLE",
      "OPERATION_UNAVAILABLE",
      "OWNER_UNAVAILABLE",
      "INVALID_TRANSITION",
      "OPERATION_BUSY",
      "IDEMPOTENCY_CONFLICT",
      "APPROVAL_EXPIRED",
      "APPROVAL_INVALID",
      "PREPARATION_FAILED",
      "NETWORK_PAUSED",
    ]),
  },
  { httpApiStatus: 409 },
) {}

export const SessionKeyErrors = [
  SessionKeyNotFoundError,
  SessionKeyCreationError,
  SessionKeyOperationError,
] as const;
export const SessionKeyError = Schema.Union(SessionKeyErrors);
export type SessionKeyError = typeof SessionKeyError.Type;
