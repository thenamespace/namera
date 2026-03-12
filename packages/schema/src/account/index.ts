import { Schema } from "effect";

import { UserId } from "../common";

export const EthereumAddress = Schema.TemplateLiteral(
  "0x",
  Schema.String.pipe(Schema.pattern(/^0x[0-9a-fA-F]{40}$/)),
);

export type EthereumAddress = typeof EthereumAddress.Type;

export const EntrypointVersion = Schema.Union(
  Schema.Literal("0.7"),
  Schema.Literal("0.8"),
  Schema.Literal("0.9"),
);

export type EntrypointVersion = typeof EntrypointVersion.Type;

export const KernelVersion = Schema.Union(
  Schema.Literal("3.1"),
  Schema.Literal("3.2"),
  Schema.Literal("3.3"),
);

export type KernelVersion = typeof KernelVersion.Type;

export const SmartAccount = Schema.Struct({
  id: Schema.String,
  entryPointVersion: EntrypointVersion,
  kernelVersion: KernelVersion,
  index: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  address: EthereumAddress,
  userId: UserId,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export type SmartAccount = typeof SmartAccount.Type;

export const SmartAccountLocal = SmartAccount.omit("userId");

export type SmartAccountLocal = typeof SmartAccountLocal.Type;
