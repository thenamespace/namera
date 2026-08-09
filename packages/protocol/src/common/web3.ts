import { Schema } from "effect";

export const Hex = Schema.TemplateLiteral(["0x", Schema.String])
  .check(
    Schema.isPattern(/^0x[0-9a-fA-F]*$/, {
      message: "Hex must be a 0x-prefixed hexadecimal string",
    }),
  )
  .annotate({ identifier: "Hex", description: "A 0x-prefixed hexadecimal string" });

export const EthereumAddress = Hex.check(
  Schema.isPattern(/^0x[0-9a-fA-F]{40}$/, {
    message: "Invalid Ethereum address",
  }),
)
  .pipe(Schema.brand("EthereumAddress"))
  .annotate({ identifier: "EthereumAddress", description: "A 20-byte Ethereum address" });

export const EntryPointVersion = Schema.Literals(["0.6", "0.7", "0.8"]);
export const KernelVersion = Schema.Literals(["0.3.0", "0.3.1", "0.3.2", "0.3.3"]);
export const ValidatorType = Schema.Literals(["webauthn_p256", "raw_p256", "ecdsa_secp256k1"]);

export type Hex = typeof Hex.Type;
export type EthereumAddress = typeof EthereumAddress.Type;
export type EntryPointVersion = typeof EntryPointVersion.Type;
export type KernelVersion = typeof KernelVersion.Type;
export type ValidatorType = typeof ValidatorType.Type;
