import { Metric } from "effect";

export const apiKeyCreationResults = Metric.counter("namera.api_key.creation.results", {
  description: "API-key creation outcomes",
  incremental: true,
});

export const apiKeyCreationDuration = Metric.timer("namera.api_key.creation.duration", {
  description: "Duration of API-key creation workflows",
});
