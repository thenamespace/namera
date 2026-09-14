import { GlobalIcon } from "@namera-ai/ui/icons";

export const definition = {
  type: "evm.chain-allowlist",
  name: "Allowed networks",
  description: "Choose the networks allowed for this session key.",
  cardinality: "singleton",
  icon: GlobalIcon,
} as const;
