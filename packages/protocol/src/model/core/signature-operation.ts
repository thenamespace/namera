import { Schema, Struct } from "effect";

import {
  ActorId,
  OrganizationId,
  SessionKeyGrantId,
  SessionKeyId,
  SignatureOperationId,
  WalletId,
} from "#/common/index";
import { Bytes32, EthereumAddress, EvmTypedData, SupportedEvmChainId } from "#/evm/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

export const SignatureOperationStatus = Schema.Literals(["reserved", "succeeded", "failed"]);

export const SignatureOperationFailureCode = Schema.Literals(["SIGNING_FAILED"]);

const EvmSignatureOperationDataCommon = {
  version: Schema.Literal(1),
  chainId: SupportedEvmChainId,
  account: EthereumAddress,
  payloadDigest: Bytes32,
  payloadSizeBytes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
};

export const EvmMessageSignatureOperationData = Schema.Struct({
  ...EvmSignatureOperationDataCommon,
  type: Schema.Literal("message"),
  message: Schema.String,
});

export const EvmTypedDataSignatureOperationData = Schema.Struct({
  ...EvmSignatureOperationDataCommon,
  type: Schema.Literal("typed-data"),
  typedData: EvmTypedData,
});

export const EvmSignatureOperationData = Schema.Union(
  [EvmMessageSignatureOperationData, EvmTypedDataSignatureOperationData],
  { mode: "oneOf" },
);

const SignatureOperationCommon = Schema.Struct({
  id: SignatureOperationId,
  organizationId: OrganizationId,
  actorId: ActorId,
  walletId: WalletId,
  sessionKeyId: SessionKeyId,
  sessionKeyGrantId: SessionKeyGrantId,
  idempotencyKey: NonEmptyString,
  requestHash: NonEmptyString,
  policyHash: NonEmptyString,
  status: SignatureOperationStatus,
  failureCode: Schema.NullOr(SignatureOperationFailureCode),
  reservationExpiresAt: Schema.DateTimeUtcFromDate,
  succeededAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  failedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const EvmMessageSignatureOperation = SignatureOperationCommon.mapFields(
  Struct.assign({
    namespace: Schema.Literal("eip155"),
    data: EvmMessageSignatureOperationData,
  }),
);

export const EvmTypedDataSignatureOperation = SignatureOperationCommon.mapFields(
  Struct.assign({
    namespace: Schema.Literal("eip155"),
    data: EvmTypedDataSignatureOperationData,
  }),
);

export const SignatureOperation = Schema.Union(
  [EvmMessageSignatureOperation, EvmTypedDataSignatureOperation],
  { mode: "oneOf" },
);

export const SignatureOperationInsert = createInsertSchema(
  SignatureOperation,
  "organizationId",
  "actorId",
  "walletId",
  "sessionKeyId",
  "sessionKeyGrantId",
  "idempotencyKey",
  "requestHash",
  "policyHash",
  "reservationExpiresAt",
  "namespace",
  "data",
);

export type SignatureOperationStatus = typeof SignatureOperationStatus.Type;
export type SignatureOperationFailureCode = typeof SignatureOperationFailureCode.Type;
export type EvmMessageSignatureOperationData = typeof EvmMessageSignatureOperationData.Type;
export type EvmTypedDataSignatureOperationData = typeof EvmTypedDataSignatureOperationData.Type;
export type EvmSignatureOperationData = typeof EvmSignatureOperationData.Type;
export type EvmMessageSignatureOperation = typeof EvmMessageSignatureOperation.Type;
export type EvmTypedDataSignatureOperation = typeof EvmTypedDataSignatureOperation.Type;
export type SignatureOperation = typeof SignatureOperation.Type;
export type SignatureOperationEncoded = typeof SignatureOperation.Encoded;
export type SignatureOperationInsert = typeof SignatureOperationInsert.Type;
