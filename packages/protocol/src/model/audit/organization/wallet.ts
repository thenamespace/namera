import { Schema } from "effect";

import { WalletId, WalletKeyId } from "#/common/index";
import { EthereumAddress, EntryPointVersion, KernelVersion, SafeVersion } from "#/evm/index";
import { WalletKeyProtectionLevel } from "#/model/core/wallet-key";

export const WalletImplementation = Schema.Union([
  Schema.Struct({
    implementation: Schema.Literal("kernel"),
    implementationVersion: KernelVersion,
    entryPointVersion: EntryPointVersion,
  }),
  Schema.Struct({
    implementation: Schema.Literal("safe"),
    implementationVersion: SafeVersion,
    entryPointVersion: EntryPointVersion,
  }),
]);

export const WalletCreationRequestedEventData = Schema.Struct({
  event: Schema.Literal("wallet.creation_requested"),
  resourceType: Schema.Null,
  resourceId: Schema.Null,
  data: Schema.Struct({
    version: Schema.Literal(1),
    namespace: Schema.Literal("eip155"),
    protectionLevel: WalletKeyProtectionLevel,
    account: WalletImplementation,
  }),
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

export const WalletCreationFailedEventData = Schema.Struct({
  event: Schema.Literal("wallet.creation_failed"),
  resourceType: Schema.Null,
  resourceId: Schema.Null,
  data: Schema.Struct({
    version: Schema.Literal(1),
    stage: Schema.Literals(["entitlement", "key", "account", "persistence"]),
    code: Schema.String,
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
