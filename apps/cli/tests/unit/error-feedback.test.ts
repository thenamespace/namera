import { Cause, Console, Effect, Exit, Schema } from "effect";

import { describe, expect, it } from "vitest";

import { reportCommandErrors, structuredErrors } from "../../src/services/command-errors.js";
import { cliFailure, errorFeedback, formatFailure } from "../../src/services/error-feedback.js";
import { localToolError, toolErrorResult } from "../../src/services/mcp/tool-errors.js";
import { unwrapResult } from "../../src/services/output.js";

describe("CLI error feedback", () => {
  it("renders unexpected defects safely while retaining failure status", async () => {
    const stderr: unknown[] = [];
    const result = await Effect.runPromiseExit(
      reportCommandErrors(Effect.die(new Error("secret-native-stack"))).pipe(
        Effect.provideService(Console.Console, {
          ...console,
          error: (...values) => {
            stderr.push(...values);
          },
        }),
      ),
    );
    expect(Exit.isFailure(result)).toBe(true);
    expect(stderr).toHaveLength(1);
    expect(String(stderr[0])).toContain("Namera could not complete this command.");
    expect(String(stderr[0])).not.toContain("secret-native-stack");
  });
  it.each([
    [{ code: "ORIGIN_MISMATCH" }, "ORIGIN_MISMATCH"],
    [{ code: "invalid_grant" }, "UNAUTHORIZED"],
    [{ code: "access_denied" }, "AUTH_DENIED"],
    [{ code: "expired_token" }, "AUTH_EXPIRED"],
    [{ kind: "network" }, "UPSTREAM_UNAVAILABLE"],
    [{ kind: "api", status: 401 }, "UNAUTHORIZED"],
    [{ kind: "api", status: 403 }, "INSUFFICIENT_SCOPE"],
    [{ kind: "api", status: 429 }, "RATE_LIMITED"],
    [{ kind: "api", status: 503 }, "UPSTREAM_UNAVAILABLE"],
    [{ code: "EACCES" }, "CONFIG_UNAVAILABLE"],
    [{ code: "ERR_INVALID_URL" }, "INVALID_HOST"],
  ])("classifies %j without exposing raw details", (input, code) => {
    const error = errorFeedback({ ...input, message: "secret", stack: "secret", cause: "secret" });
    expect(error.code).toBe(code);
    expect(error.nextStep.length).toBeGreaterThan(10);
    expect(formatFailure(error, true)).not.toContain("secret");
  });

  it("unwraps Effect's promise failures without leaking causes", async () => {
    const failure = await Effect.runPromise(
      Effect.tryPromise(async () => {
        throw cliFailure("KEYRING_UNAVAILABLE");
      }).pipe(Effect.flip),
    );
    expect(errorFeedback(failure).code).toBe("KEYRING_UNAVAILABLE");
  });

  it("never renders arbitrary exceptions or schema inputs", async () => {
    const secret = "private-key-must-not-appear";
    const schemaError = await Effect.runPromise(
      Schema.decodeUnknownEffect(Schema.Number)(secret).pipe(Effect.flip),
    );
    for (const error of [new Error(secret), schemaError, { _tag: "Unexpected", message: secret }]) {
      expect(formatFailure(errorFeedback(error), false)).not.toContain(secret);
      expect(formatFailure(errorFeedback(error), true)).not.toContain(secret);
    }
  });

  it("preserves actionable SDK error codes", async () => {
    const cause = await Effect.runPromise(
      unwrapResult({
        success: false,
        data: null,
        error: {
          kind: "signer",
          code: "PREPARED_EXECUTION_INVALID",
          message: "raw provider details",
          status: null,
          cause: null,
        },
      }).pipe(Effect.flip),
    );
    expect(cause.code).toBe("PREPARED_EXECUTION_INVALID");
    expect(cause.retryable).toBe(false);
    expect(formatFailure(cause, true)).not.toContain("raw provider");
  });

  it("adds the same next step to MCP text and structured errors", () => {
    const result = toolErrorResult(localToolError("EXECUTION_UNAVAILABLE"));
    expect(result.structuredContent).toMatchObject({
      error: {
        code: "EXECUTION_UNAVAILABLE",
        retryable: false,
        nextStep: expect.stringContaining("twice"),
      },
    });
    expect(result.content).toEqual([
      { type: "text", text: JSON.stringify(result.structuredContent) },
    ]);
  });

  it("keeps unknown defects non-retryable", () => {
    const error = errorFeedback(Cause.squash(Cause.die(new Error("secret"))));
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.retryable).toBe(false);
  });

  it("honors structured format flags without interpreting positional arguments", () => {
    expect(structuredErrors(["--output=json"])).toBe(true);
    expect(structuredErrors(["wallet", "list", "-o", "ndjson"])).toBe(true);
    expect(structuredErrors(["--", "--output", "json"])).toBe(false);
    expect(structuredErrors(["--output", "json", "--output", "pretty"])).toBe(false);
  });
});
