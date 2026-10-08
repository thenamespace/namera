import { Metric } from "effect";

export const waitlistJoins = Metric.counter("namera.waitlist.joins", {
  description: "New waitlist entries; duplicate submissions are excluded",
  incremental: true,
});
