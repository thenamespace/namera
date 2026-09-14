import { CreateEvmContractFunctionsPolicy } from "@namera-ai/protocol";
import { ShieldUserIcon } from "@namera-ai/ui/icons";

export const definition = {
  type: "evm.functions-on-contract",
  onchain: "functions-on-contract",
  name: "Contract functions",
  description: "Only call selected functions on this contract through Namera.",
  cardinality: "singleton",
  icon: ShieldUserIcon,
  schema: CreateEvmContractFunctionsPolicy,
  initial: { type: "evm.functions-on-contract", version: 1, address: "0x", functions: [] },
} as const;
