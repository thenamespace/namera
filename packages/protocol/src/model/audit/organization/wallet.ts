import { Schema } from "effect";

import { WalletId, WalletKeyId } from "#/common/index";
import { AlchemyModularAccountVersion, EthereumAddress, EntryPointVersion } from "#/evm/index";
import { WalletKeyProtectionLevel } from "#/model/core/wallet-key";

export const WalletImplementation = Schema.Struct({
  implementation: Schema.Literal("alchemy-modular-v2"),
  implementationVersion: AlchemyModularAccountVersion,
  entryPointVersion: EntryPointVersion,
});

export const WalletCreatedEventData = Schema.Struct({
  event: Schema.Literal("wallet.created"),
  resourceType: Schema.Literal("wallet"),
  resourceId: WalletId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    walletKeyId: WalletKeyId,
    namespace: Schema.Literal("eip155"),
    address: EthereumAddress,
    protectionLevel: WalletKeyProtectionLevel,
    account: WalletImplementation,
  }),
});

export const WalletUpdatedEventData = Schema.Struct({
  event: Schema.Literal("wallet.updated"),
  resourceType: Schema.Literal("wallet"),
  resourceId: WalletId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    changedFields: Schema.Array(Schema.Literal("metadata")),
  }),
});

export const WalletKeyCreatedEventData = Schema.Struct({
  event: Schema.Literal("wallet_key.created"),
  resourceType: Schema.Literal("wallet-key"),
  resourceId: WalletKeyId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    protectionLevel: WalletKeyProtectionLevel,
  }),
});

export type WalletImplementation = typeof WalletImplementation.Type;
