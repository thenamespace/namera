import { Schema } from "effect";

/** @deprecated Compatibility export. Provider services expose their own typed errors. */
export class WalletKeyError extends Schema.TaggedError<WalletKeyError>()("WalletKeyError", {
  operation: Schema.Literals(["create", "sign", "disable", "destroy"]),
  code: Schema.optionalKey(
    Schema.Literals([
      "PROVIDER_UNAVAILABLE",
      "APPROVAL_REQUIRED",
      "IDENTITY_MISMATCH",
      "UNSUPPORTED_OPERATION",
      "PROVISIONING_INCOMPLETE",
    ]),
  ),
  cause: Schema.Defect(),
}) {}
