import { Metric } from "effect";

export const organizationInvitationFailures = Metric.counter(
  "namera.organization.invitation.failures",
  {
    description: "Rejected invitation mutation requests by action and bounded error code",
    incremental: true,
  },
);

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

export const organizationMemberEvents = Metric.frequency("namera.organization.member.events", {
  description: "Successful organization member administration events",
  preregisteredWords: ["role_updated", "removed"],
});
