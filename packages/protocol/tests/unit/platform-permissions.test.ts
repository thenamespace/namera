import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import { PlatformPermission, platformPermissions } from "../../src/model/auth/platform.js";

describe("platform permissions", () => {
  it("grants only implemented team administration to the owner", () => {
    expect(platformPermissions.owner).toEqual(["team:manage", "ownership:transfer"]);
    expect(platformPermissions.operator).toEqual([]);
    expect(platformPermissions.viewer).toEqual([]);
  });

  it.each(["waitlist:read", "waitlist:accept", "invites:read", "invites:create", "invites:revoke"])(
    "rejects the unimplemented permission %s",
    (permission) => {
      expect(Schema.is(PlatformPermission)(permission)).toBe(false);
    },
  );
});
