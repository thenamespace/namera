import { Predicate } from "effect";

import { pendingTeamInvitation } from "@/lib/team-invitation";

export function authErrorMessage(error: unknown, fallback: string): string {
  if (Predicate.isTagged(error, "RateLimitExceeded"))
    return "Too many attempts. Wait a minute, then try again.";
  if (Predicate.isTagged(error, "InvalidMagicLinkError"))
    return "This code or link is invalid or expired. Request a new email.";
  if (Predicate.isTagged(error, "GoogleAuthError") && "code" in error) {
    switch (error.code) {
      case "GOOGLE_CANCELED":
        return "Google sign-in was canceled. Choose a sign-in method to try again.";
      case "EMAIL_LOGIN_REQUIRED":
        return "Check your email to confirm your Google account, or continue with email.";
      case "GOOGLE_NOT_CONFIGURED":
        return "Google sign-in is unavailable. Continue with email.";
      default:
        return "Google sign-in didn’t finish. Try again or continue with email.";
    }
  }
  return fallback;
}

export const finishSignIn = (response: { body: { returnTo: string } }) => {
  window.location.replace(
    response.body.returnTo === "/auth/invite"
      ? "/auth?denied=true"
      : pendingTeamInvitation()
        ? "/invitations/accept"
        : "/",
  );
};
