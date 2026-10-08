import { Predicate } from "effect";

import { toast } from "@namera-ai/ui";

import { teamErrorMessage } from "@/lib/team-feedback";

export function inviteNeedsSignIn(error: unknown) {
  return (
    Predicate.isTagged(error, "Unauthorized") ||
    (Predicate.isTagged(error, "PlatformAuthError") &&
      "code" in error &&
      error.code === "RECENT_LOGIN_REQUIRED")
  );
}

export function showInviteError(error: unknown) {
  toast.danger("Couldn’t update invite codes", {
    description: inviteNeedsSignIn(error)
      ? "Sign in again, then retry. Invite changes require a recent sign-in."
      : teamErrorMessage(error),
  });
}
