import { Metric } from "effect";

export const emailJobsEnqueued = Metric.counter("namera.email.jobs.enqueued", {
  description: "Number of durable email jobs enqueued",
  incremental: true,
});

export const emailJobDeliveryResults = Metric.counter("namera.email.jobs.delivery.results", {
  description: "Email job delivery state transitions",
  incremental: true,
});

export const emailJobDeliveryDuration = Metric.timer("namera.email.jobs.delivery.duration", {
  description: "Duration of email provider delivery attempts",
});
