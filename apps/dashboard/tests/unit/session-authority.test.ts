import type { UserActorData } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { canSaveInAuthority, sessionAuthority } from "../../src/atoms/auth/authority";

// Only fields contributing to authority are relevant to this comparison.
const actor = {
  user: { id: "user" },
  session: { id: "session" },
  organization: { id: "organization" },
  member: { organizationMember: { id: "member" } },
  role: { id: "role", permissions: ["wallet:read", "wallet:create"] },
} as unknown as UserActorData;

describe("browser authority boundary", () => {
  it("ignores presentation and permission ordering changes", () => {
    expect(
      sessionAuthority({
        ...actor,
        role: { ...actor.role, permissions: actor.role.permissions.toReversed() },
      }),
    ).toBe(sessionAuthority(actor));
    expect(
      sessionAuthority({
        ...actor,
        user: { ...actor.user, metadata: { ...actor.user.metadata, name: "New name" } },
      }),
    ).toBe(sessionAuthority(actor));
  });

  it("changes for user, session, tenant, membership, role or permission changes", () => {
    const variants = [
      { ...actor, user: { ...actor.user, id: "other-user" } },
      { ...actor, session: { ...actor.session, id: "other-session" } },
      { ...actor, organization: { ...actor.organization, id: "other-org" } },
      {
        ...actor,
        member: {
          ...actor.member,
          organizationMember: { ...actor.member.organizationMember, id: "other-member" },
        },
      },
      { ...actor, role: { ...actor.role, id: "other-role" } },
      { ...actor, role: { ...actor.role, permissions: ["wallet:read"] } },
    ] as UserActorData[];
    for (const changed of variants) {
      expect(sessionAuthority(changed)).not.toBe(sessionAuthority(actor));
      expect(canSaveInAuthority(sessionAuthority(actor), sessionAuthority(changed))).toBe(false);
    }
  });

  it("blocks autosave while signed out, loading or after a registry reset", () => {
    const authority = sessionAuthority(actor);
    expect(canSaveInAuthority(authority, authority)).toBe(true);
    expect(canSaveInAuthority(authority, null)).toBe(false);
    expect(canSaveInAuthority(authority, undefined)).toBe(false);
    expect(canSaveInAuthority(undefined, undefined)).toBe(false);
    expect(canSaveInAuthority(null, null)).toBe(false);
  });
});
