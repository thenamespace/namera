import { Metric } from "effect";

export const executionResults = Metric.counter("namera.execution.results", {
  description: "Execution workflow outcomes",
  incremental: true,
});

export const executionDuration = Metric.timer("namera.execution.duration", {
  description: "Duration of execution preparation, completion and simulation requests",
});

export const executionPolicyDecisions = Metric.counter("namera.execution.policy.decisions", {
  description: "Bounded policy decisions made while selecting a session key",
  incremental: true,
});

export const executionReconciliations = Metric.counter("namera.execution.reconciliations", {
  description: "Background execution reconciliation outcomes",
  incremental: true,
});
