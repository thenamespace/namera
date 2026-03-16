import { Schema } from "effect";

export const EthereumAddress = Schema.TemplateLiteral("0x", Schema.String);

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

export const SmartAccountOwnerType = Schema.Union(
  Schema.Literal("ecdsa"),
  Schema.Literal("passkey"),
);

export type SmartAccountOwnerType = typeof SmartAccountOwnerType.Type;
