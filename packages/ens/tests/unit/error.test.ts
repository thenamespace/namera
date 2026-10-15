import {
  AuthenticationError,
  RateLimitError,
  SubnameAlreadyExistsError,
  SubnameNotFoundError,
  ValidationError,
} from "@thenamespace/offchain-manager";
import { describe, expect, it } from "vitest";

import { toEnsError } from "../../src/client.js";

describe("toEnsError", () => {
  it("limits the Axios 404 compatibility fallback to single-name lookups", () => {
    const cause = { isAxiosError: true, response: { status: 404 } };
    expect(toEnsError("getSingleSubname", cause).reason).toBe("NOT_FOUND");
    expect(toEnsError("deleteSubname", cause).reason).toBe("REQUEST_FAILED");
    expect(toEnsError("getTextRecord", cause).reason).toBe("REQUEST_FAILED");
  });

  it.each([
    { response: { status: 404 } },
    { isAxiosError: false, response: { status: 404 } },
    { isAxiosError: true, response: { status: "404" } },
    { isAxiosError: true, response: null },
    null,
  ])("does not treat unrecognized failure evidence as absence: %j", (cause) => {
    expect(toEnsError("getSingleSubname", cause).reason).toBe("REQUEST_FAILED");
  });

  it.each([
    [new AuthenticationError(), "AUTHENTICATION_FAILED"],
    [new ValidationError("invalid subname"), "VALIDATION_FAILED"],
    [new SubnameNotFoundError("alice.namera.id"), "NOT_FOUND"],
    [new SubnameAlreadyExistsError("alice.namera.id"), "ALREADY_EXISTS"],
    [new RateLimitError(), "RATE_LIMITED"],
    [new Error("network unavailable"), "REQUEST_FAILED"],
  ] as const)("maps provider failures to %s", (cause, reason) => {
    const error = toEnsError("createSubname", cause);

    expect(error.operation).toBe("createSubname");
    expect(error.reason).toBe(reason);
    expect(error.cause).toBe(cause);
  });
});
