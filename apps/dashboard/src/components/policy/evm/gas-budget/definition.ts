import { FuelStationIcon } from "@namera-ai/ui/icons";

export const definition = {
  onchain: "gas-limit",
  type: "evm.gas-budget",
  name: evmPolicyDisplayNames["evm.gas-budget"],
  description: "Limit native gas costs by network and reset period.",
  cardinality: "singleton",
  icon: FuelStationIcon,
} as const;
import { evmPolicyDisplayNames } from "@namera-ai/protocol";
