import { Metric } from "effect";

export const waitlistJoins = Metric.counter("namera.waitlist.joins", {
  description: "New waitlist entries; duplicate submissions are excluded",
  incremental: true,
});
export const waitlistStatusChanges = Metric.counter("namera.waitlist.status_changes", {
  description: "Committed waitlist status changes, by destination status",
  incremental: true,
});
