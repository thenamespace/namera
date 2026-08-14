import { Metric } from "effect";

export const sessionKeyCreationResults = Metric.counter("namera.session_key.creation.results", {
  description: "Session-key creation outcomes",
  incremental: true,
});

export const sessionKeyCreationDuration = Metric.timer("namera.session_key.creation.duration", {
  description: "Duration of session-key creation workflows",
});
