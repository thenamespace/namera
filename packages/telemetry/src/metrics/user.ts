import { Metric } from "effect";

export const userCountMetric = Metric.counter("user_count", {
  description: "Total number of users",
  bigint: true,
  incremental: true,
});
