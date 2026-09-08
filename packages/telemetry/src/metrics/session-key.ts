import { Metric } from "effect";

export const sessionKeyOperationResults = Metric.counter("namera.session_key.operation.results", {
  description: "Owner-approved session operation transitions and denials",
  incremental: true,
});

export const sessionKeyOperationDuration = Metric.timer("namera.session_key.operation.duration", {
  description: "Duration of owner session operation preparation and approval",
});

export const sessionKeyCreationResults = Metric.counter("namera.session_key.creation.results", {
  description: "Session-key creation outcomes",
  incremental: true,
});

export const sessionKeyCreationDuration = Metric.timer("namera.session_key.creation.duration", {
  description: "Duration of session-key creation workflows",
});

export const sessionKeyRevocationResults = Metric.counter("namera.session_key.revocation.results", {
  description: "Session-key revocation outcomes",
  incremental: true,
});

export const sessionKeyRevocationDuration = Metric.timer("namera.session_key.revocation.duration", {
  description: "Duration of session-key revocation workflows",
});
