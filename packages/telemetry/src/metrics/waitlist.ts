import { Metric } from "effect";

export const waitlistAcceptances = Metric.counter("namera.waitlist.acceptances", {
  description:
    "Waitlist entries accepted with an invite and queued email; repeat requests excluded",
  incremental: true,
});

export const waitlistJoins = Metric.counter("namera.waitlist.joins", {
  description: "New waitlist entries; duplicate submissions are excluded",
  incremental: true,
});
