import { Predicate } from "effect";

import { toast } from "@namera-ai/ui";

export function teamErrorMessage(error: unknown): string {
  if (Predicate.isTagged(error, "PlatformAuthError") && "code" in error) {
    switch (error.code) {
      case "MEMBER_ALREADY_EXISTS":
        return "This email already belongs to a team member.";
      case "MEMBER_NOT_FOUND":
        return "This member is no longer available. Refresh the page.";
      case "OWNER_TRANSFER_REQUIRED":
        return "The owner cannot be changed or removed here.";
      case "INVITATION_EMAIL_MISMATCH":
        return "Sign in with the email address that received this invitation.";
      case "INVITATION_UNAVAILABLE":
        return "This invitation has expired or is no longer available. Ask the owner for a new invitation.";
      default:
        return "You no longer have permission for this action. Sign in again or contact the owner.";
    }
  }
  if (Predicate.isTagged(error, "Unauthorized"))
    return "Your session has expired. Sign in again to continue.";
  if (Predicate.isTagged(error, "RateLimitExceeded"))
    return "Too many attempts. Wait a minute and try again.";
  return "The request could not be completed. Check your connection and try again.";
}

export function showTeamError(error: unknown) {
  toast.danger("Couldn’t complete action", { description: teamErrorMessage(error) });
}
