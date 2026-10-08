import { describe, expect, it } from "vitest";

import { EmailCodeValidator } from "../../../src/routes/auth/-components/auth-form/email-code-schema";

describe("email sign-in code form", () => {
  it("preserves leading zeroes and normalizes the email", async () => {
    const result = await EmailCodeValidator["~standard"].validate({
      email: "MEMBER@example.com",
      code: "00123456",
    });
    expect(result).toEqual({ value: { email: "member@example.com", code: "00123456" } });
  });
  it.each(["", "123456", "123456789", "1234abcd"])("rejects invalid code %j", async (code) => {
    const result = await EmailCodeValidator["~standard"].validate({
      email: "member@example.com",
      code,
    });
    expect(result.issues?.length).toBeGreaterThan(0);
  });
});
