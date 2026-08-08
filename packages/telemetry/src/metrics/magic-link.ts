import { Metric } from "effect";

export const magicLinkRequests = Metric.counter("namera.auth.magic_link.requests", {
  description: "Number of magic-link sign-in requests",
  incremental: true,
});

export const magicLinkRequestDuration = Metric.timer("namera.auth.magic_link.request.duration", {
  description: "Duration of magic-link request workflows",
});

export const magicLinkVerificationResults = Metric.frequency(
  "namera.auth.magic_link.verification.results",
  {
    description: "Result of magic-link verification attempts",
    preregisteredWords: ["success", "invalid", "expired", "attempts_exceeded"],
  },
);

export const magicLinkEmailResults = Metric.frequency("namera.auth.magic_link.email.results", {
  description: "Result of magic-link email delivery attempts",
  preregisteredWords: ["success", "failure"],
});
