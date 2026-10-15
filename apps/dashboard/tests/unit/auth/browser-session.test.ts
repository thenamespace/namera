import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import { HttpApiError } from "effect/http-api";

import {
  recoverSignedOutSession,
  revalidateRejectedAccess,
} from "../../../src/atoms/auth/browser-session";

describe("browser session recovery", () => {
  it("revalidates denied access but never loops on the bootstrap request", () => {
    let refreshes = 0;
    const refresh = () => {
      refreshes += 1;
    };
    for (const error of [new HttpApiError.Unauthorized(), new HttpApiError.Forbidden()]) {
      revalidateRejectedAccess(error, refresh);
      revalidateRejectedAccess(error, refresh, true);
    }
    expect(refreshes).toBe(2);
    for (const error of [null, new Error("offline"), new HttpApiError.InternalServerError()]) {
      revalidateRejectedAccess(error, refresh);
    }
    expect(refreshes).toBe(2);
  });
  it.effect("treats only Unauthorized as signed out", () =>
    Effect.gen(function* () {
      expect(
        yield* recoverSignedOutSession(Effect.fail(new HttpApiError.Unauthorized())),
      ).toBeNull();
      expect(yield* recoverSignedOutSession(Effect.succeed({ authenticated: true }))).toEqual({
        authenticated: true,
      });
    }),
  );

  it.effect("preserves server, permission and transport failures", () =>
    Effect.gen(function* () {
      const errors = [
        new HttpApiError.InternalServerError(),
        new HttpApiError.Forbidden(),
        new Error("offline"),
      ];
      const failures = yield* Effect.all(
        errors.map((error) => recoverSignedOutSession(Effect.fail(error)).pipe(Effect.flip)),
      );
      failures.forEach((failure, index) => expect(failure).toBe(errors[index]));
    }),
  );

  it.effect("does not turn defects into signed-out sessions", () =>
    Effect.gen(function* () {
      const defect = new Error("unexpected defect");
      const result = yield* Effect.exit(recoverSignedOutSession(Effect.die(defect)));
      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) expect(Cause.squash(result.cause)).toBe(defect);
    }),
  );
});
