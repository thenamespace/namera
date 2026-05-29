import type { Atom } from "effect/unstable/reactivity";
import type { AsyncResult } from "effect/unstable/reactivity/AsyncResult";

import { Effect } from "effect";

import { AtomRegistry } from "effect/unstable/reactivity";

export function ensureAtomData<A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult<A, E>>,
) {
  return Effect.runPromise(
    AtomRegistry.getResult(registry, atom, {
      suspendOnWaiting: true,
    }),
  );
}

export function refreshAtomData<A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult<A, E>>,
) {
  registry.refresh(atom);
  return ensureAtomData(registry, atom);
}
