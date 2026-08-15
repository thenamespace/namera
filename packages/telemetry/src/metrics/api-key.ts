import { Metric } from "effect";

export const apiKeyCreationResults = Metric.counter("namera.api_key.creation.results", {
  description: "API-key creation outcomes",
  incremental: true,
});

export const apiKeyCreationDuration = Metric.timer("namera.api_key.creation.duration", {
  description: "Duration of API-key creation workflows",
});

export const apiKeyRevocationResults = Metric.counter("namera.api_key.revocation.results", {
  description: "API-key revocation outcomes",
  incremental: true,
});

export const apiKeyRevocationDuration = Metric.timer("namera.api_key.revocation.duration", {
  description: "Duration of API-key revocation workflows",
});
