import { Effect, Predicate } from "effect";

export const isAccessRejection = (error: unknown) =>
  Predicate.isTagged(error, "Unauthorized") || Predicate.isTagged(error, "Forbidden");

/** Never refresh the session in response to its own rejection. */
export function revalidateRejectedAccess(
  error: unknown,
  refreshSession: () => void,
  isSessionRequest = false,
) {
  if (!isSessionRequest && isAccessRejection(error)) refreshSession();
}

/** Only an explicit authentication rejection represents a signed-out browser. */
export const recoverSignedOutSession = <A, E, R>(request: Effect.Effect<A, E, R>) =>
  request.pipe(
    Effect.catch((error) =>
      Predicate.isTagged(error, "Unauthorized") ? Effect.succeed(null) : Effect.fail(error),
    ),
  );
