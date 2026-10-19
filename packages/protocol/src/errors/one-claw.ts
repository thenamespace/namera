import { Schema } from "effect";

export const OneClawOperation = Schema.Literals([
  "oidc.issue",
  "oidc.configure",
  "connections.upsert",
  "connections.findBySubject",
  "connections.get",
  "connections.bootstrapEmpty",
  "connections.reissueClaim",
  "customers.redeemClaim",
  "customers.getIdentity",
  "customers.enableDelegation",
  "customers.setPassword",
  "customers.verifyPassword",
  "agents.create",
  "agents.get",
  "agents.setRawSigningEnabled",
  "signingKeys.create",
  "signingKeys.list",
  "signingKeys.deactivate",
  "signingKeys.destroy",
  "signing.signDigest",
]);

// Never attach SDK exceptions, request URLs, response bodies or credential values.
export class OneClawError extends Schema.TaggedError<OneClawError>()("OneClawError", {
  operation: OneClawOperation,
  code: Schema.Literals([
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "LINK_REQUIRED",
    "RATE_LIMITED",
    "PAYMENT_REQUIRED",
    "APPROVAL_REQUIRED",
    "INVALID_REQUEST",
    "INVALID_RESPONSE",
    "UNAVAILABLE",
    "TIMEOUT",
    "IDENTITY_MISMATCH",
    "AUTHORITY_EXPIRED",
    "RECOVERY_AMBIGUOUS",
    "TEMPLATE_MISMATCH",
    "UNEXPECTED_RESOURCES",
    "KEY_MISMATCH",
    "SIGNING_DISABLED",
    "UNSUPPORTED",
    "CONFIGURATION_INVALID",
  ]),
  httpStatus: Schema.optionalKey(
    Schema.Int.check(Schema.isBetween({ minimum: 100, maximum: 599 })),
  ),
  approval: Schema.optionalKey(
    Schema.Struct({
      kind: Schema.Literals(["consensus", "guardrail"]),
      id: Schema.NonEmptyString,
    }),
  ),
}) {}

export type OneClawOperation = typeof OneClawOperation.Type;
