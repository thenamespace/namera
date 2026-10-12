import { CreateEvmContractFunctionsPolicy } from "@namera-ai/protocol";
import { FileScriptIcon } from "@namera-ai/ui/icons";

export const definition = {
  type: "evm.functions-on-contract",
  onchain: "functions-on-contract",
  name: evmPolicyDisplayNames["evm.functions-on-contract"],
  description: "Only call selected functions on this contract through Namera.",
  cardinality: "singleton",
  icon: FileScriptIcon,
  schema: CreateEvmContractFunctionsPolicy,
  initial: { type: "evm.functions-on-contract", version: 1, address: "0x", functions: [] },
} as const;
import { evmPolicyDisplayNames } from "@namera-ai/protocol";
