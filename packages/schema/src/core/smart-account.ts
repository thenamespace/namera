import { Schema } from "effect";

import { createInsertSchema, createUpdateSchema } from "@/helpers";

import {
  EntrypointVersion,
  EthereumAddress,
  KernelVersion,
  SmartAccountId,
  OwnerType,
  UserId,
} from "../common";

export const SmartAccount = Schema.Struct({
  id: SmartAccountId,
  userId: UserId,
  name: Schema.NullOr(Schema.String),
  entryPointVersion: EntrypointVersion,
  kernelVersion: KernelVersion,
  index: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  address: EthereumAddress,
  ownerType: OwnerType,
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
