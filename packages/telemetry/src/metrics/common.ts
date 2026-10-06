import { Metric } from "effect";

export const rateLimitRejections = Metric.counter("namera.http.rate_limit.rejections", {
  description: "Requests rejected by a code-owned rate-limit scope",
  incremental: true,
});

export const httpServerRequests = Metric.counter("namera.http.server.requests", {
  description: "Number of HTTP requests handled by the Namera server",
  incremental: true,
});

export const httpServerRequestDuration = Metric.timer("namera.http.server.request.duration", {
  description: "Duration of HTTP requests handled by the Namera server",
});
