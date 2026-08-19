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
      "TIME_WINDOW_TOO_LONG",
      "POLICY_CARDINALITY_EXCEEDED",
      "WALLET_NOT_ACTIVE",
      "WALLET_NAMESPACE_MISMATCH",
    ]),
  },
  { httpApiStatus: 409 },
) {}

export const SessionKeyErrors = [SessionKeyNotFoundError, SessionKeyCreationError] as const;
export const SessionKeyError = Schema.Union(SessionKeyErrors);
export type SessionKeyError = typeof SessionKeyError.Type;
