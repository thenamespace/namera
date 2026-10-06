import { Metric } from "effect";

export const betaInviteTransitions = Metric.counter("namera.beta_invite.transitions", {
  description: "Beta invite creation, revocation and redemption transitions",
  incremental: true,
});
