import { Predicate } from "effect";

import { toast } from "@namera-ai/ui";

import { teamErrorMessage } from "@/lib/team-feedback";

export function inviteNeedsSignIn(error: unknown) {
  return Predicate.isTagged(error, "Unauthorized");
}

export function showInviteError(error: unknown) {
  toast.danger("Couldn’t update invite codes", {
    description: inviteNeedsSignIn(error)
      ? "Your session has expired. Sign in again to continue."
      : teamErrorMessage(error),
  });
}
