import { CreateEvmTokenSpendPolicy } from "@namera-ai/protocol";
import { ShieldUserIcon } from "@namera-ai/ui/icons";

export const definition = {
  type: "evm.erc20-token-transfer",
  onchain: "erc20-token-transfer",
  name: "Token spend limit",
  description: "Only direct transfers and approvals for this token. Lifetime budget per network.",
  cardinality: "singleton",
  icon: ShieldUserIcon,
  schema: CreateEvmTokenSpendPolicy,
  initial: { type: "evm.erc20-token-transfer", version: 1, address: "0x", allowance: "0" },
} as const;
