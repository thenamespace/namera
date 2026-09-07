import { Schema } from "effect";

import { SigningKeyId, WalletId } from "#/common/index";
import { AlchemyModularAccountVersion, EthereumAddress, EntryPointVersion } from "#/evm/index";
import { SigningKeyCustody } from "#/model/core/signing-key";

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
    signingKeyId: SigningKeyId,
    namespace: Schema.Literal("eip155"),
    address: EthereumAddress,
    custody: SigningKeyCustody,
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

export const SigningKeyCreatedEventData = Schema.Struct({
  event: Schema.Literal("signing_key.created"),
  resourceType: Schema.Literal("signing-key"),
  resourceId: SigningKeyId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    custody: SigningKeyCustody,
  }),
});

export type WalletImplementation = typeof WalletImplementation.Type;
