import { Schema } from "effect";

export class WalletCustodyUnavailableError extends Schema.TaggedError<WalletCustodyUnavailableError>()(
  "WalletCustodyUnavailableError",
  { code: Schema.Literal("MANAGED_WALLETS_DISABLED") },
  { httpApiStatus: 403 },
) {}

export class EvmAccountCreationError extends Schema.TaggedError<EvmAccountCreationError>()(
  "EvmAccountCreationError",
  {
    implementation: Schema.Literal("alchemy-modular-v2"),
    cause: Schema.Defect(),
  },
) {}

export class WalletCreationError extends Schema.TaggedError<WalletCreationError>()(
  "WalletCreationError",
  {
    code: Schema.Literals([
      "KEY_CREATION_FAILED",
      "ACCOUNT_CREATION_FAILED",
      "WALLET_PERSISTENCE_FAILED",
    ]),
    namespace: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

export class PasskeyRegistrationError extends Schema.TaggedError<PasskeyRegistrationError>()(
  "PasskeyRegistrationError",
  {
    code: Schema.Literal("REGISTRATION_OPTIONS_UNAVAILABLE"),
  },
  { httpApiStatus: 500 },
) {}

export class PasskeyVerificationError extends Schema.TaggedError<PasskeyVerificationError>()(
  "PasskeyVerificationError",
  {
    code: Schema.Literals([
      "REGISTRATION_NOT_FOUND",
      "REGISTRATION_EXPIRED",
      "REGISTRATION_INVALID",
    ]),
  },
  { httpApiStatus: 400 },
) {}

export class EnsUnavailableError extends Schema.TaggedError<EnsUnavailableError>()(
  "EnsUnavailableError",
  { code: Schema.Literal("ENS_UNAVAILABLE") },
  { httpApiStatus: 502 },
) {}

export class WalletNotFoundError extends Schema.TaggedError<WalletNotFoundError>()(
  "WalletError",
  {
    code: Schema.Literal("WALLET_NOT_FOUND"),
  },
  { httpApiStatus: 404 },
) {}

export class EvmPortfolioError extends Schema.TaggedError<EvmPortfolioError>()(
  "EvmPortfolioError",
  {
    code: Schema.Literals(["PROVIDER_UNAVAILABLE", "INVALID_PROVIDER_RESPONSE"]),
    cause: Schema.Defect(),
  },
) {}

export class PortfolioUnavailableError extends Schema.TaggedError<PortfolioUnavailableError>()(
  "PortfolioUnavailableError",
  { code: Schema.Literal("PORTFOLIO_UNAVAILABLE") },
  { httpApiStatus: 502 },
) {}

export const WalletErrors = [
  WalletCustodyUnavailableError,
  WalletCreationError,
  PasskeyRegistrationError,
  PasskeyVerificationError,
  EnsUnavailableError,
  WalletNotFoundError,
] as const;
export const WalletError = Schema.Union(WalletErrors);
export type WalletError = typeof WalletError.Type;
