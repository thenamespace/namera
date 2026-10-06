import { Metric } from "effect";

export const workerBacklog = Metric.gauge("namera.worker.backlog", {
  description: "Nonterminal queued items, including leased and retrying work",
});

export const workerOldestAge = Metric.gauge("namera.worker.oldest_age", {
  description: "Age in seconds of the oldest queued item; zero for an empty queue",
});

export const workerPollResults = Metric.counter("namera.worker.poll.results", {
  description: "Completed worker polls by worker and success or failure",
  incremental: true,
});

export const workerLastSuccess = Metric.gauge("namera.worker.last_success", {
  description: "Unix timestamp in seconds of the last successful worker poll",
});
