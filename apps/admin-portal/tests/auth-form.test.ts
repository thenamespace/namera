import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import { authErrorMessage } from "../src/lib/auth-feedback";
import { EmailForm, CodeForm } from "../src/routes/auth/-components/schema";

describe("admin sign-in forms", () => {
  it("normalizes email and rejects invalid addresses", () => {
    expect(Schema.decodeUnknownSync(EmailForm)({ email: "  Team@Example.com  " }).email).toBe(
      "team@example.com",
    );
    expect(() => Schema.decodeUnknownSync(EmailForm)({ email: "not-an-email" })).toThrow();
  });
  it("requires exactly eight digits for email verification", () => {
    for (const code of ["", "123456", "abcdefgh", "123456789"])
      expect(Schema.is(CodeForm)({ email: "team@example.com", code })).toBe(false);
    expect(
      Schema.decodeUnknownSync(CodeForm)({ email: "team@example.com", code: "12345678" }).code,
    ).toBe("12345678");
  });
  it("shows safe instructions without reflecting server messages", () => {
    expect(authErrorMessage({ _tag: "RateLimitExceeded" }, "fallback")).toContain("Wait a minute");
    expect(authErrorMessage({ message: "secret infrastructure detail" }, "Try again")).toBe(
      "Try again",
    );
  });
});
