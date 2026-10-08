import { Effect } from "effect";
import { AtomRegistry, type AsyncResult, type Atom } from "effect/reactivity";

export const prefetchQuery = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  signal: AbortSignal,
) =>
  Effect.runPromise(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }), { signal });
