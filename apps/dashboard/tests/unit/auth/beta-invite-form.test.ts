import { Schema } from "effect";

import { RequestMagicLinkRequest } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { EmailFormValidator } from "../../../src/routes/auth/-components/auth-form/schema";
import { InviteFormValidator } from "../../../src/routes/auth/-components/invite-schema";

describe("beta invite signup form", () => {
  it("requires a valid invite on the post-verification page", async () => {
    const invalid = await Promise.all(
      ["", "123", "O0IIII", "k7mp2x"].map((inviteCode) =>
        InviteFormValidator["~standard"].validate({ inviteCode }),
      ),
    );
    for (const result of invalid) expect(result.issues).toBeDefined();
    expect(await InviteFormValidator["~standard"].validate({ inviteCode: "K7MP2X" })).toEqual({
      value: { inviteCode: "K7MP2X" },
    });
  });
  it("omits a cleared invite instead of restoring a link's prefilled code", async () => {
    const result = await EmailFormValidator["~standard"].validate({
      email: "member@example.com",
      inviteCode: "",
    });
    expect(result).toEqual({ value: { email: "member@example.com" } });
  });
  it("lets existing users leave the controlled invite field blank", async () => {
    const result = await EmailFormValidator["~standard"].validate({
      email: "member@example.com",
      inviteCode: undefined,
    });
    expect(result.issues).toBeUndefined();
  });
  it("accepts an invite and rejects malformed or ambiguous codes", () => {
    expect(
      Schema.is(RequestMagicLinkRequest)({ email: "member@example.com", inviteCode: "K7MP2X" }),
    ).toBe(true);
    for (const inviteCode of ["123", "AAAAAA7", "O0IIII", "k7mp2x"]) {
      expect(Schema.is(RequestMagicLinkRequest)({ email: "member@example.com", inviteCode })).toBe(
        false,
      );
    }
  });
});
