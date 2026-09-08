import { Effect, Exit } from "effect";
import { HttpApiError } from "effect/unstable/httpapi";

import { describe, expect, it } from "vitest";

import { recoverSignedOutSession } from "../../src/atoms/auth/browser-session";

describe("browser session recovery", () => {
  it("treats only Unauthorized as signed out", async () => {
    expect(
      await Effect.runPromise(
        recoverSignedOutSession(Effect.fail(new HttpApiError.Unauthorized())),
      ),
    ).toBeNull();
    expect(
      await Effect.runPromise(recoverSignedOutSession(Effect.succeed({ authenticated: true }))),
    ).toEqual({ authenticated: true });
  });

  it("preserves server, permission and transport failures", async () => {
    const errors = [
      new HttpApiError.InternalServerError(),
      new HttpApiError.Forbidden(),
      new Error("offline"),
    ];
    const failures = await Effect.runPromise(
      Effect.all(
        errors.map((error) => recoverSignedOutSession(Effect.fail(error)).pipe(Effect.flip)),
      ),
    );
    failures.forEach((failure, index) => expect(failure).toBe(errors[index]));
  });

  it("does not turn defects into signed-out sessions", async () => {
    const result = await Effect.runPromiseExit(
      recoverSignedOutSession(Effect.die("unexpected defect")),
    );
    expect(Exit.isFailure(result)).toBe(true);
  });
});
