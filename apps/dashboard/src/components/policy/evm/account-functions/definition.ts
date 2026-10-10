import { CreateEvmAccountFunctionsPolicy } from "@namera-ai/protocol";
import { ShieldUserIcon } from "@namera-ai/ui/icons";

export const definition = {
  type: "evm.account-functions",
  onchain: "account-functions",
  name: evmPolicyDisplayNames["evm.account-functions"],
  description: "Only call selected non-management functions on this account.",
  cardinality: "singleton",
  icon: ShieldUserIcon,
  schema: CreateEvmAccountFunctionsPolicy,
  initial: { type: "evm.account-functions", version: 1, functions: [] },
} as const;
import { evmPolicyDisplayNames } from "@namera-ai/protocol";
