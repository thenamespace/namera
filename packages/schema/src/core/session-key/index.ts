import { Schema } from "effect";

import {
  EntrypointVersion,
  EthereumAddress,
  KernelVersion,
  SmartAccountOwnerType,
  UserId,
} from "../../common";

export const SmartAccount = Schema.Struct({
  id: Schema.String,
  userId: UserId,
  name: Schema.optional(Schema.String),
  entryPointVersion: EntrypointVersion,
  kernelVersion: KernelVersion,
  index: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  address: EthereumAddress,
  ownerType: SmartAccountOwnerType,
  ownerIdentifier: Schema.String, // Should be address for ecdsa, and passkey credential id for passkey
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export type SmartAccount = typeof SmartAccount.Type;
