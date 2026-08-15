import { Metric } from "effect";

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
