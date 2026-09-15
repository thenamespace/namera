import { Schema } from "effect";

import { RequestMagicLinkRequest } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { EmailFormValidator } from "../../src/routes/auth/-components/auth-form/schema";

describe("beta invite signup form", () => {
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
