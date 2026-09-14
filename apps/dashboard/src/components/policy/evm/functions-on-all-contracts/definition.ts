import { CreateEvmWildcardFunctionsPolicy } from "@namera-ai/protocol";
import { ShieldUserIcon } from "@namera-ai/ui/icons";

export const definition = {
  type: "evm.functions-on-all-contracts",
  onchain: "functions-on-all-contracts",
  name: "Functions on any contract",
  description: "Only call these selectors, across non-management contracts.",
  cardinality: "singleton",
  icon: ShieldUserIcon,
  schema: CreateEvmWildcardFunctionsPolicy,
  initial: { type: "evm.functions-on-all-contracts", version: 1, functions: [] },
} as const;
