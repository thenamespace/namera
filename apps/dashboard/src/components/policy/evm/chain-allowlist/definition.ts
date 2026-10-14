import { GlobalIcon } from "@namera-ai/ui/icons";

export const definition = {
  type: "evm.chain-allowlist",
  name: evmPolicyDisplayNames["evm.chain-allowlist"],
  description: "Choose the networks allowed for signature requests.",
  cardinality: "singleton",
  icon: GlobalIcon,
} as const;
import { evmPolicyDisplayNames } from "@namera-ai/protocol";
