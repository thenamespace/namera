import { Coins01Icon } from "@namera-ai/ui/icons";

export const definition = {
  onchain: "native-token-transfer",
  type: "evm.native-spend-limit",
  name: "Native spend",
  description: "Limit native-token spending for the session key.",
  cardinality: "singleton",
  icon: Coins01Icon,
} as const;
