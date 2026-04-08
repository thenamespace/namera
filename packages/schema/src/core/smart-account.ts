import { Schema, Struct } from "effect";

import { createInsertSchema, createUpdateSchema } from "@/helpers";

import {
  EntrypointVersion,
  EthereumAddress,
  KernelVersion,
  SmartAccountId,
  UserId,
} from "../common";

export const EcdsaOwner = Schema.Struct({
  address: EthereumAddress,
});

export const PasskeyOwner = Schema.Struct({
  credentialId: Schema.String,
});

const BaseSmartAccount = Schema.Struct({
  id: SmartAccountId,
  userId: UserId,
  name: Schema.NullOr(Schema.String),
  entryPointVersion: EntrypointVersion,
  kernelVersion: KernelVersion,
  index: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  address: EthereumAddress,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

const EcdsaSmartAccount = BaseSmartAccount.mapFields(
  Struct.assign({
    ownerType: Schema.Literal("ecdsa"),
    owner: EcdsaOwner,
  }),
);

const PasskeySmartAccount = BaseSmartAccount.mapFields(
  Struct.assign({
    ownerType: Schema.Literal("passkey"),
    owner: PasskeyOwner,
  }),
);

export const SmartAccountOwner = Schema.Union([EcdsaOwner, PasskeyOwner]);

export const SmartAccount = Schema.Union(
  [EcdsaSmartAccount, PasskeySmartAccount],
  {
    mode: "oneOf",
  },
);

export const SmartAccountUpdate = Schema.Union([
  createUpdateSchema(EcdsaSmartAccount),
  createUpdateSchema(PasskeySmartAccount),
]);

const requiredInsertKeys = [
  "userId",
  "name",
  "address",
  "entryPointVersion",
  "kernelVersion",
  "index",
  "ownerType",
  "owner",
] as const;

export const SmartAccountInsert = Schema.Union([
  createInsertSchema(EcdsaSmartAccount, ...requiredInsertKeys),
  createInsertSchema(PasskeySmartAccount, ...requiredInsertKeys),
]);

export type SmartAccount = typeof SmartAccount.Type;
export type SmartAccountUpdate = typeof SmartAccountUpdate.Type;
export type SmartAccountInsert = typeof SmartAccountInsert.Type;
export type SmartAccountOwner = typeof SmartAccountOwner.Type;
