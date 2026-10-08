import { Schema } from "effect";

import { AcceptPlatformInvitationRequest } from "@namera-ai/protocol/dto";

const key = "namera-admin-invitation";
const isToken = Schema.is(AcceptPlatformInvitationRequest.fields.token);

export function pendingTeamInvitation() {
  if (typeof window === "undefined") return null;
  const token = sessionStorage.getItem(key);
  return isToken(token) ? token : null;
}

export function captureTeamInvitation() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (fragment.has("token")) {
    const token = fragment.get("token");
    sessionStorage.removeItem(key);
    if (isToken(token)) sessionStorage.setItem(key, token);
    // Keep bearer credentials out of navigation history and subsequent URLs.
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }
  return pendingTeamInvitation();
}

export function clearTeamInvitation() {
  sessionStorage.removeItem(key);
}
