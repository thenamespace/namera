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

export const Bytes32 = Hex.check(
  Schema.isPattern(/^0x[0-9a-fA-F]{64}$/, {
    message: "Bytes32 must contain exactly 32 bytes",
  }),
)
  .pipe(Schema.brand("Bytes32"))
  .annotate({
    identifier: "Bytes32",
    description: "A 32-byte hexadecimal value",
  });

export const TransactionHash = Bytes32.pipe(Schema.brand("TransactionHash")).annotate({
  identifier: "TransactionHash",
  description: "An EVM transaction hash",
});

export const UserOperationHash = Bytes32.pipe(Schema.brand("UserOperationHash")).annotate({
  identifier: "UserOperationHash",
  description: "An ERC-4337 UserOperation hash",
});

export const EntryPointVersion = Schema.Literal("0.7");
export const AlchemyModularAccountVersion = Schema.Literal("2.0.0");
export const AlchemyModularAccount7702Version = Schema.Literals(["v1.0.0", "v1.1.0"]);

export type Hex = typeof Hex.Type;
export type EthereumAddress = typeof EthereumAddress.Type;
export type Bytes32 = typeof Bytes32.Type;
export type TransactionHash = typeof TransactionHash.Type;
export type UserOperationHash = typeof UserOperationHash.Type;
export type EntryPointVersion = typeof EntryPointVersion.Type;
export type AlchemyModularAccountVersion = typeof AlchemyModularAccountVersion.Type;
export type AlchemyModularAccount7702Version = typeof AlchemyModularAccount7702Version.Type;
