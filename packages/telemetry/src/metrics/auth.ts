import { Metric } from "effect";

export const googleAuthResults = Metric.counter("namera.auth.google.results", {
  description: "Google authentication flow outcomes by stage and result",
  incremental: true,
});
export const googleAuthDuration = Metric.timer("namera.auth.google.duration", {
  description: "Server-side Google authentication processing duration",
});
export const connectedAccountTransitions = Metric.counter(
  "namera.auth.connected_account.transitions",
  {
    description: "Committed external login account links and unlinks",
    incremental: true,
  },
);

export const authenticationResults = Metric.counter("namera.auth.authentication.results", {
  description: "Credential authentication outcomes, excluding downstream handler failures",
  incremental: true,
});

export const userProfileUpdates = Metric.counter("namera.auth.user.profile_updates", {
  description: "Number of user profile updates",
  incremental: true,
});

export const sessionLifecycleEvents = Metric.frequency("namera.auth.session.lifecycle", {
  description: "Successful session lifecycle events",
  preregisteredWords: [
    "revoked",
    "selected_revoked",
    "others_revoked",
    "active_organization_changed",
  ],
});
