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
  { httpApiStatus: 500 },
) {}

export class WalletNotFoundError extends Schema.TaggedError<WalletNotFoundError>()(
  "WalletError",
  {
    code: Schema.Literal("WALLET_NOT_FOUND"),
  },
  { httpApiStatus: 404 },
) {}

export const WalletErrors = [WalletCreationError, WalletNotFoundError] as const;
export const WalletError = Schema.Union(WalletErrors);
export type WalletError = typeof WalletError.Type;
