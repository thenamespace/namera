import { Schema, Struct } from "effect";

import {
  BigIntFromNumber,
  EntrypointVersion,
  EthereumAddress,
  KernelVersion,
  OrganizationId,
  OrganizationMemberId,
  SmartAccountId,
} from "@/common";
import { MetadataLogo, MetadataName, TimestampFields } from "@/database/common";
import { createInsertSchema, createUpdateSchema } from "@/database/helpers";

export const SmartAccountMetadata = Schema.Struct({
  logo: MetadataLogo,
  name: MetadataName,
});

const BaseSmartAccount = Schema.Struct({
  id: SmartAccountId,
  organizationId: OrganizationId,
  creatorId: OrganizationMemberId,
  metadata: SmartAccountMetadata,
  entryPointVersion: EntrypointVersion,
  kernelVersion: KernelVersion,
  index: BigIntFromNumber,
  address: EthereumAddress,
}).mapFields(Struct.assign(TimestampFields));

export const EcdsaOwner = EthereumAddress;

const EcdsaSmartAccount = BaseSmartAccount.mapFields(
  Struct.assign({
    ownerType: Schema.Literal("ecdsa"),
    owner: EcdsaOwner,
  }),
);

export const SmartAccountOwner = Schema.Union([EcdsaOwner]);

export const SmartAccount = Schema.Union([EcdsaSmartAccount], {
  mode: "oneOf",
});

export const SmartAccountUpdate = createUpdateSchema(SmartAccount);

export const SmartAccountInsert = createInsertSchema(
  SmartAccount,
  "organizationId",
  "creatorId",
  "metadata",
  "entryPointVersion",
  "kernelVersion",
  "index",
  "address",
);

export type SmartAccountMetadata = typeof SmartAccountMetadata.Type;
export type SmartAccountOwner = typeof SmartAccountOwner.Type;
export type SmartAccount = typeof SmartAccount.Type;
export type SmartAccountUpdate = typeof SmartAccountUpdate.Type;
export type SmartAccountInsert = typeof SmartAccountInsert.Type;
