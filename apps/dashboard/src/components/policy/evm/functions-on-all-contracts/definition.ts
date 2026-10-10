import { CreateEvmWildcardFunctionsPolicy } from "@namera-ai/protocol";
import { ShieldUserIcon } from "@namera-ai/ui/icons";

export const definition = {
  type: "evm.functions-on-all-contracts",
  onchain: "functions-on-all-contracts",
  name: evmPolicyDisplayNames["evm.functions-on-all-contracts"],
  description: "Only call these selectors, across non-management contracts.",
  cardinality: "singleton",
  icon: ShieldUserIcon,
  schema: CreateEvmWildcardFunctionsPolicy,
  initial: { type: "evm.functions-on-all-contracts", version: 1, functions: [] },
} as const;
import { evmPolicyDisplayNames } from "@namera-ai/protocol";
