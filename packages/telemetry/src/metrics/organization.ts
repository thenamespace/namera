import { Metric } from "effect";

export const organizationCreations = Metric.counter("namera.organization.creations", {
  description: "Number of organizations created",
  incremental: true,
});

export const organizationUpdates = Metric.counter("namera.organization.updates", {
  description: "Number of organization metadata updates",
  incremental: true,
});

export const organizationInvitationEvents = Metric.frequency(
  "namera.organization.invitation.events",
  {
    description: "Successful organization invitation lifecycle events",
    preregisteredWords: ["created", "accepted", "rejected", "canceled"],
  },
);
