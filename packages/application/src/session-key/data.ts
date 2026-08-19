import { Duration } from "effect";

export const sessionKeyPolicy = {
  maximumLifetime: Duration.days(365),
} as const;
