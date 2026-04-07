import { Schema } from "effect";

export const EthereumAddress = Schema.TemplateLiteral([
  "0x",
  Schema.String.check(Schema.isPattern(/^[0-9a-fA-F]{40}$/)),
]);

export const Hex = Schema.TemplateLiteral([
  "0x",
  Schema.String.check(Schema.isPattern(/^[0-9a-fA-F]*$/)),
]);
export const EntrypointVersion = Schema.Literals(["0.7", "0.8", "0.9"]);
export const KernelVersion = Schema.Literals(["3.1", "3.2", "3.3"]);
export const OwnerType = Schema.Literals(["ecdsa", "passkey"]);
export const SessionKeyType = Schema.Literals(["ecdsa", "passkey", "multisig"]);

export type EthereumAddress = typeof EthereumAddress.Type;
export type Hex = typeof Hex.Type;
export type EntrypointVersion = typeof EntrypointVersion.Type;
export type KernelVersion = typeof KernelVersion.Type;
export type OwnerType = typeof OwnerType.Type;
export type SessionKeyType = typeof SessionKeyType.Type;
