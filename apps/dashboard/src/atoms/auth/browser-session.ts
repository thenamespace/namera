import { Effect, Predicate } from "effect";

/** Only an explicit authentication rejection represents a signed-out browser. */
export const recoverSignedOutSession = <A, E, R>(request: Effect.Effect<A, E, R>) =>
  request.pipe(
    Effect.catch((error) =>
      Predicate.isTagged(error, "Unauthorized") ? Effect.succeed(null) : Effect.fail(error),
    ),
  );
