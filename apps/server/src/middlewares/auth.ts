import { Authorization, Unauthorized } from "@repo/api";
import { Database } from "@repo/database";
import { Effect, Layer, Redacted } from "effect";

export const authorizationMiddleware = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const db = yield* Database;

    return {
      authToken: (token) =>
        Effect.gen(function* () {
          yield* Effect.log("authToken", Redacted.value(token));
          const sessionDetails = yield* db.query.session
            .findFirst({
              where: {
                token: { eq: Redacted.value(token) },
              },
              with: {
                user: true,
              },
            })
            .pipe(Effect.catchAll(() => Effect.fail(new Unauthorized())));

          if (!sessionDetails?.user)
            return yield* Effect.fail(new Unauthorized());

          return sessionDetails.user;
        }),
    };
  }),
);
