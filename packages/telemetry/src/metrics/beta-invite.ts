import { Metric } from "effect";

export const betaInviteTransitions = Metric.counter("namera.beta_invite.transitions", {
  description: "Committed beta invite creations, revocations, and redemptions",
  incremental: true,
});
