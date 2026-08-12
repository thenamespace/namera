import { Schema } from "effect";

export class EvmAccountCreationError extends Schema.TaggedError<EvmAccountCreationError>()(
  "EvmAccountCreationError",
  {
    implementation: Schema.Literals(["kernel", "safe"]),
    cause: Schema.Defect(),
  },
) {}

export class WalletCreationError extends Schema.TaggedError<WalletCreationError>()(
  "WalletCreationError",
  {
    code: Schema.Literals([
      "UNSUPPORTED_CHAIN",
      "KEY_CREATION_FAILED",
      "ACCOUNT_CREATION_FAILED",
      "WALLET_PERSISTENCE_FAILED",
    ]),
    namespace: Schema.String,
  },
) {}
