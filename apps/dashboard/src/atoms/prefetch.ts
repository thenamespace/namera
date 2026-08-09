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
