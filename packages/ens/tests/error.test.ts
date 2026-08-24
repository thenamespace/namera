import {
  AuthenticationError,
  RateLimitError,
  SubnameAlreadyExistsError,
  SubnameNotFoundError,
  ValidationError,
} from "@thenamespace/offchain-manager";
import { describe, expect, it } from "vitest";

import { toEnsError } from "../src/client.js";

describe("toEnsError", () => {
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
