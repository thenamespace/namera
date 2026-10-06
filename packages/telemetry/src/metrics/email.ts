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

export const emailJobTimeToSend = Metric.timer("namera.email.jobs.time_to_send", {
  description: "Elapsed time from enqueue to provider acceptance, including retries",
});
