import { Schema, Struct } from "effect";

import { createInsertSchema, createUpdateSchema } from "@/helpers";

import {
  EntrypointVersion,
  EthereumAddress,
  KernelVersion,
  OrganizationId,
  SmartAccountId,
  UserId,
} from "../common";

export const SmartAccountMetadata = Schema.Struct({
  icon: Schema.Struct({
    type: Schema.Literals(["icon", "emoji"]),
    value: Schema.String,
  }),
  name: Schema.String.check(
    Schema.isLengthBetween(4, 255, {
      message: "Name must be between 4 and 255 characters long",
    }),
  ),
});

// Address of the Owner
export const EcdsaOwner = EthereumAddress;
// Credential ID of the Owner
export const PasskeyOwner = Schema.String;

const BaseSmartAccount = Schema.Struct({
  id: SmartAccountId,
  organizationId: OrganizationId,
  creatorId: UserId,
  metadata: SmartAccountMetadata,
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

const SmartAccountUpdate = createUpdateSchema(SmartAccount);

export const SmartAccountInsert = createInsertSchema(
  SmartAccount,
  "organizationId",
  "creatorId",
  "metadata",
  "address",
  "entryPointVersion",
  "kernelVersion",
  "index",
  "ownerType",
  "owner",
);

export type SmartAccountMetadata = typeof SmartAccountMetadata.Type;

export type SmartAccount = typeof SmartAccount.Type;
export type SmartAccountUpdate = typeof SmartAccountUpdate.Type;
export type SmartAccountInsert = typeof SmartAccountInsert.Type;
export type SmartAccountOwner = typeof SmartAccountOwner.Type;
