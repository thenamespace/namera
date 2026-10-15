import { evmPolicyDisplayNames } from "@namera-ai/protocol";
import { CalendarClockIcon } from "@namera-ai/ui/icons";

export const definition = {
  onchain: "time-window",
  type: "evm.time-window",
  name: evmPolicyDisplayNames["evm.time-window"],
  description: "Choose when API signature requests are allowed.",
  cardinality: "singleton",
  icon: CalendarClockIcon,
} as const;
