import { Effect } from "effect";

/** The Effect behind an action, for callers who compose with Effect. */
export type ActionEffect<Parameters, Success, Failure> = (
  parameters: Parameters,
) => Effect.Effect<Success, Failure>;

/**
 * An SDK operation with a dual API: call it for a Promise, or use `.effect` for the Effect with typed
 * failures. Both run the same implementation.
 */
export interface Action<Parameters, Success, Failure> {
  (parameters: Parameters, options?: Effect.RunOptions): Promise<Success>;

  readonly effect: ActionEffect<Parameters, Success, Failure>;
}

export const defineAction = <Parameters, Success, Failure>(
  implementation: ActionEffect<Parameters, Success, Failure>,
): Action<Parameters, Success, Failure> => {
  const action = (parameters: Parameters, options?: Effect.RunOptions): Promise<Success> =>
    Effect.runPromise(implementation(parameters), options);

  return Object.freeze(
    Object.defineProperty(action, "effect", {
      value: implementation,
      enumerable: true,
      configurable: false,
      writable: false,
    }),
  ) as Action<Parameters, Success, Failure>;
};
