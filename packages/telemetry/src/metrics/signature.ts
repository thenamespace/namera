import { Metric } from "effect";

export const signatureResults = Metric.counter("namera.signature.results", {
  description: "Smart-account signature workflow outcomes",
  incremental: true,
});

export const signatureDuration = Metric.timer("namera.signature.duration", {
  description: "Duration of synchronous smart-account signature workflows",
});

export const signaturePolicyDecisions = Metric.counter("namera.signature.policy.decisions", {
  description: "Bounded policy decisions made while selecting a signature session key",
  incremental: true,
});
