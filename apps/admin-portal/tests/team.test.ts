import { afterEach, describe, expect, it, vi } from "vitest";

import { hasPermissions, manageTeamPermission } from "../src/components/permission";
import { isAccessRejection } from "../src/lib/access-rejection";
import { teamErrorMessage } from "../src/lib/team-feedback";
import {
  captureTeamInvitation,
  clearTeamInvitation,
  pendingTeamInvitation,
} from "../src/lib/team-invitation";

afterEach(() => vi.unstubAllGlobals());

describe("team access and feedback", () => {
  it("requires every declared permission, not merely a logged-in member", () => {
    expect(hasPermissions([], manageTeamPermission)).toBe(false);
    expect(hasPermissions(["ownership:transfer"], manageTeamPermission)).toBe(false);
    expect(hasPermissions(["team:manage"], manageTeamPermission)).toBe(true);
  });
  it("invalidates rejected access but does not log out on network errors", () => {
    expect(isAccessRejection({ _tag: "PlatformAuthError", code: "ADMIN_ACCESS_REQUIRED" })).toBe(
      true,
    );
    expect(isAccessRejection(new TypeError("Network unavailable"))).toBe(false);
    expect(teamErrorMessage({ _tag: "Unauthorized" })).toContain("Sign in again");
  });
});

describe("invitation handoff", () => {
  it("captures the fragment without keeping it in history, survives sign-in and clears on completion", () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    });
    const replaceState = vi.fn();
    const token = "a".repeat(43);
    const location = { hash: `#token=${token}`, pathname: "/invitations/accept" };
    vi.stubGlobal("window", { location, history: { state: null, replaceState } });
    expect(captureTeamInvitation()).toBe(token);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/invitations/accept");
    location.hash = "";
    expect(pendingTeamInvitation()).toBe(token);
    clearTeamInvitation();
    expect(pendingTeamInvitation()).toBeNull();
    location.hash = "#token=invalid";
    expect(captureTeamInvitation()).toBeNull();
  });
});
