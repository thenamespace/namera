import { Schema } from "effect";

export class WalletKeyError extends Schema.TaggedError<WalletKeyError>()("WalletKeyError", {
  operation: Schema.Literals(["create", "sign", "disable", "destroy"]),
  cause: Schema.Defect(),
}) {}
