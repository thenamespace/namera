import { Effect, Layer, Redacted } from "effect";

import { AuthenticatedUser, Authorization, Unauthorized } from "@namera-ai/api";
import { AdminDatabase } from "@namera-ai/database";

export const AuthMiddleware = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const db = yield* AdminDatabase.AdminDatabase;
    return {
      authToken: (effect, { credential }) =>
        Effect.provideServiceEffect(
          effect,
          AuthenticatedUser,
          Effect.gen(function* () {
            const sessionDetails = yield* db.query.session
              .findFirst({
                where: {
                  token: { eq: Redacted.value(credential) },
                },
                with: {
                  user: true,
                },
              })
              .pipe(Effect.catch(() => Effect.fail(new Unauthorized())));

            if (
              !sessionDetails?.user ||
              sessionDetails.expiresAt < new Date()
            ) {
              return yield* Effect.fail(new Unauthorized());
            }

            const { user, ...session } = sessionDetails;

            yield* Effect.annotateCurrentSpan("userId", user.id);
            return { session, user };
          }).pipe(Effect.withSpan("getCurrentUser")),
        ),
    };
  }),
);
