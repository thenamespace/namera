import { Schema } from "effect";

import {
  createInsertSchema,
  createUpdateSchema,
  EntrypointVersion,
  EthereumAddress,
  KernelVersion,
  SmartAccountId,
  SmartAccountOwnerType,
  UserId,
} from "../common";

export const SmartAccount = Schema.Struct({
  id: SmartAccountId,
  userId: UserId,
  name: Schema.NullOr(Schema.String),
  entryPointVersion: EntrypointVersion,
  kernelVersion: KernelVersion,
  index: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  address: EthereumAddress,
  ownerType: SmartAccountOwnerType,
  ownerIdentifier: Schema.String, // Should be address for ecdsa, and passkey credential id for passkey
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export const SmartAccountUpdate = createUpdateSchema(SmartAccount);
export const SmartAccountInsert = createInsertSchema(
  SmartAccount,
  "userId",
  "name",
  "address",
  "entryPointVersion",
  "kernelVersion",
  "index",
  "ownerType",
  "ownerIdentifier",
  "address",
);

export type SmartAccount = typeof SmartAccount.Type;
export type SmartAccountUpdate = typeof SmartAccountUpdate.Type;
export type SmartAccountInsert = typeof SmartAccountInsert.Type;
