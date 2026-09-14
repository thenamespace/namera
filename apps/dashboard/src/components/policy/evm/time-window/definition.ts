import { CalendarClockIcon } from "@namera-ai/ui/icons";

export const definition = {
  onchain: "time-window",
  type: "evm.time-window",
  name: "Time window",
  description: "Choose when this session key starts and expires.",
  cardinality: "singleton",
  icon: CalendarClockIcon,
} as const;
