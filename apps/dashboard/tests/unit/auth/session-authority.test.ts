import { Schema } from "effect";

import { UserActorData } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { canSaveInAuthority, sessionAuthority } from "../../../src/atoms/auth/authority";
import { actor } from "../../fixtures/actor";

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
    const otherId = "01900000-0000-7000-8000-000000000099";
    const variants = [
      { ...actor, user: { ...actor.user, id: otherId } },
      { ...actor, session: { ...actor.session, id: otherId } },
      { ...actor, organization: { ...actor.organization, id: otherId } },
      {
        ...actor,
        member: {
          ...actor.member,
          organizationMember: { ...actor.member.organizationMember, id: otherId },
        },
      },
      { ...actor, role: { ...actor.role, id: otherId } },
      { ...actor, role: { ...actor.role, permissions: ["wallet:read"] } },
    ].map((value) => Schema.decodeUnknownSync(Schema.toType(UserActorData))(value));
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
