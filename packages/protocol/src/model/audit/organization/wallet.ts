import { Schema } from "effect";

import { SignatureOperationId, SigningKeyId, WalletId, WalletOperationId } from "#/common/index";
import {
  AlchemyModularAccountVersion,
  EthereumAddress,
  EntryPointVersion,
  SupportedEvmChainId,
} from "#/evm/index";
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

export const WalletOperationEventData = Schema.Struct({
  event: Schema.Literals([
    "wallet.operation_prepared",
    "wallet.operation_cancelled",
    "wallet.operation_approved",
    "wallet.operation_confirmed",
    "wallet.operation_failed",
  ]),
  resourceType: Schema.Literal("wallet"),
  resourceId: WalletId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    operationId: WalletOperationId,
    kind: Schema.Literals(["set-primary-name", "transaction"]),
  }),
});

export const IdentityChangedEventData = Schema.Struct({
  event: Schema.Literal("identity.changed"),
  resourceType: Schema.Literal("wallet"),
  resourceId: WalletId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    name: Schema.String,
    action: Schema.Literals(["created", "records_updated"]),
    applied: Schema.Number,
  }),
});

export const WalletSignatureEventData = Schema.Struct({
  event: Schema.Literals(["wallet.signature_prepared", "wallet.signature_created"]),
  resourceType: Schema.Literal("wallet"),
  resourceId: WalletId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    operationId: SignatureOperationId,
    namespace: Schema.Literal("eip155"),
    chainId: SupportedEvmChainId,
    type: Schema.Literals(["message", "typed-data"]),
  }),
});
