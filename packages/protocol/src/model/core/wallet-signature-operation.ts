import { Schema, Struct } from "effect";

import {
  ActorId,
  OrganizationId,
  SignatureOperationId,
  SigningKeyId,
  WalletId,
} from "#/common/index";
import { PrepareWalletSignatureRequest } from "#/dto/wallet-signature";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

export const WalletSignatureOperation = Schema.Struct({
  id: SignatureOperationId,
  organizationId: OrganizationId,
  actorId: ActorId,
  walletId: WalletId,
  signingKeyId: SigningKeyId,
  ownerBinding: NonEmptyString,
  idempotencyKey: NonEmptyString,
  requestHash: NonEmptyString,
  request: PrepareWalletSignatureRequest,
  status: Schema.Literals(["prepared", "succeeded"]),
  encryptedResult: Schema.NullOr(NonEmptyString),
  leaseToken: Schema.NullOr(NonEmptyString),
  leaseExpiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  expiresAt: Schema.DateTimeUtcFromDate,
  succeededAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));
export const WalletSignatureOperationInsert = createInsertSchema(
  WalletSignatureOperation,
  "organizationId",
  "actorId",
  "walletId",
  "signingKeyId",
  "ownerBinding",
  "idempotencyKey",
  "requestHash",
  "request",
  "expiresAt",
);
export type WalletSignatureOperation = typeof WalletSignatureOperation.Type;
export type WalletSignatureOperationInsert = typeof WalletSignatureOperationInsert.Type;
