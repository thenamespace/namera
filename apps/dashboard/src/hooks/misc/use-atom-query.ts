import type { AsyncResult, Atom } from "effect/unstable/reactivity";

import { useAtomValue } from "@effect/atom-react";

import { toQueryLike } from "@/lib/atom";

export function useAtomQuery<A, E>(
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) {
  return toQueryLike(useAtomValue(atom));
}
