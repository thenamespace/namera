import { Coins01Icon } from "@namera-ai/ui/icons";

export const definition = {
  onchain: "native-token-transfer",
  type: "evm.native-spend-limit",
  name: evmPolicyDisplayNames["evm.native-spend-limit"],
  description: "Limit native-token spending for the session key.",
  cardinality: "singleton",
  icon: Coins01Icon,
} as const;
import { evmPolicyDisplayNames } from "@namera-ai/protocol";
