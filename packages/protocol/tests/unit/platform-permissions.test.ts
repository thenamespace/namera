import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import { PlatformPermission, platformPermissions } from "../../src/model/auth/platform.js";

describe("platform permissions", () => {
  it("grants team administration only to owners and access management to operators", () => {
    expect(platformPermissions.owner).toEqual([
      "overview:read",
      "team:manage",
      "ownership:transfer",
      "invites:read",
      "invites:manage",
      "waitlist:read",
      "waitlist:accept",
    ]);
    expect(platformPermissions.operator).toEqual([
      "overview:read",
      "invites:read",
      "invites:manage",
      "waitlist:read",
      "waitlist:accept",
    ]);
    expect(platformPermissions.viewer).toEqual(["overview:read", "invites:read", "waitlist:read"]);
  });

  it.each(["users:read", "waitlist:delete", "invites:create", "invites:revoke"])(
    "rejects the unimplemented permission %s",
    (permission) => {
      expect(Schema.is(PlatformPermission)(permission)).toBe(false);
    },
  );
});
