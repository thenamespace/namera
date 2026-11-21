import * as Effect from "effect/Effect";

/**
 * An SDK operation with a dual API: calling it returns a Promise, and `effect` returns the same
 * operation as an Effect with typed failures.
 *
 * **Details**
 *
 * Both forms run one implementation, so the Promise rejects with exactly the failure the Effect
 * would fail with.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface Action<Parameters, Success, Failure> {
  (parameters: Parameters, options?: Effect.RunOptions): Promise<Success>;

  readonly effect: (parameters: Parameters) => Effect.Effect<Success, Failure>;
}

/**
 * Creates an `Action` from its Effect implementation.
 *
 * **When to use**
 *
 * Use to define every public SDK operation, so Promise and Effect callers share one implementation.
 *
 * **Gotchas**
 *
 * The implementation must not require services: the Promise form runs it with no context.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const make = <Parameters, Success, Failure>(
  effect: (parameters: Parameters) => Effect.Effect<Success, Failure>,
) => {
  const action: Action<Parameters, Success, Failure> = Object.assign(
    (parameters: Parameters, options?: Effect.RunOptions) =>
      Effect.runPromise(effect(parameters), options),
    { effect },
  );

  return Object.freeze(action);
};
