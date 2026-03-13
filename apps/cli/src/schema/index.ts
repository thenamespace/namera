import { Schema } from "effect";

export const EthereumAddress = Schema.TemplateLiteral([
  "0x",
  Schema.String.check(Schema.isPattern(/^[0-9a-fA-F]{40}$/)),
]);

export const EntrypointVersion = Schema.Literals(["0.7", "0.8", "0.9"]);
export const KernelVersion = Schema.Literals(["0.3.1", "0.3.2", "0.3.3"]);
export const OwnerType = Schema.Literals(["ecdsa"]);

export const LocalSmartAccount = Schema.Struct({
  chainId: Schema.Number,
  entrypointVersion: EntrypointVersion,
  index: Schema.Number,
  kernelVersion: KernelVersion,
  ownerIdentifier: Schema.String,
  ownerType: OwnerType,
  smartAccountAddress: EthereumAddress,
});

export const LocalSmartAccountFromString =
  Schema.fromJsonString(LocalSmartAccount);

export type EntrypointVersion = typeof EntrypointVersion.Type;
export type KernelVersion = typeof KernelVersion.Type;
export type LocalSmartAccount = typeof LocalSmartAccount.Type;
