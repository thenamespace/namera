import { Schema } from "effect";

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

export class EvmDataProviderError extends Schema.TaggedError<EvmDataProviderError>()(
  "EvmDataProviderError",
  {
    operation: Schema.Literals(["address-detail", "address-metadata", "address-search"]),
    code: Schema.Literals(["PROVIDER_UNAVAILABLE", "INVALID_PROVIDER_RESPONSE"]),
    cause: Schema.Defect(),
  },
) {}

export class AddressMetadataUnavailableError extends Schema.TaggedError<AddressMetadataUnavailableError>()(
  "AddressMetadataUnavailableError",
  { code: Schema.Literal("ADDRESS_METADATA_UNAVAILABLE") },
  { httpApiStatus: 502 },
) {}

export class PortfolioUnavailableError extends Schema.TaggedError<PortfolioUnavailableError>()(
  "PortfolioUnavailableError",
  { code: Schema.Literal("PORTFOLIO_UNAVAILABLE") },
  { httpApiStatus: 502 },
) {}

export class WalletAssetsUnavailableError extends Schema.TaggedError<WalletAssetsUnavailableError>()(
  "WalletAssetsUnavailableError",
  {
    code: Schema.Literal("WALLET_ASSETS_UNAVAILABLE"),
  },
  { httpApiStatus: 502 },
) {}

export const WalletErrors = [
  WalletCreationError,
  WalletNotFoundError,
  WalletAssetsUnavailableError,
] as const;
export const WalletError = Schema.Union(WalletErrors);
export type WalletError = typeof WalletError.Type;
