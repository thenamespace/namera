import { Schema } from "effect";

import { EvmJsonAbi } from "@namera-ai/protocol/model";

import { abiFunctionOptions } from "@/components/evm-function-picker/functions";

export function parseContractAbi(text: string) {
  try {
    const abi = Schema.decodeUnknownSync(EvmJsonAbi)(JSON.parse(text));
    return abiFunctionOptions(abi).length ? abi : null;
  } catch {
    return null;
  }
}

export const ContractAbiText = Schema.String.check(
  Schema.makeFilter((value) => parseContractAbi(value) !== null, {
    message: "Enter a JSON ABI containing at least one function.",
  }),
);
