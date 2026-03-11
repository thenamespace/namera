import { Authorization, Unauthorized } from "@namera-ai/api";
import { AdminDatabase } from "@namera-ai/database";
import { Effect, Layer, Redacted } from "effect";

export const authorizationMiddleware = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const db = yield* AdminDatabase;

    return {
      authToken: (token) =>
        Effect.gen(function* () {
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

          if (!sessionDetails?.user || sessionDetails.expiresAt < new Date()) {
            return yield* Effect.fail(new Unauthorized());
          }

          const { user, ...session } = sessionDetails;
          return { session, user };
        }),
    };
  }),
);
