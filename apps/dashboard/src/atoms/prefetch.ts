import { Effect } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import type { AsyncResult, Atom } from "effect/unstable/reactivity";

export const prefetchQuery = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  signal?: AbortSignal,
): Promise<A> =>
  Effect.runPromise(
    AtomRegistry.getResult(registry, atom, {
      suspendOnWaiting: true,
    }),
    { signal },
  );

/**
 * Starts the same cached query used by React hooks without suspending route rendering.
 * Expected request failures remain available on the atom for the owning component.
 */
export const startPrefetchQuery = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  signal?: AbortSignal,
): void => {
  void prefetchQuery(registry, atom, signal).catch(() => undefined);
};
