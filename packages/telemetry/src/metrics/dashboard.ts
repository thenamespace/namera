import { Metric } from "effect";

export const dashboardOverviewReads = Metric.counter("namera.dashboard.overview.reads", {
  description: "Number of organization dashboard overview snapshots loaded",
  incremental: true,
});

export const dashboardOverviewReadDuration = Metric.timer(
  "namera.dashboard.overview.read.duration",
  { description: "Duration of organization dashboard overview aggregation" },
);
