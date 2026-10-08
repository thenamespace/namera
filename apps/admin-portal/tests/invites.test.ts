import { Schema } from "effect";

import { CreateBetaInvitesRequest } from "@namera-ai/protocol/dto";
import { platformPermissions } from "@namera-ai/protocol/model";
import { describe, expect, it } from "vitest";

import {
  hasPermissions,
  manageInvitesPermission,
  readInvitesPermission,
} from "../src/components/permission";
import { inviteNeedsSignIn } from "../src/lib/invite-feedback";
import {
  CreateInvitesForm,
  invitePayload,
} from "../src/routes/_authenticated/-components/invites/create-form";

describe("invite code creation", () => {
  const decode = Schema.decodeUnknownSync(CreateInvitesForm);
  it.each([7, 14, 30])("accepts the %i-day preset in the form and API", (expiresInDays) => {
    const payload = invitePayload(decode({ count: 1, expiresInDays, email: "" }));
    expect(payload.expiresInDays).toBe(expiresInDays);
    expect(Schema.is(CreateBetaInvitesRequest)(payload)).toBe(true);
  });
  it("supports an unbound single code and normalizes a bound email", () => {
    expect(invitePayload(decode({ count: 1, expiresInDays: 7, email: "" }))).toEqual({
      count: 1,
      expiresInDays: 7,
    });
    expect(
      invitePayload(decode({ count: 1, expiresInDays: 7, email: "  Recipient@Example.com " })),
    ).toEqual({ count: 1, expiresInDays: 7, email: "recipient@example.com" });
  });
  it("does not send stale email input for a batch, while the API rejects batch binding", () => {
    expect(
      invitePayload(decode({ count: 3, expiresInDays: 7, email: "recipient@example.com" })),
    ).not.toHaveProperty("email");
    expect(Schema.is(CreateBetaInvitesRequest)({ count: 3, email: "recipient@example.com" })).toBe(
      false,
    );
  });
  it.each([
    { count: 0, expiresInDays: 7, email: "" },
    { count: 51, expiresInDays: 7, email: "" },
    { count: 1.5, expiresInDays: 7, email: "" },
    { count: 1, expiresInDays: 31, email: "" },
    { count: 1, expiresInDays: 7, email: "invalid" },
  ])("rejects invalid form values: %j", (value) => expect(() => decode(value)).toThrow());
  it("allows everyone to read but only owners and operators to manage", () => {
    for (const role of ["owner", "operator", "viewer"] as const) {
      expect(hasPermissions(platformPermissions[role], readInvitesPermission)).toBe(true);
      expect(hasPermissions(platformPermissions[role], manageInvitesPermission)).toBe(
        role !== "viewer",
      );
    }
  });
  it("offers reauthentication only for an invalid session", () => {
    expect(inviteNeedsSignIn({ _tag: "Unauthorized" })).toBe(true);
    expect(inviteNeedsSignIn({ _tag: "PlatformAuthError", code: "ADMIN_ACCESS_REQUIRED" })).toBe(
      false,
    );
    expect(inviteNeedsSignIn(new Error("offline"))).toBe(false);
  });
});
