import { Schema, SchemaGetter } from "effect";

import { EvmSessionPermission } from "@namera-ai/protocol/evm";

import type { OnchainPermissionInput } from "@/components/policy/evm/onchain/catalog";

export const contractAccessModes = [
  { id: "contract-access", name: "All functions on one contract" },
  { id: "functions-on-contract", name: "Selected functions on one contract" },
  { id: "functions-on-all-contracts", name: "Selected functions on any contract" },
] as const;

export function toContractAccessForm(permission?: OnchainPermissionInput | undefined) {
  return {
    type:
      permission?.type === "functions-on-contract" ||
      permission?.type === "functions-on-all-contracts"
        ? permission.type
        : ("contract-access" as const),
    address: permission && "address" in permission ? permission.address : "",
    functions: permission && "functions" in permission ? permission.functions.join("\n") : "",
  };
}

export const ContractAccessForm = Schema.Struct({
  type: Schema.Literals(contractAccessModes.map((mode) => mode.id)),
  address: Schema.String,
  functions: Schema.String,
}).pipe(
  Schema.decodeTo(EvmSessionPermission, {
    decode: SchemaGetter.transform((value) => {
      const functions = value.functions
        .split(/[\n,]/)
        .map((selector) => selector.trim())
        .filter(Boolean) as Array<`0x${string}`>;
      if (value.type === "functions-on-all-contracts") return { type: value.type, functions };
      if (value.type === "functions-on-contract")
        return { type: value.type, address: value.address.trim() as `0x${string}`, functions };
      return { type: value.type, address: value.address.trim() as `0x${string}` };
    }),
    encode: SchemaGetter.transform((permission) => toContractAccessForm(permission)),
  }),
);
