import { CalendarClockIcon } from "@namera-ai/ui/icons";

export const timeWindowPolicy = {
  type: "evm.time-window",
  name: "Time window",
  description: "Restrict when this session key can be used.",
  cardinality: "singleton",
  icon: CalendarClockIcon,
} as const;

export const policyCatalog = {
  eip155: [timeWindowPolicy],
} as const;

export const policyDefinitions = {
  "evm.time-window": timeWindowPolicy,
} as const;

export type PolicyDefinition = (typeof policyCatalog)[keyof typeof policyCatalog][number];
export type PolicyNamespace = keyof typeof policyCatalog;
